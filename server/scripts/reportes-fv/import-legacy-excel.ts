// Migración one-off de las planillas del sistema Python a Voltia PM.
//
// DRY-RUN POR DEFAULT: sin --commit no escribe nada, sólo imprime el informe de
// matching y las diferencias. La idea es revisarlo antes de aplicar.
//
//   docker compose exec server npx tsx scripts/reportes-fv/import-legacy-excel.ts \
//     [--dir tmp-legacy-import] [--commit] [--crear-faltantes]
//
// Orden: tarifas → plantas Growatt → configs → destinatarios → lecturas →
// recálculo → verificación contra el histórico emitido.
//
// El último paso es el que valida todo de una: si los cálculos que produce el
// sistema nuevo coinciden con las 282 filas del histórico, entonces el matching,
// las tarifas, el motor y la persistencia están bien.

import { AuditAction, AuditEntityType, FranjaHoraria, Prisma, ProjectStatus, TarifaUte } from "@prisma/client";

import { prisma } from "../../src/lib/prisma.js";
import { createAuditEntry } from "../../src/services/audit.service.js";
import { recalcularSerieConConfig } from "../../src/services/reportesFv/calculo.service.js";
import { resolverConfigEfectiva, SELECT_PROYECTO_CONFIG } from "../../src/services/reportesFv/config.service.js";
import { periodoADate } from "../../src/services/reportesFv/periodo.js";
import { clearTarifasCache } from "../../src/services/reportesFv/tarifas/tarifas.service.js";
import {
  leerConstantes,
  leerCsvPlantas,
  leerDatos,
  leerEmails,
  leerHistorico,
  leerTarifas,
  leerTipoCambio,
  normalizar,
  type FilaConstantes,
  type FilaHistorico,
  type FilaLectura,
} from "./lib/planillas.js";
import { resolverMatch, type Match, type ProyectoCandidato } from "./lib/matching.js";

// ─── Args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const valor = (n: string, def: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const DIR = valor("dir", "tmp-legacy-import");
const COMMIT = flag("commit");
const CREAR_FALTANTES = flag("crear-faltantes");

const TOLERANCIA = 0.01;

// ─── Salida ──────────────────────────────────────────────────────────────────

