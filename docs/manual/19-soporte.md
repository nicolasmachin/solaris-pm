# 19 · Soporte (mesa de monitoreo de plantas)

## Para qué existe

Enterarse de que una planta anda mal **el mismo día, y antes que el cliente**.
El monitoreo diario (capítulo 09) mira el día anterior y lo cuenta en un mail;
con eso Alberto Norman pasó del 8 al 28 de octubre de 2026 con la llave de
microgeneración saltada: estaba detectado ("falla código 302") pero nadie
entendía qué quería decir. Y lo que no deja código —una planta que genera a
medias, como Martín González con la aislación— no lo veía nadie.

Es la primera parte del módulo de Soporte, que va a centralizar los reclamos y
el monitoreo. Decidido el 28-oct-2026: **por ahora no lo atiende nadie en
particular** (las alertas le llegan a quien tenga `SOPORTE:VIEW`, hoy ADMIN);
después habrá un rol de Soporte. **Al cliente nunca le escribe el sistema
solo**: lo decide una persona con un toque. Fuera de horario no se avisa a
nadie: lo detectado queda en la cola.

## Cómo se usa

Menú **Soporte** (`/soporte`, `pages/Soporte.tsx`):

- Arriba: cuándo fue la última lectura, cómo está generando la cartera, y cuatro
  datos: casos abiertos, plantas en línea, reclamos abiertos (lleva a Mis
  tareas → Tickets) e incidencias del monitoreo diario (lleva a Experiencia
  Solar → Monitoreo).
- **Casos abiertos**: qué se detectó, desde cuándo y la evidencia (la hora del
  último dato, la potencia, el código, las tensiones). Acciones: **Avisar al
  cliente** (abre el mensaje sugerido, se puede editar), **Resuelto** y
  **Descartar** (las dos piden qué era). **Ver cerrados** muestra los últimos
  50, con quién y por qué se cerraron.
- **Plantas ahora**: todas las plantas vinculadas, primero las con caso, después
  las desconectadas y después las que vienen generando menos. Columnas: estado,
  potencia de ahora, **últimos días vs. lo normal** (los últimos 3 días con
  sol), energía de hoy y cuándo generó por última vez.
- **Revisar ahora** corre el vigía en el momento; **Revisar rendimiento**, el
  chequeo diario de "genera menos".

## Cómo funciona

### El vigía (cada 15 minutos, de 7:00 a 20:45)

`services/soporte/vigia.service.ts` → `correrVigia()`, programado en
`soporte.job.ts`.

1. **`plant/list` de Growatt**: en 2 llamadas trae, para las 185 plantas
   visibles, la potencia de ahora (`current_power`), la energía total y el
   estado (1 en línea, 4 desconectada). Es lo barato: toda la cartera por el
   costo de dos consultas. Verificado el 28-oct-2026 que se actualiza (en 5
   minutos cambiaron 18 de 46 plantas: cada datalogger sube cada 5 a 10).
2. **Hay sol si la mediana de la cartera** (W generados por W instalados, de
   las plantas en línea, con el kWp del proyecto) pasa de 10 %
   (`medianaCartera()`, `SOL_MIN` en `vigia.ts`). Así el clima se cancela: si
   está nublado, baja todo el mundo.
