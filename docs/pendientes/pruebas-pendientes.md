# Pruebas pendientes (validación visual de Nicolás)

> Documento vivo. Se va alimentando a medida que avanzamos sin testear. Cada ítem
> es una prueba manual que falta validar en la UI. Lo verificado por API/código se
> marca como tal, pero igual conviene la pasada visual.

## Tanda 2 — Comisiones del asesor (v7.1, implementado 6-jul-2026)

Estado backend: verificado por API end-to-end (crear, idempotencia, sync a pagada,
409, métricas). Cliente: typecheck + build OK. **Falta la validación visual.**

### Dashboard `/comisiones`
- [ ] **Comisiones** aparece en el **desplegable del usuario** (avatar arriba a la derecha), debajo de "Configuración", para ADMIN/FINANZAS/ASESOR_COMERCIAL; NO para roles sin el permiso. En mobile sigue en el drawer.
- [ ] Un **asesor** entra y ve **solo sus** comisiones (sin columna de asesor).
- [ ] **ADMIN/FINANZAS** ven **todas**, con columna "Asesor".
- [ ] Tarjetas: saldo total a cobrar (destacado), cobrado en el año, ventas cerradas — con números coherentes.
- [ ] Gráfico mensual: barras **cobradas (verde)** por mes de pago y **proyectadas (azul)** por mes de vencimiento.
- [ ] Tabla: filtros **Todas / Pendientes / Pagas** y orden **Por fecha / Por monto** funcionan.
- [ ] Estado vacío (sin comisiones) se ve prolijo.
- [ ] **Comisión manual (admin)**: botón "Agregar comisión manual" (visible solo con FINANZAS:CREATE) → elegir asesor + monto + fecha + concepto → aparece en el listado (columna "Cliente" muestra el concepto) y en las métricas; genera pendiente en Finanzas; se puede pagar (sync a Pagada) y no se puede borrar el movimiento (409).

### Captura al marcar Ganado (en Ventas)
- [ ] Marcar un lead como **Ganado** → se abre el modal de comisión.
- [ ] Con **propuestas nuevas (V2)**: lista las versiones, preselecciona la última, muestra la comisión de cada una; al registrar queda congelada.
- [ ] Con **solo propuesta vieja**: como ADMIN aparece el campo de **monto manual**; como asesor sin permiso, aparece el aviso de que un admin debe cargarla.
- [ ] Al cerrar el modal de comisión se ofrece **convertir a proyecto** (flujo anterior intacto).
- [ ] Botón **"Registrar comisión del asesor"** en el panel de un lead ya ganado sin comisión.
- [ ] Panel del lead ganado muestra **"Comisión: US$ X · Pendiente/Pagada"** cuando ya existe.
- [ ] Registrar dos veces la misma → no duplica (idempotente), avisa que ya existía.

### Integración con Finanzas
- [ ] La comisión aparece como **movimiento PREVISTO** (GASTO, subcategoría "Comisiones ventas") con el monto correcto y vencimiento al mes siguiente.
- [ ] Marcar ese movimiento como **Pagado** en Finanzas → la comisión pasa a **Pagada** y se refleja en el dashboard (cobradas).
- [ ] Intentar **borrar** ese movimiento desde Finanzas → error claro (no se puede, se gestiona desde Comisiones).

### Reapertura
- [ ] Reabrir (cambiar de etapa) un lead ganado **con comisión** → aparece el **aviso**; al confirmar, la comisión y su pendiente **se mantienen**.
- [ ] Reabrir un lead ganado **sin comisión** → no muestra aviso (cambio directo).

### Permisos / bordes
- [ ] Un asesor no ve comisiones ajenas ni entra a Finanzas.
- [ ] Responsive: dashboard y modal en mobile se ven bien.

### Decisión de negocio abierta (no es prueba, es definición)
- [ ] Confirmar si el movimiento de comisión debe datarse en el **mes de la venta** (hoy) o en el **mes de pago**.

## Tanda 3 — Lead → proyecto → ficha (v7.1, implementado 6-jul-2026)

- [ ] Marcar un lead como **Ganado** y convertirlo a proyecto → en la **ficha del cliente** aparece la **"Fecha de venta"** (= fecha de cierre del lead), **además** de la "Fecha de entrega".
- [ ] La "Fecha de venta" es de **solo lectura** (no editable); la "Fecha de entrega" sigue editable inline.
- [ ] Proyectos convertidos **antes** de este cambio: no tienen fecha de venta (queda "—"). Los nuevos sí.
- [ ] **Tab "Historial"** en la ficha del cliente: junta en un solo feed, ordenado por fecha, las **actividades de Ventas** (cambios de etapa del lead), los **comentarios** (del lead y del proyecto) y las **interacciones** del cliente, cada uno con su badge de origen (Ventas / Proyecto / Cliente).
- [ ] El historial es **solo lectura** y respeta el permiso de Experiencia de Clientes.

## Tanda 4 — Deuda técnica (v7.1, implementado 6-jul-2026)

- [ ] **Drawer de debug de calculadora**: como ADMIN se ve igual; como asesor sin permiso `VENTAS:DEBUG_CALCULADORA` **no** aparece el botón ni entra al endpoint (403). (Correr el grant + reiniciar server en cada entorno.)
- [ ] **Admin → Propuestas → Defaults**: nueva sección **"Generación y dimensionamiento"** con rendimiento anual (1479), m²/panel (3) y la **grilla de 12 factores estacionales** (con indicador de suma = 1.0). Cambiar un valor, guardar, recargar → persiste, y el cálculo de la propuesta lo usa.
- [ ] **Propuestas viejas** en el panel del lead: botón **"Excel"** descarga el archivo de entrada; **descartar** (con confirmación) y **restaurar** funcionan; el toggle "Ver descartadas" las muestra.
- [ ] Calculadora sigue dando los mismos números (sacar `energiaMensualKwh` y mover constantes al singleton no cambió resultados).
- [ ] **Publicar una propuesta nueva funciona** (regresión de T4.7: el snapshot rechazaba el array de factores estacionales). Con un borrador completo, "Publicar" genera la versión sin error.
- [ ] **Constructor**: la barra de arriba muestra, con un borrador completo, **Retorno N años** y **US$ N/kW c/IVA** (además de Ahorro y Espacio).
- [ ] (Interno, no visible) Baseline TypeScript del server ahora en **0** (era 5).