const c = {
  ok: (s: string) => `\x1b[32m${s}\x1b[0m`,
  warn: (s: string) => `\x1b[33m${s}\x1b[0m`,
  err: (s: string) => `\x1b[31m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

function titulo(s: string) {
  console.log(`\n${c.bold(s)}\n${"─".repeat(Math.min(s.length, 72))}`);
}

// ─── Tarifas ─────────────────────────────────────────────────────────────────

const TARIFA_ENUM: Record<string, TarifaUte> = {
  simple: TarifaUte.SIMPLE,
  doble: TarifaUte.DOBLE,
  triple: TarifaUte.TRIPLE,
  zafral: TarifaUte.ZAFRAL,
};

const FRANJA_ENUM: Record<string, FranjaHoraria> = {
  punta: FranjaHoraria.PUNTA,
  llano: FranjaHoraria.LLANO,
  valle: FranjaHoraria.VALLE,
  fuera_punta: FranjaHoraria.FUERA_PUNTA,
};

async function migrarTarifas(userId: string): Promise<string> {
  const cuadro = await leerTarifas(DIR);

  console.log("  Cargos por tarifa:");
  for (const [t, v] of Object.entries(cuadro.cargos)) {
    console.log(`    ${t.padEnd(8)} fijo ${String(v.cargoFijo).padStart(8)}   por kW ${String(v.cargoPotenciaKw).padStart(8)}`);
  }
  console.log("  Tramos de la simple:");
  for (const t of cuadro.tramosSimple) {
    console.log(`    ${String(t.desdeKwh).padStart(7)} – ${String(t.hastaKwh).padStart(7)} kWh  →  $${t.precioKwh}/kWh`);
  }
  console.log("  Franjas:");
  for (const [tarifa, fs] of Object.entries(cuadro.franjas)) {
    console.log(`    ${tarifa.padEnd(8)} ${Object.entries(fs).map(([f, p]) => `${f}=${p}`).join("  ")}`);
  }

  const yaExiste = await prisma.tarifaUteVersion.findFirst({ where: { nombre: "Legacy Excel" } });
  if (yaExiste) {
    console.log(c.dim("  Ya existe el cuadro \"Legacy Excel\", se reutiliza."));
    return yaExiste.id;
  }

  if (!COMMIT) {
    console.log(c.warn("  [dry-run] se crearía el cuadro \"Legacy Excel\" vigente desde 2024-01-01"));
    return "";
  }

  const version = await prisma.tarifaUteVersion.create({
    data: {
      nombre: "Legacy Excel",
      // Cubre todos los periodos migrados. Los precios de simple y doble son los
      // de la planilla; se sabe que parecen placeholders y se corrigen desde la
      // UI con una versión nueva, para no desalinear el histórico ya emitido.
      vigenteDesde: new Date("2024-01-01T00:00:00.000Z"),
      publicada: true,
      notas:
        "Importado de tarifas.xlsx del sistema Python. Los precios de las tarifas simple y doble " +
        "parecen placeholders (valores redondos): revisar contra el pliego real de UTE y publicar " +
        "una versión nueva con la vigencia que corresponda.",
      creadaPorId: userId,
      cargos: {
        create: Object.entries(cuadro.cargos)
          .filter(([t]) => TARIFA_ENUM[t])
          .map(([t, v]) => ({
            tarifa: TARIFA_ENUM[t],
            cargoFijo: v.cargoFijo,
            cargoPotenciaKw: v.cargoPotenciaKw,
          })),
      },
      tramos: {
        create: cuadro.tramosSimple.map((t, i) => ({
          tarifa: TarifaUte.SIMPLE,
          orden: i,
          desdeKwh: Math.round(t.desdeKwh),
          hastaKwh: Math.round(t.hastaKwh),
          precioKwh: t.precioKwh,
        })),
      },
      franjas: {
        create: Object.entries(cuadro.franjas).flatMap(([tarifa, fs]) =>
          Object.entries(fs)
            .filter(([f]) => FRANJA_ENUM[f])
            .map(([f, precio]) => ({
              tarifa: TARIFA_ENUM[tarifa],
              franja: FRANJA_ENUM[f],
              precioKwh: precio,
            })),
        ),
      },
    },
  });

  clearTarifasCache();
  console.log(c.ok(`  Cuadro "Legacy Excel" creado y publicado (${version.id})`));
  return version.id;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(c.bold("\n╔══════════════════════════════════════════════════════════════╗"));
  console.log(c.bold("║  Migración de reportes fotovoltaicos — planillas → Voltia PM  ║"));
  console.log(c.bold("╚══════════════════════════════════════════════════════════════╝"));
  console.log(`  Origen: ${DIR}`);
  console.log(`  Modo:   ${COMMIT ? c.err("COMMIT (escribe en la base)") : c.ok("dry-run (no escribe nada)")}`);
  if (CREAR_FALTANTES) console.log(`  ${c.warn("Se crearán generadores livianos para los clientes sin proyecto")}`);

  const admin = await prisma.user.findFirst({
    where: { deletedAt: null, role: { name: "ADMIN" } },
    select: { id: true, name: true },
  });
  if (!admin) throw new Error("No hay ningún usuario ADMIN para atribuir la migración");

  // ─── 1. Leer planillas ───
  titulo("1. Planillas");
  const [constantes, datos, historico, emails, tipoCambio] = await Promise.all([
    leerConstantes(DIR),
    leerDatos(DIR),
    leerHistorico(DIR),
    leerEmails(DIR),
    leerTipoCambio(DIR),
  ]);
  const allowlist = leerCsvPlantas(DIR, "growatt_allowlist.csv");
  const detectadas = leerCsvPlantas(DIR, "growatt_plantas_detectadas.csv");

  console.log(`  constantes            ${String(constantes.length).padStart(5)} clientes`);
  console.log(`  datos                 ${String(datos.length).padStart(5)} lecturas`);
  console.log(`  historico             ${String(historico.length).padStart(5)} filas emitidas`);
  console.log(`  emails                ${String(emails.length).padStart(5)} filas`);
  console.log(`  allowlist Growatt     ${String(allowlist.length).padStart(5)} plantas`);
  console.log(`  plantas detectadas    ${String(detectadas.length).padStart(5)} plantas`);
  console.log(`  tipo de cambio        ${tipoCambio ?? "(no encontrado)"}`);

  // ─── 2. Tarifas ───
  titulo("2. Cuadro tarifario");
  const tarifaVersionId = await migrarTarifas(admin.id);

  // ─── 3. Matching ───
  titulo("3. Vinculación con proyectos");

  const proyectos: ProyectoCandidato[] = (
    await prisma.project.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, clientName: true, clientEmail: true, importedFromCsv: true, capacityKwp: true },
    })
  ).map((p) => ({ ...p, capacityKwp: p.capacityKwp == null ? null : Number(p.capacityKwp) }));
  console.log(`  ${proyectos.length} proyectos en la base`);

  const vinculados = new Map<string, string>(
    (await prisma.growattPlant.findMany({ where: { projectId: { not: null } }, select: { plantId: true, projectId: true } }))
      .map((g) => [g.plantId.toString(), g.projectId as string]),
  );

  // Email por nombre de planta, para desempatar homónimos.
  const emailPorNombre = new Map<string, string>();
  for (const e of emails) {
    if (e.planta && e.emails[0]) emailPorNombre.set(normalizar(e.planta), e.emails[0]);
  }
  // plant_id por nombre, desde la allowlist.
  const plantIdPorNombre = new Map<string, string>();
  for (const p of allowlist) {
    if (p.nombre) plantIdPorNombre.set(normalizar(p.nombre), p.plantId);
  }

  const matches = new Map<string, Match>();
  for (const fila of constantes) {
    const norm = normalizar(fila.cliente);
    matches.set(
      fila.cliente,
      resolverMatch(
        { nombre: fila.cliente, plantId: plantIdPorNombre.get(norm) ?? null, email: emailPorNombre.get(norm) ?? null },
        proyectos,
        vinculados,
      ),
    );
  }

  const resueltos = [...matches.values()].filter((m) => m.proyecto);
  const sinMatch = [...matches.values()].filter((m) => !m.proyecto);

  const porMetodo = new Map<string, number>();
  for (const m of resueltos) porMetodo.set(m.metodo!, (porMetodo.get(m.metodo!) ?? 0) + 1);

  console.log(`\n  ${c.ok(`${resueltos.length} vinculados`)} · ${sinMatch.length > 0 ? c.warn(`${sinMatch.length} sin vincular`) : "0 sin vincular"}`);
  console.log("  Por método:");
  for (const [metodo, n] of [...porMetodo].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${metodo.padEnd(20)} ${n}`);
  }

  // Sólo se listan los que NO son un match exacto: los exactos no necesitan revisión.
  const revisar = resueltos.filter((m) => m.metodo !== "nombre_exacto");
  if (revisar.length > 0) {
    console.log(`\n  ${c.bold("Vinculados por regla (revisar):")}`);
    for (const m of revisar) {
      console.log(
        `    ${m.nombrePlanilla.slice(0, 30).padEnd(32)} → ${m.proyecto!.clientName.slice(0, 34).padEnd(36)} ${c.dim(`[${m.metodo}]`)}`,
      );
    }
  }

  if (sinMatch.length > 0) {
    console.log(`\n  ${c.bold(c.warn("Sin vincular:"))}`);
    for (const m of sinMatch) {
      const sug = m.ambiguo.length > 0 ? ` ${c.dim(`¿${m.ambiguo.map((p) => p.clientName).join(" / ")}?`)}` : "";
      console.log(`    ${m.nombrePlanilla.slice(0, 30).padEnd(32)} ${c.dim(m.nota ?? "")}${sug}`);
    }
  }

  // ─── 4. Crear faltantes ───
  if (sinMatch.length > 0 && CREAR_FALTANTES && COMMIT) {
    titulo("4. Generadores livianos para los clientes sin proyecto");
    for (const m of sinMatch) {
      if (m.descartado) {
        console.log(`    ${c.dim("descartado")} ${m.nombrePlanilla} — ${m.nota}`);
        continue;
      }
      if (m.ambiguo.length > 0) {
        console.log(`    ${c.warn("omitido")} ${m.nombrePlanilla} — tiene candidatos, resolvelo a mano`);
        continue;
      }
      const fila = constantes.find((f) => f.cliente === m.nombrePlanilla)!;
      const creado = await crearGeneradorLiviano(fila, admin.id);
      m.proyecto = creado;
      m.metodo = "alias_manual";
      proyectos.push(creado);
      console.log(`    ${c.ok("creado")} ${creado.code}  ${creado.clientName}`);
    }
  } else if (sinMatch.length > 0 && CREAR_FALTANTES) {
    titulo("4. Generadores livianos");
    const creables = sinMatch.filter((m) => !m.descartado && m.ambiguo.length === 0);
    console.log(c.warn(`  [dry-run] se crearían ${creables.length} generadores livianos:`));
    for (const m of creables) console.log(`    ${m.nombrePlanilla}`);

    const descartados = sinMatch.filter((m) => m.descartado);
    for (const m of descartados) {
      console.log(`  ${c.dim(`No se crea "${m.nombrePlanilla}": ${m.nota}`)}`);
    }

    const ambiguos = sinMatch.filter((m) => !m.descartado && m.ambiguo.length > 0);
    if (ambiguos.length > 0) {
      console.log(c.warn(`  ${ambiguos.length} NO se crearían (tienen candidatos, hay que resolverlos a mano):`));
      for (const m of ambiguos) {
        console.log(`    ${m.nombrePlanilla} → ¿${m.ambiguo.map((p) => p.clientName).join(" / ")}?`);
      }
    }
  }

  // ─── 5. Plantas Growatt ───
  titulo("5. Plantas Growatt");
  const todasLasPlantas = new Map<string, string | null>();
  for (const p of detectadas) todasLasPlantas.set(p.plantId, p.nombre);
  for (const p of allowlist) todasLasPlantas.set(p.plantId, p.nombre ?? todasLasPlantas.get(p.plantId) ?? null);

  const enAllowlist = new Set(allowlist.map((p) => p.plantId));
  let plantasVinculadas = 0;
  const plantasPorProyecto = new Map<string, string>();

  for (const [plantId, nombre] of todasLasPlantas) {
    let projectId: string | null = null;
    if (nombre && enAllowlist.has(plantId)) {
      const m = matches.get(
        [...matches.keys()].find((k) => normalizar(k) === normalizar(nombre)) ?? "",
      );
      if (m?.proyecto && !plantasPorProyecto.has(m.proyecto.id)) {
        projectId = m.proyecto.id;
        plantasPorProyecto.set(m.proyecto.id, plantId);
        plantasVinculadas++;
      }
    }

    if (COMMIT) {
      await prisma.growattPlant.upsert({
        where: { plantId: BigInt(plantId) },
        create: {
          plantId: BigInt(plantId),
          name: nombre ?? `Planta ${plantId}`,
          projectId,
          // Lo que el script original no tenía en la allowlist no es cliente:
          // queda marcado para que no aparezca como "pendiente de vincular".
          ignorada: !enAllowlist.has(plantId),
          vinculadaPorId: projectId ? admin.id : null,
          vinculadaEn: projectId ? new Date() : null,
        },
        update: { name: nombre ?? `Planta ${plantId}`, ultimaVezEn: new Date() },
      });
    }
  }
  console.log(`  ${todasLasPlantas.size} plantas conocidas · ${enAllowlist.size} en la allowlist · ${c.ok(`${plantasVinculadas} vinculadas a un proyecto`)}`);
  if (!COMMIT) console.log(c.warn("  [dry-run] no se escribió nada"));

  // ─── 6. Lecturas ───
  titulo("6. Lecturas mensuales");

  // El histórico conserva valores que ya no están en `datos`: se cargaban a mano
  // cuando el smart meter fallaba y una corrida posterior de Growatt los volvía a
  // dejar vacíos. Es la única copia que queda, así que manda sobre `datos`.
  const lecturasPorCliente = new Map<string, Map<string, FilaLectura>>();
  const agregar = (fila: FilaLectura, pisar: boolean) => {
    const key = normalizar(fila.cliente);
    let m = lecturasPorCliente.get(key);
    if (!m) lecturasPorCliente.set(key, (m = new Map()));
    const actual = m.get(fila.periodo);
    if (!actual) {
      m.set(fila.periodo, { ...fila });
      return 0;
    }
    let rescatados = 0;
    for (const campo of ["generacionKwh", "consumoKwh", "exportacionKwh"] as const) {
      if (fila[campo] != null && (pisar || actual[campo] == null)) {
        if (actual[campo] == null) rescatados++;
        actual[campo] = fila[campo];
      }
    }
    return rescatados;
  };

  for (const fila of datos) agregar(fila, false);
  let rescatados = 0;
  for (const fila of historico) rescatados += agregar(fila, true);

  console.log(`  ${datos.length} lecturas de la hoja "datos"`);
  console.log(`  ${c.ok(`${rescatados} valores rescatados del histórico`)} ${c.dim("(no estaban en \"datos\")")}`);

  let lecturasEscritas = 0;
  let lecturasSinProyecto = 0;
  const incompletas = { generacion: 0, consumo: 0, exportacion: 0 };

  for (const [clienteNorm, porPeriodo] of lecturasPorCliente) {
    const match = [...matches.values()].find((m) => normalizar(m.nombrePlanilla) === clienteNorm);
    if (!match?.proyecto) {
      lecturasSinProyecto += porPeriodo.size;
      continue;
    }

    for (const fila of porPeriodo.values()) {
      if (fila.generacionKwh == null) incompletas.generacion++;
      if (fila.consumoKwh == null) incompletas.consumo++;
      if (fila.exportacionKwh == null) incompletas.exportacion++;

      if (COMMIT) {
        const faltantes = [
          fila.generacionKwh == null ? "generación" : null,
          fila.consumoKwh == null ? "consumo" : null,
          fila.exportacionKwh == null ? "exportación" : null,
        ].filter(Boolean);

        const data = {
          generacionKwh: fila.generacionKwh,
          consumoKwh: fila.consumoKwh,
          exportacionKwh: fila.exportacionKwh,
          generacionFuente: fila.generacionKwh == null ? null : ("IMPORT_LEGACY" as const),
          consumoFuente: fila.consumoKwh == null ? null : ("IMPORT_LEGACY" as const),
          exportacionFuente: fila.exportacionKwh == null ? null : ("IMPORT_LEGACY" as const),
          motivoFaltante: faltantes.length > 0 ? `Migración: sin ${faltantes.join(" ni ")} en la planilla` : null,
        };

        await prisma.reporteFvLectura.upsert({
          where: { projectId_periodo: { projectId: match.proyecto.id, periodo: periodoADate(fila.periodo) } },
          create: { projectId: match.proyecto.id, periodo: periodoADate(fila.periodo), ...data },
          update: data,
        });
      }
      lecturasEscritas++;
    }
  }

  const total = lecturasEscritas + lecturasSinProyecto;
  console.log(`  ${lecturasEscritas} lecturas ${COMMIT ? "importadas" : "a importar"}${lecturasSinProyecto > 0 ? ` · ${c.warn(`${lecturasSinProyecto} descartadas (cliente sin proyecto)`)}` : ""}`);
  console.log(
    `  Incompletas: generación ${incompletas.generacion}/${total} · ` +
      `consumo ${c.warn(`${incompletas.consumo}/${total}`)} · exportación ${c.warn(`${incompletas.exportacion}/${total}`)}`,
  );

  // ─── 7. Configs y destinatarios ───
  titulo("7. Configuración por generador");

  const emailsPorPlanta = new Map<string, string[]>();
  for (const e of emails) {
    if (!e.planta || e.emails.length === 0) continue;
    emailsPorPlanta.set(normalizar(e.planta), e.emails);
  }

  let configsEscritas = 0;
  let sinDestinatario = 0;
  const configsCreadas: Array<{ projectId: string; nombre: string }> = [];

  for (const fila of constantes) {
    const match = matches.get(fila.cliente);
    if (!match?.proyecto) continue;

    const destinatarios = emailsPorPlanta.get(normalizar(fila.cliente)) ?? [];
    if (destinatarios.length === 0) sinDestinatario++;

    if (COMMIT) {
      const data = {
        habilitado: fila.habilitado,
        tipoCliente: fila.tipoCliente === "empresa" ? ("EMPRESA" as const) : ("RESIDENCIAL" as const),
        tarifaContratada: fila.tarifa ? (TARIFA_ENUM[fila.tarifa] ?? null) : null,
        potenciaContratadaKw: fila.potenciaContratadaKw ?? 0,
        pctPunta: fila.pctPunta ?? 0,
        pctLlano: fila.pctLlano ?? 0,
        pctValle: fila.pctValle ?? 0,
        // Se persisten aunque el proyecto los tenga: son los valores con los que
        // se emitieron los reportes históricos y tienen que quedar congelados.
        // Si coinciden con el proyecto, el usuario puede borrarlos para heredarlos.
        inversionUsd: fila.inversionUsd,
        potenciaInstaladaKwp: fila.potenciaInstaladaKwp,
        mesInicio: fila.mesInicio ? periodoADate(fila.mesInicio) : null,
        growattPlantId: plantasPorProyecto.has(match.proyecto.id)
          ? BigInt(plantasPorProyecto.get(match.proyecto.id) as string)
          : null,
        origenDatos: plantasPorProyecto.has(match.proyecto.id) ? ("GROWATT" as const) : ("MANUAL" as const),
        actualizadoPorId: admin.id,
      };

      const config = await prisma.reporteFvConfig.upsert({
        where: { projectId: match.proyecto.id },
        create: { projectId: match.proyecto.id, ...data },
        update: data,
      });

      for (const [i, email] of destinatarios.entries()) {
        await prisma.reporteFvDestinatario.upsert({
          where: { configId_email: { configId: config.id, email } },
          create: { configId: config.id, email, esCopia: i > 0 },
          update: {},
        });
      }
    }

    configsEscritas++;
    configsCreadas.push({ projectId: match.proyecto.id, nombre: fila.cliente });
  }

  console.log(`  ${configsEscritas} configuraciones ${COMMIT ? "importadas" : "a importar"}`);
  console.log(`  ${configsEscritas - sinDestinatario} con destinatario propio · ${sinDestinatario} ${c.dim("heredarán el mail del proyecto")}`);

  const manuales = configsCreadas.filter((x) => !plantasPorProyecto.has(x.projectId));
  if (manuales.length > 0) {
    console.log(`  ${c.warn(`${manuales.length} sin planta Growatt`)} ${c.dim("→ quedan como carga manual")}`);
  }

  if (!COMMIT) {
    console.log(c.warn("\n[dry-run] No se escribió nada. Volvé a correr con --commit para aplicar."));
    console.log(c.dim("El recálculo y la verificación contra el histórico requieren los datos en la base."));
    return;
  }

  // ─── 8. Recálculo ───
  titulo("8. Recálculo de series");
  const configs = await prisma.reporteFvConfig.findMany({
    include: { destinatarios: true, project: { select: SELECT_PROYECTO_CONFIG } },
  });

  let calculados = 0;
  const bloqueados: Array<{ nombre: string; motivos: string[] }> = [];
  const sinDestino: string[] = [];
  const conAdvertencia: Array<{ nombre: string; motivos: string[] }> = [];

  for (const config of configs) {
    const efectiva = resolverConfigEfectiva(config, config.project);
    if (efectiva.bloqueosCalculo.length > 0) {
      bloqueados.push({ nombre: efectiva.clientName, motivos: efectiva.bloqueosCalculo });
      continue;
    }
    const r = await recalcularSerieConConfig(efectiva);
    calculados += r.periodosCalculados;

    if (efectiva.advertencias.length > 0) {
      conAdvertencia.push({ nombre: efectiva.clientName, motivos: efectiva.advertencias });
    }
    if (efectiva.destinatarios.length === 0) sinDestino.push(efectiva.clientName);
  }

  console.log(`  ${c.ok(`${calculados} periodos calculados`)} sobre ${configs.length} generadores`);

  if (bloqueados.length > 0) {
    console.log(`\n  ${c.warn(`${bloqueados.length} sin calcular`)} ${c.dim("(les falta un dato que haría salir mal los números)")}`);
    for (const b of bloqueados) {
      console.log(`    ${b.nombre.slice(0, 34).padEnd(36)} ${c.dim(b.motivos.join("; "))}`);
    }
  }
  if (conAdvertencia.length > 0) {
    console.log(`\n  ${c.dim(`${conAdvertencia.length} calculados con el reporte degradado:`)}`);
    for (const a of conAdvertencia) {
      console.log(`    ${a.nombre.slice(0, 34).padEnd(36)} ${c.dim(a.motivos.join("; "))}`);
    }
  }
  if (sinDestino.length > 0) {
    console.log(`\n  ${c.dim(`${sinDestino.length} calculados pero sin destinatario (no se les puede enviar):`)}`);
    console.log(`    ${c.dim(sinDestino.join(", "))}`);
  }

  // ─── 9. Verificación ───
  titulo("9. Verificación contra el histórico emitido");
  await verificar(historico, matches);
}

