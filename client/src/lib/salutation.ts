// Saludo de la carta de la propuesta comercial, derivado del nombre del
// cliente. No se escribe a mano: el nombre ya se ingresa una vez, y tipearlo de
// nuevo con el "Estimado/a" delante era la fuente típica de propuestas que
// saludaban a otra persona.
//
// El género se infiere del primer nombre. Cuando no hay señal confiable se cae
// a "Estimado/a", que es correcto siempre; es preferible a arriesgar un género
// equivocado en la primera línea de la propuesta. Los nombres ambiguos acá
// (Ariel, Noel, Cruz…) quedan a propósito fuera de las dos listas.

// Nombres que contradicen la terminación (-a femenino / -o masculino) o que no
// terminan en vocal y son frecuentes en Uruguay. Van sin tildes: la comparación
// normaliza antes.
const FEMENINOS = new Set([
  "beatriz", "ines", "mercedes", "isabel", "raquel", "ruth", "rut", "judith",
  "carmen", "belen", "soledad", "caridad", "milagros", "dolores", "lourdes",
  "pilar", "nair", "noemi", "rocio", "consuelo", "rosario", "amparo", "marisol",
  "esther", "ester", "astrid", "ingrid", "abigail", "anahi", "araceli", "mabel",
  "maribel", "yamil", "estefani", "jazmin", "yasmin", "carmin", "loreley",
]);

const MASCULINOS = new Set([
  // Terminan en -a pero son masculinos.
  "luca", "nicola", "elia", "noa", "bautista",
  // Terminan en consonante y son frecuentes acá.
  "miguel", "daniel", "gabriel", "rafael", "manuel", "ismael", "jose",
  "andres", "luis", "jesus", "nicolas", "matias", "tomas", "lucas", "marcos",
  "ramon", "adrian", "fabian", "sebastian", "julian", "cristian", "christian",
  "ivan", "martin", "agustin", "joaquin", "nahuel", "axel", "alex", "victor",
  "nestor", "hector", "walter", "javier", "oscar", "cesar", "omar", "edgar",
  "jorge", "felipe", "enrique", "vicente", "jaime", "gaston", "ruben", "raul",
  "saul", "abel", "angel", "leonel", "lionel", "emanuel", "ezequiel", "dylan",
  "brian", "bryan", "kevin", "wilson", "nelson", "milton", "washington",
  "heber", "juan", "german", "hernan", "esteban", "damian", "joel", "israel",
  "amir", "yamandu",
]);

// Sufijos societarios: si el "nombre" es una empresa, no hay a quién tratar en
// singular.
const RAZON_SOCIAL =
  /\b(s\.a\.?|s\.r\.l\.?|srl|sas|ltda|cooperativa|coop\.?|fundaci[oó]n|asociaci[oó]n)\b/i;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// "MIGUEL" y "miguel" se escriben "Miguel" en la carta; un nombre ya escrito en
// mayúsculas y minúsculas mezcladas (McCarthy, De León) se respeta tal cual.
function capitalizar(nombre: string): string {
  const esUniforme = nombre === nombre.toUpperCase() || nombre === nombre.toLowerCase();
  if (!esUniforme) return nombre;
  return nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
}

type Genero = "m" | "f" | null;

// Género del primer nombre, o null si no hay señal confiable.
function generoDe(primerNombre: string): Genero {
  const n = normalizar(primerNombre);
  if (!n) return null;

  if (MASCULINOS.has(n)) return "m";
  if (FEMENINOS.has(n)) return "f";

  // Las únicas terminaciones que discriminan bien sin tildes. El resto
  // (consonantes) queda en "sin señal": no vale el riesgo de errarle.
  if (n.endsWith("a")) return "f";
  if (n.endsWith("o")) return "m";
  return null;
}

/**
 * Saludo completo para la carta, con la coma final incluida.
 *
 *   "Miguel Yenssen"  → "Estimado Miguel,"
 *   "Ana Pérez"       → "Estimada Ana,"
 *   "Nair Rodríguez"  → "Estimada Nair,"
 *   "Ariel Lo"        → "Estimado/a Ariel,"   (sin señal de género)
 *   "Solar SRL"       → "Estimados,"
 *   ""                → "Estimado/a cliente,"
 */
export function saludoPara(nombreCompleto: string): string {
  const limpio = (nombreCompleto ?? "").trim().replace(/\s+/g, " ");
  if (!limpio) return "Estimado/a cliente,";
  if (RAZON_SOCIAL.test(limpio)) return "Estimados,";

  const primerNombre = limpio.split(" ")[0];
  const genero = generoDe(primerNombre);
  const tratamiento = genero === "m" ? "Estimado" : genero === "f" ? "Estimada" : "Estimado/a";
  return `${tratamiento} ${capitalizar(primerNombre)},`;
}
