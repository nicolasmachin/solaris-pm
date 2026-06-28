# Prompt para Claude Imagine — Diseño de Propuesta Comercial Voltia

## Contexto

Soy fundador de **Voltia**, empresa uruguaya de instalación de paneles solares
fotovoltaicos. Quiero rediseñar la propuesta comercial que les enviamos a los
clientes residenciales para que sea más profesional, visualmente impactante
y más fácil de leer.

Vamos a generar **dos PDFs**:
1. **Propuesta completa**: 7-8 páginas A4, documento principal
2. **Propuesta resumen**: 1-2 páginas A4, versión ejecutiva (es un subset
   visual del completo)

Ambos PDFs comparten el mismo lenguaje visual.

El diseño debe ser **interactivo (HTML/CSS)**, listo para pasarlo después
a un sistema que reemplace los placeholders por datos reales. No es una
imagen estática, es código.

## Identidad visual de Voltia

- **Color principal**: azul Voltia `#1836B2` (azul intenso, casi cobalto)
- **Color secundario**: azul oscuro `#122a8f` para contrastes
- **Acento**: amarillo solar tenue, solo para destacar números importantes (opcional)
- **Tipografía**: Helvetica Neue o Inter, sans-serif. Sin Calibri.
- **Estilo**: profesional, limpio, con buen uso de espacio en blanco.
  Tipo Apple keynote o McKinsey deck. NO tipo factura corporativa antigua.
- **Tono**: confianza técnica + cercanía humana

El logo de Voltia es una V estilizada con rayo, color azul `#1836B2`.

## Datos de ejemplo (caso real: Jose Gonzalez, El Pinar)

Usar estos datos en el mockup como contenido real:

**Cliente**
- Nombre: Jose Gonzalez
- Ciudad: El Pinar, Uruguay
- Fecha propuesta: 19 de junio de 2026

**Sistema dimensionado**
- 16 paneles solares Resun de 590 W cada uno
- 1 inversor monofásico Growatt de 10 kW
- Potencia pico total: 9,44 kWp
- Superficie ocupada: ~48 m²
- Techo: de tejas, 8 × 4 mts

**Económico para el cliente**
- Precio total: USD 14.029 (IVA incluido) — equivale a USD 11.499 + IVA
- Cotización dólar referencia: $40
- Energía anual generada: 13.962 kWh
- Ahorro mensual: $8.024 (USD 201)
- Ahorro anual: USD 2.407
- Factura UTE actual: $9.000 / mes
- Factura UTE proyectada con sistema: $976 / mes (ahorro 89%)
- TIR: 17,2%
- PRI: 5,8 años
- Vida útil estimada: 25 años

**Financiación BBVA** (3 opciones)
- 24 cuotas a 0% UI: $24.517 / mes
- 36 cuotas a 0% UI: $16.875 / mes
- 60 cuotas a 5% UI: $11.514 / mes

**Generación mensual estimada (kWh)**
Ene: 1418, Feb: 1282, Mar: 1242, Abr: 1080, May: 945, Jun: 837,
Jul: 891, Ago: 999, Sep: 1107, Oct: 1215, Nov: 1242, Dic: 1242

**Retorno acumulado de inversión (USD, año 0 a 15)**
-14029, -11622, -9215, -6808, -4401, -1994, 413, 2820, 5227, 7634,
10041, 12448, 14855, 17262, 19669, 22076

(El año 6 es donde cruza el cero = recuperación de la inversión)

**Cronograma (configurable, estos son los valores actuales)**
- Firma de contrato y pago 50% inicial
- Acopio de materiales: 2 semanas
- Instalación física: 3 días
- Habilitación frente a UTE: hasta 8 semanas

## Estructura del PDF COMPLETO (8 páginas A4)

