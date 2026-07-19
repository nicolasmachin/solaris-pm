# Estado general de pendientes — Voltia PM

> Tablero maestro. Validado contra el código el 2026-07-12; depurado contra el CHANGELOG v8.1 el 2026-07-17.
> Los detalles finos viven en los docs enlazados; este archivo es el índice.
> Numeración de traspasos = enum `TraspasoTipo` del código (T1–T13). El informe
> viejo usaba una numeración distinta (T6/T7/T9/T10/T11); acá manda el código.

## Leyenda
🟡 PARCIAL · 🟠 SOLO DISEÑO · ⬜ PENDIENTE · ❌ NO EXISTE · ❓ a aclarar · ✅ HECHO (verificado)

---

# PARTE A — PENDIENTES

## 1. Traspasos y notificaciones

| Ítem | Estado | Nota |
|---|---|---|
| Tests de integración con DB (crear/confirmar, escalación) | ⬜ | `estado-traspasos.md` §4 (E). Ruteo ya testeado (14 tests). |
| T8 para 3 proyectos legacy con nombre viejo de etapa | ⬜ | Borde; ya finalizados. Resto de la migración 5→8 ya reconciliada (0 trabados). |
| T11 (encuesta nota baja) | ✅ | **Disparado (Ola 3a, 2026-07-14).** Lo genera `responderEncuesta` cuando la nota ≤3; actor = responsable de Experiencia Solar (fallback ADMIN). Falta validación visual + deploy prod. |
| T12 (mant. agendado), T13 (mant. ejecutado) | 🟡 | Ola 3b, **NO auto-agenda** (decisión 2026-07-14). **Parcial:** la lista de Generadores ya tiene columna "Próx. mantenimiento" ordenable (aniversario + cuánto falta, 2026-07-16). Falta vista dedicada próximos/en plazo/vencidos + registrar el mantenimiento ejecutado (T13). Agenda manual de Operaciones. |
| Afinados de traspasos (config SLA por-traspaso desde UI, transición auto E3-A→E3-B, feriados en días hábiles) | ⬜ | Fuera del MVP. |

📄 Detalle: `docs/pendientes/estado-traspasos.md` (ojo: desfasado, subestima Tickets/T8).

## 2. Tickets (T9/T10)

| Ítem | Estado | Nota |
|---|---|---|
| Adjuntar documentos al abrir o responder un ticket | ⬜ | Hoy `Ticket`/`TicketComment` no soportan adjuntos. Casos: abrir con foto/plano, responder con un informe. Reusar `FileAttachment` (agregar `ticketId` o vía `toolEntityId`). Backend + UI (interna y portal). |
| Historial de recorrido del ticket (áreas/usuarios por los que pasó) | 🟡 | El dato **ya se audita** (`createAuditEntry` en derivar / en progreso / resolver / cerrar / comentar), pero `TicketDetail` no lo muestra. Falta endpoint que devuelva el audit del ticket + timeline en la UI. |
| Cabecera del ticket con más contexto (quién abrió · asignado actual · proyecto/cliente) | 🟡 | Hoy muestra "Abierto por X" + link "Ver proyecto →" **sin nombre**. Falta: nombre del proyecto/cliente y **asignado actual**. Ojo: `asignadoAId` **nunca se setea** hoy — no existe asignación real de tickets; definir el modelo de asignación primero. |
| Botón "Abrir ticket" directo desde ficha de proyecto/Generador | ⬜ | Hoy se crea desde Mis tareas con el buscador. Mejora chica. |

## 3. Atención al cliente (Experiencia Solar) — Olas

| Ola / Ítem | Estado | Nota |
|---|---|---|
| Ola 3a — motor de encuestas + aniversario + T11 | ✅ | **Hecho (2026-07-14).** Encuestas OBRA/HABILITACION (por hito de etapa) + ANIVERSARIO (cron, cap 2 años). Nota 1-5, ≤3 dispara T11. Portal `/portal/encuestas` (in-app) + panel interno `/encuestas` + timeline. Falta validación visual + deploy prod. |
| Ola 3b — mantenimientos (T12/T13) | 🟡 | **NO auto-agenda** (decisión 2026-07-14). **Parcial:** la lista de Generadores ya muestra "Próx. mantenimiento" ordenable (2026-07-16). Falta vista dedicada (próximos/en plazo/vencidos) + registrar el mantenimiento ejecutado. Sin calendario. |
| Ola 4 — encuestas E1/E2/E3 (nota baja) | 🟡 | Desbloqueada: el motor de encuestas ya existe (Ola 3a). Falta el detalle E1/E2/E3 del protocolo. |
| Ola 5+ — reporte mensual · dashboard · fabricantes | 🟡 | Tickets ya hechos (ver Parte B). Reporte mensual puliéndose en otro chat. Dashboard y fabricantes sin diseñar. |
| Unificar interacciones en la ficha del cliente | ✅ | Historial ahora junta Ventas + comentarios + interacciones (con canal/dirección/motivo) + avances de etapa del proyecto + traspasos + tickets (apertura/resolución) + documentos publicados (contrato/proforma/propuesta). `getClienteTimeline` en `services/clientes/index.ts` + `ClienteTimeline.tsx`. Verificado por API 2026-07-12; falta validación visual. |
| Portal auto-agendamiento de mantenimiento (calendario in-house) | ❌ | No existe modelo de mantenimiento ni self-schedule en el portal. |
| Campana de avisos in-app dentro del portal del cliente | ✅ | Campana en el header del portal (`PortalNotificationBell` + `GET/PATCH /client/notifications`). Superficie de lectura de las notifs que ya apuntan al Generador (hoy: tickets); no incluye globales internas. Sin migración. Verificado por API 2026-07-12; falta validación visual. |