// ─── Verificación ────────────────────────────────────────────────────────────

/**
 * Compara los cálculos recién persistidos contra las 282 filas del histórico
 * emitido. Es el chequeo que valida toda la migración de una: matching, tarifas,
 * motor y persistencia.
 */
async function verificar(historico: FilaHistorico[], matches: Map<string, Match>) {
  const calculos = await prisma.reporteFvCalculo.findMany({
    select: {
      projectId: true,
      periodo: true,
      autoconsumoKwh: true,
      importacionRedKwh: true,
      ahorroAutoconsumo: true,
      ahorroVenta: true,
      ahorroTotal: true,
      ahorroTotalUsd: true,
    },
  });

  const porClave = new Map(
    calculos.map((c) => [
      `${c.projectId}|${c.periodo.toISOString().slice(0, 7)}`,
      {
        autoconsumoKwh: Number(c.autoconsumoKwh),
        importacionRedKwh: Number(c.importacionRedKwh),
        ahorroAutoconsumo: Number(c.ahorroAutoconsumo),
        ahorroVenta: Number(c.ahorroVenta),
        ahorroTotal: Number(c.ahorroTotal),
        ahorroTotalUsd: Number(c.ahorroTotalUsd),
      },
    ]),
  );

  const campos = [
    "autoconsumoKwh",
    "importacionRedKwh",
    "ahorroAutoconsumo",
    "ahorroVenta",
    "ahorroTotal",
    "ahorroTotalUsd",
  ] as const;

  let comparadas = 0;
  let faltantes = 0;
  const diferencias: Array<{ cliente: string; periodo: string; campo: string; esp: number; obt: number }> = [];

  for (const fila of historico) {
    const match = matches.get(fila.cliente) ?? [...matches.values()].find((m) => normalizar(m.nombrePlanilla) === normalizar(fila.cliente));
    if (!match?.proyecto) continue;

    const calc = porClave.get(`${match.proyecto.id}|${fila.periodo}`);
    if (!calc) {
      faltantes++;
      continue;
    }

    comparadas++;
    for (const campo of campos) {
      const esperado = fila[campo];
      if (esperado == null) continue;
      const obtenido = calc[campo];
      if (Math.abs(obtenido - esperado) > TOLERANCIA) {
        diferencias.push({ cliente: fila.cliente, periodo: fila.periodo, campo, esp: esperado, obt: obtenido });
      }
    }
  }

  console.log(`  ${comparadas} filas del histórico comparadas${faltantes > 0 ? ` · ${c.warn(`${faltantes} sin cálculo`)}` : ""}`);

  if (diferencias.length === 0) {
    console.log(c.ok(`  ✓ Todas las filas coinciden. La migración reproduce los reportes ya emitidos.`));
    return;
  }

  // Se separan por magnitud: unos centavos es redondeo, decenas o cientos de
  // pesos es que el dato de origen cambió entre corridas.
  const UMBRAL_REDONDEO = 0.1;
  const redondeo = diferencias.filter((d) => Math.abs(d.obt - d.esp) < UMBRAL_REDONDEO);
  const reales = diferencias.filter((d) => Math.abs(d.obt - d.esp) >= UMBRAL_REDONDEO);

  if (redondeo.length > 0) {
    const clientes = new Set(redondeo.map((d) => d.cliente));
    console.log(
      `  ${c.dim(`${redondeo.length} de redondeo (< $${UMBRAL_REDONDEO})`)} en ${clientes.size} ` +
        `${clientes.size === 1 ? "generador" : "generadores"}: ` +
        c.dim("la planilla tenía kWh imputados con 13 decimales y la base los guarda con 2"),
    );
  }

  if (reales.length === 0) {
    console.log(c.ok("  ✓ Sin diferencias de fondo: la migración reproduce los reportes ya emitidos."));
    return;
  }

  const clientesAfectados = new Set(reales.map((d) => d.cliente));
  console.log(
    `  ${c.warn(`${reales.length} diferencias de fondo`)} en ${clientesAfectados.size} generadores ` +
      `${c.dim("(esperable: el histórico se armó con una corrida por mes y la planilla cambió entre corridas)")}`,
  );
  console.log(`\n  ${"cliente".padEnd(30)}${"periodo".padEnd(10)}${"campo".padEnd(20)}${"histórico".padStart(13)}${"ahora".padStart(13)}`);
  for (const d of reales.slice(0, 30)) {
    console.log(
      `  ${d.cliente.slice(0, 28).padEnd(30)}${d.periodo.padEnd(10)}${d.campo.padEnd(20)}${d.esp.toFixed(2).padStart(13)}${d.obt.toFixed(2).padStart(13)}`,
    );
  }
  if (reales.length > 30) console.log(c.dim(`  … y ${reales.length - 30} más`));
}

