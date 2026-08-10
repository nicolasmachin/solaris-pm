# 12 · Infraestructura

> **Capítulo pendiente de escribir.** La funcionalidad existe y está en
> producción; lo que falta es la documentación. Se completa cuando se trabaje
> sobre este módulo.

Cómo corre la aplicación: contenedores, base, storage, jobs, correo, IA y respaldos.

---

## Correo saliente: resumen diario (digest) en vez de mails por evento

> Documentado en v9.0. El resto del capítulo sigue pendiente.

### Para qué existe

Los pasajes de etapa y los traspasos mandaban **un mail por cada evento a cada
usuario de cada rol involucrado + ADMIN siempre en copia**, sin filtrar por
asignación. Un solo pasaje de etapa podía disparar ~9 mails, varios repetidos,
ahogando los importantes. Ahora las notificaciones **in-app siguen siendo
inmediatas** (la campana no cambió) pero el **correo** se junta en **un único
resumen diario por persona**.

### Cómo funciona

- Job `daily-digest.job.ts` (`startDailyDigestJob`, cron `CRON_DAILY_DIGEST`,
  default `0 8 * * *`), registrado en `index.ts` junto a los demás jobs.
- `enviarDigestDiario(now)` junta las `Notification` de las últimas
  `DIGEST_VENTANA_HORAS` horas (default 24) de cada **usuario interno**, las
  agrupa por proyecto y manda **un** mail `internal` con la plantilla
  `emailDailyDigest` (`email.templates.ts`). Quien no tuvo novedades no recibe
  nada.
- Los **clientes (rol CLIENT) nunca entran** al digest: el job los excluye por
  rol y, como segunda red, el guardrail de `sendEmail({ type: "internal" })`
  bloquea cualquier destinatario que no sea un `User` interno.
- Se **quitaron los `sendEmail` por evento** de: confirmación de traspaso
  (`traspasos/notificar.ts`), escalación (`traspasos/escalacion.service.ts`),
  ingeniería completada (`notify.service.ts`) y aviso de habilitación
  (`clientes/aviso-habilitacion.service.ts`). Todos siguen creando su
  notificación in-app, que es lo que alimenta el digest.
- El **reporte diario de escalados a ADMIN** (`traspasos/reportes.service.ts`) se
  descontinuó por redundante (esas escalaciones ya llegan a cada ADMIN como
  notificación y viajan en su digest). El **resumen semanal** se mantiene porque
  es analítico (métricas de la semana), no una repetición de eventos.

### Configuración (Administración → Resumen diario)

- **Qué recibe cada rol** es una matriz **opt-in** Rol × Tipo de notificación
  (`DigestPreference`, tabla `digest_preferences`): la presencia de una fila
  significa que ese rol recibe ese tipo. **Sin fila = no lo recibe**, así que un
  tipo de notificación nuevo arranca **apagado** para todos hasta que se tilde.
  El filtro se aplica en `enviarDigestDiario`: cada usuario recibe solo los tipos
  habilitados para su rol.
- **La hora de envío** es única para todos, guardada en `Setting`
  (`SettingKey.DIGEST_SEND_HOUR`, default 8, hora Uruguay). El cron corre **cada
  hora** y `enviarDigestDiario` se dispara solo cuando la hora de Uruguay coincide
  con la configurada (`daily-digest.job.ts`), así se cambia desde la app sin
  reprogramar nada.
- El catálogo de tipos con su etiqueta y explicación (el tooltip ⓘ del admin)
  vive en `digest-config.service.ts` (`NOTIFICATION_TYPE_META`); al sumar un tipo
  al enum `NotificationType`, agregarlo ahí.
- Rutas admin en `api.routes.ts` (`GET /admin/digest-config`,
  `PUT /admin/digest-config/hour`, `PUT /admin/digest-config/toggle`), guard
  `Module.CONFIGURACION`. Seed inicial: `seed-digest-preferences.ts` habilita
  todos los tipos al rol **ADMIN** (para no dejar el digest en cero tras el
  deploy); el resto de los roles arranca vacío.

### Casos borde

- **Inmediatez**: un evento crítico puede esperar hasta la corrida diaria del
  digest. Mitigación: la campana in-app es inmediata. Si en el futuro se quiere
  un mail inmediato para escalaciones, es el único candidato a excepción.
- **Doble corrida el mismo día** duplicaría el resumen (la ventana es de 24h
  alineada al cron); el cron dispara una vez por día.

---

## Qué tiene que cubrir este capítulo

- Docker Compose en desarrollo y en producción
- Base de datos: migraciones, seed y respaldos
- Storage de archivos y su respaldo a Backblaze B2
- Los ocho trabajos programados
- Correo saliente: SMTP por usuario y el guardrail de correos internos
- IA: modelos, costos, límites y el validador de SQL
- Despliegue y vuelta atrás

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
