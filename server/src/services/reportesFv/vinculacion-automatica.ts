// Vinculación automática de plantas (Growatt y Huawei) a proyectos por nombre.
//
// Pedido de Nicolás (27-oct-2026): una planta que genera en Growatt/Huawei sin
// proyecto en Voltia PM "no puede pasar" — queda fuera del monitoreo y de los
// reportes. Lo contrario sí (un proyecto todavía sin planta).
//
// Criterio deliberadamente estricto, porque vincular mal es peor que no
// vincular: el nombre normalizado de la planta tiene que ser IGUAL al de un
// único proyecto, y ese proyecto no puede tener ya ninguna planta, de ninguna
// marca. Un segundo inversor del mismo cliente se decide a mano (la config del
// reporte guarda una sola planta), y una planta Growatt con el nombre de un
// cliente que está en Huawei suele ser otra cosa: el caso Álvaro García.
// Todo lo demás va al mail para revisarlo.

import { normalizar } from "./growatt/plantas.service.js";

export interface PlantaSinVincular {
  marca: "GROWATT" | "HUAWEI";
  id: string;
  nombre: string;
}

export interface ProyectoCandidato {
  id: string;
  clientName: string;
  tieneGrowatt: boolean;
  tieneHuawei: boolean;
}

export type MotivoSinVincular = "SIN_PROYECTO" | "VARIOS_PROYECTOS" | "PROYECTO_CON_PLANTA";

export const MOTIVO_LABEL: Record<MotivoSinVincular, string> = {
  SIN_PROYECTO: "ningún proyecto se llama igual",
  VARIOS_PROYECTOS: "hay más de un proyecto con ese nombre",
  PROYECTO_CON_PLANTA: "el proyecto ya tiene una planta vinculada",
};

export interface ResultadoMatching {
  vincular: Array<{ planta: PlantaSinVincular; proyecto: ProyectoCandidato }>;
  sinVincular: Array<{ planta: PlantaSinVincular; motivo: MotivoSinVincular; proyectos: ProyectoCandidato[] }>;
}

export function emparejarPlantas(plantas: PlantaSinVincular[], proyectos: ProyectoCandidato[]): ResultadoMatching {
  const porNombre = new Map<string, ProyectoCandidato[]>();
  for (const p of proyectos) {
    const n = normalizar(p.clientName);
    if (!n) continue;
    porNombre.set(n, [...(porNombre.get(n) ?? []), p]);
  }

  const res: ResultadoMatching = { vincular: [], sinVincular: [] };
  // Dos plantas con el mismo nombre no pueden ir al mismo proyecto en la misma corrida.
  const usados = new Set<string>();
  for (const planta of plantas) {
    const candidatos = porNombre.get(normalizar(planta.nombre)) ?? [];
    if (candidatos.length === 0) {
      res.sinVincular.push({ planta, motivo: "SIN_PROYECTO", proyectos: [] });
      continue;
    }
    if (candidatos.length > 1) {
      res.sinVincular.push({ planta, motivo: "VARIOS_PROYECTOS", proyectos: candidatos });
      continue;
    }
    const proyecto = candidatos[0];
    const ocupado = proyecto.tieneGrowatt || proyecto.tieneHuawei || usados.has(proyecto.id);
    if (ocupado) {
      res.sinVincular.push({ planta, motivo: "PROYECTO_CON_PLANTA", proyectos: candidatos });
      continue;
    }
    usados.add(proyecto.id);
    res.vincular.push({ planta, proyecto });
  }
  return res;
}
