/**
 * Lectura del aviso que manda Meta al webhook de Instagram (objeto
 * `instagram`, campos `messages`, `messaging_postbacks` y `comments`). Lógica
 * pura, con pruebas.
 */

export type MensajeAviso = {
  mid: string;
  de: string;
  para: string;
  momentoMs: number;
  texto: string;
  /** Fotos, audios, videos, historias compartidas: solo el tipo. */
  adjuntos: string[];
  /** Lo que manda la propia cuenta (el asistente, ManyChat o el celular) vuelve como eco. */
  esEco: boolean;
  /** La conversación empezó en un anuncio que lleva a Instagram Direct. */
  anuncio: boolean;
};

export type ComentarioAviso = {
  id: string;
  texto: string;
  deId: string;
  usuario: string;
  mediaId: string;
  parentId: string;
};

type Aviso = { entry?: Array<{ messaging?: any[]; changes?: any[] }> };

/** Los mensajes de verdad (y los botones apretados). Lecturas, reacciones y borrados no cuentan. */
export function mensajesDelAviso(datos: Aviso): MensajeAviso[] {
  const salida: MensajeAviso[] = [];
  for (const entrada of datos.entry ?? []) {
    for (const m of entrada.messaging ?? []) {
      let mensaje = m.message;
      if (!mensaje && m.postback) {
        // Un botón apretado ("Quiero más info"): cuenta como si lo escribiera.
        mensaje = { mid: m.postback.mid ?? "", text: m.postback.title ?? "" };
      }
      if (!mensaje || mensaje.is_deleted) continue;
      salida.push({
        mid: String(mensaje.mid ?? ""),
        de: String(m.sender?.id ?? ""),
        para: String(m.recipient?.id ?? ""),
        momentoMs: Number(m.timestamp ?? Date.now()),
        texto: mensaje.text ?? "",
        adjuntos: (mensaje.attachments ?? []).map((a: any) => a?.type ?? "archivo"),
        esEco: Boolean(mensaje.is_echo),
        anuncio: Boolean((mensaje.referral ?? m.referral ?? {}).ad_id),
      });
    }
  }
  return salida;
}

export function comentariosDelAviso(datos: Aviso): ComentarioAviso[] {
  const salida: ComentarioAviso[] = [];
  for (const entrada of datos.entry ?? []) {
    for (const cambio of entrada.changes ?? []) {
      if (cambio?.field !== "comments") continue;
      const v = cambio.value ?? {};
      if (!v.id) continue;
      salida.push({
        id: String(v.id),
        texto: v.text ?? "",
        deId: String(v.from?.id ?? ""),
        usuario: v.from?.username ?? "",
        mediaId: String(v.media?.id ?? ""),
        parentId: String(v.parent_id ?? ""),
      });
    }
  }
  return salida;
}

/** El texto que se guarda: lo escrito más "[Mandó: image]" por cada adjunto. */
export function textoDe(m: Pick<MensajeAviso, "texto" | "adjuntos">): string {
  return [m.texto, ...m.adjuntos.map((a) => `[Mandó: ${a}]`)].filter(Boolean).join(" ").trim();
}
