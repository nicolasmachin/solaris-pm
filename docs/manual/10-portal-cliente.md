# 10 · Portal del cliente

> **Capítulo parcial.** Están escritas y al día las secciones "Generación día a
> día", "Videos" y "Ver el portal como lo ve el cliente". El resto funciona en producción
> pero todavía no está documentado.

Lo que ve el cliente final: sus proyectos, tickets, encuestas y reportes.

---

# Generación y consumo (vista de energía)

En *Mis reportes solares* el cliente tiene la misma vista que el equipo en la
ficha: pestañas Hora, Día, Mes y Año, como la aplicación de Growatt, una por
planta. Endpoints `/client/energia/plantas` y `/client/energia/:projectId/*`,
con `PORTAL_CLIENTE:VIEW` y el chequeo de que la planta sea suya. Todo el
detalle (de dónde salen los datos, los totales, los casos borde) está en el
capítulo 09, *Vista de energía*.

La tarjeta "Generación día a día" de abajo sigue existiendo y se superpone con la
pestaña Día de la vista nueva: queda pendiente decidir si se saca.

---

# Generación día a día

## Para qué existe

El dashboard del portal mostraba sólo datos mensuales, y sólo de meses con
reporte ya publicado. El cliente que quería saber cuánto generó *esta semana* no
tenía dónde mirarlo dentro de la aplicación.

## Cómo se usa

En el portal, dentro de "Mi energía", aparece una tarjeta **"Generación día a día"**
con el mes en curso: una barra por día, y abajo el total del mes, el promedio
diario y el mejor día. Con las flechas ‹ › se navegan los meses anteriores; no
deja avanzar más allá del mes actual.

La tarjeta aclara hasta qué día llegan los datos, porque el último disponible es
siempre el de ayer.

## Cómo funciona

`GET /api/client/energia/diaria?periodo=YYYY-MM` lee `ReporteFvGeneracionDiaria`,
la misma tabla que llena el monitoreo diario. **No consulta Growatt**: es lectura
de una tabla ya poblada, así que la pantalla es instantánea.

El endpoint viejo `/client/energia` (mensual) **no se tocó**, y el guard de
render de `PortalEnergiaDashboard.tsx` tampoco: un cliente sin serie diaria sigue
viendo su dashboard mensual completo, sólo que sin la tarjeta nueva.

## Reglas y decisiones

- **Tiene un gate propio, más laxo que el del reporte mensual.** Aquel exige
  `publicadoEnPortal` porque el reporte lleva números económicos (ahorro, ROI,
  tarifa) que alguien tiene que revisar antes de mostrarlos. Esto son kWh crudos
  del inversor, el mismo dato que el cliente ya ve en la app de Growatt si tiene
  la cuenta. Además el mes en curso **nunca** va a tener reporte publicado —el de
  agosto se emite el 7 de septiembre—, así que con aquel gate la pantalla no
  mostraría nada nunca.
- El gate concreto es: planta vinculada y no ignorada + el usuario es cliente del
  proyecto + `ReporteFvConfig.habilitado !== false`.
- **`habilitado` se reusa como opt-out, pero no se exige que la config exista.**
  Si a un cliente no le mandamos el reporte mensual, tampoco le mostramos el
  detalle diario; pero un generador vinculado y andando que nunca se dio de alta
  en la herramienta ve su gráfico igual.
- La condición se escribe con `OR` y no con `NOT`: en Prisma, un `NOT` sobre una
  relación opcional también descarta las filas que **no tienen** esa relación.

## Casos borde

- **Los datos empiezan cuando empezó a correr el monitoreo.** Para meses
  anteriores hay que correr `backfill-generacion-diaria.ts --desde YYYY-MM-DD`.
- Si no hay ningún día con dato, la tarjeta directamente no se renderiza.

---

# Videos

## Para qué existe

Durante el proceso se le mandan al cliente videos cortos (cómo usar la
aplicación del inversor, qué hacer si se corta la generación, etc.). Por
WhatsApp se pierden entre los mensajes; en el portal quedan juntos para volver a
verlos cuando haga falta.

## Cómo se usa

Pestaña **Videos** del portal (`/portal/videos`): los videos agrupados por lista,
con miniatura, duración y tilde de visto, y los documentos de apoyo. Al tocar uno
se abre el reproductor arriba y debajo el resto de la lista.

## Cómo funciona

Es el módulo **Capacitación** (capítulo 14, sección "Videos para clientes"): se
ve lo de las áreas que tienen tildado el rol del cliente. Los detalles técnicos
están allá.

## Permisos

`PORTAL_CLIENTE:VIEW`. En modo vista previa la pestaña se ve y los videos se
reproducen, pero no se guarda progreso.

## Casos borde

- Sin ningún área para clientes con videos, la pestaña muestra "Todavía no hay
  videos".
- La navegación del portal se describe en "El menú del portal", más abajo.

---

# El menú del portal

## Cómo funciona

Las secciones están en una sola lista, `PORTAL_NAV` en `PortalLayout.tsx`
(ruta, nombre largo, nombre corto e ícono). De ahí salen los dos menús:

- **Computadora** (`sm` en adelante): pestañas debajo del encabezado, con el
  nombre largo.
- **Celular**: `PortalBottomNav`, una barra fija abajo con ícono y nombre corto,
  que respeta el área segura del iPhone (`env(safe-area-inset-bottom)`). El pie
  de página lleva un margen inferior para que la barra no lo tape.

"Inicio" (`/portal`) queda activa también en el detalle de un proyecto
(`/portal/:id`): `esActiva()` la marca cuando la ruta no es de ninguna otra
sección.

## Reglas y decisiones

- **Se pasó a la barra de abajo porque las pestañas no entraban.** Con cinco
  secciones quedaban cortadas en un celular angosto, y deslizarlas de costado no
  se descubre. Es el patrón de las aplicaciones del teléfono.
- **Para sumar una sección se agrega a `PORTAL_NAV`, y nada más.** En la barra
  entran cinco (`MAX_BARRA`): con una sexta, quedan cuatro a la vista y el resto
  pasa a un botón **Más**, que abre la lista arriba de la barra.

---

# Ver el portal como lo ve el cliente

## Para qué existe

Para poder contestar "¿qué está viendo el cliente en la pantalla?" sin pedirle
una captura ni tener su contraseña.

## Cómo se usa

En **Experiencia Solar → Generadores**, en la última columna de cada fila, hay un
ícono de ojo a la izquierda de la papelera. El mismo acceso está en la cabecera
de la ficha del cliente, como **Ver como el cliente**. Aparece sólo si ese generador ya
tiene usuario de portal creado.

Al hacer clic se entra al portal de ese cliente con una **franja ámbar fija
arriba** que dice que lo que se ve es la pantalla del cliente y que es sólo
lectura. El menú de la cuenta muestra el nombre del cliente, no el propio, y su
única opción es **Salir de la vista del cliente**.

## Cómo funciona

El frontend guarda el modo en `portalPreview.store.ts` (zustand + `sessionStorage`)
y un interceptor de axios agrega la cabecera `X-Portal-Preview: <projectId>` a las
llamadas a `/api/client/*`.

En el backend, `portalPreviewHook` en `portal.routes.ts` **reemplaza
`request.user` por el usuario del cliente**. Todos los endpoints del portal
filtran por `clients.some.userId`, así que con eso funcionan sin cambiar ni una
consulta — y no hay forma de que a algún endpoint se le olvide contemplar el modo
vista previa y termine filtrando datos de otro cliente. Quién está mirando de
verdad queda en `request.portalPreview`.

## Permisos

Hace falta `EXPERIENCIA_CLIENTES:VIEW`, el mismo permiso que se necesita para ver
el listado desde el que se entra: quien puede ver la ficha del cliente puede ver
su pantalla. No hay escalada de privilegios — es la misma información, presentada
como la ve él.

## Reglas y decisiones

- **Es de sólo lectura y no es negociable.** El hook rechaza con 403 cualquier
  método que no sea GET. Ver la pantalla del cliente es una cosa; abrir un ticket
  o responder una encuesta en su nombre es otra, y quedaría registrada como si la
  hubiera hecho él.
- **Vive en `sessionStorage`, no en `localStorage`.** Es un modo temporal y tiene
  que morir al cerrar la pestaña; si sobreviviera entre sesiones, alguien
  terminaría trabajando media mañana creyendo que ve su propia pantalla.
- **El hook se acota a las rutas `/client/*`.** El mismo archivo registra las
  rutas de administración de clientes (`/admin/*`), que un interno usa con su
  propio usuario: suplantar ahí lo dejaría sin permisos a mitad de camino.
- Al salir se hace una recarga dura, para no arrastrar al panel interno consultas
  ya cacheadas con los datos del cliente.

## Casos borde

- **Generador sin usuario de portal**: el botón no aparece, y si se llega igual
  por otro camino el backend responde `SIN_USUARIO_PORTAL` explicando que no hay
  pantalla de cliente que mirar.
- **Varios usuarios de cliente en un proyecto**: se toma el primero. El portal
  muestra lo mismo para todos ellos.
- **Un usuario CLIENT que mande la cabecera a mano** recibe 403: no tiene
  `EXPERIENCIA_CLIENTES:VIEW` (verificado contra la API).

---

## Qué falta cubrir en este capítulo

- Cómo se crea un cliente y su acceso
- El rol CLIENT y sus restricciones de navegación
- Qué ve del proyecto y qué no
- Tickets desde el portal y notas internas
- Encuestas y reportes publicados
- Notificaciones

---

## Plantilla

Al escribirlo, seguir la estructura común (ver `README.md`):

```
## Para qué existe
## Cómo se usa
## Cómo funciona
## Permisos
## Reglas y decisiones
## Casos borde
```

## Mientras tanto

Fuentes para consultar, con la advertencia de que **ninguna es fuente de verdad
sobre cómo funciona hoy**:

- El código, que es lo único que no miente.
- `CHANGELOG.md` para saber qué cambió y cuándo.
- `docs/features/*/SPEC.md` si existe para este módulo: es diseño previo, puede
  contradecir a la implementación.
- `docs/pendientes/` para saber qué falta.
