// Vinculación de los nombres de la planilla con los proyectos de Voltia PM.
//
// La planilla unía sus 4 fuentes por nombre de persona escrito a mano, y ya
// tenía vínculos rotos: "David Raij" vs "Raij", "Nicolas Pence" vs "SHANGRILA",
// "~Wilmar Ciliuti", "Fernando " con espacio al final. Además hay un proyecto
// duplicado ("Santiago Pons") que por nombre es indistinguible.
//
// Por eso el matching es una cascada explícita, de más confiable a menos, que
// registra POR QUÉ vinculó cada cosa. Nada de esto corre en producción: sólo en
// la migración, y con revisión humana del informe antes de aplicar.

import { normalizar } from "./planillas.js";

export type MetodoMatch =
  | "plant_id"
  | "alias_manual"
  | "nombre_exacto"
  | "email"
  | "tokens"
  | "prefijo"
  | "sufijo_societario";

export interface ProyectoCandidato {
  id: string;
  code: string;
  clientName: string;
  clientEmail: string | null;
  importedFromCsv: boolean;
  capacityKwp: number | null;
}

export interface Match {
  nombrePlanilla: string;
  proyecto: ProyectoCandidato | null;
  metodo: MetodoMatch | null;
  /** Cuando hay más de un candidato plausible, hay que resolverlo a mano. */
  ambiguo: ProyectoCandidato[];
  nota: string | null;
  /** Fila que no corresponde a un generador real: no se vincula ni se crea. */
  descartado: boolean;
}

/**
 * Equivalencias que ninguna regla puede deducir: apodos, razones sociales y
 * nombres de planta que no se parecen al del titular. Se verificaron uno por uno
 * contra la planilla y los proyectos.
 *
 * Clave: nombre normalizado en la planilla → nombre normalizado del proyecto.
 */
export const ALIAS_MANUAL: Record<string, string> = {
  raij: "david raij",
  "wilmar ciliuti": "wilmar ciliuti", // en la planilla viene con "~" al inicio
  shangrila: "nicolas pence",
  barenof: "barenof sa",
  "riverol santiago": "santiago riverol",
};

/**
 * Filas de la planilla que NO corresponden a un generador real y no deben
 * vincularse a ningún proyecto. Se verificaron contra los datos.
 */
export const DESCARTAR: Record<string, string> = {
  // Inversión 7442, 4.25 kWp e inicio 2024-12: idéntico a "Raij". Es una fila
  // duplicada de la planilla, no el proyecto "Fernando Ciaran" (que tiene 6.38 kWp).
  fernando: "fila duplicada de Raij (misma inversión, potencia y fecha)",
};

/** Sufijos societarios que no aportan a la identidad del titular. */
const SUFIJOS = [" sa", " s a", " srl", " s r l", " ltda", " sas", " sca"];

/**
 * ¿Los dos nombres comparten al menos un token significativo?
 *
 * Es el guard del match por email: dos personas distintas pueden compartir
 * casilla (una pareja, o el mail de quien gestionó el trámite). Sin este
 * chequeo, "Antonio Costa Vital" se vinculaba a "Alicia Grunwald" sólo porque
 * la planilla tenía el mail de ella en la fila de él.
 */
function compartenNombre(a: string, b: string): boolean {
  const ta = a.split(" ").filter((t) => t.length >= 4);
  const tb = new Set(b.split(" ").filter((t) => t.length >= 4));
  return ta.some((t) => tb.has(t));
}

function sinSufijo(n: string): string {
  for (const s of SUFIJOS) {
    if (n.endsWith(s)) return n.slice(0, -s.length).trim();
  }
  return n;
}

function tokensOrdenados(n: string): string {
  return n.split(" ").filter(Boolean).sort().join(" ");
}

export interface EntradaMatch {
  nombre: string;
  /** plant_id de Growatt, si se conoce: es el vínculo más confiable. */
  plantId?: string | null;
  /** Email del titular según la planilla, para desempatar homónimos. */
  email?: string | null;
}

/**
 * Resuelve un nombre de planilla contra los proyectos.
 *
 * `vinculadosPorPlantId` mapea plant_id → projectId para las plantas que ya
 * quedaron vinculadas en una corrida anterior.
 */