### Página 1 — Tapa
- Título: "PROPUESTA COMERCIAL DE ENERGÍA SOLAR"
- Subtítulo: "Sistema solar fotovoltaico"
- Cliente (Jose Gonzalez) y mes/año (Junio 2026), bien visible
- Foto grande de paneles solares (placeholder)
- Logo Voltia abajo
- Forma geométrica azul como elemento gráfico de fondo

### Página 2 — Carta de presentación + Highlights cards

**Mitad superior**: Carta formal breve
- Saludo: "Estimado Jose Gonzalez,"
- 2-3 párrafos cortos presentando la propuesta
- Firma: "Nicolás Machín · Director · VOLTIA · nmachin@voltia.com.uy"

**Mitad inferior**: 4 cards en grilla 2×2 con los números clave:

```
┌─────────────────────┐  ┌─────────────────────┐
│ INVERSIÓN TOTAL     │  │ AHORRO MENSUAL      │
│                     │  │                     │
│   USD 14.029        │  │   $ 8.024           │
│   IVA incluido      │  │   89% de tu factura │
└─────────────────────┘  └─────────────────────┘
┌─────────────────────┐  ┌─────────────────────┐
│ RECUPERO INVERSIÓN  │  │ RENTABILIDAD ANUAL  │
│                     │  │                     │
│   5,8 años          │  │   17,2 %            │
│   (PRI)             │  │   (TIR)             │
└─────────────────────┘  └─────────────────────┘
```

Hacer que los números sean MUY grandes y legibles. Los labels arriba en
mayúsculas, pequeños, color secundario. El número en azul `#1836B2`, peso
fuerte. Debajo, un texto pequeño que contextualiza.

### Página 3 — Especificaciones del sistema + diagrama on-grid

**Mitad superior**: Tabla compacta con íconos (no bullet points)

```
┌────────────────┬──────────────────────────────┐
│ [ícono panel]  │ Paneles solares              │
│                │ 16 unidades · Resun · 590 W  │
├────────────────┼──────────────────────────────┤
│ [ícono inv.]   │ Inversor                     │
│                │ Growatt 10 kW · Monofásico   │
├────────────────┼──────────────────────────────┤
│ [ícono rayo]   │ Potencia pico                │
│                │ 9,44 kWp                     │
├────────────────┼──────────────────────────────┤
│ [ícono área]   │ Superficie ocupada           │
│                │ 48 m² sobre techo de tejas   │
├────────────────┼──────────────────────────────┤
│ [ícono energía]│ Generación anual estimada    │
│                │ 13.962 kWh                   │
└────────────────┴──────────────────────────────┘
```

**Mitad inferior**: Diagrama esquemático on-grid (versión moderna del
clásico "panel + inversor + UTE + casa"). Estilo flat, líneas limpias,
con flechas indicando flujo de energía. Texto al lado explicando en
1 párrafo cómo funciona el sistema on-grid (versión COMPRIMIDA del actual,
no la explicación larga).

### Página 4 — Servicios incluidos (grilla de íconos) + plazo de entrega

**Mitad superior**: Grilla 3×3 (9 servicios incluidos)

Cada celda con ícono + título corto + descripción de 1 línea:

```
┌─────────────────┬─────────────────┬─────────────────┐
│ [ícono]         │ [ícono]         │ [ícono]         │
│ Preventa        │ Ingeniería      │ Materiales      │
│ Relevamiento... │ Diseño y memo...│ Todo incluido...│
├─────────────────┼─────────────────┼─────────────────┤
│ [ícono]         │ [ícono]         │ [ícono]         │
│ Planificación   │ Montaje         │ Puesta en marcha│
│ Logística...    │ Instalación...  │ Pruebas y...    │
├─────────────────┼─────────────────┼─────────────────┤
│ [ícono]         │ [ícono]         │ [ícono]         │
│ Tramitación UTE │ Mantenimiento   │ Garantía        │
│ Firma cat. A...│ 2 años...       │ 10/5/3 años...  │
└─────────────────┴─────────────────┴─────────────────┘
```

