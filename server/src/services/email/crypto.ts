import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { env } from "../../config/env.js";

// Cifrado simétrico para las passwords SMTP por usuario. AES-256-GCM (autenticado:
// detecta manipulación). La clave de 32 bytes se deriva con SHA-256 de
// SMTP_ENCRYPTION_KEY, así cualquier string de .env sirve como clave.
const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = env.smtpEncryptionKey;
  if (!raw) {
    throw new Error("SMTP_ENCRYPTION_KEY no está configurada: no se pueden cifrar credenciales SMTP");
  }
  return createHash("sha256").update(raw).digest();
}

export function isEncryptionConfigured(): boolean {
  return Boolean(env.smtpEncryptionKey);
}

// Formato persistido: base64(iv).base64(authTag).base64(ciphertext)
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, ctB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error("Formato de secreto cifrado inválido");
  }
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}
