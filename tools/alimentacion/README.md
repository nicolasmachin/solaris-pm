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
  fórmulas**. Sirve para auditar la estructura.
- `node inspect.js --tab='Nombre' --range='A2:T2'` — lectura puntual con fórmulas.
- `node registrar.js` — registra comidas en la pestaña **Registro Diario**:

  ```bash
  node registrar.js --fecha=2026-08-10 \
    --items='[{"comida":"Cafe con leche","cantidad":1,"tipo":"Desayuno"},
              {"comida":"Alfajor","cantidad":2}]'
  ```

  - `--fecha` acepta `YYYY-MM-DD` o `DD/MM/YYYY` (default: hoy).
  - Cada item: `comida` (obligatorio), `cantidad` (obligatorio), `tipo?`, `hora?`.
  - `--dry-run` muestra el preview sin escribir. `--clear` limpia el rango que
    escribiría (para deshacer una prueba).
  - La `comida` se resuelve al nombre exacto de **Datos** (match tolerante a
    acentos/mayúsculas). Si no hay match claro, no escribe nada y sugiere opciones.

## Estructura real de la planilla

- **Datos**: base de alimentos. Comidas en columna **D (filas 3–385)**, valores
  *por porción* en E–O. Es la tabla del VLOOKUP.
- **Registro Diario**: **única pestaña de entrada**, una fila por alimento. Solo se
  escriben `E=Fecha` (nº de serie), `F=Hora?`, `G=Tipo?`, `H=Comida`, `I=Cantidad`.
  Las columnas `A–D` (día/mes/año) y `J–T` (nutrientes = `VLOOKUP × Cantidad`) son
  **fórmulas ya pre-cargadas** que se calculan solas al completar la Comida.
- **Enero 26 … Agosto 26 / INDICADORES**: dashboards que agregan desde Registro
  Diario con `SUMIFS` por mes/año. **No se escriben.**
