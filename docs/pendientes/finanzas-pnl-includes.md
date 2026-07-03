# Pendiente — Errores TS del bloque PnL / cashflow de finanzas

> Baseline TS conocido. **NO es un bug de runtime** (ver análisis). Queda para
> un turno aparte de finanzas por convención de ownership, no por riesgo.

## Síntoma

5 errores de TypeScript en `server/src/routes/api.routes.ts`, todos en el bloque
que arma los "unified items" del cashflow/PnL:

- `13664`, `13671` — `Property 'supplier' does not exist ... ¿supplierId?`
- `13673` — `Property 'account' does not exist ... ¿accountId?`
- `13674` — `Property 'applications' does not exist`
- `13674` — `Parameter 'a' implicitly has an 'any' type` (consecuencia del anterior)

## Causa raíz (NO es includes faltantes en la query real)

El array `allPayments` sale de un ternario dentro de un `Promise.all`
(`server/src/routes/api.routes.ts:13407-13419`):

```ts
includePayments
  ? prisma.payment.findMany({
      where: paymentWhere,
      include: { supplier: {...}, account: {...}, applications: { include: { movement: {...} } } },
      orderBy: [...],
    })
  : prisma.payment.findMany({ where: { id: "__never__" } })   // ← fallback SIN include
```

La rama real (`includePayments === true`) **sí** incluye `supplier`, `account` y
`applications`. La rama fallback (`__never__`) **no**. TypeScript infiere el tipo
de `allPayments` como la **unión** de ambos retornos, y en la unión esas
relaciones no existen → error al acceder `p.supplier` / `p.account` /
`p.applications` en el `for (const p of allPayments)` (línea 13653+).

## Por qué NO es un bug de producción

En runtime, el acceso a las relaciones está gateado por `includePayments`:
- Si `includePayments` es `true` → corre la query real (con includes) → las
  relaciones existen.
- Si es `false` → corre `{ where: { id: "__never__" } }` → devuelve `[]` → el
  `for` no itera → nunca se accede a `p.applications` sobre el tipo sin include.

O sea el `.map` sobre `applications` **nunca** corre sobre un valor `undefined`.
El código es correcto en runtime; el problema es solo de tipos.

## Fix seguro (diferido)

Alinear el shape del fallback con el de la rama real (mismos `include`):

```ts
: prisma.payment.findMany({ where: { id: "__never__" }, include: {
    supplier: { select: { id: true, nombre: true } },
    account: { select: { id: true, nombre: true, moneda: true } },
    applications: { include: { movement: { select: { id: true, descripcion: true, monto: true, moneda: true } } } },
  } }),
```

- **Cambio de runtime: ninguno** (el fallback sigue devolviendo `[]`).
- Resuelve los 5 errores → baseline TS bajaría de 5 a **0**.

Se dejó fuera de Fase G por decisión de ownership (código de finanzas se toca en
su propio turno), no por riesgo técnico. Cuando se retome, es un cambio de ~6
líneas verificable con `tsc`.
