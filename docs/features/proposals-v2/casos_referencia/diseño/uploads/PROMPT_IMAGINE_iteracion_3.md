# Iteración 3 — Ajustes consolidados a la Propuesta Voltia

## Contexto

Tercera pasada de diseño. Esto es una reorganización y limpieza
profunda del documento. Hay decisiones de estructura, voz, terminología
y layout que afectan a todo el documento.

Cambios decididos respecto a la iteración 2:
- Tratamiento informal (tu/te/vos) en todo el documento
- Carta de presentación sin cifras específicas (texto narrativo)
- Reorden de páginas (cotización ANTES del análisis económico)
- Tapa como placeholder (se diseña aparte en Canva)
- Sin lema inventado en contratapa
- Pulido completo de coherencia y terminología

---

## 1. Tapa: placeholder simple

La tapa la voy a diseñar en Canva y se va a integrar al PDF final via
overlay con pdf-lib. Para este mockup, **reemplazar la tapa actual**
por un placeholder mínimo:

```
┌─────────────────────────────────────┐
│                                     │
│  [ Tapa diseñada externamente —     │
│    placeholder para mockup ]        │
│                                     │
│  Cliente: Jose Gonzalez             │
│  Ciudad: El Pinar                   │
│  Fecha: Junio 2026                  │
│                                     │
└─────────────────────────────────────┘
```

Un rectángulo A4 con texto centrado simple. No invertir esfuerzo
visual acá. Sin imagen de fondo, sin formas geométricas.

---

## 2. Nueva estructura de páginas

**Orden definitivo del documento completo:**

1. **Tapa** (placeholder)
2. **Carta de presentación** — texto narrativo, SIN highlights numéricos
   debajo. Si queda espacio en la página, arrancar la siguiente sección
   directamente.
3. **Especificaciones del sistema** — "Lo que vamos a instalar" (tabla
   con íconos + protecciones)
4. **Cómo funciona el sistema on-grid** — diagrama correcto + texto
   explicativo + nota sobre IVA/IRPF
5. **Servicios incluidos** (grilla 3×3) + **Servicios no incluidos**
6. **Plazo de entrega** (timeline con coordinación previa correcta)
7. **Generación de energía** (gráfico mensual) + bloque **"Tu ahorro"**
   (compacto, no gigante)
8. **Cotización + condiciones generales** — aquí aparece el precio por
   primera vez
9. **Financiación BBVA + Seguro contra granizo**
10. **Análisis económico** — texto explicativo + tabla resumen + gráfico
    de retorno 15 años. **YA NO se llama "Anexo"**, es una sección más.
11. **Tu retorno · Resumen** — los 4 highlights + card grande de
    inversión total + texto narrativo de cierre
12. **Contratapa** — logo grande de Voltia + datos de contacto. SIN lema.

**Importante:** las páginas no son unidades estancas. Si una sección
termina y queda espacio en la página, **arrancar la siguiente sección
ahí mismo**. No dejar páginas con media carilla en blanco. Esto NO se
aplica a tapa y contratapa.

Resultado esperado: documento más compacto y denso, sin desperdicio
de espacio. La cantidad final de páginas la decide el contenido, no un
número objetivo.

---

## 3. Voz del documento: tratamiento INFORMAL

Todo el documento usa tratamiento informal: **tú/te/tuyo** (o "vos" si
encaja mejor con la cadencia rioplatense). NO "usted/su/le".

**Ejemplo concreto de la carta de presentación reescrita:**

```
CARTA DE PRESENTACIÓN

Estimado Jose Gonzalez,

Es un gusto presentarte esta propuesta para la instalación de un
sistema solar fotovoltaico en tu hogar de El Pinar. La diseñamos a
medida de tu consumo, buscando el mejor equilibrio entre generación,
ahorro y retorno de la inversión.

El sistema te permite cubrir la mayor parte de tu factura de UTE con
energía propia y limpia, con una vida útil estimada de 25 años.

En las páginas siguientes encontrás el detalle técnico y económico,
los servicios incluidos y los plazos de ejecución. Quedamos a
disposición para acompañarte en cada etapa del proceso.

Nicolás Machín
Director · Voltia · nmachin@voltia.com.uy
```

**Importante:** la carta NO menciona cifras específicas (5,8 años, 89%,
USD 14.029). Solo narrativa. Las cifras viven en la sección "Tu retorno"
al final del documento. Esto es porque la carta es un texto fijo
mientras que las cifras varían por proyecto.

Cambios concretos de voz para hacer en todo el documento:
- "Su factura" → "Tu factura"
- "Su consumo" → "Tu consumo"
- "Su hogar" → "Tu hogar"
- "Le permite cubrir" → "Te permite cubrir"
- "Cuando consumes" → "Cuando consumís"
- "Pasá a generar..." (si se mantiene algo similar) → ya estaba en tono informal

---

## 4. Terminología y consistencia

### "Voltia" vs "VOLTIA"

- **Voltia** (capitalizado) en el texto del documento
- **VOLTIA** (mayúsculas) solo dentro de logos gráficos (contratapa, etc.)
- En firmas, encabezados de pie, etc., usar "Voltia"

