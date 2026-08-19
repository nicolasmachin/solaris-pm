# Credenciales SMTP por usuario: resuelto, con una fragilidad de fondo

**Estado:** ✅ resuelto el 19 de agosto de 2026 · queda una decisión de diseño pendiente

## Qué se hizo

Tras migrar el correo a Zoho, las cuatro configuraciones SMTP **por usuario**
(`user_smtp_configs`, cifradas con `SMTP_ENCRYPTION_KEY`) seguían apuntando al
servidor de Netuy. Ese es un camino de correo distinto del de la app: se usa
cuando alguien manda un mail desde su propia casilla, por ejemplo la consulta a
UTE desde Onboarding.

Las cuatro se repuntaron a Zoho (`smtppro.zoho.com:465`, SSL) y **cada una se
probó con un envío real**: las cuatro autenticaron OK.

Además, **dos usuarios se renombraron** para que su dirección en la app coincida
con su casilla real en Zoho:

| Antes | Ahora |
|---|---|
| `mgarcia@voltia.com.uy` | `martin@voltia.com.uy` |
| `july.correa@voltia.com.uy` | `july@voltia.com.uy` |

Las direcciones viejas siguen existiendo como alias y **reciben** normalmente,
pero para **autenticarse** contra Zoho hay que usar la principal. Al renombrar el
usuario de la app, el usuario de autenticación y el remitente volvieron a
coincidir, y no hizo falta ningún caso especial en el código.

> **Esas dos personas ahora entran a Voltia PM con la dirección nueva.** La
> contraseña de la app no cambió.

No hubo que tocar nada más: el job de novedades resuelve los destinatarios **por
nombre**, no por email (`novedades-email.job.ts`), justamente para que un cambio
de dirección se tome solo.

## La fragilidad que queda

Guardar credenciales SMTP por usuario significa que **cada vez que alguien cambie
su contraseña de correo, su configuración en Voltia PM deja de funcionar** — en
silencio, hasta que alguien intente mandar un mail. Y la idea es que cada uno
cambie su contraseña la primera vez que entre a Zoho, así que esto va a pasar.

Hoy no hay ninguna alerta: el error aparece recién al fallar un envío.

### Decisión (19/8/2026)

**Se descarta mandar todo por una casilla de sistema.** La consulta a UTE tiene
que salir desde la casilla de la persona que la manda, no desde `reportes@`.
Como esa es justamente la razón de ser de las credenciales por usuario, el
esquema se mantiene.

### Lo que falta entonces: detectar la rotura

Queda pendiente construir la red de seguridad, porque hoy **una credencial vencida
no se nota hasta que alguien intenta mandar un mail y falla**:

1. **Chequeo periódico** de cada configuración (`transporter.verify()`, que es lo
   que ya hace "Probar conexión" sin enviar nada) y actualización de `verifiedAt`.
2. **Aviso cuando una falla**: notificación in-app a esa persona y a un admin, con
   el texto claro de que hay que actualizar la contraseña en su perfil.
3. **Señal en la UI**: mostrar en el perfil cuándo se verificó por última vez, y
   marcarla en rojo si el último chequeo falló.

Sin esto, el modo de falla es el peor posible: silencioso, y se descubre cuando
alguien creía haber mandado la consulta a UTE y nunca salió.

## Cómo comprobar el estado

```sql
SELECT u.email, c.host, c.port, c.username, c."verifiedAt"
FROM user_smtp_configs c JOIN users u ON u.id = c."userId";
```

`verifiedAt` es la última vez que "Probar conexión" dio OK — no garantiza que
hoy funcione.

---

## Anexo: cambio de usuario de Nicolás (19/8/2026)

`nmachin@voltia.com.uy` → **`nicolas@voltia.com.uy`**, la cuenta nueva de Google
Workspace. La dirección vieja sigue existiendo en Zoho y recibe, pero deja de ser
la principal.

Hecho y verificado:

- Usuario renombrado. **Entra con la dirección nueva; la contraseña no cambió.**
  Verificado: login OK con `nicolas@`, 401 con `nmachin@`.
- `.env` de prod: `REPORTES_FV_BCC` y `FV_MONITOR_EMAIL` a la nueva.
  `MCP_ALLOWED_EMAILS` quedó **con las dos** durante la transición, para no
  perder el acceso desde Claude si algo falla — sacar `nmachin@` cuando esté
  confirmado.
- Código: la dirección estaba repetida en tres lugares de
  `novedades-email.job.ts`; se unificó en `DESTINATARIO_PRINCIPAL`. También el
  default de `FV_MONITOR_EMAIL` en `reportesFv/monitor/config.ts`.
- Se verificó que **ninguna tabla guarda el email como texto** para referirse a un
  usuario: todas van por `userId`. Solo hubo que tocar `users.email`.
- Envío de la app a la dirección nueva: probado, llega.

### Su SMTP: resuelto (19/8/2026)

Reconfigurado contra **Google Workspace** con una contraseña de aplicación, y
probado con un envío real:

```
Host: smtp.gmail.com
Puerto: 587 (STARTTLS, secure=false)
Usuario: nicolas@voltia.com.uy
Contraseña: de APLICACIÓN, no la del correo
```

Es la **única** casilla en Google: las otras cuatro van por Zoho. Si alguna vez
hay que rehacerla, tener presente que Google **rechaza la contraseña normal** —
hace falta generar una de aplicación desde la cuenta (requiere verificación en
dos pasos activada), y se usa **sin los espacios** con que Google la muestra.

## Estado final de las cinco casillas

| Usuario | Servidor | Puerto |
|---|---|---|
| `nicolas@voltia.com.uy` | `smtp.gmail.com` | 587 STARTTLS |
| `alejandra@voltia.com.uy` | `smtppro.zoho.com` | 465 SSL |
| `july@voltia.com.uy` | `smtppro.zoho.com` | 465 SSL |
| `martin@voltia.com.uy` | `smtppro.zoho.com` | 465 SSL |
| `reportes@voltia.com.uy` (la app, vía `.env`) | `smtppro.zoho.com` | 465 SSL |

Las cuatro personales se probaron con un envío real y quedaron verificadas.
