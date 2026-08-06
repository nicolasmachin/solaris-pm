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
  // Límite propio para los videos de ensayos. Se aplica SOLO en la ruta de
  // videos (vía `request.file({ limits })`), no toca el techo global de
  // `maxFileSizeMb`: un video crudo de celular pesa dos órdenes de magnitud más
  // que cualquier otro adjunto, y subir el límite global abriría la puerta a que
  // entren archivos gigantes por cualquier endpoint.
  maxVideoSizeMb: Number(process.env.MAX_VIDEO_SIZE_MB ?? 500),
  // Binarios de ffmpeg (vienen en la imagen Docker del server). Configurables
  // para poder correr los tests o un script suelto fuera del contenedor.
  ffmpegPath: process.env.FFMPEG_PATH ?? "ffmpeg",
  ffprobePath: process.env.FFPROBE_PATH ?? "ffprobe",
  // Clave para cifrar las passwords SMTP por usuario (AES-256-GCM). Cualquier
  // string sirve: se deriva a 32 bytes con SHA-256.
  smtpEncryptionKey: process.env.SMTP_ENCRYPTION_KEY ?? "",
  // Redirección de correo en desarrollo: si está seteada (y NO estamos en
  // producción), TODOS los mails salientes se redirigen a esta casilla en vez
  // de a los destinatarios reales, para no spamear al equipo mientras se
  // testea. En producción se ignora aunque esté seteada (doble red).
  devEmailRedirectTo: process.env.DEV_EMAIL_REDIRECT_TO ?? "",
  // ── Conector MCP ────────────────────────────────────────────────────────
  // URL pública del servidor, tal cual la tipea el usuario al agregar el
  // conector. Tiene que coincidir EXACTO con lo que se publica en el
  // documento de metadata: si no coincide, Claude no completa la conexión.
  mcpPublicUrl: process.env.MCP_PUBLIC_URL ?? "http://localhost:4000",
  // Emails habilitados a conectar, separados por coma. Vacío = nadie puede.
  // Es una allowlist explícita a propósito: tener usuario en la app no alcanza
  // para exponer los datos por fuera de ella.
  mcpAllowedEmails: process.env.MCP_ALLOWED_EMAILS ?? "",
};