3. Por planta, `evaluarLectura()` (puro, `vigia.test.ts`) cuenta lecturas
   seguidas **en línea sin generar con sol** (`ceroConSol`) o **desconectada con
   sol** (`desconectadaConSol`). A las 4 (una hora) hay alerta. Si genera, se
   ponen en cero y **se cierran solos** los casos de planta caída ("Volvió a
   generar a las…").
4. **Antes de abrir el caso se confirma con el inversor**: `ultimoDatoInversor()`
   (`growatt/client.ts`, `tlx_last_data` para MIN y `max_last_data` para MAX, una
   llamada por equipo, solo de las plantas sospechosas). Hace falta porque
   `plant/list` es grueso: Irigaray figuraba "en línea con 0 W" y en realidad su
   inversor había dejado de mandar datos a las 16:23 generando 3,5 kW.
   `diagnosticarInversor()` (`diagnostico.ts`, puro, `diagnostico.test.ts`):

   | Último dato del inversor | Caso |
   |---|---|
   | de hace más de 35 minutos | No comunica (con la hora y lo que generaba) |
   | trae código de falla | Falla del inversor, explicada (`codigos.ts`) |
   | genera | ninguno: la lista venía atrasada |
   | red en 0 y paneles con tensión | No genera — **el inversor no ve la red: la llave** |
   | paneles sin tensión, con sol | No genera — lado de continua |
   | red y paneles con tensión, sin generar | No genera — en espera, apagado o limitado |

   Con varios inversores manda el peor (`elegirPeor()`).
5. **Un caso de "planta caída" por proyecto** (`TIPOS_CAIDA`: no genera, no
   comunica, falla): si cambia el diagnóstico se actualiza el mismo caso. Con un
   caso abierto revisado hace menos de una hora no se vuelve a consultar al
   inversor.
6. Al **abrir** un caso (no al actualizarlo) se avisa a los usuarios con
   `SOPORTE:VIEW`: notificación `soporte_alerta` con link a `/soporte`, que sale
   también por push (capítulo 12, *Avisos push*).

Además guarda por planta (`SoporteEstadoPlanta`) la última lectura, la energía
total del primer sondeo del día (para "Hoy") y un `factorNormal` (cuánto rinde
respecto de la mediana, promedio móvil, que no aprende con un caso abierto). El
factor instantáneo **no se muestra**: depende de la hora y la orientación (un
techo al este a las 17 h siempre rinde poco) y confundía.

### Genera menos de lo normal (una vez por día, 9:30)

`rendimiento.service.ts` → `revisarRendimiento()`. Sin APIs: usa
`ReporteFvGeneracionDiaria` (la carga el monitoreo de las 8).

- rendimiento del día = kWh / kWp; cociente = rendimiento / mediana de la
  cartera ese día (el clima se cancela); **lo normal de la planta** = mediana de
  sus cocientes de 60 días (orientación, sombras); vs. lo normal = cociente /
  lo normal. **Hoy no entra** (día incompleto).
- Alerta si en 2 de los últimos 3 días con sol (mediana ≥ 1 kWh/kWp) estuvo
  debajo del 60 % y el último también; se cierra sola cuando el último vuelve a
  80 %. Los días en cero no cuentan (son del vigía). Si ya hay un caso de
  planta caída, no se abre otro.
- Probado sobre producción el 28-oct-2026 (81 plantas, 30 días): marcó 11
  plantas, casi todas con algo real (Norman, Gerónimo Viera, Martín González,
  Álvaro García…).
- `rendimientoReciente()` alimenta también la columna de la mesa (caché de 10
  minutos en la ruta).

### Avisar al cliente

`casos.service.ts` → `mensajeSugerido()` (según el tipo y si es la llave) y
`avisarCliente()`: notificación `soporte_aviso_cliente` a cada usuario de portal
del proyecto (campanita del portal y push). Mientras el caso siga abierto, el
Inicio del portal le muestra el aviso arriba (`GET /client/avisos-planta`, solo
el mensaje que se le mandó). Sin usuario de portal, la mesa dice que hay que
avisarle por WhatsApp.

## Permisos

- `SOPORTE:VIEW`: ver la mesa y recibir las alertas. `SOPORTE:EDIT`: avisar al
  cliente, cerrar casos y correr las revisiones a mano. Hoy solo ADMIN
  (`prisma/scripts/seed-soporte-permissions.ts`).
- `/client/avisos-planta`: `PORTAL_CLIENTE:VIEW` y proyectos del cliente.

## Reglas y decisiones

- **El vigía solo corre en producción** (`vigiaHabilitado()`): dev usa el mismo
  token de Growatt y compartirían el cupo. En dev: **Revisar ahora**, o
  `SOPORTE_VIGIA=1`. `SOPORTE_VIGIA=0` lo apaga en prod.
- Una hora (4 lecturas) antes de alertar: menos da falsas alarmas por nubes que
  tapan una planta y no la mediana.
- Los códigos de `codigos.ts` salen de los manuales MIN/MAX; **el 302 = sin red
  (la llave) está confirmado con Norman**, los demás a confirmar caso a caso.

## Casos borde

- **Solo Growatt.** Huawei queda para la fase 4.
- "Hoy" se calcula desde la primera lectura del día: el día que se prende (o si
  el server estuvo caído a la mañana) da de menos.
- Una planta muerta desde antes que el vigía empiece se detecta en su primera
  hora con sol.
- Si Growatt no contesta, la vuelta falla entera y se loguea; la siguiente
  vuelve a intentar.
- `plant/list` muestra 55 de 185 plantas desconectadas, pero muchas no son de
  clientes (de otra empresa, de prueba): el vigía solo mira las vinculadas a un
  proyecto y no ignoradas.
