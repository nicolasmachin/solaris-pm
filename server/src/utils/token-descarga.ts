// Token firmado de vida corta para descargar un archivo desde un enlace.
//
// Ni un `<a href>` ni un `<iframe>` pueden mandar el header Authorization, así
// que el permiso viaja en `?t=`. Lo emiten los endpoints normales (que sí pasan
// por `authenticate` + `authorize`) y queda atado a UN archivo: si el enlace se
// filtra, abre ese archivo y nada más, y solo hasta que vence. Mismo patrón que
// las miniaturas de Capacitación (`capacitacion/miniaturas.service.ts`).

import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { unauthorized } from "./errors.js";

type Payload = { sub: string; role: string; typ: string; rec: string };

export function firmarTokenDescarga(
  user: { id: string; role: string },
  tipo: string,
  recursoId: string,
  vida: string = "30m",
) {
  return jwt.sign({ sub: user.id, role: user.role, typ: tipo, rec: recursoId }, env.jwtSecret, {
    expiresIn: vida,
  } as jwt.SignOptions);
}

export function verificarTokenDescarga(token: string, tipo: string, recursoId: string) {
  let payload: Payload;
  try {
    payload = jwt.verify(token, env.jwtSecret) as Payload;
  } catch {
    throw unauthorized("El enlace venció: recargá la página");
  }
  if (payload.typ !== tipo || payload.rec !== recursoId) {
    throw unauthorized("Este enlace no habilita abrir este archivo");
  }
  return { id: payload.sub, role: payload.role };
}
