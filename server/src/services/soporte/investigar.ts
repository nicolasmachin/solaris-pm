// Ir a mirar un día rojo, sin que nadie lo pida.
//
// Cuando una planta genera menos del 60 % de lo normal un día, se lee (solo
// para esa planta) el historial cada 5 minutos del inversor de ESE día y sus
// alarmas de las últimas dos semanas, y se escribe en el caso qué se encontró.
// Si hay una falla con código, el caso pasa a "falla del inversor" (y "se
// repite" si el código vino más de un día). Caso que lo motivó: Martín
// González, aislación baja (203) a la mañana, que el total del día no siempre
// delataba pero el inversor sí.
//
// Solo Growatt (la web de Growatt da el historial y las alarmas). Dos
// consultas por día rojo.

import { SoporteCasoTipo } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { analizarHistorial } from "../reportesFv/growatt/historial-analisis.js";
import { alarmasPlanta, historialInversor, tipoConHistorial, webConfigurada } from "../reportesFv/growatt/web.client.js";
import { describirCodigo } from "./codigos.js";

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const restarDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

export async function investigarDia(casoId: string, projectId: string, dia: string): Promise<void> {
  if (!webConfigurada()) return;
  try {
    const planta = await prisma.growattPlant.findFirst({
      where: { projectId },
      select: { plantId: true, devices: { select: { deviceSn: true, tipo: true } }, project: { select: { capacityKwp: true } } },
    });
    if (!planta) return;
    const partes: string[] = [];
    let codigoDelDia: number | null = null;

    // El historial cada 5 minutos de ese día.
    const inversor = planta.devices.find((d) => tipoConHistorial(d.tipo));
    if (inversor) {
      const rs = await historialInversor(inversor.deviceSn, inversor.tipo as 4 | 7, dia, dia);
      const a = analizarHistorial(rs, { kwp: Number(planta.project?.capacityKwp) || null, hoy: dia });
      for (const f of a.fallaConSol) {
        partes.push(`estuvo en falla con sol de ${f.desde} a ${f.hasta} (código ${f.codigos.join(", ")})`);
        codigoDelDia = codigoDelDia ?? f.codigos[0] ?? null;
      }
      if (a.aislamiento?.minEnFalla != null && a.aislamiento.minEnFalla < 100) {
        partes.push(`el aislamiento de los paneles bajó a ${a.aislamiento.minEnFalla} kΩ`);
      }
      const huecos = a.huecos.filter((h) => h.minutos >= 60);
      if (huecos.length) partes.push(`${huecos.length} ${huecos.length === 1 ? "corte" : "cortes"} de comunicación de más de una hora`);
      for (const aviso of a.avisos) {
        if (/no tiene tensión|Recorte de potencia|en su corriente máxima|string/i.test(aviso) && !/^Sin datos/.test(aviso)) {
          partes.push(aviso.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase()));
        }
      }
    }

    // Las alarmas de las últimas dos semanas: ¿el código vino otros días?
    let diasConCodigo: string[] = [];
    if (codigoDelDia != null) {
      const alarmas = await alarmasPlanta(String(planta.plantId), restarDias(dia, 14), dia);
      diasConCodigo = [
        ...new Set(alarmas.filter((x) => new RegExp(`\\b${codigoDelDia}\\b`).test(x.codigo)).map((x) => x.time.slice(0, 10))),
      ].sort();
    }

    const caso = await prisma.soporteCaso.findUnique({ where: { id: casoId }, select: { detalle: true } });
    if (!caso) return;
    if (codigoDelDia != null) {
      const falla = describirCodigo(codigoDelDia, null)!;
      const repite = diasConCodigo.length > 1;
      await prisma.soporteCaso.update({
        where: { id: casoId },
        data: {
          tipo: SoporteCasoTipo.FALLA_INVERSOR,
          codigoFalla: codigoDelDia,
          titulo: repite ? `Se repite: ${falla.titulo}` : falla.titulo,
          recurrente: repite ? true : undefined,
          detalle: `${caso.detalle} Al mirar el inversor el ${ddmm(dia)}: ${partes.join("; ")}.${
            repite ? ` Esa falla vino ${diasConCodigo.length} días en las últimas dos semanas (${diasConCodigo.map(ddmm).join(", ")}).` : ""
          } ${falla.queHacer}`,
        },
      });
    } else {
      await prisma.soporteCaso.update({
        where: { id: casoId },
        data: {
          detalle: `${caso.detalle} ${
            partes.length
              ? `Al mirar el inversor el ${ddmm(dia)}: ${partes.join("; ")}.`
              : `Al mirar el inversor el ${ddmm(dia)} no se ve falla ni corte: puede ser sombra nueva, suciedad o un grupo de paneles que rinde menos. Queda en observación; si vuelve a pasar, conviene la curva del día y una visita.`
          }`,
        },
      });
    }
  } catch (err) {
    console.error("[soporte] no se pudo mirar el día rojo:", (err as Error).message);
  }
}
