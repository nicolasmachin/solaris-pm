# Pedido de Operaciones — cierre de documentación post-obra

> **Qué es esto.** El registro de lo que el área de Operaciones necesita que
> Nicolás confirme o envíe para cerrar la documentación de post-obra por marca,
> más las credenciales de los portales y los videos de capacitación interna.
>
> **Origen**: documento "Pendientes para Nico · Cierre de documentación post-obra",
> recibido el **25 de septiembre de 2026**.
>
> Este archivo se va completando a medida que Nicolás responde. Cada ítem queda
> con su estado, y los videos con el enlace al video que corresponde.

**Estados**: ⬜ pendiente de Nicolás · 🟡 respondido, falta validar con Operaciones · ✅ cerrado

---

## 1 · Por marca

### Growatt

| # | Qué pide Operaciones | Estado | Respuesta |
|---|---|---|---|
| G1 | Confirmar el orden real: **1)** conectar el datalogger físicamente → **2)** crear la planta en ShinePhone → **3)** recién ahí configurar los 180 s en OSS. ¿Coincide con el video? | ⬜ | |
| G2 | **URL del portal OSS** + usuario y clave (login propio, distinto al de ShinePhone) | ⬜ | ver §2 |
| G3 | Menú exacto dentro de OSS donde vive el parámetro de **180 s** | ⬜ | |

### Huawei

| # | Qué pide Operaciones | Estado | Respuesta |
|---|---|---|---|
| H1 | Pasos completos de **inicio y configuración** al entrar a FusionSolar (puesta en servicio), incluyendo dónde vive el parámetro de 180 s | ⬜ | |
| H2 | **Procedimiento de conexión del datalogger externo** | ⬜ | |
| H3 | *(Corregido por Operaciones, no requiere acción)* El datalogger es **externo**, como en Growatt — no viene integrado como se había supuesto | ✅ | Corrección ya incorporada del lado de Operaciones |

### Fronius

| # | Qué pide Operaciones | Estado | Respuesta |
|---|---|---|---|
| F1 | Confirmar que los nombres en pantalla de **nuestros** modelos son exactamente `Start up time (s)` y `Start up time following grid error (s)`, ambos en 180 s. Puede variar entre **Symo / Primo / GEN24** | ⬜ | |
| F2 | *(Confirmado por Operaciones)* Datalogger **integrado** en todos los modelos — sin acción | ✅ | |
| F3 | *(Confirmado por Operaciones)* Los 180 s se configuran **desde el propio inversor** (no desde la app), en "Configuración de red" | ✅ | |

> **Ojo con F1.** Operaciones aclara que esos dos nombres de parámetro los sacaron
> de **documentación pública de Fronius** (certificados de conformidad de red), no
> de nuestros equipos. Coinciden en nombre y en el valor de 180 s, pero hace falta
> mirar la pantalla de un inversor nuestro para confirmarlo. Es el único ítem del
> documento apoyado en una fuente externa.

---

## 2 · Credenciales

Operaciones pide la lista completa y actualizada de los 4 accesos, para
centralizarlos en una sección de referencia.

| Portal | Usuario | Estado |
|---|---|---|
| ShinePhone | | ⬜ |
| Portal OSS (Growatt) | | ⬜ |
| FusionSolar (Huawei) | | ⬜ |
| Solar.start / Solar.web (Fronius) | | ⬜ |

**Confirmado por Operaciones**: no hace falta ninguna clave de instalador adicional
en el display de los inversores, más allá de estos logins de app/portal.

> ### Dónde guardar las claves — decidir antes de completar la tabla
>
> El documento de Operaciones dice que las credenciales "van a quedar escritas en
> los documentos" y que la decisión ya está tomada porque es un grupo cerrado.
>
> **Esta tabla vive en el repo de Voltia PM, que se pushea a GitHub en cada
> `save.sh`.** Escribirlas acá no es lo mismo que escribirlas en un documento
> interno: quedan en el historial de git para siempre, y borrarlas después no las
> saca de los commits viejos. Además son claves de portales de fabricante,
> compartidas y difíciles de rotar.
>
> Por eso **dejo la tabla con los usuarios y sin las contraseñas**. Tres caminos,
> de más a menos recomendable:
>
> 1. Un gestor de contraseñas compartido con el grupo de Operaciones, y acá solo
>    el nombre de la entrada.
> 2. Un documento fuera del repo (Drive con acceso restringido) y acá el enlace.
> 3. Escribirlas acá igual, si evaluás que el riesgo es aceptable — decime y las
>    agrego.
>
> **No avanzo con ninguna hasta que elijas.**

---

## 3 · Videos de capacitación

Operaciones los pide **todos desde cero**: parten de la base de que no hay nada
subido. Los marcados 🆕 son nuevos por la corrección del datalogger externo de
Huawei.

| # | Video | Estado | Enlace |
|---|---|---|---|
| 1 | Growatt — datalogger + creación de planta | ⬜ | |
| 2 | Growatt — configuración 180 s (OSS) | ⬜ | |
| 3 | Growatt — smartmeter Chint | ⬜ | |
| 4 | Huawei — puesta en servicio (FusionSolar) | ⬜ | |
| 5 | Huawei — configuración 180 s | ⬜ | |
| 6 | Huawei — conexión datalogger externo 🆕 | ⬜ | |
| 7 | Huawei — smartmeter | ⬜ | |
| 8 | Fronius — puesta en marcha (Solar.start) | ⬜ | |
| 9 | Fronius — configuración 180 s (desde inversor) | ⬜ | |
| 10 | Fronius — smartmeter TS | ⬜ | |
| 11 | Ensayo de Arranque (genérico) | ⬜ | |
| 12 | Ensayo Anti-isla (genérico) | ⬜ | |

### Estos videos ya tienen su lugar en la app

El módulo **Capacitación** está en producción desde el 15 de septiembre (v10.4) y
es exactamente para esto: videos por área, con permisos por sección y seguimiento
de quién vio qué.

La sección **Operaciones existe y está vacía** — cero listas, cero videos
(verificado en producción el 25/9/2026). Las únicas dos listas cargadas hoy son
"Procesos de Ventas" y "Soporte técnico", con un video cada una.

**Propuesta de organización**, tres listas dentro de la sección Operaciones:

| Lista | Videos |
|---|---|
| Growatt | 1, 2, 3 |
| Huawei | 4, 5, 6, 7 |
| Fronius | 8, 9, 10 |
| Ensayos (genérico) | 11, 12 |

Cargarlos ahí en vez de repartir enlaces sueltos tiene tres ventajas concretas:
el equipo los encuentra sin buscar en un chat, **queda registro de quién vio cada
video**, y los enlaces de Bunny no circulan fuera de la app (la biblioteca tiene
el acceso directo por URL bloqueado, así que un enlace pegado en WhatsApp no
funciona).

El flujo sería: Nicolás sube el video a Bunny → se agrega desde **Gestionar** en
Capacitación con el selector → acá se anota el enlace de la app, que es el que se
comparte.

---

## Qué falta para cerrar

- **9 respuestas de Nicolás**: G1, G2, G3, H1, H2, F1 y las 4 credenciales.
- **12 videos** para grabar o subir.
- **Una decisión**: dónde viven las contraseñas (§2).
- Después de cargar los videos, sumar la sección Operaciones al manual de
  trabajo, capítulo de Operaciones.
