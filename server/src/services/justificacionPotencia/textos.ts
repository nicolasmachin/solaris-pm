// Texto automático del informe de justificación de potencia. Toma las frases
// de los informes que Voltia mandó a UTE a mano (ESTILO, Soler, Filippa,
// García Rodríguez, Coviteja) y las completa con los datos y el balance.
// Cualquier texto que el proyectista haya escrito (o redactado con IA) gana:
// el automático solo rellena los vacíos.

import type { Balance } from "./calculo.js";
import { fmtNum } from "./calculo.js";
import type { DatosJustificacion, MotivoAntecedente, Textos } from "./schema.js";

const NO_REPRESENTATIVO =
  "Por tal motivo, el consumo histórico registrado hasta la fecha no resulta representativo de la demanda futura esperada.";

const ANTECEDENTES: Record<MotivoAntecedente, string> = {
  NUEVAS_CARGAS:
    "Se prevé un incremento significativo de la demanda eléctrica del suministro en los próximos meses, debido a la incorporación de nuevas cargas de elevada potencia y uso frecuente.",
  EN_CONSTRUCCION:
    "La edificación e infraestructura asociadas al suministro se encuentran actualmente en construcción, por lo que las principales cargas proyectadas aún no se encuentran operativas.",
  RECIEN_HABILITADO:
    "El suministro corresponde a una instalación habilitada recientemente, cuyas instalaciones se encuentran en proceso de ocupación y puesta en funcionamiento.",
  UNIFICACION:
    "Se incorporan al suministro cargas previamente abastecidas por otros servicios, que se centralizan en la cuenta actual.",
};

export const MOTIVO_ANTECEDENTE_LABELS: Record<MotivoAntecedente, string> = {
  NUEVAS_CARGAS: "Se suman cargas nuevas",
  EN_CONSTRUCCION: "Obra en construcción",
  RECIEN_HABILITADO: "Instalación recién habilitada",
  UNIFICACION: "Mudanza o unificación de cuentas",
};

function suministroRef(d: DatosJustificacion): string {
  const cuenta = d.cliente.cuentaUte.trim();
  return cuenta ? `al suministro N° ${cuenta}` : "al suministro indicado";
}

function listaConceptos(d: DatosJustificacion): string {
  // Solo la inicial en minúscula: "SUM" o "UTE" tienen que quedar como están.
  const conceptos = d.cargas.map((c) => {
    const t = c.concepto.trim().replace(/\.$/, "");
    return t.charAt(0).toLowerCase() + t.slice(1);
  });
  if (conceptos.length <= 1) return conceptos[0] ?? "";
  return `${conceptos.slice(0, -1).join(", ")} y ${conceptos[conceptos.length - 1]}`;
}

export function textoObjeto(d: DatosJustificacion): string {
  const kw = fmtNum(d.potenciaSolicitadaKw, 2);
  const sistema =
    d.tipoSolicitud === "AMPLIACION"
      ? `la ampliación del sistema de microgeneración fotovoltaica asociado ${suministroRef(d)} a una potencia de ${kw} kW`
      : `la instalación de un sistema de microgeneración fotovoltaica de ${kw} kW asociado ${suministroRef(d)}`;
  return `El presente informe tiene como objetivo justificar el incremento de consumo eléctrico previsto, a efectos de respaldar ${sistema}.`;
}

export function textoAntecedentes(d: DatosJustificacion): string {
  return `${ANTECEDENTES[d.motivoAntecedente]}\n\n${NO_REPRESENTATIVO}`;
}

export function textoJustificacion(d: DatosJustificacion, b: Balance): string {
  const partes: string[] = [];
  if (b.consumoActualEstimadoDesdeUte) {
    partes.push(
      `El consumo actual del suministro es del orden de ${fmtNum(b.consumoAnualActualKwh)} kWh anuales. Sumando el incremento estimado de ${fmtNum(b.incrementoMensualKwh)} kWh/mes (${fmtNum(b.incrementoAnualKwh)} kWh/año), el consumo anual proyectado del suministro asciende a ${fmtNum(b.consumoAnualProyectadoKwh)} kWh.`,
    );
  } else if (b.consumoAnualActualKwh > 0) {
    partes.push(
      `El consumo registrado en el último año es del orden de ${fmtNum(b.consumoAnualActualKwh)} kWh. Sumando el incremento estimado de ${fmtNum(b.incrementoMensualKwh)} kWh/mes (${fmtNum(b.incrementoAnualKwh)} kWh/año), el consumo anual proyectado del suministro asciende a ${fmtNum(b.consumoAnualProyectadoKwh)} kWh.`,
    );
  } else {
    partes.push(
      `Considerando un consumo futuro estimado de ${fmtNum(b.incrementoMensualKwh)} kWh/mes, el consumo anual proyectado del suministro asciende a ${fmtNum(b.consumoAnualProyectadoKwh)} kWh.`,
    );
  }
  partes.push(
    `Un sistema fotovoltaico de ${fmtNum(b.potenciaSolicitadaKw, 2)} kW genera del orden de ${fmtNum(b.generacionAnualKwh)} kWh por año (estimación de ${fmtNum(b.productividadKwhKw)} kWh por kW instalado).`,
  );
  if (b.cumpleBalance) {
    partes.push(
      "Dicha generación no supera el consumo anual proyectado, por lo que la potencia solicitada resulta coherente con el balance anual de energía del suministro.",
    );
  } else {
    partes.push(
      `Dicha generación supera el consumo anual proyectado: el consumo estimado justifica una potencia de generación del orden de ${fmtNum(b.potenciaJustificadaKw, 2)} kW.`,
    );
  }
  return partes.join(" ");
}

export function textoConclusion(d: DatosJustificacion, b: Balance): string {
  const kw = fmtNum(d.potenciaSolicitadaKw, 2);
  const motivo = listaConceptos(d);
  const intro = motivo
    ? `Debido a la incorporación de nuevos consumos (${motivo}), se prevé un incremento significativo del consumo eléctrico del suministro, alcanzando una demanda estimada del orden de ${fmtNum(b.consumoAnualProyectadoKwh)} kWh por año.`
    : `Se prevé un consumo eléctrico del orden de ${fmtNum(b.consumoAnualProyectadoKwh)} kWh por año.`;
  const cierre = b.cumpleBalance
    ? `Por lo tanto, se considera técnicamente justificada la instalación del sistema de microgeneración fotovoltaica de ${kw} kW solicitado.`
    : `Por lo tanto, se considera técnicamente justificada una potencia de generación de hasta ${fmtNum(b.potenciaJustificadaKw, 2)} kW.`;
  return `${intro}\n\n${cierre}`;
}

export function textosAutomaticos(d: DatosJustificacion, b: Balance): Textos {
  return {
    objeto: textoObjeto(d),
    antecedentes: textoAntecedentes(d),
    justificacion: textoJustificacion(d, b),
    conclusion: textoConclusion(d, b),
  };
}

/** Los textos que van al PDF: lo escrito a mano y, donde está vacío, el automático. */
export function textosFinales(d: DatosJustificacion, b: Balance): Textos {
  const auto = textosAutomaticos(d, b);
  const pick = (k: keyof Textos) => (d.textos[k].trim() ? d.textos[k].trim() : auto[k]);
  return {
    objeto: pick("objeto"),
    antecedentes: pick("antecedentes"),
    justificacion: pick("justificacion"),
    conclusion: pick("conclusion"),
  };
}