### "Sistema solar fotovoltaico"

Forma canónica: "**sistema solar fotovoltaico**". Usarla en:
- Eyebrow de la tapa
- Carta de presentación
- Tabla de cotización
- Sección "Cómo funciona"

Forma corta aceptable ("sistema fotovoltaico") solo en contextos muy
cortos donde "solar" es redundante.

### Generación de energía

Forma canónica: "**13.962 kWh / año**" (con barra y "año" explícito).
Aplicar en:
- Especificaciones del sistema
- Carta y resúmenes (cuando se mencione)
- Gráfico mensual ("13.962 kWh / año" como total)

### Potencia del inversor

Forma canónica: "**10 kW**" (sin decimales innecesarios).
Si en otros casos hay valores no enteros (ej. 9,44 kWp del sistema),
mantener la coma decimal solo cuando sea necesario.

### Marca de paneles e inversor

Agregar **"Marca: "** explícito antes del nombre, para evitar
confusión con términos técnicos:

```
Paneles solares
Marca: Resun · 16 unidades · monocristalino de alta eficiencia · 590 W

Inversor
Marca: Growatt · 10 kW · monofásico · Wifi con reporte en tiempo real
```

### Eliminar la palabra "Anexo"

La sección que hoy se llama "**ANEXO · ANÁLISIS ECONÓMICO**" debe
renombrarse. Es parte del documento, no anexo. Opciones:
- "ANÁLISIS ECONÓMICO" (más simple)
- "EL RETORNO DE TU INVERSIÓN" (más comercial)
- "ANÁLISIS DE RENTABILIDAD"

Elegir una y mantenerla.

### "Detalle técnico"

Hoy hay un bloque "DETALLE TÉCNICO" después de la tabla con íconos.
Renombrar a "**SOBRE LA INSTALACIÓN**" o "**CONSIDERACIONES TÉCNICAS**"
para no sonar redundante con "ESPECIFICACIONES DEL SISTEMA" que está
arriba.

---

## 5. Headers y numeración de páginas

**Lo que está mal:** cada página interior tiene un header que dice
"02 · PROPUESTA COMERCIAL", "03 · PROPUESTA COMERCIAL", etc. La palabra
"PROPUESTA COMERCIAL" es redundante (todo el documento es propuesta
comercial), y la numeración es confusa (empieza en 02 saltándose la
tapa).

**Lo que quiero:**
- Sacar la palabra "PROPUESTA COMERCIAL" del header
- Numerar las páginas simplemente: "1", "2", "3"... (o "Pág. 1", "Pág. 2")
- La numeración cuenta páginas interiores (la tapa no tiene número)
- La contratapa tampoco tiene número
- O directamente sacar la numeración: con buena maquetación, no hace
  falta

**Recomendación**: sacar la numeración completamente. Mantener solo el
logo V (más grande, ver punto siguiente) y el separador horizontal.

---

## 6. Sacar meta-labels del mockup

El mockup actual tiene en la tapa: "PROPUESTA COMPLETA · 11 páginas · A4".
Eso es un meta-label del proceso de diseño, **NO debe ir en el PDF
final que el cliente recibe**. Sacarlo de la tapa.

Lo mismo con "PROPUESTA RESUMEN · Versión ejecutiva · 2 páginas" en la
versión resumen.

En el mockup, separar las dos versiones con un divisor visual sobrio
fuera del documento (un texto pequeño en gris arriba de cada bloque),
pero el documento en sí no debe tener esos meta-labels.

---

## 7. Logo V del pie de página más grande

El logo V del pie es muy chico. Aumentar a aproximadamente **el doble
del tamaño actual**, manteniendo proporciones. Sin texto debajo (solo
la V), porque "Soluciones Eléctricas" en chico queda ilegible.

---

## 8. Highlights: NO en la página 2, SÍ al final

**Página 2 (carta de presentación):**
- Solo carta de presentación (con la voz informal del punto 3)
- Firma de Nicolás Machín
- **NADA de highlights numéricos**
- Si queda espacio en la página, empezar la siguiente sección
  (especificaciones)

**Página antes de la contratapa: "Tu retorno · Resumen":**

```
TU RETORNO

[texto introductorio breve, 1-2 líneas:
"Estos son los números clave de tu proyecto."]

┌──────────────────────────────────────────────────────────┐
│                   INVERSIÓN TOTAL                         │
│                                                           │
│                   USD 14.029                              │
│                   IVA incluido · llave en mano           │
└──────────────────────────────────────────────────────────┘

┌─────────────────────┐  ┌─────────────────────┐
│ AHORRO MENSUAL      │  │ AHORRO ANUAL        │
│ $ 8.024             │  │ USD 2.407           │
│ 89% de tu factura   │  │ Lo que dejás de UTE │
└─────────────────────┘  └─────────────────────┘
┌─────────────────────┐  ┌─────────────────────┐
│ RECUPERO INVERSIÓN  │  │ RENTABILIDAD ANUAL  │
│ 5,8 años (PRI)      │  │ 17,2 % (TIR)        │
└─────────────────────┘  └─────────────────────┘

[texto narrativo breve, 2-3 líneas:
"En 5,8 años recuperás la inversión y, después, cada año
es ganancia neta. Con una vida útil de 25 años, el sistema
te genera más de USD 22.000 de retorno total."]
```