## 4. Ingeniería

| Ítem | Estado | Nota |
|---|---|---|
| Fase D del generador EFP (refactor prompt IA) | ❓ | **Sin evidencia en el código** de un refactor pausado. "Fase D" es de Propuestas v2 / pipeline PDF. **Aclarar qué era.** |
| Memorias técnicas | ⬜ | Futuro (marcado "próximamente" en CLAUDE.md). |
| Plano de canalizaciones físicas | ⬜ | Futuro. |
| AUTOGEN | ⬜ | Futuro. |
| Baterías | ⬜ | Futuro. |

## 5. Proyectos — comentarios, interacciones y calendario

| Ítem | Estado | Nota |
|---|---|---|
| Heredar comentarios/interacciones del lead en el proyecto convertido | 🟡 | El **Historial de la ficha del cliente** (`getClienteTimeline`) ya une comentarios + actividades del lead de origen (por `convertedToProjectId`; hecho 2026-07-12). **Falta** que la vista de comentarios normal del proyecto (`/projects/:id`) también los muestre, o re-vincular `Comment.leadId` al proyecto al convertir. Decidir enfoque (mostrar unido vs. copiar). |
| Nota del calendario → comentarios múltiples y unificados | ⬜ | Hoy `InstallationSchedule.notes` es **una sola nota** editable por obra. Pedido: convertirla en **varios comentarios** (autor + fecha) y que aparezcan junto al resto de **comentarios del proyecto** en un solo lugar. |

## 6. Finanzas

| Ítem | Estado | Nota |
|---|---|---|
| Ingesta automatizada de facturas de proveedores | 🟠 | Carga 100% manual hoy. Existe patrón IA reutilizable (`ute-extract`, `minutaExtraction`) pero sin service/route/schema para facturas de proveedor. |
| Errores TS en api.routes.ts ("7") | ⬜ | No medible hoy: client Prisma stale infla el conteo. Correr `prisma generate` + `tsc`. Baseline doc = 5. |
| Cluster PnL (`finanzas-pnl-includes.md`): 5 errores TS, fix ~6 líneas | ⬜ | Baja el baseline server 5→0. No es bug de runtime. |

## 7. Transversal / Reporting

| Ítem | Estado | Nota |
|---|---|---|
| Informe de actividad por período (semanal/mensual de negocio) | ⬜ | Existe modelo `Informe` + reporte semanal admin de traspasos; falta el informe general de negocio. Verificar alcance. |

## 8. Deuda técnica

| Ítem | Estado | Nota |
|---|---|---|
| Duplicados de UteProcess en prod | ⬜ | Sin `@unique` en DB; 2 de 3 flujos crean sin chequear (`api.routes.ts:1596`, `:6954`); fix solo en endpoint manual (`:9267`). Falta `@@unique` parcial. |
| Soft-deletes no propagados | ⬜ | 26/79 modelos con `deletedAt`. Familia propuestas/versiones sin soft-delete. |
| `client/tsconfig.tsbuildinfo` trackeado por git | ⬜ | Está en `.gitignore:22` pero trackeado (ineficaz). Fix: `git rm --cached`. Se re-commitea en cada auto-save. |
| `INFORME_MODULO_EXPERIENCIA_CLIENTE.md` | ❌ | No existe en el repo. Vive afuera o se borró. Decidir si se recrea/versiona. |
| Baseline TS server → 0 | 🟡 | Baseline = 5. Sumar: cluster PnL, `energiaMensualKwh` vestigial, drawer debug con gate hardcodeado por rol. |
| Propuesta v2 conviviendo con la vieja | 🟡 | Superficie chica (~5 refs a `ProposalGeneration` en 3 archivos). v1 sin descartar/restaurar ni exportar Excel. **Poner fecha de corte.** |

📄 Detalle propuestas: `docs/pendientes/estado-proposals-v2.md`, `finanzas-pnl-includes.md`, `gates-hardcodeados-por-rol.md`.

## 9. Infraestructura

| Ítem | Estado | Nota |
|---|---|---|
| Migración web + correo + hosting (VPS + correo nuevo, baja de Netuy) | ⬜ | Roadmap infra Fases 2–6 en CLAUDE.md. |
| Backups periódicos a Backblaze B2 + storage respaldado | ⬜ | Roadmap infra Fase 5. VPS y deploy ya están. |
| Migrar bot de Telegram al VPS | ⬜ | Roadmap infra Fase 6. |

## Puntos a aclarar

