# Diagnóstico de inconsistencias en Finanzas — 2026-04-29

## Resumen ejecutivo

**No hay desfasaje actual entre saldo de cuentas y flujo unificado.**

| Métrica | Valor USD |
|---|---|
| Saldo total cuentas (`computeAccountBalance` post-v4.1) | **38,785.00** |
| Saldo calculado por flujo unificado (saldoInicial + ingresos - gastos sin Payment - Payments) | **38,785.00** |
| Diferencia | **0.00** |

El sistema, **post-fix de v4.1**, es coherente: el último movimiento concretado en orden cronológico (Ajuste conciliación BBVA Dolares por $27,964 del 29/04 a las 20:50 UTC) tendría saldoUSD == 38,785, igual a la suma de saldos actuales de cuentas activas.

La descalce reportada (USD 38,081 vs USD 5,872) corresponde a un snapshot **previo** al deploy de v4.1, donde:
- El cálculo de la columna saldoUSD repartía mal por fecha (PAGADOS con fecha de hoy/futuro caían en el grupo "futuro" y se aplicaban dos veces).
- `computeAccountBalance` sumaba doble (gasto PAGADO + Payment) en los movimientos con Auto-Payment de v3.8.

Ambos fueron corregidos en v4.1.

---

## Inconsistencias por categoría

### 1. Movimientos PAGADOS sin `accountId`

**Ninguno.** Query Q2 retornó 0 filas.

### 2. Posible duplicación movimiento + Payment (pre-v4.1)

**7 movimientos** tienen `pagado=true` Y `PaymentApplication` activa. Estos eran double-counted antes del fix v4.1:

| id | descripción | fecha | monto USD | cuenta |
|---|---|---|---|---|
| `cmok95ggc...` | Electrica MGI | 2026-04-08 | 1,700.00 | BROU Dolares |
| `cmokaao3p...` | Pago Tiempo al Tiempo | 2026-04-15 | 14,000.00 | BBVA Dolares |
| `cmokab97q...` | Pago Fivisa | 2026-04-20 | 4,000.00 | BBVA Dolares |
| `cmokasf1h...` | NIC Hormigones losas | 2026-04-23 | 668.00 | BBVA Dolares |
| `cmoiyz98l...` | Perfiles C Becam | 2026-04-28 | 1,175.41 | BROU Dolares |
| `cmok9pymj...` | pago Fivisa | 2026-04-29 | 4,000.00 | BROU Dolares |
| `cmokaeabz...` | Pago Tiempo al Tiempo | 2026-04-29 | 10,000.00 | BBVA Dolares |

**Total double-counted pre-v4.1**: $35,543.41 USD (= total de Payments activos).

Post-v4.1: `computeAccountBalance` excluye estos movimientos del agregado de gastos directos vía `paymentApplications: { none: { payment: { deletedAt: null } } }`. Sólo se cuentan vía Payments. ✓

### 3. Payments sin `accountId`

**Ninguno.** Q4 retornó 0 filas.

### 4. PaymentApplications huérfanas

**Ninguna.** Q9 retornó 0 filas. Todas las apps apuntan a Payments y FinanceMovements activos.

### 5. AJUSTE_CONCILIACION acumulados

**5 ajustes activos**, todos del 2026-04-29:

| cuenta | tipo | monto USD | createdAt |
|---|---|---|---|
| BBVA Dolares | GASTO | 8,000.00 | 19:55 |
| BROU Dolares | GASTO | 3,154.04 | 19:56 |
| SCOTIABANK Dolares | INGRESO | 2,709.00 | 19:56 |
| BROU Dolares | GASTO | 6,875.78 | 20:49 |
| BBVA Dolares | GASTO | 27,964.00 | 20:50 |

**Patrón sospechoso**: BBVA y BROU fueron conciliadas DOS VECES en una hora (19:55 y 20:50; 19:56 y 20:49). El primer ajuste no resolvió el problema porque entre la primera y la segunda recon el bug v4.1 seguía activo (probablemente se crearon Auto-Payments nuevos que volvieron a romper el saldo).

**Suma de ajustes GASTO** (impacto neto en saldo cuentas): -45,993.82 USD.
**Suma de ajustes INGRESO**: +2,709.00 USD.
**Neto**: -43,284.82 USD aplicados como ajustes.

