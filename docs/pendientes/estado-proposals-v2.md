# Handoff — Estado de Propuestas v2 (post Tanda 1)

> Snapshot para retomar en una sesión nueva. Versión del producto al cerrar:
> **7.1** (`client/src/version.ts`). Todo lo de abajo está **commiteado en `main`**
> (no pusheado). Cada tanda tiene su SPEC en `docs/features/proposals-v2/`.

## 1. Qué venimos haciendo y por qué

Serie de mejoras sobre **Propuestas v2** (el generador de propuestas comerciales
del asesor). Dos ejes: (a) que la **calculadora** matchee el Excel de referencia
(caso Gonzalez) y sea editable/trazable, y (b) que el asesor **arme y gestione
propuestas sin salir del contexto del lead**, con viabilidad en vivo y sus
documentos a mano.

## 2. Qué quedó hecho en esta sesión

En orden cronológico (grupos de commits):

1. **Fix calculadora (caso Gonzalez)**: mano de obra por **cuadrilla** (escalón por
   paneles, no por kWp), equipamiento trifásico corregido (eléctrica 750, meter
   220, panel 100), **BBVA con UI+PMT** y **factores de ahorro por tarifa**
   (Simple 1.05 / Doble 0.88 / Triple 0.88). Todo editable desde *Admin → Defaults*.
   Grants: `grant-fix-gonzalez-defaults.ts`, `grant-fix-factores-tarifa.ts`.
2. **BBVA 40x en el PDF**: el template multiplicaba la cuota (ya en pesos) por el
   dólar → se sacó el `mult ...cotizacionDolar` en `financiacion.hbs`/`resumen.hbs`.
3. **Markup en porcentaje** (20 = 20%): `interpretarMarkup()` acepta decimal o %
   por magnitud (compat con snapshots viejos). Grant `grant-markup-porcentaje.ts`.
4. **Drawer de debug de calculadora** (`/admin/propuestas`… no; es un drawer en el
   constructor, endpoint `/draft/calc` **admin-only**).
5. **Fase G**: **memoria de cálculo** (`/admin/propuestas/memoria-calculo`, gate
   `VENTAS:ACCESS_MEMORIA`), corrección del margen en `SPEC.md §6`, cleanup TS
   (baseline **7→5**), y docs de deploy: `DEPLOY.md`, `ROLLBACK.md`,
   `QA_CHECKLIST_PRE_DEPLOY.md`.
6. **Firma dinámica del mail UTE**: namespace `firma` con datos del usuario que
   prepara la consulta; se resuelve en `prepare` (el `send` manda lo ya renderizado).
7. **Rework modal + lista unificada**: el constructor pasó de **página a modal**
   (`ProposalBuilderModal` + `LargeModal`); la ruta `/leads/:leadId/propuesta` se
   **eliminó** (redirige a `/ventas`); la lista de propuestas es **unificada**
   (nuevas `ProposalV2Version` + viejas `ProposalGeneration`) en el panel del lead;
   modal de preview generalizado (viejas y nuevas).
8. **Tanda 1**: **indicadores de viabilidad** en el sub-header del constructor
   (endpoint `/draft/viability`, `VENTAS:VIEW`); **panel del lead** → `LargeModal`
   centrado con **dos columnas**; **adjuntos** ajustados a la spec (whitelist
   angosta, 10 MB, `ConfirmDialog`).

## 3. Qué falta (en orden)

### A. Deploy a producción (bloqueante para que todo ande en prod)

1. **Env faltantes**: el `docker-compose.prod.yml` (bloque `server.environment`)
   solo pasa 7 variables. Faltan y hay que **agregarlas al compose** + setearlas en
   el `.env` de prod, y **recrear el server**:
   `SMTP_ENCRYPTION_KEY` (sin esto no se guardan credenciales SMTP → no se manda
   mail), `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SMTP_HOST/PORT/USER/PASS/FROM`,
   `TWILIO_*`. (Ver DEPLOY.md §2.)
2. **Scripts one-off en prod** (tras `migrate deploy`): los grants de DEPLOY.md §6
   **+** `scripts/seed-email-templates.ts` (crea la plantilla `consulta_ute` si no
   está) **+** `scripts/update-consulta-ute-template.ts` (aplica la firma dinámica
   a la fila existente — el seed es create-if-absent y no la pisa).
3. **QA visual**: recorrer `docs/QA_CHECKLIST_PRE_DEPLOY.md`.

### B. Decisiones de negocio pendientes (Nicolás)

- **Precio del panel 100 vs 105** (hoy **100** para reproducir el Excel).
- **Factor real de tarifa Triple** (hoy **0.88** = Doble, placeholder; editable
  desde *Admin → Factor de ahorro por tarifa*).

### C. Deuda técnica (post-deploy)

- **Cluster finanzas PnL** (`docs/pendientes/finanzas-pnl-includes.md`): 5 errores
  TS por el fallback `__never__` sin includes; fix seguro de ~6 líneas → baseline
  TS **5→0**. No es bug de runtime.