export function resolverMatch(
  entrada: EntradaMatch,
  proyectos: ProyectoCandidato[],
  vinculadosPorPlantId: Map<string, string> = new Map(),
): Match {
  const nombre = entrada.nombre.trim();
  const norm = normalizar(nombre);
  const base: Omit<Match, "proyecto" | "metodo"> = {
    nombrePlanilla: nombre,
    ambiguo: [],
    nota: null,
    descartado: false,
  };

  const encontrar = (pred: (p: ProyectoCandidato) => boolean) => proyectos.filter(pred);

  // 0. Descartes verificados: filas que no son un generador real.
  const motivoDescarte = DESCARTAR[norm];
  if (motivoDescarte) {
    return { ...base, proyecto: null, metodo: null, nota: `descartada: ${motivoDescarte}`, descartado: true };
  }

  // 1. plant_id — la entidad canónica. Si ya está vinculado, no se discute.
  if (entrada.plantId) {
    const projectId = vinculadosPorPlantId.get(entrada.plantId);
    const p = projectId ? proyectos.find((x) => x.id === projectId) : null;
    if (p) return { ...base, proyecto: p, metodo: "plant_id" };
  }

  // 2. Alias manual — resuelve lo que ninguna regla puede deducir.
  const alias = ALIAS_MANUAL[norm];
  if (alias) {
    const cs = encontrar((p) => normalizar(p.clientName) === alias);
    if (cs.length === 1) return { ...base, proyecto: cs[0], metodo: "alias_manual" };
    if (cs.length > 1) {
      return { ...base, proyecto: null, metodo: null, ambiguo: cs, nota: `alias "${alias}" es ambiguo` };
    }
  }

  // 3. Nombre normalizado exacto.
  const exactos = encontrar((p) => normalizar(p.clientName) === norm);
  if (exactos.length === 1) return { ...base, proyecto: exactos[0], metodo: "nombre_exacto" };

  // 3b. Homónimos: el email desempata (es el caso del "Santiago Pons" duplicado).
  if (exactos.length > 1) {
    if (entrada.email) {
      const porEmail = exactos.filter(
        (p) => p.clientEmail && p.clientEmail.toLowerCase() === entrada.email!.toLowerCase(),
      );
      if (porEmail.length === 1) {
        return { ...base, proyecto: porEmail[0], metodo: "email", nota: "homónimos desempatados por email" };
      }
    }
    return {
      ...base,
      proyecto: null,
      metodo: null,
      ambiguo: exactos,
      nota: `${exactos.length} proyectos con el mismo nombre`,
    };
  }

  // 4. Email exacto — pero sólo si además los nombres comparten algún token.
  //    Ver compartenNombre(): compartir casilla no significa ser la misma persona.
  if (entrada.email) {
    const porEmail = encontrar(
      (p) => !!p.clientEmail && p.clientEmail.toLowerCase() === entrada.email!.toLowerCase(),
    );
    if (porEmail.length === 1) {
      const candidato = porEmail[0];
      if (compartenNombre(norm, normalizar(candidato.clientName))) {
        return { ...base, proyecto: candidato, metodo: "email" };
      }
      return {
        ...base,
        proyecto: null,
        metodo: null,
        ambiguo: [candidato],
        nota: `comparte el mail con "${candidato.clientName}" pero el nombre no coincide`,
      };
    }
  }

  // 5. Mismos tokens en otro orden: "riverol santiago" ≡ "santiago riverol".
  const tk = tokensOrdenados(norm);
  const porTokens = encontrar((p) => tokensOrdenados(normalizar(p.clientName)) === tk);
  if (porTokens.length === 1) return { ...base, proyecto: porTokens[0], metodo: "tokens" };
  if (porTokens.length > 1) {
    return { ...base, proyecto: null, metodo: null, ambiguo: porTokens, nota: "varios con los mismos tokens" };
  }

  // 6. Sufijo societario: "barenof" ≡ "BARENOF SA".
  const sinSuf = sinSufijo(norm);
  const porSufijo = encontrar((p) => sinSufijo(normalizar(p.clientName)) === sinSuf);
  if (porSufijo.length === 1) return { ...base, proyecto: porSufijo[0], metodo: "sufijo_societario" };

  // 7. Prefijo: "hotel lamas 1" ⊂ "Hotel LAMAS 1 - 8038942923".
  //    Se exigen 2 tokens: con uno solo, "fernando" matcheaba "Fernando Ciaran"
  //    siendo que no tenían nada que ver.
  if (norm.length >= 6 && norm.split(" ").filter(Boolean).length >= 2) {
    const porPrefijo = encontrar((p) => normalizar(p.clientName).startsWith(norm));
    if (porPrefijo.length === 1) return { ...base, proyecto: porPrefijo[0], metodo: "prefijo" };
    if (porPrefijo.length > 1) {
      return {
        ...base,
        proyecto: null,
        metodo: null,
        ambiguo: porPrefijo,
        nota: "varios proyectos empiezan igual",
      };
    }
  }

  // 8. Sin match. Se sugieren candidatos por parecido para el informe, pero NO se
  //    vincula nada automáticamente.
  const sugerencias = proyectos
    .map((p) => ({ p, score: similitud(norm, normalizar(p.clientName)) }))
    .filter((x) => x.score >= 0.55)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.p);

  return {
    ...base,
    proyecto: null,
    metodo: null,
    ambiguo: sugerencias,
    nota: sugerencias.length > 0 ? "sin match; hay parecidos" : "sin match",
  };
}

/** Similitud por tokens compartidos (Jaccard). Sólo para sugerir, nunca para vincular. */
export function similitud(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter((t) => t.length > 2));
  const tb = new Set(b.split(" ").filter((t) => t.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let comunes = 0;
  for (const t of ta) if (tb.has(t)) comunes++;
  return comunes / new Set([...ta, ...tb]).size;
}