Estos movimientos están bien formados (categoria=AJUSTE_CONCILIACION, ivaTasa=0, accountId presente, pagado/cobrado coherente con tipoMovimiento, status=PAGADO). NO son un bug. Son la corrección manual del descalce que existía pre-v4.1.

### 6. `fechaSaldoInicial` en el FUTURO

**Hallazgo crítico de configuración** (no es bug del código pero genera confusión):

| cuenta | saldoInicial USD | fechaSaldoInicial | movs anteriores a fechaSaldoInicial |
|---|---|---|---|
| **BBVA Dolares** | 41,791.00 | **2026-04-30** (mañana) | 13 movs · gastos pagados $68,460 · ingresos cobrados $60,460 |
| **BROU Dolares** | 1,960.00 | **2026-04-30** (mañana) | 37 movs · gastos pagados $43,300 · ingresos cobrados $43,300 |
| BBVA Pesos | 0 | 2026-04-27 | — |
| BROU Pesos | 0 | 2026-04-27 | — |
| Efectivo | 700 | 2026-04-27 | — |
| SCOTIABANK Dolares | 0 | (null) | — |

**`computeAccountBalance` IGNORA `fechaSaldoInicial`** — no hay filtro `WHERE fecha >= account.fechaSaldoInicial`. El campo es puramente informativo.

Implicancia: 50 movimientos con `fecha < fechaSaldoInicial` se suman al saldo igual que los demás. Esto _funciona_ en este dataset porque el `saldoInicial` (41,791 BBVA / 1,960 BROU) representa el balance original ANTES de cualquier movimiento, no el balance "a partir de la fecha". Pero el campo `fechaSaldoInicial` está mal usado como si fuera un cutoff.

### 7. PaymentApplications múltiples por movimiento

**Ninguno.** Q9b retornó 0 filas. No hay parcialidades reales en el dataset (los 7 PaymentApplications son 1:1 con 7 Payments, todos full-payment).

### 8. Inconsistencias de flags status/pagado/cobrado

**Ninguna.** Verificado:
- `INGRESO` `cobrado=true` SIN `status=PAGADO`: 0
- `INGRESO` `status=PAGADO` SIN `cobrado=true`: 0
- `GASTO` `pagado=true` SIN `status=PAGADO`: 0
- `GASTO` `status=PAGADO` SIN `pagado=true`: 0

Todos los flags están sincronizados.

### 9. Status A_PAGAR / PARCIALMENTE_PAGADO inconsistente con applications

**Ninguno.** Q final no encontró movimientos con status PAGADO cuyo monto != suma de aplications, ni A_PAGAR con applications activas.

---

## Por cada cuenta: saldo esperado vs calculado

| Cuenta | Moneda | saldoInicial | Ingresos cobrados | Gastos sin Payment | Payments | **Saldo v4.1** | Saldo última recon | Coincide |
|---|---|---|---|---|---|---|---|---|
| BBVA Dolares | USD | 41,791.00 | 60,460.00 | 39,792.00 | 28,668.00 | **33,791.00** | 33,791.00 | ✓ |
| BBVA Pesos | UYU | 0.00 | 0 | 0 | 0 | **0.00** | 0.00 | ✓ |
| BROU Dolares | USD | 1,960.00 | 43,300.00 | 36,424.59 | 6,875.41 | **1,960.00** | 1,960.00 | ✓ |
| BROU Pesos | UYU | 0.00 | 0 | 0 | 0 | **0.00** | 0.00 | ✓ |
| Efectivo | USD | 700.00 | 0 | 0 | 0 | **700.00** | 700.00 | ✓ |
| SCOTIABANK Dolares | USD | 0.00 | 2,709.00 | 375.00 | 0 | **2,334.00** | 2,334.00 | ✓ |
| **Total USD** | | | | | | **38,785.00** | | |

---

## Comparación pre-v4.1 vs post-v4.1

| Cuenta | Saldo pre-v4.1 (BUGGY) | Saldo post-v4.1 | Diferencia |
|---|---|---|---|
| BBVA Dolares | 5,123.00 | 33,791.00 | +28,668.00 (= Payments) |
| BROU Dolares | -4,915.41 | 1,960.00 | +6,875.41 (= Payments) |
| Efectivo | 700.00 | 700.00 | 0 |
| SCOTIABANK Dolares | 2,334.00 | 2,334.00 | 0 |
| **Total USD** | **3,241.59** | **38,785.00** | **+35,543.41** |

