# Debug saldo lista de movimientos — 2026-04-29

## TL;DR

**La aritmética del saldo está correcta.** Cada fila tiene el valor matemáticamente exacto.

**El problema es el ORDEN visual** del listado: la consulta sólo ordena por `fecha desc`, sin desempate. Cuando hay 6 movimientos del mismo día (29/04), Postgres los devuelve en orden arbitrario. El cálculo del saldo SÍ usa `createdAt desc` como desempate, así que los números coinciden con el orden cronológico real — pero ese orden no es el que se ve en la UI, lo que hace que leídos top-to-bottom los saldos parezcan inconsistentes.

**Bonus**: hay 2 "Ajuste conciliación BBVA Dolares" de USD 8.000 cada uno — son duplicados de los retries que hiciste antes del fix de v4.3, no aportan saldo (la cuenta tiene `fechaSaldoInicial=2026-04-30` que los filtra).

---

## 1. Movimientos del 29/04 ordenados por createdAt

| # | createdAt UTC | descripción | tipo | monto | cuenta | categoría |
|---|---|---|---|---|---|---|
| 1 | 16:27:17 | pago Fivisa | GASTO | 4.000 | BROU Dolares | PAGO_PROVEEDOR |
| 2 | 16:46:12 | Pago Tiempo al Tiempo | GASTO | 10.000 | BBVA Dolares | PAGO_PROVEEDOR |
| 3 | 17:45:49 | Patente Camion | GASTO | 158 | BROU Dolares | FIJO |
| 4 | 17:46:06 | Peajes | GASTO | 100 | BROU Dolares | VARIABLE |
| 5 | 30/04 00:30:46 | Ajuste conciliación BBVA Dolares | GASTO | 8.000 | BBVA Dolares | AJUSTE_CONCILIACION |
| 6 | 30/04 00:32:20 | Ajuste conciliación BBVA Dolares | GASTO | 8.000 | BBVA Dolares | AJUSTE_CONCILIACION |

Todos tienen `fecha = 2026-04-29`. Los 2 ajustes BBVA tienen createdAt del 30/04 UTC porque fueron creados ~21:30 hora Uruguay = 00:30 UTC.

---

## 2. Saldo total cuentas (= punto de partida del walk)

| Cuenta | saldoInicial | fechaSaldoInicial | Saldo USD |
|---|---|---|---|
| BBVA Dolares | 41.791 | **2026-04-30** (futuro) | 41.791 |
| BROU Dolares | 1.960 | **2026-04-30** (futuro) | 1.960 |
| Efectivo | 700 | 2026-04-27 | 700 |
| SCOTIABANK Dolares | 0 | (null) | -375 |
| BBVA Pesos | 0 | 2026-04-27 | 0 |
| BROU Pesos | 0 | 2026-04-27 | 0 |
| **Total USD** | | | **44.076** |

Como BBVA y BROU tienen `fechaSaldoInicial=2026-04-30`, NINGÚN movimiento del 29/04 (ni los ajustes, ni el Pago Fivisa, etc.) cuenta para sus saldos. Sólo aporta SCOTIABANK con un -375 (un GASTO directo del 28/04 sin Payment).

`saldoActualCuentas = 44.076 USD`.

---

## 3. Walk DESC (cómo se computa la columna saldo)

El backend (v4.1) ordena los concretados DESC por `fechaEfectiva` y, en empate, por `createdAt DESC`. Empieza con `saldoTemp = saldoActualCuentas = 44.076` y para cada fila:
1. `saldoMap[id] = saldoTemp`  ← lo que se muestra en la columna
2. `saldoTemp += monto` (revierte el GASTO)

Aplicando esto a los 6 movs (DESC por createdAt):

| Iter | Mov | createdAt | saldo mostrado | saldoTemp después de revertir |
|---|---|---|---|---|
| 1 | Ajuste #2 (cmokr1qk4) | 30/04 00:32 | **44.076** | 52.076 |
| 2 | Ajuste #1 (cmokqzptu) | 30/04 00:30 | **52.076** | 60.076 |
| 3 | Peajes | 17:46 | **60.076** | 60.176 |
| 4 | Patente Camion | 17:45 | **60.176** | 60.334 |
| 5 | Pago Tiempo al Tiempo | 16:46 | **60.334** | 70.334 |
| 6 | pago Fivisa | 16:27 | **70.334** | 74.334 |

**Coinciden 100% con los valores que reportaste:**
- Peajes 60.076 ✓
- pago Fivisa 70.334 ✓
- Patente Camion 60.176 ✓
- Ajuste #1 52.076 ✓
- Pago Tiempo al Tiempo 60.334 ✓
- Ajuste #2 44.076 ✓

