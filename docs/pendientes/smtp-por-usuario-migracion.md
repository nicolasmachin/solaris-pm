# Casillas SMTP por usuario rotas tras la migración de correo

**Estado:** pendiente · detectado el 19 de agosto de 2026

## Qué pasa

La migración del correo a Google Workspace + Zoho arregló el envío **de la app**
(`reportes@voltia.com.uy`, ahora en Zoho — ver `docs/DEPLOY.md` §2).

Pero hay un **segundo camino de correo** que no se arregló: las credenciales SMTP
**por usuario** (`user_smtp_configs`, cifradas con `SMTP_ENCRYPTION_KEY`), que se
usan cuando alguien manda un mail desde su propia casilla — por ejemplo la
consulta a UTE desde Onboarding.

Las cuatro configuraciones cargadas siguen apuntando al servidor de Netuy, que ya
no acepta esas casillas:

| Usuario | Host | Puerto |
|---|---|---|
| `nmachin@voltia.com.uy` | `mail.voltia.com.uy` | 587 |
| `mgarcia@voltia.com.uy` | `mail.voltia.com.uy` | 587 |
| `july.correa@voltia.com.uy` | `mail.voltia.com.uy` | 587 |
| `alejandra@voltia.com.uy` | `mail.voltia.com.uy` | 587 |

Las cuatro figuran como verificadas, pero esa verificación es de **antes** de la
migración: no significa que hoy funcionen.

## Por qué no se arregló de una

La contraseña de cada casilla la tiene su dueño, y en Google Workspace hace falta
una **contraseña de aplicación** que solo puede generar el titular de la cuenta.
No es algo que se pueda hacer por ellos desde el servidor.

## Qué hay que hacer

Cada usuario, desde su perfil en la app:

1. Generar una contraseña de aplicación en su cuenta de Google
   (Seguridad → Verificación en dos pasos → Contraseñas de aplicaciones).
2. Editar su configuración SMTP con:
   - Host: `smtp.gmail.com`
   - Puerto: `587` (STARTTLS) o `465` (SSL)
   - Usuario: su dirección completa
   - Contraseña: la de aplicación, **no** la del correo
3. Usar "Probar conexión" y confirmar que da OK.

Ojo: `reportes@` va por **Zoho** (`smtppro.zoho.com`), no por Google. Estas cuatro
casillas sí están en Google.

## Cómo comprobar el estado

```sql
SELECT u.email, c.host, c.port, c."verifiedAt"
FROM user_smtp_configs c JOIN users u ON u.id = c."userId";
```
