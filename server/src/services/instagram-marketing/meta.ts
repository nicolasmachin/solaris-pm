/**
 * Las llamadas a Meta (Graph API) para Instagram de @voltia_uy.
 *
 * El token lo tiene el servidor de indicadores, que lo renueva solo y lo usan
 * también los anuncios y las métricas: un solo token, un solo vencimiento.
 * Voltia PM se lo pide por `GET <INSTAGRAM_CONECTOR_URL>/interno/token-meta`
 * con el secreto compartido, y con él saca el token de la página (cada hora).
 * Ningún token se loguea.
 */

import { IG, instagramConectorConfig } from "./config.js";

export class ErrorMeta extends Error {}

const TIMEOUT_MS = 30_000;

let tokenUsuario: { token: string; hasta: number } | null = null;
let tokenPagina: { token: string; hasta: number } | null = null;

async function json(res: Response): Promise<Record<string, any>> {
  return (await res.json().catch(() => ({}))) as Record<string, any>;
}

/** El token de Meta vigente, pedido a indicadores (cacheado 30 minutos). */
async function tokenDeIndicadores(): Promise<string> {
  if (tokenUsuario && tokenUsuario.hasta > Date.now()) return tokenUsuario.token;
  const { url, secreto } = instagramConectorConfig();
  if (!url || !secreto) {
    throw new ErrorMeta("Falta INSTAGRAM_CONECTOR_URL o INSTAGRAM_CONECTOR_SECRETO: no hay de dónde sacar el token de Meta.");
  }
  let res: Response;
  try {
    res = await fetch(`${url}/interno/token-meta`, {
      headers: { Authorization: `Bearer ${secreto}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new ErrorMeta(`Indicadores no contestó al pedir el token (${err instanceof Error ? err.name : "error"}).`);
  }
  const datos = await json(res);
  if (!res.ok || typeof datos.token !== "string" || !datos.token) {
    throw new ErrorMeta(`Indicadores no dio el token de Meta (HTTP ${res.status}).`);
  }
  tokenUsuario = { token: datos.token, hasta: Date.now() + 30 * 60_000 };
  return datos.token;
}

/** El token de la página Voltia (el que manda mensajes), pedido cada hora. */
export async function tokenDePagina(): Promise<string> {
  if (tokenPagina && tokenPagina.hasta > Date.now()) return tokenPagina.token;
  const u = new URL(`${IG.graph}/${IG.pagina}`);
  u.searchParams.set("fields", "access_token");
  u.searchParams.set("access_token", await tokenDeIndicadores());
  const datos = await json(await fetch(u, { signal: AbortSignal.timeout(TIMEOUT_MS) }));
  if (!datos.access_token) {
    throw new ErrorMeta(`Meta no dio el token de la página: ${datos.error?.message ?? "sin detalle"}`);
  }
  tokenPagina = { token: datos.access_token, hasta: Date.now() + 3600_000 };
  return datos.access_token;
}

async function get(ruta: string, params: Record<string, string>, token?: string): Promise<Record<string, any>> {
  const u = new URL(`${IG.graph}/${ruta}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("access_token", token ?? (await tokenDeIndicadores()));
  let datos: Record<string, any>;
  try {
    datos = await json(await fetch(u, { signal: AbortSignal.timeout(TIMEOUT_MS) }));
  } catch (err) {
    throw new ErrorMeta(`No se pudo leer ${ruta.split("/")[0]} (${err instanceof Error ? err.name : "error"}).`);
  }
  if (datos.error) throw new ErrorMeta(datos.error.message ?? "error de Meta");
  return datos;
}

async function postPagina(cuerpo: unknown): Promise<Record<string, any>> {
  const token = await tokenDePagina();
  let datos: Record<string, any>;
  try {
    datos = await json(
      await fetch(`${IG.graph}/${IG.pagina}/messages?access_token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
    );
  } catch (err) {
    throw new ErrorMeta(`No se pudo mandar el mensaje (${err instanceof Error ? err.name : "error"}).`);
  }
  if (datos.error) throw new ErrorMeta(`Meta no dejó mandar el mensaje: ${datos.error.message ?? ""}`);
  return datos;
}

/** Un id de la Graph API: solo dígitos, para que no se pueda armar otra ruta. */
function id(texto: string): string {
  if (!/^\d+$/.test(texto)) throw new ErrorMeta(`'${texto}' no es un id de Instagram.`);
  return texto;
}

// ── Privados ────────────────────────────────────────────────────────────────

/** Manda un mensaje privado. Devuelve el id del mensaje en Meta. */
export async function enviarMensaje(persona: string, texto: string): Promise<string> {
  const datos = await postPagina({ recipient: { id: id(persona) }, message: { text: texto } });
  return String(datos.message_id ?? "");
}

/** Los tres puntitos de "escribiendo…". Si Meta no lo acepta, no pasa nada. */
export async function mostrarEscribiendo(persona: string): Promise<void> {
  try {
    await postPagina({ recipient: { id: id(persona) }, sender_action: "typing_on" });
  } catch {
    /* no importa */
  }
}

export const BOTON_MAS_INFO = "Quiero más info";

/**
 * Respuesta privada a un comentario (Meta deja una por comentario, hasta 7 días
 * después). Va con el botón "Quiero más info"; si Meta no lo acepta, sale solo
 * el texto. Devuelve [id de la persona, id del mensaje].
 */
export async function privadoAComentario(comentarioId: string, texto: string): Promise<[string, string]> {
  const conBoton = {
    text: texto,
    quick_replies: [{ content_type: "text", title: BOTON_MAS_INFO, payload: "MAS_INFO" }],
  };
  let ultimo = "";
  for (const message of [conBoton, { text: texto }]) {
    try {
      const datos = await postPagina({ recipient: { comment_id: id(comentarioId) }, message });
      return [String(datos.recipient_id ?? ""), String(datos.message_id ?? "")];
    } catch (err) {
      ultimo = err instanceof Error ? err.message : String(err);
    }
  }
  throw new ErrorMeta(ultimo || "Meta no dejó mandar el privado");
}

export type Perfil = { username?: string; name?: string; is_user_follow_business?: boolean };
const perfiles = new Map<string, Perfil>();

/** Usuario, nombre y si sigue a @voltia_uy. Vacío si Meta no lo da. */
export async function perfil(persona: string): Promise<Perfil> {
  const enCache = perfiles.get(persona);
  if (enCache) return enCache;
  try {
    const datos = await get(id(persona), { fields: "username,name,is_user_follow_business" }, await tokenDePagina());
    perfiles.set(persona, datos);
    return datos;
  } catch {
    return {};
  }
}

// ── Comentarios ─────────────────────────────────────────────────────────────

const CAMPOS_COMENTARIO = "id,text,username,from{id,username},timestamp,like_count";

export type Publicacion = { id: string; permalink?: string; caption?: string };
let publicaciones: { lista: Publicacion[]; hasta: number } | null = null;

async function todasLasPublicaciones(forzar = false): Promise<Publicacion[]> {
  if (!forzar && publicaciones && publicaciones.hasta > Date.now()) return publicaciones.lista;
  const lista: Publicacion[] = [];
  let after = "";
  for (let i = 0; i < 20; i++) {
    const params: Record<string, string> = { fields: "id,permalink,caption", limit: "100" };
    if (after) params.after = after;
    const datos = await get(`${IG.cuenta}/media`, params);
    lista.push(...((datos.data as Publicacion[]) ?? []));
    after = datos.paging?.cursors?.after ?? "";
    if (!after || !datos.paging?.next) break;
  }
  publicaciones = { lista, hasta: Date.now() + 30 * 60_000 };
  return lista;
}

/** La publicación del perfil de @voltia_uy con ese id. Si no es nuestra, falla. */
export async function publicacionPropia(mediaId: string): Promise<Publicacion> {
  id(mediaId);
  const p = (await todasLasPublicaciones()).find((x) => x.id === mediaId) ??
    (await todasLasPublicaciones(true)).find((x) => x.id === mediaId);
  if (!p) throw new ErrorMeta("Esa publicación no está en el perfil de @voltia_uy.");
  return p;
}

export type ComentarioMeta = {
  id: string;
  text?: string;
  username?: string;
  from?: { id?: string; username?: string };
  parent_id?: string;
  media?: { id?: string };
  replies?: { data?: Array<{ username?: string; from?: { id?: string; username?: string } }> };
};

export async function comentario(comentarioId: string): Promise<ComentarioMeta> {
  return (await get(id(comentarioId), {
    fields: `media{id},parent_id,${CAMPOS_COMENTARIO},replies{${CAMPOS_COMENTARIO}}`,
  })) as ComentarioMeta;
}

/** Publica la respuesta a un comentario. Las validaciones están en comentarios.ts. */
export async function responderComentario(comentarioId: string, texto: string): Promise<string> {
  const token = await tokenDeIndicadores();
  const cuerpo = new URLSearchParams({ message: texto, access_token: token });
  let datos: Record<string, any>;
  try {
    datos = await json(
      await fetch(`${IG.graph}/${id(comentarioId)}/replies`, {
        method: "POST",
        body: cuerpo,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
    );
  } catch (err) {
    throw new ErrorMeta(`No se pudo contestar el comentario (${err instanceof Error ? err.name : "error"}).`);
  }
  if (datos.error) throw new ErrorMeta(datos.error.message ?? "error de Meta");
  return String(datos.id ?? "");
}
