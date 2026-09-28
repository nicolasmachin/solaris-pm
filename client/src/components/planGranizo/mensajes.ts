// Mensajes modelo del Plan de Protección contra Granizo, listos para copiar y
// mandar por WhatsApp o mail. Los manda una persona: Voltia PM no le escribe al
// cliente por su cuenta (Manual de Posventa, Anexo D).
//
// Mismo criterio que los mensajes del recorrido (modules/clientes/plantillas.ts):
// son un piso de tono, no un texto obligatorio. Lo que el sistema sabe se
// completa solo; lo que depende de la situación queda como {marcador} a la
// vista, para que se note si falta.
//
// Vocabulario: plan, anualidad, daño por granizo. Nunca "seguro", "póliza",
// "prima" ni "siniestro".

import type { DanioPlan, PlanGranizo } from "../../api/planGranizo.api";
import { fmtFecha } from "./estado";

export type MensajePlan = {
  id: string;
  titulo: string;
  cuando: string;
  cuerpo: string;
  deDanio?: boolean;
};

export const MENSAJES_PLAN: MensajePlan[] = [
  {
    id: "activo",
    titulo: "Plan activo",
    cuando: "Cuando ya tiene el Anexo A firmado y la primera anualidad paga.",
    cuerpo: `Hola {nombre}, ya quedó activo tu Plan de Protección contra Granizo: cubre desde el {cubre desde} hasta el {vence}.

Si graniza y ves paneles dañados, no los toques ni subas al techo. Mandanos fotos tomadas desde el suelo y los datos del Anexo B dentro de los 10 días hábiles, y coordinamos la inspección.`,
  },
  {
    id: "vence",
    titulo: "Aviso de vencimiento",
    cuando: "Cuando el nombre se pone en rojo por \"Por vencer\": las condiciones prometen avisar con 30 días de anticipación.",
    cuerpo: `Hola {nombre}, te escribo por tu Plan de Protección contra Granizo. La anualidad vence el {vence}. Para seguir cubierto un año más son {monto} ({paneles} paneles × {precio} por panel, IVA incluido).{cambio de precio}

Si la pagás antes del {vence}, sigue sin corte. {datos para el pago}

Si preferís no renovarlo, avisame y lo damos de baja.`,
  },
  {
    id: "gracia",
    titulo: "Vencido sin pago (en gracia)",
    cuando: "Venció la anualidad y todavía no pagó. Sigue cubierto 15 días.",
    cuerpo: `Hola {nombre}, la anualidad de tu Plan de Protección contra Granizo venció el {venció} y todavía no nos figura el pago de {monto}.

Tenés hasta el {fin de la gracia} para pagarla sin perder la cobertura. Después el plan queda suspendido y, al pagar, pasan 30 días hasta que vuelve a cubrir. {datos para el pago}`,
  },
  {
    id: "suspendido",
    titulo: "Plan suspendido",
    cuando: "Pasaron más de 15 días del vencimiento sin pago.",
    cuerpo: `Hola {nombre}, tu Plan de Protección contra Granizo quedó suspendido porque la anualidad que venció el {venció} no se pagó. Mientras está suspendido, si graniza no cubre.

Si querés reactivarlo son {monto}, y vuelve a cubrir 30 días después del pago. {datos para el pago}`,
  },
  {
    id: "danio_recibido",
    deDanio: true,
    titulo: "Recibimos el aviso de daño",
    cuando: "El mismo día hábil en que avisa.",
    cuerpo: `Hola {nombre}, recibimos tu aviso por el granizo del {fecha del granizo}, gracias por las fotos. Vamos a coordinar la inspección en los próximos días hábiles: ¿qué días y horarios te quedan bien?

Mientras tanto, no toques los paneles ni subas al techo.`,
  },
  {
    id: "danio_repone",
    deDanio: true,
    titulo: "Confirmación de la reposición",
    cuando: "Después de la inspección: cuántos paneles se reponen y la fecha.",
    cuerpo: `Hola {nombre}, ya revisamos tu instalación: vamos a reponer {paneles a reponer} paneles dañados por el granizo, sin ningún costo para vos. La reposición la hacemos el {fecha de reposición}.

Cualquier cosa, escribime.`,
  },
  {
    id: "danio_no_repone",
    deDanio: true,
    titulo: "No corresponde reponer",
    cuando: "Si algo no se repone: se dice por qué, citando la sección de las condiciones.",
    cuerpo: `Hola {nombre}, revisamos tu instalación después del granizo del {fecha del granizo}. En este caso no corresponde reponer: {causal}.

Si tenés cualquier duda, escribime y lo vemos.`,
  },
  {
    id: "danio_cierre",
    deDanio: true,
    titulo: "Paneles repuestos",
    cuando: "Al terminar la reposición.",
    cuerpo: `Hola {nombre}, ya quedaron repuestos los paneles y verificamos que la instalación vuelve a generar normalmente.

Cualquier cosa, escribime.`,
  },
];

