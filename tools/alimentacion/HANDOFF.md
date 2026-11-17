# Traspaso — Registro de alimentación de Nicolás

Para que una sesión nueva trabaje igual sin esta conversación. Última actualización: 17/11/2026.

## Propósito
Registrar, hablando, las comidas de Nicolás en la planilla de Google Sheets, y
devolver después de **cada** mensaje una tabla con el estado del día. Meta de
fondo: **recomposición** — mantener ~80 kg y bajar el % de grasa / la cintura.

## Dónde están los datos (todo afuera del chat)
1. **Google Sheet "Control de alimentación 2026"** — id `1M0U9vGa1YuszujOfI5j1p-0MKdv-gLQA7uElGEOBDEo`.
   - `Registro Diario`: una fila por alimento consumido (acá se escribe). Entrada en cols E..I; derivados J..U son fórmulas.
   - `Datos`: base de alimentos (col D nombre, E..O nutrientes, **P azúcar agregada**). Es la tabla del VLOOKUP.
   - Pestañas mensuales (`Octubre 26`, `Noviembre 26`, …) + `INDICADORES`: dashboards. **No se escriben** salvo crear el mes nuevo.
   - **Objetivo de calorías vive en `INDICADORES!B2` = 1950** (se bajó de 2100 el 3/11). Otros objetivos: carbos 340, azúcar total 75, proteína 130, azúcar agregada 50 (B27).
2. **Google Sheet "Hábitos"** — id `1aAS3idBIry7SfUI3WVA8ZvqVnkSU0QG2Mc1cYeABucs`, pestaña **`Estado Fisico`**: serie histórica de peso, % grasa y **cintura** (última columna). Cada fila es una medición puntual. Cuando pasa una medida nueva, agregar fila ahí.
3. **Memoria de Notion** (buscar con notion-memory-search):
   - Página "Datos físicos y meta de alimentación": peso ~80, grasa ~24%, TDEE real ~2000 (medido por balanza, no fórmula), meta recomp, cintura 94 y su trayectoria.
   - Página "Plan de alimentación y entrenamiento — Nicolás": reglas de comida + plan de gimnasio.
4. **Esta carpeta `tools/alimentacion/`** (en git): la herramienta. `service-account.json` NO está en git (es secreto, se recrea; su contenido está en el historial del chat). Si falta, hay que recrearlo o setear `GOOGLE_SERVICE_ACCOUNT_JSON`.

## Lo que vive SOLO en el chat (se perdería — por eso está acá)
- **Formato del reporte** (lo pidió explícito): después de CADA comida, una tabla con semáforo al inicio de cada fila:
  | | Métrica | Hoy | Objetivo |
  Filas fijas: 🔥 Calorías (vs 1950) · 📉 Déficit · ⭐ Calidad · 🥩 Proteína · 🍬 Azúcar agregada.
- **Semáforo** 🟢/🟡/🔴 por fila: verde = bien, amarillo = justo/al límite, rojo = se fue. Reglas usadas:
  - Calorías/Déficit: 🟢 si ≤1950; 🟡 rozando; 🔴 si pasó.
  - Calidad: 🟢 ≥6 · 🟡 ~5-6 · 🔴 <5.
  - Proteína: mid-día suele ir 🟡 (se juzga "en ritmo"); meta 130.
  - Azúcar agregada: 🟢 ≤50 · 🟠 ~50 · 🔴 >50.
- **Déficit se calcula contra 1950** (el objetivo), no contra las 2000 (gasto real). Las 2000 se mencionan solo en balances grandes.
- **Cálculo de la calidad del día** = Σ(col T) / Σ(col K peso), donde T = Calidad×Peso. No es promedio simple.
- **Mapeo de columnas** en Registro Diario (al leer B1:U): B dia, C mes, D año, E fecha, F hora, G tipo, H comida, I cantidad, J calorías, K peso, L carbos, M azúcares, N proteínas, O gord tot, P gord sat, Q trans, R fibra, S sodio, **T calidad(×peso)**, **U azúcar agregada**.
- **Heurísticas de porción** (cuando no se aclara):
  - "puñado" de frutos secos/granola ≈ 0,5 porción. Nicolás aclaró que sus puñados de frutos secos son chicos → usar "Frutos secos (puñado chico)".
  - "vaso/vasito" chico de algo ≈ 0,5.
  - "bizcocho chico" ≈ 0,75; "medialuna chica" existe en base.
  - Coca: si dice "coca" sin aclarar, preguntar/usar normal; si dice "cero/light", usar la versión sin azúcar (clave, le importa).
  - "chop suey" = CON fideos (si aclara sin fideos, va con aclaración).
  - Jugo/licuado natural = azúcar agregada 0 (su azúcar es de fruta). Ojo: hubo foods con P mal cargada (se corrigió "Jugo naranja natural").
- **Confirmar día**: cuando cambió la fecha del sistema pero sigue contando "hoy", suele ser la cena del día anterior reportada tarde — registrar en el día que corresponde y avisar que se puede mover.
- **Crear alimentos nuevos**: solo si no existe en Datos; llenar también col P (azúcar agregada). Nombre exacto (el VLOOKUP exige match literal).

## Procedimiento para registrar una comida (paso a paso)
Working dir: `/home/user/solaris-pm/tools/alimentacion`. Requiere `NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` (ya está en el env) y `service-account.json` presente. Primera vez tras reciclado: `npm install googleapis`.

1. **(si hay alimento dudoso)** buscar en la base:
   `node -e 'import("./auth.js").then(async({getSheetsClient})=>{const{loadBase}=await import("./base.js");const s=await getSheetsClient();(await loadBase(s)).filter(f=>f.norm.includes("TERMINO")).forEach(f=>console.log(f.name,f.calorias));})'`
2. **(si no existe)** crearlo en Datos (siguiente fila libre de D): escribir D..P con `values.update` (nombre,cal,peso,carbs,az,prot,gordtot,gsat,gtrans,fibra,sodio,calidad,azAgg).
3. **Escribir las comidas**:
   `node registrar.js --fecha=YYYY-MM-DD --items='[{"comida":"X","cantidad":N}]'`
   (opcional `--dry-run` para ver matches antes). Resuelve el nombre contra Datos, escribe E:I y replica fórmulas.
4. **Corregir cantidad/comida de una fila** ya escrita: `values.update` sobre `'Registro Diario'!I<fila>` (cantidad) o `H<fila>` (comida). Para quitar un ítem: `values.clear` sobre `E<fila>:I<fila>`.
5. **Calcular totales del día** (recorre B1:U2000, filtra por día/mes/año, suma):
   cal=Σcol8(J) · déficit=1950−cal · prot=Σcol12(N) · azAgg=Σcol19(U) · calidad=Σcol18(T)/Σcol9(K).
6. **Reportar** la tabla con semáforo.

## Conectores mínimos necesarios
- **Ninguno MCP para registrar.** Todo es `Bash` + los scripts Node de esta carpeta, que pegan a la **Google Sheets API v4 con la service account** `alimentacion-bot@custom-bond-283318.iam.gserviceaccount.com` (la planilla está compartida con ese email como editor).
- **Google Drive / Google Sheets MCP**: solo para leer/escribir la planilla "Hábitos" (pestaña Estado Fisico) — la service account NO tiene acceso a esa planilla.
- **Notion MCP**: para leer/guardar la memoria (datos físicos, plan).
- No se usan para alimentación: Rutina_Diaria (se usó 1 vez para leer peso), VoltiaPM, Asana, Gmail, Canva, github, etc.
