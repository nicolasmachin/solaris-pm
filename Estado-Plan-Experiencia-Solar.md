# Experiencia Solar — Plan y estado

> **Todo lo marcado ✅ está en DESARROLLO, sin deployar.** Verificado contra el
> código el 5 de septiembre de 2026, no de memoria.

| | |
|---|---|
| ✅ | Hecho y verificado en desarrollo |
| 🟡 | Parcial |
| ⬜ | Pendiente |
| ➖ | No es desarrollo (procedimiento o contenido) |

---

## El plan, en una frase por bloque

| Bloque | Qué resuelve | Estado |
|---|---|---|
| **0 · Que Alejandra se entere** | Hoy no le llega ningún mail y las alertas se pierden | ✅ **Completo** |
| **1 · Corregir lo roto** | Fecha de habilitación, traspasos trabados, criterios duplicados | 🟡 **Mayoría hecha** |
| **2 · El objeto "novedad"** | Unificar comentario e interacción; que el cumplimiento se calcule | ⬜ Sin empezar |
| **3 · La vista de Experiencia Solar** | Sacar los carriles del pipeline y darle su propia vista | ⬜ **Próximo** |
| **4 · Calendario y visitas** | Agendar relevamientos y entregas para poder avisarlas | ⬜ Sin empezar |
| **5 · Tickets y encuestas** | Que un reclamo del cliente avise a alguien | 🟡 Encuestas hechas |
| **E3 · Post-habilitación** | Cierre, monitoreo por excepción, ritmo anual | ⬜ Sin empezar |

---

## ✅ Hecho (9 ítems)

| # | Qué | Verificación |
|---|---|---|
| **T-16** | Experiencia Solar y Postventa **reciben el resumen diario por correo** | 11 filas creadas. Antes solo ADMIN |
| **E2-06a** | **La alerta de nota baja llega.** Se calculaba "el área menos quien la originó" → con una persona quedaba en cero | 15/15 tests de traspasos |
| **T-14** | Filtros **"⚠ Aviso pendiente"** y **"Fuera de cadencia"** en el listado | 4 y 48 de 93 por API |
| **T-10** | **Criterio de "sin contacto" unificado** en la cadencia configurable. Antes convivía con 7 días fijos en pantalla | Backend calcula `diasSinContacto` y `fueraDeCadencia` |
| **E2-03** | **La fecha de habilitación la escribe Tramitación**, no un clic de seguimiento. Era el punto único de falla de todo E3 | Probado E2E + **15 recuperados** con el backfill |
| **1.2** | **Un traspaso lo puede confirmar cualquiera del área**, o un admin | tsc + tests |
| **ENC-01** *(addendum)* | **Encuestas de tres preguntas**, distintas por etapa, promedio como puntaje, **umbral configurable** | Probado E2E: 4·2·5 → promedio 3,7 **y alerta igual** |
| **E3-00** | **Derogada la cadencia de E3** | Config: fuera de cadencia pasó de 48 a 33 |
| *(extra)* | **Los comentarios de etapa y subetapa llegan al historial del cliente** | Antes solo los del proyecto raíz |

---

## ⬜ Pendiente — por orden de prioridad

### Bloqueantes de otras cosas

| # | Qué | Por qué urge |
|---|---|---|
| **T-17 / E3-07** | **Notificación de ticket nuevo** | Hoy un reclamo del cliente **no le avisa a nadie**. Es bloqueante de todo el recorrido del portal en E3 |
| **X-02** | El panel de "sin comunicación" **excluye la cartera post-habilitación** | Sin esto **E3 es invisible**. Verificado: sigue filtrando solo activos |
| **POR-01 / POR-04** | Alta del portal sin depender del mail + campaña retroactiva | **76% sin portal.** 4 de las 5 cosas del cierre de E3 dependen del acceso |

### Correcciones que quedan

| # | Qué |
|---|---|
| **E2-06b** | Un traspaso **ya confirmado no debe bloquear uno nuevo**. Verificado: **sigue bloqueando** → la segunda nota baja de un cliente se sigue tragando |
| **X-01** | Los correos al cliente **no cuentan como contacto** |
| **T-09 / E1-06** | **Motivo obligatorio** al reprogramar |
| **E1-05** | Notificación al confirmar o reprogramar la fecha de obra |
| **E1-01** | Subetapa de **presentación de Alejandra** dentro de Onboarding |
| **X-04** | El correo del monitoreo va a **una sola casilla** |
| **X-05** | El **envío de reportes mensuales está desactivado** |

### Bloque 2 — El objeto "novedad"

`T-02` unificar comentario e interacción · `T-03` tipo precargado por origen ·
`T-04` solo los contactos cuentan para la cadencia · `T-05` eliminar la casilla
"contacto semanal" · `T-06` **auditar los eventos del log** y reescribirlos en
lenguaje humano.

> `T-06` es **previo** a las lucecitas de la vista nueva: no se puede decidir qué
> genera novedad visible sin el inventario.

### Bloque 3 — La vista de Experiencia Solar ← **lo próximo**

`T-12` sacar los carriles del pipeline · `T-13` tres bloques por etapa ordenados
por días sin contacto · `T-14b` las **dos lucecitas** (informativa / con plazo) ·
`T-15` días sin contacto en la ficha · checks fijos + **subetapas dinámicas por
reagenda** · el resumen diario con la misma estructura.

### E3 — Post-habilitación (sin empezar)

- **Cierre de puesta en marcha:** 5 checks, plazo 15 días (`E3-01` a `E3-06`)
- **Monitoreo por excepción:** 6 familias de alerta, doble paso de verificación,
  notas persistentes por instalación (`MON-01` a `MON-08`)
- **Ritmo anual:** resumen anual, mantenimiento con máquina de estados, pestaña
  propia, calendario de Gonzalo (`MNT-01` a `MNT-11`)
- **Portal:** usuario sin mail, campaña retroactiva, embudo de adopción (`POR-*`)
- **Métricas** (`MET-01` a `MET-05`)

### Otros pedidos abiertos

| Qué | Estado |
|---|---|
| **Botón de plantillas** en la ficha del cliente | Nuevo. Barato y de uso inmediato |
| **Nickname de login** + alta sin mail | Medido: **27 errores** en 12 archivos. Revertido para no dejar el árbol roto |
| **Campo del umbral** de nota baja en Administración | Ya funciona por API; falta la pantalla |

---

## Datos de producción que ordenan la prioridad

| Medición | Valor |
|---|---|
| Clientes **sin acceso al portal** | **72 de 95 (76%)** |
| Clientes **fuera de cadencia** (E1+E2) | **30 de 30** |
| **Avisos de habilitación pendientes** | 10 visibles + **20 que el sistema no veía** |
| **Mantenimientos vencidos** | **18** (2 con más de 2 años) — todos en importados por planilla |
| Encuestas respondidas | **1 de 19** |
| Tickets abiertos por clientes | **0** |