La aritmética NO está rota. Los saldos significan: "saldo de las cuentas justo después de aplicar este movimiento (y antes de los movimientos posteriores)".

---

## 4. Por qué parece roto en la UI

El listado se sirve con esta query ([api.routes.ts:10304](server/src/routes/api.routes.ts#L10304)):

```typescript
orderBy: { fecha: "desc" },
```

Sin desempate por `createdAt`. Cuando 6 filas comparten `fecha=2026-04-29`, Postgres las devuelve en orden no determinístico.

Tu screenshot las muestra en este orden:
1. Peajes — saldo 60.076
2. pago Fivisa — saldo 70.334
3. Patente Camion — saldo 60.176
4. Ajuste BBVA — saldo 52.076
5. Pago Tiempo al Tiempo — saldo 60.334
6. Otra Ajuste BBVA — saldo 44.076

Si las leés top-to-bottom esperando un running balance (cada fila = saldo anterior - monto), no cuadra: el orden visual NO es chronological. Si las re-ordenás por createdAt DESC (= cómo el backend las walked):

```
Ajuste #2  44.076
Ajuste #1  52.076  (= 44.076 + 8.000 reversed)
Peajes     60.076  (= 52.076 + 8.000 reversed — wait that's 60.076)
Patente    60.176  (= 60.076 + 100 reversed)
Pago T t T 60.334  (= 60.176 + 158 reversed)
pago Fivisa 70.334 (= 60.334 + 10.000 reversed)
```

Cada fila = la fila siguiente + monto revertido. ✓ Es coherente.

Tu expectativa "pago Fivisa debería ser 56.076" probablemente sale de leer el screenshot top-to-bottom: `Peajes 60.076 - 4.000 (pago Fivisa) = 56.076`. Pero pago Fivisa NO viene cronológicamente después de Peajes — viene ANTES (16:27 vs 17:46). Entonces el saldo de pago Fivisa es MAYOR (porque las deducciones posteriores aún no se aplicaron).

---

## 5. Conciliaciones del día

Hay **16 conciliaciones registradas** en las últimas ~5 horas (ver tabla full abajo), pero sólo **2 ajustes activos** (los duplicados de BBVA $8.000):

| # | createdAt UTC | cuenta | saldoReal | saldoCalc | diferencia | ajusteId |
|---|---|---|---|---|---|---|
| 1 | 19:53 | BBVA Pesos | 0 | 0 | 0 | (sin ajuste, sin diff) |
| 2 | 19:55 | BBVA Dolares | 33.087 | 41.087 | -8.000 | cmokh61u3 (luego eliminado a las 23:59) |
| 3 | 19:56 | BROU Dolares | 1.960,37 | 5.114,41 | -3.154,04 | cmokh6qa0 (eliminado) |
| 4 | 19:56 | SCOTIABANK | 2.334 | -375 | +2.709 | cmokh7j43 (eliminado) |
| 5-6 | 19:57 | Efectivo / BROU Pesos | sin diff | | | |
| 7 | 20:49 | BROU Dolares | 1.960 | 8.835,78 | -6.875,78 | cmokj3jqy (eliminado) |
| 8 | 20:50 | BBVA Dolares | 33.791 | 61.755 | -27.964 | cmokj4ri4 (eliminado) |
| 9-13 | 30/04 00:29-00:32 | BBVA Dolares (×5 retries) | 33.791 | 41.791 | -8.000 | sólo 2 con ajuste activo |
| 14-16 | 30/04 00:42-00:48 | BBVA Dolares (×3 más) | 33.791 | 41.791 | -8.000 | el último (cmokrfvbp) eliminado |

**Resumen de la actividad**:
- A las 19:55-20:50 (29/04 hora UY) hiciste la **primera tanda** de conciliaciones funcionales (5 ajustes activos en ese momento).
- A las ~21:00 (29/04 hora UY = 23:59 UTC) eliminaste manualmente esos 5 ajustes.
- A las 21:30+ (29/04 hora UY = 30/04 UTC) intentaste de nuevo, pero las cuentas tenían `fechaSaldoInicial=2026-04-30` (futuro) y los ajustes nuevos quedaban antes del corte → no surtían efecto. Hiciste 8 intentos en BBVA antes de notar que algo andaba mal. De esos 8, sólo 2 dejaron ajuste activo (cmokqzptu y cmokr1qk4, ambos $8.000 GASTO 29/04).

---

## 6. Diferencias y causas

### Diferencia 1 — orden visual ≠ orden cronológico de cálculo

| Campo | Realidad | Problema |
|---|---|---|
| Saldo aritmético | Correcto | — |
| Display order del listado | `fecha desc` solamente | Ambiguo cuando hay multiples movs en la misma fecha |
| Walk del saldo | `fecha desc + createdAt desc` | Correcto, pero el resultado se muestra en filas que están en otro orden |

**Causa**: [server/src/routes/api.routes.ts:10304](server/src/routes/api.routes.ts#L10304):
```typescript
orderBy: { fecha: "desc" },   // sin createdAt como tiebreaker
```

### Diferencia 2 — duplicación de ajustes BBVA

2 ajustes "Ajuste conciliación BBVA Dolares" de $8.000 cada uno son **duplicados artefactos** de los retries durante el bug "fechaSaldoInicial futuro = todo bloqueado". Conceptualmente sólo querías UNO ajuste de $8.000. Aunque hoy ninguno cuenta (siguen siendo bloqueados por fechaSaldoInicial=30/04), si en algún momento bajás `fechaSaldoInicial` por debajo de 29/04, ambos van a aplicar y van a sobre-corregir el saldo.

### Diferencia 3 — saldo cuentas BBVA / BROU desconectado de la realidad

Como `fechaSaldoInicial=2026-04-30` (futuro) en BBVA y BROU:
- BBVA: 17 movs históricos del mes (USD 60k+ ingresos, USD 39k+ gastos, USD 28k+ payments) son IGNORADOS. Saldo = saldoInicial = 41.791 (lo que tipeaste como "punto cero" inicial).
- Lo mismo para BROU: saldo = saldoInicial = 1.960.

Tu saldoReal medido (33.791 BBVA, 1.960 BROU) NO matchea con el cálculo (41.791, 1.960) por el caso BBVA. La diferencia de $8.000 es lo que querés ajustar; pero el ajuste no entra porque `fecha=29/04 < fechaSaldoInicial=30/04`.

---

## 7. Recomendaciones

### A. Fix display order (1 línea de código, alta prioridad)

Cambiar [api.routes.ts:10304](server/src/routes/api.routes.ts#L10304):
```typescript
orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
```

Esto hace que el listado salga en el mismo orden que el walk del saldo. Para el caso del 29/04 visualizarías:
1. Ajuste #2 (44.076)
2. Ajuste #1 (52.076)
3. Peajes (60.076)
4. Patente (60.176)
5. Pago Tiempo al Tiempo (60.334)
6. pago Fivisa (70.334)

Cada saldo es exactamente el del próximo + monto revertido. Coherente top-to-bottom.

### B. Cleanup de los 2 ajustes BBVA duplicados

Soft-delete de uno de los dos:
- `cmokqzptu0009pk0i41k4ixx5` (00:30:46) o
- `cmokr1qk4000jpk0ieheyyjfp` (00:32:20)

Cualquiera. Borrar el más reciente es más limpio (te queda el primero que generaste). Las 2 AccountReconciliation correspondientes pueden quedar como historial — el `ajusteMovementId` quedará apuntando a un movimiento soft-deleted y el frontend lo manejará como "ajuste eliminado".

### C. Resolver el `fechaSaldoInicial` futuro de BBVA y BROU

Sin esto, las conciliaciones siguen siendo no-op. Opciones:
- Editar BBVA y BROU desde Admin → Cuentas y dejar el campo "Fecha del saldo" vacío. El saldo pasaría a calcularse desde todo el histórico (legacy).
- O bajar `fechaSaldoInicial` a una fecha pasada que represente el verdadero "punto cero" (ej. cuando empezaste a usar el sistema o hiciste el último corte limpio).

La nueva validación (v4.3 + el fix de hoy) ya impide crear conciliaciones con fecha < fechaSaldoInicial: si volvés a intentar, te avisa con mensaje claro.

### D. (Opcional) Mostrar createdAt en filas con misma fecha

Si la app va a tener muchos movimientos del mismo día, agregar la hora discreta (ej. "29/04 16:27") en la columna fecha cuando se detectan múltiples del mismo día. Hace más fácil leer el orden cronológico sin tener que adivinar.

---

## 8. Conclusión

- La columna saldo NO tiene bug aritmético. Cada valor es calculado correctamente bajo el modelo "saldo después de aplicar este movimiento, walking DESC desde el saldo actual de cuentas".
- El listado se renderiza en orden indeterminado para movimientos del mismo día → la lectura visual top-to-bottom no es coherente.
- Hay 2 ajustes BBVA duplicados de $8.000 (artefacto de retries) y `fechaSaldoInicial=2026-04-30` (futuro) en BBVA y BROU bloqueando todas las conciliaciones del día. Ninguno de esos dos compensa al otro: hoy ambos no cuentan, pero son frágiles.
- El fix mínimo de Display (recomendación A) elimina la confusión visual sin tocar datos.
