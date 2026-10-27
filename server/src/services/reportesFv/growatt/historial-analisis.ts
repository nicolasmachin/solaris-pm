// Lectura del History Data de un inversor: lo que un técnico mira primero.
//
// Lógica pura. Señala lo que en el caso Gustavo Vallegra (oct-2026) costó
// encontrar a mano: una entrada sin nada conectado (≈0 V todo el día mientras
// otra produce), una entrada clavada en su corriente máxima (dos strings en
// paralelo en la misma entrada), huecos de comunicación y el último registro
// antes de un corte.

import type { RegistroTlx } from "./web.client.js";

export interface ResumenEntrada {
  entrada: number; // 1..4
  vMax: number;
  iMax: number;
  energiaKwh: number;
  /** Registros con sol (otra entrada produce > 300 W) en que ésta marca < 20 V. */
  pctSinTension: number;
  /** Registros con corriente a menos de 0,3 A del máximo del día. */
  registrosEnTecho: number;
}

export interface AnalisisHistorial {
  registros: number;
  primero: string | null;
  ultimo: string | null;
  porDia: Record<string, number>;
  huecos: Array<{ desde: string; hasta: string; minutos: number }>;
  entradas: ResumenEntrada[];
  avisos: string[];
  pacMax: number;
  vacMax: number | null;
  ultimoRegistro: RegistroTlx | null;
}

const minutos = (a: string, b: string) => (new Date(b.replace(" ", "T")).getTime() - new Date(a.replace(" ", "T")).getTime()) / 60000;

