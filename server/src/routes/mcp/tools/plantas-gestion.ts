// Herramientas para que el equipo resuelva solo lo que el 27-oct-2026 hubo que
// hacer a mano con Gustavo Vallegra: encontrar la planta de un cliente que no
// estaba vinculada, vincularla, y bajar el detalle cada 5 minutos del inversor
// (el "History Data" de la web de Growatt) para diagnosticar.
//
// historial_inversor y alarmas_planta usan la WEB de Growatt
// (growatt/web.client.ts), no la Open API: es la única fuente con los datos por
// entrada y por string cada 5 minutos y con el registro de alarmas.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, FileAttachmentTipo, Module } from "@prisma/client";
import ExcelJS from "exceljs";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import { saveBufferAsAttachment } from "../../../services/file-storage.service.js";
import { listarDispositivos } from "../../../services/reportesFv/growatt/client.js";
import { analizarHistorial } from "../../../services/reportesFv/growatt/historial-analisis.js";
import {
  listarPlantasConSugerencias,
  normalizar,
  sincronizarPlantas,
  vincularPlanta,
} from "../../../services/reportesFv/growatt/plantas.service.js";
import {
  alarmasPlanta,
  historialInversor,
  tipoConHistorial,
  webConfigurada,
  type AlarmaGrowatt,
  type RegistroInversor,
  type TipoInversorWeb,
} from "../../../services/reportesFv/growatt/web.client.js";
import { sincronizarPlantasHuawei, vincularPlantaHuawei } from "../../../services/reportesFv/huawei/plantas.service.js";
import { hoyUy } from "../../../services/reportesFv/energia/curva.service.js";
import { esDiaValido, diasEntre } from "../../../services/reportesFv/monitor/dias.js";
import { requirePermission, type McpUser } from "../context.js";
import { buildDownloadUrl } from "../descargas.routes.js";
import { campos, texto } from "../format.js";

const diaSchema = z.string().refine(esDiaValido, "Fecha AAAA-MM-DD");
const r1 = (n: number | null | undefined) => (n == null ? "—" : String(Math.round(n * 10) / 10));