- **`energiaMensualKwh`** (`× 900`) es **vestigial** (no lo usa ningún template ni
  el cliente): sacarlo de `ProposalCalculated` (y de `calculator-labels.ts`).
- **Drawer de debug** usa gate **hardcodeado por rol ADMIN** (`/draft/calc`).
  Migrarlo al patrón declarativo con acción **`VENTAS:DEBUG_CALCULADORA`** (como se
  hizo con `ACCESS_MEMORIA`: enum `Action` + migración + seed + grant + `authorize`
  en el endpoint + `CanAccess`/`PermissionRoute` en el cliente).
- **Propuestas viejas** (`ProposalGeneration`): no soportan **descartar/restaurar**
  (no hay `discardedAt`) ni **descargar Excel** (`inputFilePath` sin endpoint).
  Requiere cambios de schema/endpoints.

### D. Próximas tandas (mencionadas, no arrancadas)

- Migración/decisión de adjuntos del lead al proyecto al convertir (ya existe
  `copyLeadAttachmentsToProject`, que hoy los copia — revisar en tanda 3).

## 4. Decisiones/contexto que NO están en CLAUDE.md ni en los SPEC

- **El constructor ya no es página**: `ProposalBuilderPage` **borrado**; es
  `client/src/components/proposals-v2/ProposalBuilderModal.tsx` (abre desde el panel
  del lead). `/leads/:leadId/propuesta` **redirige** a `/ventas`.
- **El panel del lead es un `LargeModal` centrado** (antes `<aside>` lateral).
  `LargeModal` tiene prop **`size`** (`"full"` constructor / `"wide"` = `max-w-6xl`
  panel del lead). Cierra **solo con X** (sin Escape ni backdrop).
- **`GET /api/leads/:leadId/proposals` cambió de shape** (unificado
  `ProposalListItem[]`, nuevas + viejas por fecha) — **breaking**, sin consumidores
  del formato viejo.
- **Adjuntos por lead ya existían** sobre `FileAttachment` (campo `leadId`), **no
  hay modelo `LeadAttachment`**. Se **copian al proyecto** al convertir el lead.
- **`ConfirmDialog` reusable ya existe** (`client/src/components/ui/ConfirmDialog.tsx`,
  props `open/onClose/onConfirm/destructive/loading`).
- **Gates de cálculo**: `/draft/calc` es **admin-only**; `/draft/viability` es
  **`VENTAS:VIEW`** (el estado ok/warning/error/unknown se calcula en el server).
- **Tests nuevos** (server, `node:test`): `npm run test:proposal`,
  `test:proposal-template`, `test:proposal-draft-calc`, `test:proposal-memoria`,
  `test:lead-proposals`, `test:viability`, `test:lead-attachments`.
  **Baseline `tsc` server = 5** (eran 7; se bajaron 2 de nullability en `api.routes.ts`).
- **⚠️ Al reiniciar el server para verificar en vivo**: `docker compose restart
  server` corre en background; el `/health` puede responder **durante** el restart
  (código viejo). Verificar dos veces / esperar unos segundos antes de confiar.

## 5. Archivos para mirar

- **Calculadora / servicios**: `server/src/services/proposal/` → `calculator.ts`,
  `calculator-labels.ts`, `viability.service.ts`, `lead-proposals.service.ts`,
  `calculator-memoria.ts`, `advisor.ts`, `resolveDefaults.ts`.
- **Endpoints**: `proposals-v2-drafts-versions.routes.ts` (`/draft/calc`,
  `/draft/viability`), `proposals-v2-defaults.routes.ts` (`/calculator-memoria`),
  `api.routes.ts` (`/leads/:id/proposals`, proposals viejas), `sales.routes.ts` +
  `services/sales/sales.service.ts` (adjuntos).
- **Cliente**: `components/proposals-v2/ProposalBuilderModal.tsx`,
  `ViabilityIndicators.tsx`, `CalculatorDebugDrawer.tsx`,
  `components/sales/LeadProposalsList.tsx`, `LeadAttachments.tsx`,
  `ProposalPreviewModal.tsx`, `pages/Sales.tsx` (panel del lead),
  `pages/CalculatorMemoryPage.tsx`, `components/ui/LargeModal.tsx`,
  `hooks/useViabilityIndicators.ts` / `useDraftCalc.ts` / `useLeadProposals.ts`.
- **Docs**: `docs/features/proposals-v2/` (SPEC.md, FASE_E/F/G, REWORK_MODAL,
  DEBUG_CALCULADORA, TANDA_1), `docs/DEPLOY.md`, `docs/ROLLBACK.md`,
  `docs/QA_CHECKLIST_PRE_DEPLOY.md`, `docs/pendientes/finanzas-pnl-includes.md`.
- **Grants / one-off** (correr en prod): `server/prisma/scripts/grant-*.ts`,
  `server/scripts/seed-email-templates.ts`, `server/scripts/update-consulta-ute-template.ts`.
