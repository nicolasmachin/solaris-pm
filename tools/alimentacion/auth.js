// Autenticación con Google Sheets API v4 vía Service Account (headless).
//
// Las credenciales se cargan, en orden de prioridad:
//   1. env var GOOGLE_SERVICE_ACCOUNT_JSON  → contenido JSON completo de la key
//   2. env var GOOGLE_APPLICATION_CREDENTIALS → ruta a un archivo .json
//   3. archivo local ./service-account.json (gitignored)
//
// La planilla tiene que estar COMPARTIDA con el client_email de la service
// account (como Editor) para poder escribir.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const LOCAL_KEY = path.join(__dirname, 'service-account.json');

export function loadCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON está seteada pero no es JSON válido.');
    }
  }
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const file = envPath && fs.existsSync(envPath)
    ? envPath
    : (fs.existsSync(LOCAL_KEY) ? LOCAL_KEY : null);
  if (!file) {
    throw new Error(
      'No encontré credenciales de la service account. Definí una de estas:\n' +
      '  • GOOGLE_SERVICE_ACCOUNT_JSON = <contenido JSON de la key>\n' +
      '  • GOOGLE_APPLICATION_CREDENTIALS = <ruta al .json>\n' +
      `  • o dejá el archivo en ${LOCAL_KEY}`
    );
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export async function getSheetsClient() {
  const credentials = loadCredentials();
  const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  return google.sheets({ version: 'v4', auth });
}

export function serviceAccountEmail() {
  try {
    return loadCredentials().client_email ?? null;
  } catch {
    return null;
  }
}
