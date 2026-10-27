// Herramientas para que el equipo resuelva solo lo que el 27-oct-2026 hubo que
// hacer a mano con Gustavo Vallegra: encontrar la planta de un cliente que no
// estaba vinculada, vincularla, y bajar el detalle cada 5 minutos del inversor
// (el "History Data" de la web de Growatt) para diagnosticar.
//
// historial_inversor usa la WEB de Growatt (growatt/web.client.ts), no la Open
// API: es la única fuente con los datos por string cada 5 minutos.

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
import { historialTlx, webConfigurada, type RegistroTlx } from "../../../services/reportesFv/growatt/web.client.js";
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
        "Trae el 'History Data' del inversor Growatt de un proyecto: cada ~5 minutos, la tensión y " +
        "corriente de cada entrada de paneles (PV1, PV2…), la potencia, la red, la temperatura y los " +
        "códigos de falla. Es la herramienta para diagnosticar a fondo: entradas sin nada conectado, " +
        "dos strings en la misma entrada (corriente clavada en el máximo), cortes de comunicación " +
        "(el último dato antes del corte), sobretensión de red. Devuelve el análisis, el detalle por " +
        "hora y, con `excel: true`, un enlace para bajar todos los registros en Excel. Hasta 14 días. " +
        "Solo inversores Growatt MIN/TLX.",
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
      if (!webConfigurada()) return texto("Falta configurar en el servidor el usuario de la web de Growatt (GROWATT_WEB_USER / GROWATT_WEB_PASS). Avisar a quien administra Voltia PM.");

      const p = await prisma.project.findFirst({
        where: { id: project_id, deletedAt: null },
        select: {
          clientName: true,
          capacityKwp: true,
          growattPlant: { select: { plantId: true, name: true, ignorada: true, devices: { select: { deviceSn: true, tipo: true } } } },
        },
      });
      if (!p) return texto(`No encontré el proyecto ${project_id}.`);
      if (!p.growattPlant || p.growattPlant.ignorada) {
        return texto(`${p.clientName} no tiene una planta Growatt vinculada. Buscarla con plantas_sin_vincular y vincularla con vincular_planta.`);
      }
      let inversores = p.growattPlant.devices.filter((d) => d.tipo === 7).map((d) => d.deviceSn);
      if (!inversores.length) {
        try {
          inversores = (await listarDispositivos(p.growattPlant.plantId.toString())).filter((d) => d.tipo === 7).map((d) => d.deviceSn);
        } catch {
          /* se informa abajo */
        }
      }
      if (!inversores.length) return texto(`${p.clientName}: no encontré inversores MIN/TLX en la planta (otros modelos todavía no están soportados por esta vía).`);

      const kwp = p.capacityKwp ? Number(p.capacityKwp) : null;
      const bloques: string[] = [`${p.clientName} — historial del ${desde}${fin !== desde ? ` al ${fin}` : ""} (web de Growatt, hora de Uruguay)`];
      const todos: Array<{ sn: string; rs: RegistroTlx[] }> = [];
      for (const sn of inversores) {
        let rs: RegistroTlx[];
        try {
          rs = await historialTlx(sn, desde, fin);
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
          `INVERSOR ${sn}\n` +
            campos([
              ["Registros", `${a.registros} (${Object.entries(a.porDia).map(([d, n]) => `${d.slice(8, 10)}/${d.slice(5, 7)}: ${n}`).join(", ")})`],
              ["Primero / último", `${a.primero} / ${a.ultimo}`],
              ["Pico de salida", `${a.pacMax} W`],
              ["Tensión de red máxima", a.vacMax != null ? `${a.vacMax} V` : null],
              [
                "Último registro",
                `${u.time}: ${r1(u.pac)} W, estado ${u.status}, falla ${u.faultType ?? 0}, advertencia ${u.warnCode ?? 0}, ${r1(u.temp1)} °C, red ${r1(u.vac1)} V / ${r1(u.fac)} Hz`,
              ],
            ]) +
            "\nEntradas de paneles (máximos del período):\n" +
            a.entradas.map((e) => `PV${e.entrada}: ${e.vMax} V · ${e.iMax} A · ${e.energiaKwh} kWh`).join("\n"),
        );
        bloques.push(a.avisos.length ? "⚠️ AVISOS\n" + a.avisos.map((x) => `- ${x}`).join("\n") : "Sin anomalías detectadas.");

        // Detalle por hora (promedio), compacto.
        const horas = new Map<string, RegistroTlx[]>();
        for (const r of rs) {
          const k = r.time.slice(0, 13);
          horas.set(k, [...(horas.get(k) ?? []), r]);
        }
        const prom = (xs: (number | null)[]) => {
          const v = xs.filter((x): x is number => x != null);
          return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
        };
        const nIn = a.entradas.length;
        bloques.push(
          "POR HORA (promedios): hora · Pac W · " + a.entradas.map((e) => `PV${e.entrada} V/A`).join(" · ") + " · red V\n" +
            [...horas.entries()]
              .map(([k, xs]) =>
                `${k.slice(8, 10)}/${k.slice(5, 7)} ${k.slice(11, 13)}h · ${r1(prom(xs.map((x) => x.pac)))} · ` +
                a.entradas.slice(0, nIn).map((e) => `${r1(prom(xs.map((x) => x.vpv[e.entrada - 1])))}/${r1(prom(xs.map((x) => x.ipv[e.entrada - 1])))}`).join(" · ") +
                ` · ${r1(prom(xs.map((x) => x.vac1)))}`,
              )
              .join("\n"),
        );
      }

      if (excel && todos.some((t) => t.rs.length)) {
        const wb = new ExcelJS.Workbook();
        for (const { sn, rs } of todos) {
          const ws = wb.addWorksheet(sn.slice(0, 31));
          ws.columns = [
            { header: "Hora", key: "time", width: 20 },
            { header: "Estado", key: "status" },
            { header: "Ppv (W)", key: "ppv" },
            { header: "Pac (W)", key: "pac" },
            ...[1, 2, 3, 4].flatMap((i) => [
              { header: `Vpv${i} (V)`, key: `vpv${i}` },
              { header: `Ipv${i} (A)`, key: `ipv${i}` },
              { header: `Ppv${i} (W)`, key: `ppv${i}` },
            ]),
            { header: "Red (V)", key: "vac1" },
            { header: "Frecuencia (Hz)", key: "fac" },
            { header: "Temp. inversor (°C)", key: "temp1" },
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
              ...Object.fromEntries([1, 2, 3, 4].flatMap((i) => [[`vpv${i}`, r.vpv[i - 1]], [`ipv${i}`, r.ipv[i - 1]], [`ppv${i}`, r.ppvN[i - 1]]])),
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
        "Cómo leerlo: una entrada en ~0 V mientras otra produce no tiene nada conectado. Una entrada clavada en su " +
          "corriente máxima está recortando. Si el último registro es de un día pasado a media tarde, el datalogger dejó " +
          "de comunicar ahí. Lo que se deduce es una pista para revisar en el lugar.",
      );
      return texto(...bloques);
    },
  );
}
