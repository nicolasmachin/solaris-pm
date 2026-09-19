// Hora de Uruguay para cortar períodos.
//
// Uruguay es UTC−3 fijo (sin horario de verano). En la base conviven dos
// clases de fechas y cada una se corta distinto:
//
//  - Columnas de SOLO DÍA (`@db.Date`: fin de obra, fin de etapa, fecha de
//    entrega, trámite UTE) y los movimientos financieros, que se guardan a
//    medianoche: representan un día calendario y se comparan tal cual contra
//    días a medianoche UTC. Correrlas de hora las pasaría al día anterior.
//  - Columnas con HORA (`Timestamptz`: cuándo se creó un lead, cuándo se mandó
//    la propuesta, cuándo se cerró la venta): un día de Uruguay empieza a las
//    03:00 UTC. Un lead creado el 30 de junio a las 22:00 es de junio.
//
// Un período se representa siempre en días (`RangoDias`, medianoche UTC) y se
// pasa a instantes con `instantesUruguay()` solo para las columnas con hora.

const OFFSET_URUGUAY_MS = 3 * 3_600_000;

/** [inicio, fin) en días calendario, a medianoche UTC. */
export interface RangoDias {
  inicio: Date;
  fin: Date;
}

/** Instante en que empieza en Uruguay el día calendario `dia` (medianoche UTC). */
export function inicioDiaUruguay(dia: Date): Date {
  return new Date(dia.getTime() + OFFSET_URUGUAY_MS);
}

/** El período en instantes: de las 00:00 de Uruguay del primer día a las 00:00 del día `fin`. */
export function instantesUruguay(r: RangoDias): RangoDias {
  return { inicio: inicioDiaUruguay(r.inicio), fin: inicioDiaUruguay(r.fin) };
}

/** La inversa: un período en instantes de Uruguay pasado a días calendario. */
export function diasDeInstantesUruguay(r: RangoDias): RangoDias {
  return {
    inicio: new Date(r.inicio.getTime() - OFFSET_URUGUAY_MS),
    fin: new Date(r.fin.getTime() - OFFSET_URUGUAY_MS),
  };
}

/** Hoy en Uruguay: año, mes (1-12), día, día de la semana (0 = domingo) e ISO. */
export function hoyUruguay(now: Date = new Date()) {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [anio, mes, dia] = s.split("-").map(Number);
  const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return { anio, mes, dia, diaSemana, iso: s };
}
