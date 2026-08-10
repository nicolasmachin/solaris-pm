# Control de alimentación 2026 — conexión API

Script standalone para **leer y escribir** la Google Sheet personal *"Control de
alimentación 2026"* vía la Google Sheets API v4. El flujo pensado es
conversacional: Nicolás dice qué comió y Claude registra las filas corriendo
`registrar.js`.

Es independiente del backend de Voltia PM (tiene su propio `package.json`).

## 1. Setup en Google Cloud (una sola vez)

1. Entrá a <https://console.cloud.google.com/> y creá o elegí un proyecto.
2. **APIs y servicios → Biblioteca** → buscá **Google Sheets API** → **Habilitar**.
3. **APIs y servicios → Credenciales → Crear credenciales → Cuenta de servicio**.
   Ponele un nombre (ej. `alimentacion-bot`) y creala.
4. Entrá a la cuenta de servicio → pestaña **Claves → Agregar clave → Crear clave
   nueva → JSON**. Se descarga un archivo `.json`. **Ese es el secreto.**
5. Copiá el email de la cuenta de servicio (algo como
   `alimentacion-bot@tu-proyecto.iam.gserviceaccount.com`).
6. Abrí la planilla en Google Sheets → **Compartir** → pegá ese email → dale rol
   **Editor** → Enviar.

## 2. Credenciales para el script

Cualquiera de estas tres (por prioridad):

- `GOOGLE_SERVICE_ACCOUNT_JSON` = el **contenido** completo del JSON (recomendado
  como secreto del entorno remoto, así persiste entre sesiones).
- `GOOGLE_APPLICATION_CREDENTIALS` = ruta a un archivo `.json`.
- Dejar el archivo en `tools/alimentacion/service-account.json` (está gitignored).

> ⚠️ La key **nunca** se commitea. El `.gitignore` de esta carpeta la excluye.

## 3. Instalar dependencias

```bash
cd tools/alimentacion
npm install
```

## 4. Uso

En el entorno remoto, correr Node con el CA del proxy para que las llamadas HTTPS
verifiquen bien:

```bash
NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node inspect.js
```

- `node inspect.js` — muestra pestañas y las primeras filas de cada una **con
  fórmulas**. Es el primer paso: revela los nombres reales de pestaña y si las
  columnas nutricionales del registro son fórmulas o valores.
- `node inspect.js --tab='Nombre' --range='A2:T2'` — lectura puntual con fórmulas.
- `node registrar.js ...` — registra comidas en el registro diario (se documenta
  su interfaz final una vez confirmada la estructura con `inspect.js`).

## Estructura de la planilla (leída, resumen)

- **Base de alimentos**: catálogo con valores nutricionales *por porción*.
- **Registro diario**: una fila por alimento consumido; columnas nutricionales =
  `Cantidad × valor de la base`. Es donde se escribe.
- **Dashboard mensual** y **Etapa 1** (peso/grasa/objetivos): calculadas/manuales,
  no se escriben.
