// Autenticación con Google Sheets API v4. Reutiliza la MISMA service account
// del tool de alimentación (misma key), así que no hay que crear nada nuevo en
// Google Cloud: solo compartir esta planilla con el email de la cuenta.
//
// Orden de búsqueda de credenciales:
//   1. env var GOOGLE_SERVICE_ACCOUNT_JSON (contenido JSON)
//   2. env var GOOGLE_APPLICATION_CREDENTIALS (ruta)
//   3. ./service-account.json  (local, gitignored)
//   4. ../alimentacion/service-account.json  (la key ya existente)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const KEY_CANDIDATES = [
  path.join(__dirname, 'service-account.json'),
  path.join(__dirname, '..', 'alimentacion', 'service-account.json'),
];

export function loadCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const file = envPath && fs.existsSync(envPath)
    ? envPath
    : KEY_CANDIDATES.find((p) => fs.existsSync(p));
  if (!file) {
    throw new Error('No encontré credenciales de la service account (env var o service-account.json).');
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export async function getSheetsClient() {
  const credentials = loadCredentials();
  const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  return google.sheets({ version: 'v4', auth });
}

export function serviceAccountEmail() {
  try { return loadCredentials().client_email ?? null; } catch { return null; }
}
