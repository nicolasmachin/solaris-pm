/**
 * El texto de un aviso: variables, validación y pasaje al formato de Meta.
 *
 * El usuario escribe con nombres ({{cliente.nombre}}) y Meta pide huecos
 * numerados ({{1}}, {{2}}…) con un ejemplo cada uno. Acá se hace esa
 * traducción, y se guarda el orden para rellenar los huecos al mandar.
 */

import { VARIABLES, variablesDe } from "./disparadores.js";

const RE_VARIABLE = /\{\{\s*([a-zA-Z.]+)\s*\}\}/g;

/** Las variables en el orden en que aparecen (con repetidas). */
export function variablesDelTexto(texto: string): string[] {
  return [...texto.matchAll(RE_VARIABLE)].map((m) => m[1]);
}

/**
 * Problemas del texto, en palabras del usuario. Vacío = se puede usar.
 * Las reglas de WhatsApp son las que hacen rechazar una plantilla en Meta.
 */
export function problemasDelTexto(texto: string, disparador: string, canal: "WHATSAPP" | "EMAIL"): string[] {
  const problemas: string[] = [];
  const t = texto.trim();
  if (!t) return ["El mensaje está vacío."];
  const permitidas = new Set(variablesDe(disparador));
  for (const v of new Set(variablesDelTexto(t))) {
    if (!VARIABLES[v]) problemas.push(`{{${v}}} no es una variable que Voltia PM conozca.`);
    else if (!permitidas.has(v)) problemas.push(`{{${v}}} no tiene dato con este disparador.`);
  }
  const sinLlaves = t.replace(RE_VARIABLE, "");
  if (/\{\{|\}\}/.test(sinLlaves)) problemas.push("Hay llaves {{ }} mal cerradas.");
  if (canal === "WHATSAPP") {
    if (t.length > 1024) problemas.push(`WhatsApp acepta hasta 1024 caracteres (tiene ${t.length}).`);
    if (/^\{\{/.test(t) || /\}\}[.!?]?$/.test(t)) {
      problemas.push("WhatsApp no acepta que el mensaje empiece o termine con una variable: agregá texto antes o después.");
    }
    if (/\}\}\s*\{\{/.test(t)) problemas.push("WhatsApp no acepta dos variables seguidas: poné texto entre ellas.");
    if (/\n{3,}/.test(t)) problemas.push("WhatsApp no acepta más de un renglón en blanco seguido.");
  }
  return problemas;
}

/** El cuerpo con huecos numerados para Meta, el orden de las variables y un ejemplo por hueco. */
export function aFormatoMeta(texto: string): { cuerpo: string; variables: string[]; ejemplos: string[] } {
  const variables: string[] = [];
  const cuerpo = texto.trim().replace(RE_VARIABLE, (_m, v: string) => {
    variables.push(v);
    return `{{${variables.length}}}`;
  });
  return { cuerpo, variables, ejemplos: variables.map((v) => VARIABLES[v]?.ejemplo ?? v) };
}

/** El texto con los datos del cliente. Las que no tienen dato quedan en `faltan`. */
export function rellenar(texto: string, datos: Record<string, string | null | undefined>) {
  const faltan = new Set<string>();
  const salida = texto.trim().replace(RE_VARIABLE, (m, v: string) => {
    const valor = datos[v]?.trim();
    if (!valor) {
      faltan.add(v);
      return m;
    }
    return valor;
  });
  return { texto: salida, faltan: [...faltan] };
}

/** Nombre de plantilla válido para Meta: minúsculas, números y guion bajo. */
export function nombrePlantilla(nombreAviso: string, sufijo: string): string {
  const base = nombreAviso
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `aviso_${base || "cliente"}_${sufijo}`;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * "lunes 3 de noviembre". Las fechas sin hora (@db.Date) vienen a la medianoche
 * UTC y se leen en UTC; las que tienen hora, en hora de Uruguay.
 */
export function fechaLarga(d: Date): string {
  const soloFecha = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  const local = soloFecha ? d : new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return `${DIAS[local.getUTCDay()]} ${local.getUTCDate()} de ${MESES[local.getUTCMonth()]}`;
}
