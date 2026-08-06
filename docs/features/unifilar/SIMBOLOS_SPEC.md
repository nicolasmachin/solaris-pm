# Corrección de Símbolos IEC 60617 — Unifilar

> ⚠️ **Documento histórico — no es fuente de verdad.**
> Esto es el diseño que se escribió *antes* de construir la funcionalidad, y
> puede diferir de lo que finalmente se implementó. Sirve para entender por qué
> se decidieron las cosas, no para saber cómo funcionan hoy.
> **Cómo funciona hoy: [`docs/manual/`](../../manual/README.md).**

> **Feature:** Corrección de los símbolos del generador SVG del unifilar
> **Producto:** Voltia PM
> **Ubicación:** `server/src/services/unifilarSvg/symbols.ts`
> **Versión spec:** 2.0
> **Estado:** Aprobado para implementación

## 1. Contexto

El generador de unifilar implementado en Fase 1A funciona estructuralmente (layout, conexiones, etiquetas de cable, marker IEC) pero los símbolos individuales de los componentes están mal dibujados. Esta spec corrige los símbolos para alinearlos con la norma IEC 60617 y con el plano canónico que Voltia entrega hoy a UTE.

## 2. Ground truth visual

Plano de referencia: `docs/features/unifilar/casos_validacion/referencia_voltia.pdf` (Felipe Ciaran, Caraguatay 2285).
Estado actual a corregir: `docs/features/unifilar/casos_validacion/estado_actual_pre_correccion.pdf`.

## 3. Símbolos a corregir (resumen)

- `symBreaker` — palanca diagonal + dos contactos circulares (no rectángulo cerrado)
- `symResidual` — breaker + cuadrado de test al lado
- `symSpd` — triángulo vértice abajo + cable a tierra + símbolo de tierra
- `symMeterSimple` — rectángulo simple (no círculo con "M")
- `symInverter` — diagonal + `=` (DC) + `~` (AC). Marca `1~`/`3~` afuera
- `symMiiMeter` — NUEVO — rectángulo separado debajo del inversor
- `symMeterBidir` — más cuadrado, flechas más grandes
- `symBusbar` — punto negro en la unión (ya OK)
- `symGround` — más prominente + label "PAT" en verde

Detalles completos y SVG paths sugeridos en el prompt de corrección original.