export function registerPlantasGestionTools(server: McpServer, user: McpUser) {
  // ─── Plantas sin vincular ────────────────────────────────────────────────
  server.registerTool(
    "plantas_sin_vincular",
    {
      title: "Plantas de monitoreo sin vincular",
      description:
        "Lista las plantas de Growatt y de Huawei que todavía no están asociadas a ningún " +
        "proyecto de Voltia PM, con el proyecto que más se parece por nombre. Una planta sin " +
        "vincular no entra en el monitoreo diario ni en los reportes. Con `busqueda` filtra por " +
        "nombre; con `sincronizar: true` primero trae de las APIs las plantas nuevas (tarda más). " +
        "Para vincular, usar vincular_planta.",
      inputSchema: {
        busqueda: z.string().optional().describe("Parte del nombre de la planta o del cliente"),
        sincronizar: z.boolean().optional().describe("Traer antes las plantas nuevas de Growatt y Huawei"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ busqueda, sincronizar }) => {
      await requirePermission(user, Module.EXPERIENCIA_CLIENTES, Action.VIEW);
      const notas: string[] = [];
      if (sincronizar) {
        await requirePermission(user, Module.EXPERIENCIA_CLIENTES, Action.EDIT);
        try {
          const g = await sincronizarPlantas();
          notas.push(`Growatt: ${g.nuevas} plantas nuevas (de ${g.total}).`);
        } catch (e) {
          notas.push(`Growatt no respondió (${e instanceof Error ? e.message : e}).`);
        }
        try {
          const h = await sincronizarPlantasHuawei();
          notas.push(`Huawei: ${h.nuevas} plantas nuevas (de ${h.total}).`);
        } catch (e) {
          notas.push(`Huawei no respondió (${e instanceof Error ? e.message : e}).`);
        }
      }
      const filtro = busqueda ? normalizar(busqueda) : null;
      const gw = (await listarPlantasConSugerencias()).filter(
        (p) => !p.projectId && !p.ignorada && (!filtro || normalizar(p.name).includes(filtro)),
      );

      const hwPlantas = await prisma.huaweiPlant.findMany({
        where: { projectId: null, ignorada: false },
        select: { plantCode: true, name: true, capacityKwp: true },
        orderBy: { name: "asc" },
      });
      const proyectos = await prisma.project.findMany({
        where: { deletedAt: null },
        select: { id: true, code: true, clientName: true, huaweiPlant: { select: { id: true } }, growattPlant: { select: { plantId: true } } },
      });
      // Parecido por nombre contra TODOS los proyectos (la sugerencia del panel
      // sólo mira los ya habilitados, y una planta nueva suele ser de una obra
      // que todavía no lo está).
      const parecidos = (nombre: string, libre: (p: (typeof proyectos)[number]) => boolean) => {
        const n = normalizar(nombre);
        return proyectos
          .filter((pr) => libre(pr) && (normalizar(pr.clientName) === n || normalizar(pr.clientName).includes(n) || n.includes(normalizar(pr.clientName))))
          .slice(0, 3);
      };
      const gwSug = gw.map((p) => ({ ...p, sug: parecidos(p.name, (pr) => !pr.growattPlant) }));
      const hw = hwPlantas
        .filter((p) => !filtro || normalizar(p.name).includes(filtro))
        .map((p) => ({ ...p, sug: parecidos(p.name, (pr) => !pr.huaweiPlant) }));

      const lineas = [
        ...gwSug.map(
          (p) =>
            `- GROWATT ${p.plantId} · "${p.name.trim()}"${p.peakPowerKw ? ` · ${p.peakPowerKw} kWp` : ""}` +
            (p.sug.length ? ` → parecido a: ${p.sug.map((s) => `${s.clientName} (${s.code}, project_id ${s.id})`).join("; ")}` : " → sin proyecto parecido"),
        ),
        ...hw.map(
          (p) =>
            `- HUAWEI ${p.plantCode} · "${p.name}"${p.capacityKwp ? ` · ${Number(p.capacityKwp)} kWp` : ""}` +
            (p.sug.length ? ` → parecido a: ${p.sug.map((s) => `${s.clientName} (${s.code}, project_id ${s.id})`).join("; ")}` : " → sin proyecto parecido"),
        ),
      ];
      return texto(
        ...notas,
        lineas.length ? `${lineas.length} planta${lineas.length === 1 ? "" : "s"} sin vincular` : "No hay plantas sin vincular con ese filtro.",
        lineas.join("\n") || null,
        lineas.length
          ? "El parecido es solo por nombre: confirmar con el usuario antes de vincular. Si el cliente no aparece, puede que su planta todavía no esté en el catálogo: probar con sincronizar: true."
          : null,
      );
    },
  );

  // ─── Vincular planta ─────────────────────────────────────────────────────
  server.registerTool(
    "vincular_planta",
    {
      title: "Vincular una planta de monitoreo a un proyecto",
      description:
        "Asocia una planta de Growatt o de Huawei a un proyecto de Voltia PM. Desde ese momento " +
        "entra en el monitoreo diario, la vista de energía y los reportes. Sin `confirmar: true` " +
        "solo muestra qué haría. El id de la planta sale de plantas_sin_vincular. Si el proyecto " +
        "ya tiene otra planta de la misma marca, no la reemplaza salvo `reemplazar: true`.",
      inputSchema: {
        marca: z.enum(["GROWATT", "HUAWEI"]),
        planta_id: z.string().min(1).describe("Growatt: número (ej. 11170641). Huawei: código (ej. NE=55650978)"),
        project_id: z.string().min(1),
        reemplazar: z.boolean().optional(),
        confirmar: z.boolean().optional(),
      },
    },
    async ({ marca, planta_id, project_id, reemplazar, confirmar }) => {
      await requirePermission(user, Module.EXPERIENCIA_CLIENTES, Action.EDIT);
      const proyecto = await prisma.project.findFirst({
        where: { id: project_id, deletedAt: null },
        select: {
          code: true,
          clientName: true,
          growattPlant: { select: { plantId: true, name: true } },
          huaweiPlant: { select: { plantCode: true, name: true } },
        },
      });
      if (!proyecto) return texto(`No encontré el proyecto ${project_id}.`);

      let planta: { nombre: string; vinculadaA: string | null } | null = null;
      if (marca === "GROWATT") {
        if (!/^\d+$/.test(planta_id)) return texto("El id de una planta Growatt es un número.");
        const p = await prisma.growattPlant.findUnique({
          where: { plantId: BigInt(planta_id) },
          select: { name: true, project: { select: { clientName: true, code: true } } },
        });
        if (p) planta = { nombre: p.name.trim(), vinculadaA: p.project ? `${p.project.clientName} (${p.project.code})` : null };
      } else {
        const p = await prisma.huaweiPlant.findUnique({
          where: { plantCode: planta_id },
          select: { name: true, project: { select: { clientName: true, code: true } } },
        });
        if (p) planta = { nombre: p.name, vinculadaA: p.project ? `${p.project.clientName} (${p.project.code})` : null };
      }
      if (!planta) return texto(`No encontré la planta ${marca} ${planta_id} en el catálogo. Probar plantas_sin_vincular con sincronizar: true.`);

      const existente =
        marca === "GROWATT"
          ? proyecto.growattPlant && proyecto.growattPlant.plantId.toString() !== planta_id
            ? `${proyecto.growattPlant.name.trim()} (${proyecto.growattPlant.plantId})`
            : null
          : proyecto.huaweiPlant && proyecto.huaweiPlant.plantCode !== planta_id
            ? `${proyecto.huaweiPlant.name} (${proyecto.huaweiPlant.plantCode})`
            : null;
      const otraMarca = marca === "GROWATT" ? proyecto.huaweiPlant : proyecto.growattPlant;

      const resumen = campos([
        ["Planta", `${marca} ${planta_id} · "${planta.nombre}"`],
        ["Proyecto", `${proyecto.clientName} (${proyecto.code})`],
        ["La planta hoy está vinculada a", planta.vinculadaA ?? "ninguno"],
        ["El proyecto ya tiene", existente ? `otra planta ${marca}: ${existente}` : null],
        ["Ojo", otraMarca ? `el proyecto también tiene una planta de la otra marca vinculada` : null],
      ]);
      if (existente && !reemplazar) {
        return texto(resumen, "No vinculé nada: el proyecto ya tiene otra planta de esa marca. Si hay que cambiarla, volver a pedir con reemplazar: true.");
      }
      if (!confirmar) return texto(resumen, "Vista previa: no se cambió nada. Para vincular, volver a llamar con confirmar: true.");

      if (marca === "GROWATT") {
        if (existente && proyecto.growattPlant) {
          await vincularPlanta(proyecto.growattPlant.plantId.toString(), { projectId: null }, user.id);
        }
        await vincularPlanta(planta_id, { projectId: project_id }, user.id);
      } else {
        if (existente && proyecto.huaweiPlant) await vincularPlantaHuawei(proyecto.huaweiPlant.plantCode, null, user.id);
        await vincularPlantaHuawei(planta_id, project_id, user.id);
      }
      return texto(
        resumen,
        `Listo: la planta quedó vinculada a ${proyecto.clientName}. El monitoreo la revisa desde la próxima corrida (8:00). ` +
          "Si el cliente tiene reporte mensual, revisar su configuración.",
      );
    },
  );

  // ─── Historial del inversor (web de Growatt) ─────────────────────────────
  server.registerTool(
    "historial_inversor",
    {
      title: "Historial del inversor cada 5 minutos (Growatt)",
      description:
        "Trae el 'History Data' del inversor Growatt de un proyecto: cada ~5 minutos, el estado (generando / en falla), " +
        "la tensión y corriente de cada entrada de paneles (PV1, PV2…), la corriente de cada string (en los MAX), " +
        "la resistencia de aislamiento (pvIso) y la corriente de fuga, la potencia, la red, la temperatura y los " +
        "códigos de falla; y además el registro de alarmas de la planta en esas fechas (código, nombre y solución " +
        "que sugiere Growatt). Es LA herramienta para diagnosticar a fondo: horas en falla con sol, aislamiento bajo " +
        "(arranca tarde a la mañana), entradas sin nada conectado, dos strings en la misma entrada, strings caídos, " +
        "cortes de comunicación, sobretensión de red. Devuelve el análisis, el detalle por hora y, con `excel: true`, " +
        "un enlace para bajar todos los registros en Excel. Hasta 14 días. Todos los inversores Growatt de Voltia " +
        "(MIN/TLX y MAX/MID/MAC).",
      inputSchema: {
        project_id: z.string().min(1),
        desde: diaSchema.describe("AAAA-MM-DD"),
        hasta: diaSchema.optional().describe("AAAA-MM-DD (por defecto, el mismo día)"),
        excel: z.boolean().optional().describe("Además, generar el Excel con todos los registros"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id, desde, hasta, excel }) => {
      await requirePermission(user, Module.EXPERIENCIA_CLIENTES, Action.VIEW);
      const fin = hasta ?? desde;
      if (fin < desde) return texto("La fecha 'hasta' es anterior a 'desde'.");
      if (diasEntre(desde, fin) > 13) return texto("Son hasta 14 días por consulta.");
      if (!webConfigurada()) return texto(FALTA_WEB);

      const p = await plantaDeProyecto(project_id);
      if (typeof p === "string") return texto(p);
      let inversores = p.growattPlant.devices
        .filter((d) => tipoConHistorial(d.tipo))
        .map((d) => ({ sn: d.deviceSn, tipo: d.tipo as TipoInversorWeb }));
      if (!inversores.length) {
        try {
          inversores = (await listarDispositivos(p.growattPlant.plantId.toString()))
            .filter((d) => tipoConHistorial(d.tipo))
            .map((d) => ({ sn: d.deviceSn, tipo: d.tipo as TipoInversorWeb }));
        } catch {
          /* se informa abajo */
        }
      }
      if (!inversores.length) {
        const tipos = [...new Set(p.growattPlant.devices.map((d) => d.tipo))].join(", ") || "ninguno";
        return texto(`${p.clientName}: no encontré inversores Growatt MIN/TLX ni MAX en la planta (tipos de equipo: ${tipos}).`);
      }

      const kwp = p.capacityKwp ? Number(p.capacityKwp) : null;
      const bloques: string[] = [`${p.clientName} — historial del ${desde}${fin !== desde ? ` al ${fin}` : ""} (web de Growatt, hora de Uruguay)`];
      const todos: Array<{ sn: string; rs: RegistroInversor[] }> = [];
      for (const { sn, tipo } of inversores) {
        let rs: RegistroInversor[];
        try {
          rs = await historialInversor(sn, tipo, desde, fin);
        } catch (e) {
          bloques.push(`Inversor ${sn}: no se pudo leer (${e instanceof Error ? e.message : e}).`);
          continue;
        }
        todos.push({ sn, rs });
        if (!rs.length) {
          bloques.push(`Inversor ${sn}: Growatt no tiene ningún registro en esas fechas (el equipo no comunicó).`);
          continue;
        }
        const a = analizarHistorial(rs, { kwp: inversores.length === 1 ? kwp : null, hasta: fin, hoy: hoyUy() });
        const u = a.ultimoRegistro!;
        bloques.push(
          `INVERSOR ${sn} (${tipo === 4 ? "MAX/MID/MAC" : "MIN/TLX"})\n` +
            campos([
              ["Registros", `${a.registros} (${Object.entries(a.porDia).map(([d, n]) => `${d.slice(8, 10)}/${d.slice(5, 7)}: ${n}`).join(", ")})`],
              ["Primero / último", `${a.primero} / ${a.ultimo}`],
              ["Pico de salida", `${a.pacMax} W`],
              ["Tensión de red máxima", a.vacMax != null ? `${a.vacMax} V` : null],
              [
                "Aislamiento (pvIso)",
                a.aislamiento
                  ? [
                      a.aislamiento.minEnFalla != null ? `en falla ${a.aislamiento.minEnFalla}–${a.aislamiento.maxEnFalla} kΩ` : null,
                      a.aislamiento.minGenerando != null ? `generando ≥ ${a.aislamiento.minGenerando} kΩ` : null,
                    ].filter(Boolean).join(" · ")
                  : null,
              ],
              ["Corriente de fuga máx.", a.gfciMax ? `${a.gfciMax} mA` : null],
              [
                "Último registro",
                `${u.time}: ${r1(u.pac)} W, estado ${u.status}, falla ${u.faultType ?? 0}, advertencia ${u.warnCode ?? 0}, ${r1(u.temp1)} °C, red ${r1(u.vac1)} V / ${r1(u.fac)} Hz`,
              ],
            ]) +
            "\nEntradas de paneles (máximos del período):\n" +
            a.entradas.map((e) => `PV${e.entrada}: ${e.vMax} V · ${e.iMax} A · ${e.energiaKwh} kWh`).join("\n") +
            (a.strings.length
              ? "\nStrings (corriente máxima · % del tiempo sin corriente mientras los demás producían):\n" +
                a.strings.map((x) => `S${x.string}: ${x.iMax} A · ${x.pctSinCorriente} %`).join("\n")
              : ""),
        );
        bloques.push(a.avisos.length ? "⚠️ AVISOS\n" + a.avisos.map((x) => `- ${x}`).join("\n") : "Sin anomalías detectadas.");

        // Detalle por hora (promedio), compacto.
        const horas = new Map<string, RegistroInversor[]>();
        for (const r of rs) {
          const k = r.time.slice(0, 13);
          horas.set(k, [...(horas.get(k) ?? []), r]);
        }
        const prom = (xs: (number | null)[]) => {
          const v = xs.filter((x): x is number => x != null);
          return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
        };
        const conIso = a.aislamiento != null;
        bloques.push(
          "POR HORA (promedios): hora · Pac W · registros en falla · " +
            a.entradas.map((e) => `PV${e.entrada} V/A`).join(" · ") +
            " · red V" +
            (conIso ? " · pvIso kΩ" : "") +
            "\n" +
            [...horas.entries()]
              .map(
                ([k, xs]) =>
                  `${k.slice(8, 10)}/${k.slice(5, 7)} ${k.slice(11, 13)}h · ${r1(prom(xs.map((x) => x.pac)))} · ${xs.filter((x) => x.status === 3).length}/${xs.length} · ` +
                  a.entradas.map((e) => `${r1(prom(xs.map((x) => x.vpv[e.entrada - 1] ?? null)))}/${r1(prom(xs.map((x) => x.ipv[e.entrada - 1] ?? null)))}`).join(" · ") +
                  ` · ${r1(prom(xs.map((x) => x.vac1)))}` +
                  (conIso ? ` · ${r1(prom(xs.map((x) => x.pvIso)))}` : ""),
              )
              .join("\n"),
        );
      }

      try {
        const alarmas = await alarmasPlanta(p.growattPlant.plantId.toString(), desde, fin);
        bloques.push(textoAlarmas(alarmas));
      } catch (e) {
        bloques.push(`REGISTRO DE ALARMAS: no se pudo leer (${e instanceof Error ? e.message : e}).`);
      }

      if (excel && todos.some((t) => t.rs.length)) {
        const wb = new ExcelJS.Workbook();
        for (const { sn, rs } of todos) {
          const ws = wb.addWorksheet(sn.slice(0, 31));
          // Solo las entradas y strings que alguna vez tuvieron algo.
          const usadas = (xs: (n: RegistroInversor) => (number | null)[]) =>
            [...Array(Math.max(0, ...rs.map((r) => xs(r).length))).keys()].filter((i) => rs.some((r) => (xs(r)[i] ?? 0) > 0.5));
          const entradas = usadas((r) => r.vpv);
          const strs = usadas((r) => r.iString);
          ws.columns = [
            { header: "Hora", key: "time", width: 20 },
            { header: "Estado (1 genera, 3 falla)", key: "status" },
            { header: "Ppv (W)", key: "ppv" },
            { header: "Pac (W)", key: "pac" },
            ...entradas.flatMap((i) => [
              { header: `Vpv${i + 1} (V)`, key: `vpv${i}` },
              { header: `Ipv${i + 1} (A)`, key: `ipv${i}` },
              { header: `Ppv${i + 1} (W)`, key: `ppv${i}` },
            ]),
            ...strs.map((i) => ({ header: `String ${i + 1} (A)`, key: `str${i}` })),
            { header: "Red (V)", key: "vac1" },
            { header: "Frecuencia (Hz)", key: "fac" },
            { header: "Temp. inversor (°C)", key: "temp1" },
            { header: "Aislamiento pvIso (kΩ)", key: "pvIso" },
            { header: "Fuga GFCI (mA)", key: "gfci" },
            { header: "Generado hoy (kWh)", key: "eacToday" },
            { header: "Exportado hoy (kWh)", key: "etoGridToday" },
            { header: "Comprado hoy (kWh)", key: "etoUserToday" },
            { header: "Consumo hoy (kWh)", key: "elocalLoadToday" },
            { header: "A la red (W)", key: "pacToGrid" },
            { header: "De la red (W)", key: "pacToUser" },
            { header: "Consumo (W)", key: "pacToLocalLoad" },
            { header: "Falla", key: "faultType" },
            { header: "Advertencia", key: "warnCode" },
            { header: "Recorte", key: "deratingMode" },
            { header: "% potencia", key: "realOPPercent" },
          ];
          for (const r of rs) {
            ws.addRow({
              ...r,
              ...Object.fromEntries(entradas.flatMap((i) => [[`vpv${i}`, r.vpv[i]], [`ipv${i}`, r.ipv[i]], [`ppv${i}`, r.ppvN[i]]])),
              ...Object.fromEntries(strs.map((i) => [`str${i}`, r.iString[i]])),
            });
          }
          ws.getRow(1).font = { bold: true };
          ws.views = [{ state: "frozen", ySplit: 1 }];
        }
        const buffer = Buffer.from(await wb.xlsx.writeBuffer());
        const nombre = `Historial ${p.clientName.trim()} ${desde}${fin !== desde ? `_${fin}` : ""}.xlsx`.replace(/[\\/:*?"<>|]+/g, "_");
        const stored = await saveBufferAsAttachment(buffer, nombre, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", project_id);
        const fa = await prisma.fileAttachment.create({
          data: {
            projectId: project_id,
            filename: stored.filename,
            storedFilename: stored.storedFilename,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            url: stored.url,
            tipo: FileAttachmentTipo.OTRO,
            toolSource: "growatt-historial",
            uploadedById: user.id,
          },
          select: { id: true },
        });
        bloques.push(`EXCEL (todos los registros, también quedó en los documentos del proyecto): ${buildDownloadUrl(user.id, "project-file", fa.id, nombre)}`);
      }

      bloques.push(
        "Cómo leerlo: estado 3 con tensión en las entradas = en falla con sol, energía perdida. Una entrada en ~0 V " +
          "mientras otra produce no tiene nada conectado. Una entrada clavada en su corriente máxima está recortando. " +
          "Si el último registro es de un día pasado a media tarde, el datalogger dejó de comunicar ahí. Lo que se " +
          "deduce es una pista para revisar en el lugar.",
      );
      return texto(...bloques);
    },
  );

  // ─── Alarmas de la planta (web de Growatt) ───────────────────────────────
  server.registerTool(
    "alarmas_planta",
    {
      title: "Registro de alarmas del inversor (Growatt)",
      description:
        "El 'Registro de fallos de la planta' de la web de Growatt para un proyecto: cada alarma con fecha y hora, " +
        "código (ej. Error 203), nombre (ej. PV Isolation Low) y la solución que sugiere Growatt, agrupadas por " +
        "código y por día. Sirve para ver de un vistazo qué fallas tuvo un cliente en meses (hasta 12), cuántas " +
        "veces y desde cuándo; para el detalle minuto a minuto de un día, historial_inversor.",
      inputSchema: {
        project_id: z.string().min(1),
        desde: diaSchema.describe("AAAA-MM-DD"),
        hasta: diaSchema.optional().describe("AAAA-MM-DD (por defecto, hoy)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id, desde, hasta }) => {
      await requirePermission(user, Module.EXPERIENCIA_CLIENTES, Action.VIEW);
      const fin = hasta ?? hoyUy();
      if (fin < desde) return texto("La fecha 'hasta' es anterior a 'desde'.");
      if (diasEntre(desde, fin) > 366) return texto("Son hasta 12 meses por consulta.");
      if (!webConfigurada()) return texto(FALTA_WEB);
      const p = await plantaDeProyecto(project_id);
      if (typeof p === "string") return texto(p);
      const alarmas = await alarmasPlanta(p.growattPlant.plantId.toString(), desde, fin);
      return texto(`${p.clientName} — alarmas del ${desde} al ${fin} (web de Growatt, hora de Uruguay)`, textoAlarmas(alarmas, true));
    },
  );
}

const FALTA_WEB =
  "Falta configurar en el servidor el usuario de la web de Growatt (GROWATT_WEB_USER / GROWATT_WEB_PASS). Avisar a quien administra Voltia PM.";

/** El proyecto con su planta Growatt vinculada, o el texto que explica por qué no. */
async function plantaDeProyecto(projectId: string) {
  const p = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      clientName: true,
      capacityKwp: true,
      growattPlant: { select: { plantId: true, name: true, ignorada: true, devices: { select: { deviceSn: true, tipo: true } } } },
    },
  });
  if (!p) return `No encontré el proyecto ${projectId}.`;
  if (!p.growattPlant || p.growattPlant.ignorada) {
    return `${p.clientName} no tiene una planta Growatt vinculada. Buscarla con plantas_sin_vincular y vincularla con vincular_planta.`;
  }
  return { ...p, growattPlant: p.growattPlant };
}

/** Las alarmas agrupadas por código, con los días y, si se pide, la lista completa. */
function textoAlarmas(alarmas: AlarmaGrowatt[], completo = false): string {
  if (!alarmas.length) return "REGISTRO DE ALARMAS: ninguna en esas fechas.";
  const grupos = new Map<string, AlarmaGrowatt[]>();
  for (const a of alarmas) {
    const k = `${a.codigo} — ${a.nombre}`;
    grupos.set(k, [...(grupos.get(k) ?? []), a]);
  }
  const partes = [`REGISTRO DE ALARMAS (${alarmas.length})`];
  for (const [k, xs] of grupos) {
    const dias = [...new Set(xs.map((x) => x.time.slice(0, 10)))];
    partes.push(
      `${k}: ${xs.length} vez/veces en ${dias.length} día(s), del ${xs[0].time} al ${xs.at(-1)!.time}` +
        (xs[0].modelo ? ` · equipo ${xs[0].sn} (${xs[0].modelo})` : "") +
        `\n  Días: ${dias.map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`).join(", ")}` +
        (xs[0].solucion ? `\n  Solución que sugiere Growatt: ${xs[0].solucion}` : ""),
    );
  }
  if (completo && alarmas.length <= 200) {
    partes.push("DETALLE\n" + alarmas.map((a) => `${a.time} · ${a.sn} · ${a.codigo} ${a.nombre}`).join("\n"));
  }
  return partes.join("\n");
}