**Mitad inferior**: Timeline visual del cronograma de entrega

```
[1] Firma          [2] Acopio        [3] Instalación   [4] Habilitación
    contrato            materiales        física            UTE
    +50% pago           2 semanas         3 días            8 semanas
    ●━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━●
    Día 0               Semana 2          Semana 2 + 3 días Mes 4 aprox
```

Línea horizontal con 4 hitos, círculos en cada punto. Tiempos como texto
debajo. Estilo gantt minimalista.

### Página 5 — Generación de energía + ahorro mensual

**Mitad superior**: Gráfico de barras de generación mensual (12 meses)
- Color barras: azul `#1836B2`
- Eje Y: kWh
- Valores arriba de cada barra
- Título: "Generación mensual estimada"
- 1 párrafo abajo explicando que la generación varía por estación

**Mitad inferior**: Bloque grande destacado con el ahorro mensual:

```
┌─────────────────────────────────────────────┐
│  TU FACTURA HOY     →    CON VOLTIA         │
│                                             │
│     $ 9.000                $ 976            │
│                                             │
│              AHORRÁS                        │
│             $ 8.024 / mes                   │
│           USD 2.407 / año                   │
└─────────────────────────────────────────────┘
```

Estética: bloque grande, contraste fuerte, el número del ahorro
DESTACADO en gran tamaño. Esto es el "wow moment" de la propuesta.

### Página 6 — Cotización + condiciones + financiación BBVA

**Tercio superior**: Tabla de cotización

```
┌──────────────────────────────────────┬────────────┬──────────┬──────────────┐
│ Ítem                                 │ Pot. (W)   │ Precio   │ Precio c/IVA │
├──────────────────────────────────────┼────────────┼──────────┼──────────────┤
│ Sistema solar fotovoltaico on-grid   │ 9.440      │ USD11.499│  USD 14.029  │
│                                      │            │  + IVA   │              │
└──────────────────────────────────────┴────────────┴──────────┴──────────────┘
```

**Tercio medio**: Condiciones generales en 4 cards horizontales o lista
visualmente atractiva
1. Validez: 60 días
2. Pago inicial: 50% al confirmar
3. Saldo: al finalizar la instalación técnica
4. Seguro contra granizo opcional: USD 12 / panel / año

**Tercio inferior**: Tabla de financiación BBVA con visual atractivo

```
┌─────────────┬───────────┬──────────┬───────────────┐
│ Plazo       │ Interés   │ Moneda   │ Cuota mensual │
├─────────────┼───────────┼──────────┼───────────────┤
│ 24 cuotas   │ 0% UI     │ UI       │ $ 24.517      │
│ 36 cuotas   │ 0% UI     │ UI       │ $ 16.875      │
│ 60 cuotas   │ 5% UI     │ UI       │ $ 11.514      │
└─────────────┴───────────┴──────────┴───────────────┘
```

### Página 7 — Análisis económico (anexo)

**Tercio superior**: Tabla resumen económica

```
┌──────────────┬──────────────┬──────────────┬─────────┬───────────┐
│ Inversión    │ Ahorro mes   │ Ahorro año   │ TIR     │ PRI       │
├──────────────┼──────────────┼──────────────┼─────────┼───────────┤
│ USD 14.029   │ $8.024       │ USD 2.407    │ 17,2%   │ 5,8 años  │
│              │ (USD 201)    │              │         │           │
└──────────────┴──────────────┴──────────────┴─────────┴───────────┘
```

**Resto de la página**: Gráfico de barras del retorno acumulado a 15 años
- Eje X: años (0 a 15)
- Eje Y: USD (formato uruguayo con separador de miles `46.616`, sin
  notación científica, sin decimales)
- Barras negativas en azul claro `#A7C7E7`
- Barras positivas en azul oscuro `#1836B2`
- Valores arriba de cada barra: USD con separador de miles
- Línea horizontal punteada en y=0 marcando "punto de equilibrio"
- Título: "Retorno de inversión proyectado"