// ─── Generadores livianos ────────────────────────────────────────────────────

async function crearGeneradorLiviano(fila: FilaConstantes, userId: string): Promise<ProyectoCandidato> {
  // Mismo patrón que el import CSV de Experiencia Solar: proyecto sin pipeline,
  // marcado con importedFromCsv para que no ensucie Proyectos ni las métricas.
  const ultimo = await prisma.project.findFirst({
    where: { code: { startsWith: "GEN-" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const n = ultimo ? Number(ultimo.code.slice(4)) + 1 : 1;
  const code = `GEN-${String(n).padStart(4, "0")}`;

  const inicio = fila.mesInicio ? periodoADate(fila.mesInicio) : new Date();
  const p = await prisma.project.create({
    data: {
      code,
      clientName: fila.cliente,
      capacityKwp: fila.potenciaInstaladaKwp ?? 0,
      locationCity: "Sin especificar",
      locationProvince: "Sin especificar",
      startDate: inicio,
      saleDate: inicio,
      status: ProjectStatus.COMPLETED,
      executedUsd: new Prisma.Decimal(0),
      importedFromCsv: true,
      budgetUsd: fila.inversionUsd ?? null,
      // El generador ya está habilitado y generando: el ancla del año 0 es la
      // fecha de instalación de la planilla, marcada como aproximada.
      postHabilitacionInicioEn: inicio,
      postHabilitacionFechaAproximada: true,
      createdById: userId,
    },
    select: { id: true, code: true, clientName: true, clientEmail: true, importedFromCsv: true, capacityKwp: true },
  });

  await createAuditEntry({
    entityType: AuditEntityType.project,
    entityId: p.id,
    projectId: p.id,
    userId,
    action: AuditAction.created,
    description: `Generador creado por la migración de reportes fotovoltaicos: ${fila.cliente}`,
  });

  return { ...p, capacityKwp: p.capacityKwp == null ? null : Number(p.capacityKwp) };
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(c.err(`\n${e instanceof Error ? e.stack : String(e)}`));
    await prisma.$disconnect();
    process.exit(1);
  });