---

## 9. Cotización con precio destacado, sin saltos de línea

**Problemas a corregir en la página de cotización:**
- "USD 11.499 + IVA" debe quedar en UNA línea, no dos
- "USD 14.029" no debe partirse en "USD" + "14.029" en dos líneas
- El precio total con IVA debe destacar:
  - Tipografía más grande
  - Color azul Voltia `#1836B2` fuerte
  - Fondo de celda con tinte azul claro
  - O algún elemento gráfico que lo resalte

Que cualquier cliente que abra el PDF en la página de cotización vea
el total con IVA en menos de un segundo.

---

## 10. Ítems adicionales opcionales en cotización

Permitir agregar renglones extras a la cotización (cableado extra,
aumento de potencia UTE, baterías, etc.).

**Comportamiento:**
- Por defecto NO hay extras. Cotización limpia con sistema base.
- Si hay extras, aparecen como filas adicionales con su precio.
- Total con IVA suma todo.
- Si no hay extras, la sección no muestra columnas o filas vacías.

**En el mockup mostrar DOS variantes** (etiquetadas claramente):
- **Variante A**: cotización sin extras (estado por defecto)
- **Variante B**: cotización con 2 extras (ej. baterías USD 3.500 + IVA
  y cableado extra USD 280 + IVA) sumando al total

---

## 11. Email correcto

Reemplazar todas las apariciones de `[email protected]` por los emails
reales:
- En la firma de Nicolás Machín: **nmachin@voltia.com.uy**
- En la contratapa y pies generales: **contacto@voltia.com.uy**

---

## 12. Sacar lema inventado de la contratapa

Eliminar el texto "Pasá a generar tu propia energía. Nosotros nos
encargamos del resto." Voltia no usa ese lema.

Contratapa final:
- Logo grande de Voltia (con texto "VOLTIA Soluciones Eléctricas")
- Datos de contacto: `contacto@voltia.com.uy` · `098 640 651` ·
  `www.voltia.com.uy`
- Eso es todo. Sobria.

---

## 13. Plazo de entrega: limpiar etiquetas temporales

El timeline actual tiene labels confusos: "Día 0", "Semana 2", "Semana 2
+ 3 días", "Mes 4 aprox.". La unidad cambia entre etapas.

Simplificar a duraciones relativas, no acumulados:

```
Firma + 50%      Coordinación      Instalación      Habilitación UTE
                 previa            física
Día 0            3-4 semanas       3 días           hasta 8 semanas
```

Sin acumulados, sin "semana 2 + 3 días". El cliente entiende que las
duraciones son secuenciales.

Recordatorio: estos plazos son **configurables desde Admin defaults
globales** (no por propuesta). El mockup muestra valores razonables.

---

## 14. Arreglar layout roto del resumen

El resumen actual tiene problemas:
- Header azul gigante que ocupa un tercio de la página 1 (achicar)
- Página 3 termina cortada en mitad de bullet
- Páginas 13-14 (que serían parte del resumen) vacías o casi vacías

Rehacer el resumen como **1-2 páginas máximo**, sin layouts rotos.

Estructura del resumen:
- Header compacto con nombre cliente + fecha + V chiquita
- 4 highlight cards (ahorro mes, ahorro año, PRI, TIR)
- Tabla de especificaciones compacta (paneles, inversor, potencia,
  generación) con marca
- Cotización: "TOTAL C/IVA · USD 14.029"
- Plazo de entrega: timeline compacto
- Financiación BBVA: tabla
- Footer con datos de contacto

Si entra todo en 1 página, mejor. Si necesita 2, las 2 deben estar
completas, sin layouts rotos.

---

## Recordatorios generales

Mantener todo lo que ya está bien:
- Identidad visual (azul Voltia `#1836B2`, blanco, tipografía sans-serif)
- Diagrama on-grid corregido (Sol → Paneles → Inversor → Casa/Medidor → Red UTE)
- Texto técnico recuperado de la propuesta original
- Grilla 3×3 de servicios con descripciones largas
- Sección de "Servicios no incluidos"
- Texto completo del análisis económico
- Nota legal de tabla BBVA
- Seguro contra granizo
- Sin emojis, sin CO₂/equivalencias, sin logos de terceros, sin
  comparativa visual de factura en columnas

---

## Output esperado

HTML autocontenido mostrando:
1. **Propuesta completa** (con tapa placeholder + cuerpo reorganizado)
2. **Propuesta resumen** (1-2 páginas, sin layout roto)
3. Dentro de la propuesta completa, en la sección de cotización,
   mostrar las **dos variantes** (sin extras y con extras)

Las dos versiones (completa + resumen) separadas por un divisor sobrio
fuera del documento.

Aplicá los 14 cambios. Si tenés dudas de prioridad ante conflictos,
priorizá: (1) estructura/orden de páginas, (2) coherencia de voz, (3)
terminología, (4) layout sin roturas, (5) detalles de estilo.