export function analizarHistorial(
  rs: RegistroTlx[],
  opts: { kwp?: number | null; hasta?: string; hoy?: string } = {},
): AnalisisHistorial {
  const porDia: Record<string, number> = {};
  for (const r of rs) porDia[r.time.slice(0, 10)] = (porDia[r.time.slice(0, 10)] ?? 0) + 1;

  const huecos: AnalisisHistorial["huecos"] = [];
  for (let i = 1; i < rs.length; i++) {
    const m = minutos(rs[i - 1].time, rs[i].time);
    // De noche el datalogger no transmite: un salto que cruza la noche es
    // normal. Sólo es hueco si deja un día sin su tramo de sol.
    const mismoDia = rs[i - 1].time.slice(0, 10) === rs[i].time.slice(0, 10);
    const cortoDeDia = rs[i - 1].time.slice(11, 13) < "17" || rs[i].time.slice(11, 13) > "09";
    if (m > 15 && (mismoDia || (cortoDeDia && m > 18 * 60))) {
      huecos.push({ desde: rs[i - 1].time, hasta: rs[i].time, minutos: Math.round(m) });
    }
  }

  const conSol = rs.filter((r) => (r.ppv ?? 0) > 300);
  const entradas: ResumenEntrada[] = [];
  for (let e = 0; e < 4; e++) {
    const vs = rs.map((r) => r.vpv[e] ?? 0);
    const is = rs.map((r) => r.ipv[e] ?? 0);
    const vMax = Math.max(0, ...vs);
    const iMax = Math.max(0, ...is);
    // Una entrada que nunca pasó de 20 V en todo el período no existe en este
    // equipo (o nunca se usó): no se lista, salvo que otra sí produzca.
    const energiaKwh = rs.reduce((s, r) => s + ((r.ppvN[e] ?? (r.vpv[e] ?? 0) * (r.ipv[e] ?? 0)) * 5) / 60 / 1000, 0);
    const sinTension = conSol.filter((r) => (r.vpv[e] ?? 0) < 20).length;
    const enTecho = iMax > 1 ? is.filter((i) => i >= iMax - 0.3).length : 0;
    if (e >= 2 && vMax < 20) continue;
    entradas.push({
      entrada: e + 1,
      vMax: Math.round(vMax * 10) / 10,
      iMax: Math.round(iMax * 10) / 10,
      energiaKwh: Math.round(energiaKwh * 10) / 10,
      pctSinTension: conSol.length ? Math.round((sinTension / conSol.length) * 100) : 0,
      registrosEnTecho: enTecho,
    });
  }

  const avisos: string[] = [];
  const productivas = entradas.filter((x) => x.iMax > 2);
  for (const x of entradas) {
    if (x.pctSinTension >= 80 && productivas.some((p) => p.entrada !== x.entrada)) {
      avisos.push(
        `La entrada PV${x.entrada} no tiene tensión (< 20 V) en el ${x.pctSinTension} % de los registros con sol, mientras otra entrada produce: no tiene nada conectado, o el string está cortado (termomagnética, fusible, conector).`,
      );
    }
    // Techo = meseta: la corriente se queda en el máximo una parte grande del
    // tiempo con sol (en una planta sana el máximo es un pico, unos pocos registros).
    // Con otra entrada vacía alcanza con que toque el techo varias veces: es la
    // firma de dos strings en paralelo en una entrada (caso Vallegra).
    const hayVacia = entradas.some((o) => o.entrada !== x.entrada && o.pctSinTension >= 80);
    const meseta = conSol.length > 0 && x.registrosEnTecho >= Math.max(6, conSol.length * 0.15);
    if (x.iMax >= 12 && (meseta || (hayVacia && x.registrosEnTecho >= 5))) {
      avisos.push(
        `La entrada PV${x.entrada} llega a ${x.iMax} A y se queda clavada ahí (${x.registrosEnTecho} registros a menos de 0,3 A del máximo): está en el techo de corriente de la entrada y el inversor recorta. Si además hay una entrada vacía, lo más probable es que dos strings estén en paralelo en la misma entrada.`,
      );
    }
  }
  const fallas = rs.filter((r) => (r.faultType ?? 0) !== 0 || (r.warnCode ?? 0) !== 0);
  if (fallas.length) {
    const cods = [...new Set(fallas.map((r) => `falla ${r.faultType ?? 0} / advertencia ${r.warnCode ?? 0}`))];
    avisos.push(`El inversor registró códigos en ${fallas.length} registros: ${cods.slice(0, 5).join("; ")} (primero ${fallas[0].time}).`);
  }
  const derate = rs.filter((r) => (r.deratingMode ?? 0) !== 0 && (r.ppv ?? 0) > 300);
  if (derate.length) avisos.push(`Recorte de potencia del inversor (deratingMode ≠ 0) en ${derate.length} registros con sol.`);
  const vacMax = rs.length ? Math.max(...rs.map((r) => r.vac1 ?? 0)) : null;
  if (vacMax != null && vacMax >= 250) {
    const altos = rs.filter((r) => (r.vac1 ?? 0) >= 250).length;
    avisos.push(`La tensión de red llegó a ${vacMax} V (${altos} registros ≥ 250 V). Cerca del límite de desconexión por sobretensión.`);
  }
  for (const h of huecos) {
    avisos.push(`Sin datos entre ${h.desde} y ${h.hasta} (${Math.round(h.minutos / 60)} h): el datalogger no comunicó; esos datos no existen en Growatt.`);
  }
  // Corte al final: el último dato es de un día pasado y de antes de que baje
  // el sol, y después no hay nada más en el rango pedido.
  const ult = rs.at(-1)?.time;
  if (ult && opts.hoy && ult.slice(0, 10) < opts.hoy && ult.slice(11, 13) < "17" && (!opts.hasta || ult.slice(0, 10) <= opts.hasta)) {
    avisos.push(`El último dato es del ${ult} y después no hay más en el rango pedido: el datalogger dejó de comunicar ese día a esa hora.`);
  }
  const pacMax = rs.length ? Math.max(...rs.map((r) => r.pac ?? 0)) : 0;
  if (opts.kwp && pacMax > 0 && pacMax < opts.kwp * 1000 * 0.65 && conSol.length > 50) {
    avisos.push(`El pico de salida fue ${Math.round(pacMax)} W con ${opts.kwp} kWp instalados (${Math.round((pacMax / (opts.kwp * 1000)) * 100)} %): bajo para un período con días de sol.`);
  }

  return {
    registros: rs.length,
    primero: rs[0]?.time ?? null,
    ultimo: rs.at(-1)?.time ?? null,
    porDia,
    huecos,
    entradas,
    avisos,
    pacMax: Math.round(pacMax),
    vacMax,
    ultimoRegistro: rs.at(-1) ?? null,
  };
}