1. **"Fase D del generador EFP"** — no hay evidencia en el código de un refactor de
   prompt pausado. ¿Era otra cosa (Propuestas v2 Fase D, pipeline PDF del EFP), o un
   refactor que nunca se codeó?
2. **`INFORME_MODULO_EXPERIENCIA_CLIENTE.md`** — ¿se recrea dentro del repo o se deja
   afuera? Hoy no está versionado.
3. **"Unificar interacciones en la ficha del cliente"** e **"Informe de actividad de
   negocio"** — confirmar alcance para marcar el estado fino.

---

# PARTE B — TERMINADO / VERIFICADO

Todo lo de abajo está commiteado, pusheado y en prod (deploy verificado 2026-07-12).
Detalle completo de lo entregado en v8.0–v8.1 (11–17 jul): ver `CHANGELOG.md`.

## Traspasos y notificaciones

| Ítem | Nota |
|---|---|
| Motor de traspasos T1–T10 (backend + endpoints + frontend en campana) | `services/traspasos/`, `routes/traspasos.routes.ts`, `modules/traspasos/`. Verificado E2E. |
| Expansión pipeline 5→8 etapas (backend + frontend) | `estado-traspasos.md` §4 (A/A-frontend). |
| Motor de completitud de sub-tareas (dispara traspaso de cierre) | `estado-traspasos.md` §4 (B2). "No aplica" cuenta como resuelta. |
| Migración de datos pipeline 5→8 (proyectos viejos) | Ejecutada y verificada en prod vía reconciliación C10: **0 proyectos trabados** (queda solo el borde de 3 legacy → Parte A). |
| Campana / notificaciones in-app + email interno | `NotificationBell.tsx`, `notification.service.ts`. |
| Curaduría de la campana: cobertura de tipos + ruteo por click + página `/notifications` (tabs, filtro por tipo, paginación, marcar leídas) | `NotificationBell.tsx`, `pages/Notifications.tsx`. |
| Deploy prod de traspasos (módulo TRASPASOS + 2 roles + permisos) | Deployado y verificado 2026-07-12 (migraciones + permisos + C10). |

## Tickets (T9/T10)

| Ítem | Nota |
|---|---|
| Módulo de tickets end-to-end (schema, service, rutas, UI staff + portal cliente) | `services/tickets/`, `modules/tickets/`, `PortalTickets*`. Dispara T9/T10. Todo in-app, sin mails. |
| Deploy prod | Deployado y verificado 2026-07-12 (migración + seed de permisos). |
| "Mis tareas" reorganizado (tabs Tareas · Pendientes · Tickets) | "Pendientes" salió del menú principal y vive adentro. |

## Atención al cliente (Experiencia Solar)

| Ítem | Nota |
|---|---|
| Ola 2 — fin de trámite UTE (= T8) | Cierra TRAMITACION_UTE → traspaso a Experiencia Solar (aparece en Pendientes). |
| Seguimientos paralelos CX (último contacto, aviso habilitación) | `estado-traspasos.md` §4 (CX-seguimientos). |

## Comercial / Proyectos

| Ítem | Nota |
|---|---|
| Onboarding — automatizaciones del Asesor Comercial | Según informe externo (no re-validado en esta pasada). |
| Rediseño del panel de leads (dos columnas) | `LargeModal` de dos columnas (rework Propuestas v2). El informe viejo lo listaba como "diferido". |
| Borrado lógico recuperable de proyectos, Generadores y leads | Confirmación escribiendo un número en letras. Desde ficha del proyecto, listado de Experiencia Solar y Ventas. |
| Generadores importados por CSV | Salen de Proyectos y del portafolio de métricas, pero cuentan como obras por Fecha entrega. Campo `importedFromCsv` + backfill. |

## Obra / Operaciones

| Ítem | Nota |
|---|---|
| Calendario — obra tentativa vs. confirmada | Tentativas rayadas/punteadas, confirmadas sólidas, con leyenda. + fix para reconocer la etapa de obra del pipeline nuevo. |
| Control de costos de obra | "Costo real por kW" + sección "Costo no-material" (mano de obra, tercerizados, fletes; carga manual) que suma al costo real, margen y costo/kW. |

## Finanzas

| Ítem | Nota |
|---|---|
| Pago a proveedor aplicado FIFO + backfill | El pago se descuenta solo de las facturas más viejas; los movimientos mal aplicados se auto-corrigieron (CHANGELOG 11 y 15 jul). **Verificar por las dudas** que no queden movimientos viejos "sin aplicar". |
| Estado de resultados — pagos a proveedor por fecha de pago | Cada pago cae en el mes en que salió la plata, aunque la factura siga parcialmente pendiente (CHANGELOG 13 jul). |
| Gasto asociado a proveedor = pago concretado | Un gasto con proveedor cargado desde Movimientos se registra como factura+pago en un acto y ya no figura como deuda (CHANGELOG 15 jul). |

## Calidad

| Ítem | Nota |
|---|---|
| Tests del motor de traspasos (ruteo de destinatarios) | 14 tests: sub-roles, copia gerente/ADMIN, dedupe, área derivada. |
