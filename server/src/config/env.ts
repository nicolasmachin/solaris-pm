import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), "../.env") });

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  storagePath: process.env.STORAGE_PATH ?? "./storage",
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB ?? 20),
  // Clave para cifrar las passwords SMTP por usuario (AES-256-GCM). Cualquier
  // string sirve: se deriva a 32 bytes con SHA-256.
  smtpEncryptionKey: process.env.SMTP_ENCRYPTION_KEY ?? "",
  // Redirección de correo en desarrollo: si está seteada (y NO estamos en
  // producción), TODOS los mails salientes se redirigen a esta casilla en vez
  // de a los destinatarios reales, para no spamear al equipo mientras se
  // testea. En producción se ignora aunque esté seteada (doble red).
  devEmailRedirectTo: process.env.DEV_EMAIL_REDIRECT_TO ?? "",
};
