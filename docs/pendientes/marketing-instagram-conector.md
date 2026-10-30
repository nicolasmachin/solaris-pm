# Marketing → Instagram: lo que falta del lado del conector

**Fecha:** 29-oct-2026 · Para la sesión que trabaja en el conector de indicadores
(`~/Dev/MCP Indicadores Voltia`, el contestador de privados).

Voltia PM ya tiene el módulo **Marketing** con la bandeja de Instagram (ver
`docs/manual/20-marketing.md`). El contestador **sigue donde está**: el webhook de
Meta, el token, Claude y las reglas viven en el conector. Voltia PM es la
ventana: guarda una copia de las conversaciones y deja contestar a mano, tomar
la conversación y crear el lead.

Para que ande faltan tres cosas en el conector. Todo usa **un solo secreto
compartido**, `VOLTIA_PM_SECRETO` en el conector = `INSTAGRAM_CONECTOR_SECRETO`
en Voltia PM (`openssl rand -hex 32`).

## 1. Mandar la conversación a Voltia PM cada vez que cambia

Después de cada `_guardar(conv)` (mensaje nuevo, eco, respuesta del asistente,
derivación), en segundo plano y sin frenar al contestador si falla:

```
POST https://app.voltia.com.uy/webhooks/instagram-conector
Content-Type: application/json
X-Voltia-Firma: sha256=<HMAC-SHA256 hex del cuerpo crudo, con el secreto>

{ "conversacion": <el dict de la conversación tal cual se guarda> }
```

Voltia PM lee estos campos (el resto lo ignora, así que se puede mandar el dict
entero):

| Campo | Qué es |
|---|---|
| `persona` | id de Instagram (solo dígitos). Llave de todo. |
| `usuario`, `nombre` | opcionales |
| `desde_anuncio` | bool |
| `derivada` | `{momento, motivo}` o null |
| `mensajes[]` | `{mid, momento (segundos), de, texto, por?}` |

`de` puede ser `cliente`, `asistente`, `otro` (ManyChat o el celular) o
**`persona`** (nuevo: lo mandó alguien desde Voltia PM; va con `por` = el id del
usuario de Voltia PM). Si un mensaje no tiene `mid`, Voltia PM arma la llave con
`momento + de + texto`, así que **el texto de un mensaje sin `mid` no debería
cambiar entre un envío y el siguiente**.

Es idempotente: se puede reenviar la misma conversación las veces que haga
falta. Respuestas: 200 `{ok, conversaciones, mensajesNuevos}`, 401 firma mala,
400 formato.

**Carga inicial** (una vez): todas juntas y marcadas como historial, para que no
aparezcan como "sin leer":

```json
{ "conversaciones": [ ... ], "historial": true }
```

## 2. `POST /api/privados/enviar` (Voltia PM → conector)

```
Authorization: Bearer <secreto>
{ "persona": "1784…", "texto": "…", "por": { "id": "<userId>", "nombre": "Martín García" } }
```

- Controla la ventana de Meta (24 h / 7 días por anuncio). Fuera de ventana:
  **409** `{ "mensaje": "…" }` (el texto se le muestra tal cual al usuario).
- Manda con el token de la página y guarda el mensaje con `de: "persona"`,
  `por: <id>` (ojo con el eco: es el mismo `mid`, que no quede como `otro`).
- Cuenta como "escribió una persona": el asistente se calla los 30 minutos de
  siempre.
- Devuelve **200** `{ "mid": "<id de Meta>" }` y empuja la conversación (punto 1).
- Cualquier otro error: 4xx/5xx con `{ "mensaje": "…" }`.

## 3. `POST /api/privados/tomar` (Voltia PM → conector)

```
Authorization: Bearer <secreto>
{ "persona": "1784…", "tomada": true, "por": { "id": "…", "nombre": "…" } }
```

- `tomada: true` → guardar `conv["tomada"] = {momento, por}` y que
  `por_que_no()` devuelva `"tomada"` mientras esté puesta: **el asistente no
  contesta más en esa conversación**, sin vencimiento.
- `tomada: false` → borrarla; el asistente vuelve a contestar.
- Devuelve 200 `{}`. Voltia PM es quien manda en esto: lo que diga la
  conversación sobre "tomada" no se mira del lado de Voltia PM.

## Configuración

- Conector: `VOLTIA_PM_URL=https://app.voltia.com.uy` y `VOLTIA_PM_SECRETO`.
- Voltia PM (prod, `.env` + ya está en `docker-compose.prod.yml`):
  `INSTAGRAM_CONECTOR_URL=https://indicadores.voltia.com.uy` y
  `INSTAGRAM_CONECTOR_SECRETO`.
- Caddy de Voltia PM ya manda `/webhooks/*` al backend (lo usa WhatsApp).

## Cómo probarlo

1. Con las variables puestas, correr la carga inicial y ver que en Marketing →
   Instagram aparecen las conversaciones, sin "sin leer".
2. Escribirle a @voltia_uy desde un celular: tiene que aparecer en segundos.
3. Contestar desde Voltia PM: llega al celular, y el asistente no contesta encima.
4. "Tomo yo", escribir otra vez desde el celular: el asistente no contesta.
   "Devolver al asistente" y escribir: contesta.