function usd(n: number) {
  return `USD ${n.toLocaleString("es-UY", { maximumFractionDigits: 2 })}`;
}

function sumarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Mensaje sugerido según el estado del plan (o del daño).
export function mensajeSugerido(plan: PlanGranizo, danio?: DanioPlan | null): string {
  if (danio) {
    if (danio.estado === "REPORTADO") return "danio_recibido";
    if (danio.estado === "EVALUADO") return "danio_repone";
    if (danio.estado === "REPUESTO") return "danio_cierre";
    return "danio_no_repone";
  }
  const e = plan.estado.estado;
  if (e === "POR_VENCER" || e === "VENCIDA") return "vence";
  if (e === "EN_GRACIA") return "gracia";
  if (e === "SUSPENDIDA") return "suspendido";
  return "activo";
}

export function renderMensaje(cuerpo: string, plan: PlanGranizo, referente: string | null, danio?: DanioPlan | null): string {
  const e = plan.estado;
  const primerNombre = plan.project.clientName.trim().split(/\s+/)[0] ?? "";
  const cobro = e.proximoCobro;
  const anualidad = cobro?.periodoId ? plan.periodos.find((p) => p.id === cobro.periodoId) : null;
  const anterior = anualidad ? plan.periodos.find((p) => p.numero === anualidad.numero - 1) : null;
  const precio = anualidad?.precioPorPanelUsd ?? plan.precioPorPanelUsd;
  const paneles = anualidad?.cantidadPaneles ?? plan.cantidadPaneles;
  const cambio =
    anterior && anualidad && anterior.precioPorPanelUsd !== anualidad.precioPorPanelUsd
      ? ` El precio por panel pasa de ${usd(anterior.precioPorPanelUsd)} a ${usd(anualidad.precioPorPanelUsd)}.`
      : "";

  const valores: Record<string, string | null> = {
    nombre: primerNombre || null,
    referente,
    "cubre desde": e.coberturaDesde ? fmtFecha(e.coberturaDesde) : null,
    vence: e.vencimiento ? fmtFecha(e.vencimiento) : null,
    monto: cobro ? usd(cobro.montoUsd) : usd(plan.montoAnualUsd),
    paneles: String(paneles),
    precio: usd(precio),
    "cambio de precio": cambio,
    venció: cobro?.fecha ? fmtFecha(cobro.fecha) : null,
    "fin de la gracia": cobro?.fecha ? fmtFecha(sumarDias(cobro.fecha, 15)) : null,
    "fecha del granizo": danio ? fmtFecha(danio.fechaEvento) : null,
    "paneles a reponer": danio?.panelesRepuestos != null ? String(danio.panelesRepuestos) : danio?.panelesAfectados != null ? String(danio.panelesAfectados) : null,
    "fecha de reposición": danio?.fechaReposicion ? fmtFecha(danio.fechaReposicion) : null,
    causal: danio?.motivoRechazoLabel ? danio.motivoRechazoLabel.replace(" — sección", " (sección") + ")" : null,
  };
  let out = cuerpo;
  for (const [k, v] of Object.entries(valores)) {
    if (v != null) out = out.replaceAll(`{${k}}`, v);
  }
  return out;
}