### Página 8 — Contraportada
- Logo V grande centrado
- Datos de contacto: contacto@voltia.com.uy · www.voltia.com.uy · 098 640 651
- Slogan o frase corta

## Estructura del PDF RESUMEN (1-2 páginas A4)

### Página 1 — Tapa compacta + highlights + esencial

Layout vertical:

1. **Header reducido**: logo Voltia + título "PROPUESTA COMERCIAL · Jose Gonzalez · Junio 2026"

2. **Highlights cards** (mismas 4 que en el completo, pero más compactas)

3. **Especificaciones en tabla con íconos** (versión compacta sin el
   diagrama on-grid)

4. **Cotización**: una sola fila destacando precio total con IVA

5. **Plazo de entrega**: línea de texto resumida o mini-timeline horizontal

6. **Footer**: "contacto@voltia.com.uy · 098 640 651"

### Página 2 (opcional) — Financiación

Tabla BBVA + nota legal pequeña.

## Requisitos generales del diseño

1. **A4 vertical** (794px × 1123px @96dpi). Hacer responsive para preview
   pero pensado para imprimir.
2. **Sin sangrado a borde**: márgenes consistentes en todas las páginas
   (sugerencia: 40px laterales, 50px arriba/abajo).
3. **Logo Voltia en pie de página** de todas las páginas excepto tapa y
   contraportada.
4. **Numeración de página** opcional, sutil (esquina inferior derecha).
5. **Acentos cromáticos**: usar el azul Voltia con moderación, no saturar.
   El blanco es protagonista.
6. **Sin emojis** en el contenido (íconos sí, gráficos vectoriales tipo
   Lucide o Heroicons).
7. **Tablas**: bordes finos, idealmente `0.5px solid` con color tenue.
   Headers en mayúsculas chiquitas, peso medio.
8. **Tipografía**: jerarquía clara (32px títulos sección / 18px subsecciones
   / 14px body / 11px notas).
9. **Mostrar AMBOS PDFs en el mismo HTML output**, separados visualmente
   (por ejemplo, dos secciones, una abajo de la otra, con un divisor
   claro entre "PROPUESTA COMPLETA" y "PROPUESTA RESUMEN").

## Lo que NO quiero

- Emojis decorativos
- Equivalencias tipo "X árboles plantados" o "X autos eléctricos"
- Mención de huella de carbono o CO₂
- Logos de marcas de terceros (paneles, inversores) ni sus certificaciones
- Comparativa visual lado a lado de la factura UTE en columnas grandes
  (ocupa demasiado espacio, mejor un bloque integrado como propuse en
  página 5 del completo)
- Estética corporativa antigua tipo Word de oficina
- Excesos de azul que cansen la vista
- Texto justificado denso (preferir alineado a la izquierda con líneas cortas)

## Output esperado

Un HTML completo, autocontenido, con CSS inline o en `<style>`, mostrando
las **dos versiones de PDF** (completo de 8 páginas + resumen de 1-2)
una debajo de la otra, separadas por un divisor visual claro.

Cada "página" del PDF como un bloque A4 con border o sombra suave para
que se vea como hoja. Pensar como si cada página fuera independiente:
no usar `page-break` reales aún, pero diseñar cada bloque para que
respete su tamaño A4 individualmente.

Si necesitás placeholders para imágenes (foto paneles, diagrama on-grid,
foto del techo), usá rectángulos grises con texto explicativo dentro
("[Foto paneles]", "[Diagrama on-grid]").

Los íconos pueden ser de Lucide, Heroicons, Phosphor o similares (en
inline SVG).

Los gráficos pueden mockearse con CSS o con Chart.js inline embebido
en el HTML.

## Iteraciones

Esto es un primer pase. Vamos a iterar varias veces. Hacé tu mejor
interpretación, y después decime sobre qué iterar.