El delta total ($35,543.41) coincide exactamente con la suma de Payments activos. Confirma que el bug pre-v4.1 era el doble conteo.

---

## Recomendaciones

### A — Aclarar el rol de `fechaSaldoInicial` (prioritario)

Hoy el campo es informativo y engañoso. Hay dos caminos:

1. **Hacerlo funcional**: agregar `fecha >= account.fechaSaldoInicial` en `computeAccountBalance`. Cuando se ejecute una conciliación, actualizar `saldoInicial=saldoReal` y `fechaSaldoInicial=fecha de la conciliación` para que esa conciliación quede como nuevo "punto cero". Movimientos anteriores ya no afectan el saldo (quedan como histórico).
   - Pro: las conciliaciones quedan limpias; saldo es transparente.
   - Contra: cambia la semántica del campo; requiere migración de las cuentas que ya tienen `fechaSaldoInicial` mal seteado (BBVA y BROU con fecha futura, hay que corregir).

2. **Eliminar el campo**: si nadie usa la fecha como cutoff, sacarlo del schema y de la UI. `saldoInicial` sigue siendo "balance arbitrario inicial" sumado al flujo completo.
   - Pro: simple; matchea el código actual.
   - Contra: el usuario reportó que pensó que servía como cutoff (de ahí los `2026-04-30` en BBVA y BROU). Si quiere conciliar, no tiene mecanismo limpio.

**Mi recomendación**: opción 1. Es lo que el usuario espera intuitivamente y resuelve el "ruido histórico" de movimientos pre-conciliación.

### B — No re-baseline retroactivo

NO recomiendo borrar o desvincular movimientos pre-conciliación para "limpiar" la historia. Los ajustes de conciliación (5 movimientos) ya compensaron el descalce, y el saldo actual es correcto. Tocar el histórico rompería:
- Reportes mensuales / anuales
- Lista de movimientos por proveedor
- Audit trail de aprobaciones

### C — Posible mejora: limit visualización de AJUSTE_CONCILIACION

Los 5 ajustes aparecen como GASTO/INGRESO en `/finanzas/movimientos`, mezclados con los reales. Podría agregarse:
- Un badge especial "Ajuste de conciliación" en la lista
- Un filtro para ocultarlos de la vista normal
- O, alternativamente, dejar que `categoriaPrincipal=AJUSTE_CONCILIACION` los marque visualmente (chip o color)

No es urgente — sólo cosmético.

### D — Tests de invariantes

Para detectar regresiones futuras como la de v4.1 antes que llegue a producción, agregar tests que validen:
1. `Σ saldoActual cuentas == Σ saldoInicial + Σ ingresos - Σ gastos sin payment - Σ payments`
2. Para cada cuenta: `saldoActual == saldoInicial + ingresos - gastos directos - pagos` (donde "gastos directos" excluye los que tienen Payment)
3. En `GET /finance/movements`: el último concretado en orden cronológico tiene `saldoUSD == saldoActualCuentas`

El warning ya agregado en v4.1 cubre el punto 3 en runtime; faltaría un test unitario que lo formalice.

### E — Eliminar fechaSaldoInicial futura como sanidad

Si se queda con el modelo actual, agregar validación en POST/PATCH /accounts: `fechaSaldoInicial <= hoy`. Las dos cuentas con fecha 2026-04-30 fueron seteadas seguramente por error.

---

## Conclusión

El estado actual de la base es **coherente**: saldo cuentas = $38,785 USD = flujo unificado.

Los problemas que el usuario reportó están resueltos por v4.1 (split por concretado + sin doble conteo). El histórico contiene 5 ajustes de conciliación que compensaron el descalce que existía pre-v4.1, sumando $43,284.82 USD netos de "corrección manual". No requieren ser revertidos.

Los únicos pendientes son **decisiones de diseño** (no bugs):
- Qué hacer con `fechaSaldoInicial` (recomendación A).
- Limpiar visualmente los AJUSTE_CONCILIACION en la lista (recomendación C).
- Validar fechas futuras en saldoInicial (recomendación E).
