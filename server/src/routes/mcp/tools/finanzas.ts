// Finanzas por chat: estado de resultados, cobros a clientes, comisiones y
// pagos a instaladores tercerizados. Todo lectura.
//
// Cada número sale del MISMO servicio que usa la pantalla correspondiente:
// el chat y la aplicación no pueden dar cifras distintas para la misma
// pregunta. Si en algún momento difieren, el bug está en el servicio, no acá.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, CommissionStatus, InstallerPaymentStatus, Module } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import { hasPermission } from "../../../middleware/authorize.middleware.js";
import { commissionMetrics, listCommissions } from "../../../services/commission/commission.service.js";
import {
  cuotasPrevistasPorProyecto,
  listarCobrosPorProyecto,
  type EstadoCobranza,
} from "../../../services/finance/cobros.service.js";
import { calcularEstadoResultados, type ResultItem } from "../../../services/finance/resultados.service.js";
import {
  installerPaymentMetrics,
  listInstallerPayments,
} from "../../../services/installer-payment/installer-payment.service.js";
import { requireAnyPermission, requirePermission, type McpUser } from "../context.js";
import { campos, fechaCorta, pesos, porcentaje, texto, usd } from "../format.js";
import { hoyUruguay, periodoInput, resolverPeriodo } from "../periodo.js";

/** Tope de renglones por lista. Más que esto no se lee en un chat. */
const TOPE = 60;

function montoOriginal(i: { monto: number; moneda: string }) {
  return i.moneda === "UYU" ? pesos(i.monto) : usd(i.monto);
}

function renglon(i: ResultItem) {
  const quien = i.projectClientName ?? i.supplierName;
  return `- ${fechaCorta(i.fecha)} · ${i.descripcion}${quien ? ` (${quien})` : ""} · ${montoOriginal(i)}`;
}

function lista(items: ResultItem[], tope = TOPE): string {
  const cuerpo = items.slice(0, tope).map(renglon).join("\n");
  return items.length > tope ? `${cuerpo}\n  …y ${items.length - tope} más.` : cuerpo;
}

