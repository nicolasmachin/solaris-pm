# QA — Pipeline 8 etapas + Experiencia Solar + rebrand

> Checklist de prueba manual de la tanda de Traspasos/Experiencia Solar (2026-07-10).
> Estado técnico: `docs/pendientes/estado-traspasos.md`.

## 0. Setup previo
- [ ] Proyectos **existentes** tienen 5 etapas (migración diferida). Para ver las **8 etapas**, usar un **proyecto nuevo**.
- [ ] Usuario de prueba con rol **Experiencia Solar**: `experiencia@voltiapm.com` / `Admin1234` (creado por el script de scaffolding).
- [ ] App en `http://localhost:5173`.

## 1. Vista visual del pipeline (proyecto)
- [ ] Proyecto nuevo → 8 cards con strip de color por área.
- [ ] Sub-tareas con dots por estado; etapa en curso resaltada.
- [ ] Chips de traspaso (T1, T2, T3·T4, T5, T6, T7, T8).
- [ ] Carriles de Experiencia Solar en paralelo (Preobra / Habilitación); carril activo resaltado.
- [ ] Scroll horizontal en mobile; dark/light OK.
- [ ] Click en etapa → abre el StageDrawer.
- [ ] Proyecto viejo (5 etapas): muestra 5 cards + carriles, sin romperse.

## 2. Estructura de sub-tareas (proyecto nuevo)
- [ ] Onboarding (10) incl. "Fecha tentativa de obra".
- [ ] Pre-Ingeniería (8): Relevamiento + Documento/Unifilar/Memorias/Planos/Lista prelim.
- [ ] Validación de Operaciones (2): Informe capataz + Fecha de obra confirmada.
- [ ] Ingeniería Final (3): Revisar + Validar/ajustar (checklist largo) + Cerrar lista.
- [ ] Compras (3): Materiales listos + Logística + Materiales recibidos.
- [ ] Ejecución de Obra (4): Planificación + Propia/Tercerizada + Control de Costos.
- [ ] Tramitación UTE (3) + Post-Habilitación (3).

## 3. Herramientas en el StageDrawer
- [ ] Onboarding → Contrato, Proforma (Modalidad de pago), Consulta UTE.
- [ ] Pre-Ingeniería / Ingeniería Final → workspace de Ingeniería.
- [ ] Validación de Operaciones → panel Informe del capataz (audio+IA) — se movió acá.
- [ ] Ejecución de Obra → fotos de obra.
- [ ] Tramitación UTE → link "Ir a Trámites UTE" + banner sync.
- [ ] Proyecto viejo: Ingeniería (workspace+capataz), Operaciones (fotos), Habilitación UTE (link) siguen OK.

## 4. Motor de traspasos
- [ ] Completar una etapa → se genera el traspaso de cierre.
- [ ] El que completó lo ve como notificación (campana); la bandeja visual aún no está.
- [ ] Al confirmar, los destinatarios reciben notificación in-app (ej. T1 → Ingeniería + Experiencia Solar + ADMIN copia).
- [ ] Ningún email a clientes (todo interno).

## 5. Experiencia Solar — seguimientos
- [ ] Menú "Experiencia Solar"; la lista dice "N Generadores".
- [ ] Columna "Último contacto": fecha + días; resalta si >7 días; "Sin contacto" si vacío.
- [ ] Registrar interacción → "Último contacto" se actualiza en la lista.
- [ ] Form: selectores Dirección (Entrante/Saliente) y Motivo (Bienvenida/Seguimiento/Aviso de habilitación/…).
- [ ] Botón "Marcar avisado al Generador".

## 6. Regla de Oro (aviso 24-48hs)
- [ ] Proyecto de prueba ya tiene el escenario armado (postHabilitacionInicioEn retrodatado).
- [ ] Login como `experiencia@voltiapm.com` → campana con "Avisá al Generador que puede encender…".
- [ ] En la lista de Experiencia Solar, ese Generador muestra badge "⚠ Aviso pendiente".
- [ ] "Marcar avisado al Generador" → deja de alertar; el badge desaparece.
- [ ] (>48h escalaría a ADMIN.)

## 7. Rebrand
- [ ] Nav desktop/móvil: "Experiencia Solar".
- [ ] Pipeline: carriles y header "Experiencia Solar".
- [ ] Portal: "Portal de Generadores"; admin: "Generadores del portal".
- [ ] Modales/avisos de traspaso: "Experiencia Solar" / "Generador".
- [ ] Usuarios/roles: "Responsable de Experiencia Solar" y "Generador" (cliente final).
- [ ] Ventas/propuestas/contratos siguen diciendo "cliente" (fuera de alcance, esperado).

## 8. Regresión
- [ ] Login por rol (admin/comercial/ingeniero/operaciones/finanzas) entra a sus módulos.
- [ ] Proyecto viejo avanza etapas normalmente.
- [ ] Los 12 Generadores (rol CLIENT) siguen entrando al portal.
- [ ] Trámites UTE, propuestas, finanzas: sin cambios.

## 9. Edición inline total (listado Experiencia Solar)
- [ ] Con el lápiz/hover, editar en el listado: **Nombre**, **Departamento** (select), **Potencia** (número), **Asesor** (select de usuarios), **Estado** (select), + los ya existentes Mail/Teléfono/Entrega.
- [ ] Persiste al recargar; queda auditoría.
- [ ] Validación: potencia negativa → error en la celda; nombre vacío → error.
- [ ] "Etapa" y "Último contacto" NO son editables (derivados).

## 10. Importar Generadores desde CSV
- [ ] Botón **"Importar"** (junto a Exportar; requiere permiso CREATE).
- [ ] Paso 1: muestra la **estructura esperada** (headers; Recorrido/Etapa tachados = se ignoran; Nombre obligatorio) + "Descargar plantilla".
- [ ] Subir un CSV → **preview**: tabla con las filas, resumen, columnas faltantes avisadas, **duplicados resaltados** (por nombre+mail), checkboxes por fila.
- [ ] Confirmar → se crean los Generadores seleccionados (aparecen en el listado con **Etapa vacía**, sin pipeline).
- [ ] Probar: CSV con columnas faltantes (se cargan en blanco); CSV con un duplicado (se marca, se puede destildar).
- [ ] Tip: **Exportar** el CSV actual, editarlo/agregar filas, y **Importar** (round-trip).

## Fuera de alcance (no testear)
Migración de proyectos 5→8, endpoints T3+T4/T6, calendario tentativo/confirmado, tickets/encuestas/mantenimientos (E3), reconciliación ute-sync.