/** Días entre dos fechas YYYY-MM-DD (b − a). */
function diasEntre(a: string, b: string) {
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

async function buscarUsuarioPorNombre(nombre: string) {
  return prisma.user.findMany({
    where: { deletedAt: null, name: { contains: nombre.trim(), mode: "insensitive" } },
    select: { id: true, name: true },
    take: 5,
  });
}

export function registerFinanzasTools(server: McpServer, user: McpUser) {
  // ── Estado de resultados ────────────────────────────────────────────────

  server.registerTool(
    "estado_resultados",
    {
      title: "Estado de resultados",
      description:
        "El estado de resultados de un período, con el MISMO criterio que la pantalla de " +
        "Finanzas: de caja, solo lo efectivamente cobrado y pagado. Devuelve ingresos, " +
        "egresos por rubro (costos fijos, variables, salidas por obra, pagos a proveedores, " +
        "compras de stock), resultado y rentabilidad. Sirve para un mes, un trimestre, un " +
        "año o cualquier rango de fechas. Con `detalle` lista cada cobro y cada pago del " +
        "período. Sin período, el mes en curso.",
      inputSchema: {
        ...periodoInput,
        detalle: z
          .boolean()
          .optional()
          .describe("Listar cada movimiento del período. Por defecto solo totales por rubro."),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      await requirePermission(user, Module.FINANZAS, Action.VIEW);
      const periodo = resolverPeriodo(args);
      const r = await calcularEstadoResultados(periodo.inicio, periodo.fin);
      const e = r.egresos;

      const resumen = campos([
        ["Ingresos", usd(r.ingresos.total)],
        ["Egresos", usd(e.total)],
        ["Resultado", usd(r.resultado)],
        ["Rentabilidad", r.ingresos.total > 0 ? `${r.rentabilidad.toLocaleString("es-UY")}%` : "— (sin ingresos)"],
      ]);

      const rubros = campos([
        ["Costos fijos", usd(e.costosFijos.total)],
        ["Costos variables", usd(e.costosVariables.total)],
        ["Salidas por obra", usd(e.salidasProyecto.total)],
        ["Pagos a proveedores", usd(e.pagoProveedores.total)],
        ["Compras de stock", usd(e.comprasStock.total)],
        ["Otros", usd(e.otros.total)],
      ]);

      // Por obra se muestra siempre: dice dónde se fue la plata de las
      // instalaciones, que es lo primero que se pregunta al ver el resultado.
      const porObra =
        e.salidasProyecto.byProject.length > 0
          ? "SALIDAS POR OBRA\n" +
            e.salidasProyecto.byProject
              .slice(0, 15)
              .map((g) => `- ${g.clientName}${g.code ? ` [${g.code}]` : ""}: ${usd(g.total)}`)
              .join("\n")
          : null;

      const bloquesDetalle = args.detalle
        ? [
            r.ingresos.items.length ? `COBROS DEL PERÍODO\n${lista(r.ingresos.items)}` : null,
            e.costosFijos.items.length ? `COSTOS FIJOS\n${lista(e.costosFijos.items)}` : null,
            e.costosVariables.items.length ? `COSTOS VARIABLES\n${lista(e.costosVariables.items)}` : null,
            e.salidasProyecto.byProject.length
              ? `SALIDAS POR OBRA — DETALLE\n${lista(e.salidasProyecto.byProject.flatMap((g) => g.items))}`
              : null,
            e.pagoProveedores.items.length ? `PAGOS A PROVEEDORES\n${lista(e.pagoProveedores.items)}` : null,
            e.comprasStock.items.length ? `COMPRAS DE STOCK\n${lista(e.comprasStock.items)}` : null,
            e.otros.items.length ? `OTROS\n${lista(e.otros.items)}` : null,
          ]
        : [
            r.ingresos.items.length
              ? `COBROS DEL PERÍODO (${r.ingresos.items.length})\n${lista(r.ingresos.items, 25)}`
              : "No hubo cobros en el período.",
          ];

      return texto(
        `Estado de resultados — ${periodo.etiqueta}`,
        resumen,
        `EGRESOS POR RUBRO\n${rubros}`,
        porObra,
        ...bloquesDetalle,
        `Montos en dólares; los pesos se convirtieron a $ ${r.fallbackUsdToUyu.toLocaleString("es-UY", { maximumFractionDigits: 3 })} por dólar ` +
          `(la última cotización cargada, igual que la pantalla). Criterio de caja: solo lo cobrado y pagado.`,
      );
    },
  );

  // ── Cobros a clientes ───────────────────────────────────────────────────

  const permisoCobros = [
    { module: Module.FINANZAS, action: Action.VIEW },
    { module: Module.EXPERIENCIA_CLIENTES, action: Action.VIEW },
  ];

  server.registerTool(
    "cobros_clientes",
    {
      title: "Cobros a clientes",
      description:
        "Cuánto cobró Voltia de cada obra y cuánto le falta cobrar, con el mismo cálculo que " +
        "Finanzas → Cobros. Dice si cada obra tiene plan de pagos o no, la próxima cuota y " +
        "las vencidas. Por defecto muestra solo las obras con saldo pendiente. Filtrable por " +
        "estado, por tener o no plan de pagos, o por nombre del cliente.",
      inputSchema: {
        estado: z
          .enum(["PENDIENTE", "PARCIAL", "COMPLETO", "EXCEDIDO", "SIN_PRESUPUESTO"])
          .optional()
          .describe(
            "PENDIENTE = no pagó nada; PARCIAL = pagó una parte. Sin estado: las dos, es decir todas las que deben.",
          ),
        plan: z
          .enum(["con_plan", "sin_plan"])
          .optional()
          .describe("Solo las que tienen plan de pagos cargado, o solo las que no."),
        busqueda: z.string().optional().describe("Parte del nombre del cliente."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ estado, plan, busqueda }) => {
      await requireAnyPermission(user, permisoCobros);

      const base = await listarCobrosPorProyecto({ estado, clientName: busqueda });
      const conSaldo: EstadoCobranza[] = ["PENDIENTE", "PARCIAL"];
      let proyectos = estado
        ? base.projects
        : base.projects.filter((p) => conSaldo.includes(p.estadoCobranza));

      const cuotas = await cuotasPrevistasPorProyecto(proyectos.map((p) => p.id));
      if (plan === "con_plan") proyectos = proyectos.filter((p) => (cuotas.get(p.id)?.length ?? 0) > 0);
      if (plan === "sin_plan") proyectos = proyectos.filter((p) => (cuotas.get(p.id)?.length ?? 0) === 0);

      if (proyectos.length === 0) return texto("No hay obras que cumplan ese filtro.");

      proyectos.sort((a, b) => b.saldoPendienteUSD - a.saldoPendienteUSD);
      const hoy = hoyUruguay().iso;

      const totPresupuesto = proyectos.reduce((s, p) => s + (p.presupuestoUSD ?? 0), 0);
      const totCobrado = proyectos.reduce((s, p) => s + p.totalCobradoUSD, 0);
      const totSaldo = proyectos.reduce((s, p) => s + p.saldoPendienteUSD, 0);
      const conPlan = proyectos.filter((p) => (cuotas.get(p.id)?.length ?? 0) > 0);

      // Si la búsqueda deja pocas obras, se muestra el plan completo: es la
      // pregunta "¿cómo viene de pagos tal cliente?".
      const detallado = proyectos.length <= 3;

      const renglones = proyectos.slice(0, TOPE).map((p) => {
        const cs = cuotas.get(p.id) ?? [];
        const vencidas = cs.filter((c) => c.dueDate && c.dueDate < hoy);
        const proxima = cs.find((c) => !c.dueDate || c.dueDate >= hoy);
        const planTxt =
          cs.length === 0
            ? "SIN plan de pagos"
            : `plan: ${cs.length} cuota${cs.length > 1 ? "s" : ""} prevista${cs.length > 1 ? "s" : ""}` +
              (vencidas.length
                ? `, ${vencidas.length} VENCIDA${vencidas.length > 1 ? "S" : ""} (${usd(vencidas.reduce((s, c) => s + (c.moneda === "USD" ? c.monto : 0), 0))})`
                : "") +
              (proxima ? `, próxima ${fechaCorta(proxima.dueDate) ?? "sin fecha"} por ${montoOriginal(proxima)}` : "");

        let linea =
          `- ${p.clientName} [${p.code}] · ${p.estadoCobranza}\n` +
          `  presupuesto ${usd(p.presupuestoUSD) ?? "—"} · cobrado ${usd(p.totalCobradoUSD)} · ` +
          `debe ${usd(p.saldoPendienteUSD)}${p.ultimoCobro ? ` · último cobro ${fechaCorta(p.ultimoCobro)}` : ""}\n` +
          `  ${planTxt}`;

        if (detallado && cs.length) {
          linea +=
            "\n" +
            cs
              .map(
                (c) =>
                  `    · ${c.descripcion} — ${montoOriginal(c)} — ${c.dueDate ? `vence ${fechaCorta(c.dueDate)}` : "sin fecha"}` +
                  (c.dueDate && c.dueDate < hoy ? ` (vencida hace ${diasEntre(c.dueDate, hoy)} días)` : ""),
              )
              .join("\n");
        }
        return linea;
      });

      return texto(
        `${proyectos.length} obra${proyectos.length > 1 ? "s" : ""}` +
          (estado ? ` en estado ${estado}` : " con saldo pendiente") +
          (plan === "con_plan" ? ", con plan de pagos" : plan === "sin_plan" ? ", sin plan de pagos" : ""),
        campos([
          ["Presupuestado", usd(totPresupuesto)],
          ["Cobrado", usd(totCobrado)],
          ["Pendiente de cobro", usd(totSaldo)],
          ["Con plan de pagos", `${conPlan.length} de ${proyectos.length}`],
        ]),
        renglones.join("\n") + (proyectos.length > TOPE ? `\n  …y ${proyectos.length - TOPE} más.` : ""),
      );
    },
  );

  server.registerTool(
    "cobros_pendientes",
    {
      title: "Cuotas por cobrar",
      description:
        "Las cuotas de los planes de pago: las vencidas sin cobrar y las que vencen en un " +
        "período. Por defecto, las vencidas más las de los próximos 30 días. Al final avisa " +
        "cuántas obras deben plata y no tienen plan de pagos, porque esas no aparecen como cuotas.",
      inputSchema: {
        desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("AAAA-MM-DD"),
        hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("AAAA-MM-DD, inclusive"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ desde, hasta }) => {
      await requireAnyPermission(user, permisoCobros);

      const hoy = hoyUruguay().iso;
      const limite = hasta ?? new Date(Date.parse(`${hoy}T00:00:00Z`) + 30 * 86_400_000).toISOString().slice(0, 10);

      const base = await listarCobrosPorProyecto({});
      const conSaldo = base.projects.filter(
        (p) => p.estadoCobranza === "PENDIENTE" || p.estadoCobranza === "PARCIAL",
      );
      const todas = await cuotasPrevistasPorProyecto(base.projects.map((p) => p.id));
      const nombre = new Map(base.projects.map((p) => [p.id, `${p.clientName} [${p.code}]`]));

      const vencidas: string[] = [];
      const porVencer: string[] = [];
      const sinFecha: string[] = [];
      let totVencidas = 0;
      let totPorVencer = 0;

      for (const [pid, cs] of todas) {
        for (const c of cs) {
          const monto = c.moneda === "USD" ? c.monto : 0;
          const renglonCuota = `- ${nombre.get(pid)} · ${c.descripcion} · ${montoOriginal(c)}`;
          if (!c.dueDate) {
            sinFecha.push(renglonCuota);
          } else if (c.dueDate < hoy && (!desde || c.dueDate >= desde)) {
            vencidas.push(`${renglonCuota} · venció ${fechaCorta(c.dueDate)} (hace ${diasEntre(c.dueDate, hoy)} días)`);
            totVencidas += monto;
          } else if (c.dueDate >= (desde ?? hoy) && c.dueDate <= limite) {
            porVencer.push(`${renglonCuota} · vence ${fechaCorta(c.dueDate)}`);
            totPorVencer += monto;
          }
        }
      }

      const sinPlan = conSaldo.filter((p) => (todas.get(p.id)?.length ?? 0) === 0);
      const deudaSinPlan = sinPlan.reduce((s, p) => s + p.saldoPendienteUSD, 0);

      return texto(
        `Cuotas por cobrar — vencidas y hasta el ${fechaCorta(limite)}`,
        vencidas.length
          ? `VENCIDAS SIN COBRAR (${vencidas.length} · ${usd(totVencidas)})\n${vencidas.join("\n")}`
          : "No hay cuotas vencidas sin cobrar.",
        porVencer.length
          ? `POR VENCER (${porVencer.length} · ${usd(totPorVencer)})\n${porVencer.join("\n")}`
          : "No hay cuotas que venzan en el período.",
        sinFecha.length ? `SIN FECHA DE VENCIMIENTO\n${sinFecha.join("\n")}` : null,
        sinPlan.length
          ? `Además, ${sinPlan.length} obra${sinPlan.length > 1 ? "s deben" : " debe"} ${usd(deudaSinPlan)} ` +
            `sin plan de pagos cargado, así que no aparecen como cuotas. Pedí cobros_clientes con plan "sin_plan" para verlas.`
          : null,
        "Los totales suman solo las cuotas en dólares; las cuotas en pesos se muestran con su monto.",
      );
    },
  );

  // ── Comisiones ──────────────────────────────────────────────────────────

  server.registerTool(
    "comisiones",
    {
      title: "Comisiones de los asesores",
      description:
        "Las comisiones de venta: cuánto se les debe a los asesores, cuánto se pagó en el año " +
        "y el detalle por venta. Por defecto las pendientes de pago. Quien no tiene permiso " +
        "para ver las de todos ve solo las propias.",
      inputSchema: {
        estado: z
          .enum(["PENDIENTE", "PAGADA", "TODAS"])
          .optional()
          .describe("Por defecto PENDIENTE."),
        asesor: z.string().optional().describe("Parte del nombre del asesor."),
        anio: z.number().int().min(2020).max(2100).optional().describe("Año de la venta. Por defecto todos."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ estado, asesor, anio }) => {
      await requirePermission(user, Module.COMISIONES, Action.VIEW);

      // Mismo criterio que la ruta HTTP: ve todas quien tiene Finanzas o puede
      // editar comisiones; el resto solo las propias.
      const verTodas =
        (await hasPermission(user.role, Module.FINANZAS, Action.VIEW)) ||
        (await hasPermission(user.role, Module.COMISIONES, Action.EDIT));

      let asesorId: string | undefined = verTodas ? undefined : user.id;
      let asesorNombre: string | null = verTodas ? null : user.name;
      if (verTodas && asesor) {
        const us = await buscarUsuarioPorNombre(asesor);
        if (us.length === 0) return texto(`No encontré ningún asesor que se llame "${asesor}".`);
        if (us.length > 1) return texto(`Hay varios: ${us.map((u) => u.name).join(", ")}. ¿Cuál?`);
        asesorId = us[0].id;
        asesorNombre = us[0].name;
      }

      const status =
        estado === "TODAS" ? undefined : estado === "PAGADA" ? CommissionStatus.PAGADA : CommissionStatus.PENDIENTE;
      const items = await listCommissions({ asesorId, status, year: anio });
      const metricas = await commissionMetrics({ asesorId, year: anio ?? hoyUruguay().anio });
      const hoy = hoyUruguay().iso;

      const renglones = items.slice(0, TOPE).map((c) => {
        const vence = c.dueDate ? String(c.dueDate).slice(0, 10) : null;
        const vencida = c.status === CommissionStatus.PENDIENTE && vence && vence < hoy;
        return (
          `- ${c.leadClientName} · ${c.asesorName} · ${usd(c.montoUsd)} · ${c.status}` +
          (vence ? ` · ${c.status === CommissionStatus.PAGADA ? "vencía" : "vence"} ${fechaCorta(vence)}` : "") +
          (vencida ? " (VENCIDA)" : "") +
          (c.paidAt ? ` · pagada ${fechaCorta(c.paidAt)}` : "")
        );
      });

      return texto(
        `Comisiones${asesorNombre ? ` de ${asesorNombre}` : " de todos los asesores"}`,
        campos([
          ["Pendiente de pago (total)", usd(metricas.saldoAcobrarUsd)],
          [`Pagado en ${anio ?? hoyUruguay().anio}`, usd(metricas.cobradoEnAnioUsd)],
          [`Ventas cerradas en ${anio ?? hoyUruguay().anio}`, metricas.ventasCerradas],
        ]),
        items.length
          ? `DETALLE (${items.length}${estado === "TODAS" ? "" : ` ${(estado ?? "PENDIENTE").toLowerCase()}s`})\n` +
              renglones.join("\n") +
              (items.length > TOPE ? `\n  …y ${items.length - TOPE} más.` : "")
          : "No hay comisiones con ese filtro.",
      );
    },
  );

  // ── Pagos a instaladores tercerizados ───────────────────────────────────

  server.registerTool(
    "pagos_instaladores",
    {
      title: "Pagos a instaladores tercerizados",
      description:
        "La mano de obra de las cuadrillas tercerizadas: cuánto se les debe por cada obra, " +
        "cuánto se les pagó y qué trabajos no tienen instalador asignado. Por defecto lo " +
        "pendiente de pago. Quien no tiene permiso para ver todo ve solo lo propio.",
      inputSchema: {
        estado: z
          .enum(["PENDIENTES", "PAGADOS", "TODOS"])
          .optional()
          .describe("PENDIENTES incluye los pagados en parte. Por defecto PENDIENTES."),
        instalador: z.string().optional().describe("Parte del nombre del instalador."),
        anio: z.number().int().min(2020).max(2100).optional().describe("Año del trabajo. Por defecto todos."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ estado, instalador, anio }) => {
      await requirePermission(user, Module.PAGOS_INSTALADOR, Action.VIEW);

      const verTodo =
        (await hasPermission(user.role, Module.FINANZAS, Action.VIEW)) ||
        (await hasPermission(user.role, Module.PAGOS_INSTALADOR, Action.EDIT));

      let installerId: string | undefined = verTodo ? undefined : user.id;
      let nombreInst: string | null = verTodo ? null : user.name;
      if (verTodo && instalador) {
        const us = await buscarUsuarioPorNombre(instalador);
        if (us.length === 0) return texto(`No encontré ningún instalador que se llame "${instalador}".`);
        if (us.length > 1) return texto(`Hay varios: ${us.map((u) => u.name).join(", ")}. ¿Cuál?`);
        installerId = us[0].id;
        nombreInst = us[0].name;
      }

      const todos = await listInstallerPayments({ installerId, year: anio });
      const modo = estado ?? "PENDIENTES";
      const filtrados = todos.filter((p) =>
        modo === "TODOS"
          ? true
          : modo === "PAGADOS"
            ? p.status === InstallerPaymentStatus.PAGADO
            : p.status !== InstallerPaymentStatus.PAGADO,
      );

      const metricas = await installerPaymentMetrics({ installerId, year: anio ?? hoyUruguay().anio });
      const saldoFiltrado = filtrados.reduce((s, p) => s + p.saldoUsd, 0);
      const hoy = hoyUruguay().iso;

      const renglones = filtrados
        .sort((a, b) => b.saldoUsd - a.saldoUsd)
        .slice(0, TOPE)
        .map((p) => {
          const vence = p.dueDate?.slice(0, 10);
          return (
            `- ${p.clientName}${p.projectCode ? ` [${p.projectCode}]` : ""} · ${p.installerName ?? "SIN INSTALADOR ASIGNADO"}\n` +
            `  total ${usd(p.montoUsd)} · pagado ${usd(p.pagadoUsd)} · debe ${usd(p.saldoUsd)} · ${p.status}` +
            (p.status !== InstallerPaymentStatus.PAGADO && vence
              ? ` · vence ${fechaCorta(vence)}${vence < hoy ? " (VENCIDO)" : ""}`
              : "")
          );
        });

      const sinAsignar = filtrados.filter((p) => !p.installerId).length;

      return texto(
        `Pagos a instaladores${nombreInst ? ` — ${nombreInst}` : ""}`,
        campos([
          [modo === "PENDIENTES" ? "Pendiente de pago" : "Saldo sin pagar de lo listado", usd(saldoFiltrado)],
          [`Total del año ${anio ?? hoyUruguay().anio}`, usd(metricas.totalUsd)],
          [`Pagado en el año`, usd(metricas.pagadoUsd)],
          [`Trabajos en el año`, metricas.trabajos],
          ["Trabajos sin instalador asignado", sinAsignar || null],
        ]),
        filtrados.length
          ? renglones.join("\n") + (filtrados.length > TOPE ? `\n  …y ${filtrados.length - TOPE} más.` : "")
          : "No hay trabajos con ese filtro.",
        "Montos con IVA. Lo que se le debe a un instalador no figura en Pendientes ni en el flujo " +
          "de fondos: solo se ve acá y en la pantalla de Pagos a instaladores.",
      );
    },
  );
}
