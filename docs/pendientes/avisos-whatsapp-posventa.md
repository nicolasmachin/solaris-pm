# Encargo: mensajes automáticos de WhatsApp al cliente (posventa)

Definido por Nicolás con Mingo los días 14 y 15 de noviembre de 2026. Los textos están validados por Nicolás: se cargan
tal cual. Detalle de cómo se llegó a cada uno, en `asesores/domingo/memoria/plantillas-whatsapp.md`.

**Antes de todo:** conectar el número real de WhatsApp (coexistencia con el celular de Alejandra) y desplegar. Meta ya
aprobó la app el 14-nov.

## 1. Los mensajes, en el orden del recorrido del cliente

Variables del PM: `{{cliente.nombre}}`, `{{portal.link}}`, `{{obra.fecha}}`, `{{evento.fecha}}`. Todas las plantillas
van a Meta como de utilidad. Los que llevan video o foto van en un **mensaje aparte, uno o dos minutos después del
texto**, nunca antes.

**Regla para todos:** ninguno sale antes de que Alejandra haga la bienvenida (paso `e1_bienvenida`). Lo que pase antes
queda esperando, no se descarta.

| # | Mensaje | Cuándo sale | Condición especial | Lleva | ¿Disparador existe? |
|---|---|---|---|---|---|
| A | Acceso al portal | Al día siguiente de la bienvenida de Alejandra | El usuario del portal tiene que existir | Video V1 después | No: "bienvenida hecha" + demora |
| B1 | Aviso del papel de UTE | Una semana después de mandar la consulta | — | Foto F1 después | Hito sí; falta la demora |
| B2 | Luz verde de UTE | Al aprobarse la consulta | — | — | Sí |
| C | Fecha de obra | Al confirmar la fecha en el calendario | No sale si el cliente está "esperando fecha nueva" (va la E3) | — | Sí |
| D | Recordatorio de la obra | 2 días antes de la obra | Solo si Alejandra no le escribió desde que se confirmó la fecha | — | Sí (falta la condición) |
| E1 | Obra suspendida, sin fecha nueva | 24 h después del cambio | Solo si Alejandra no le escribió; marca al cliente "esperando fecha nueva" | — | No |
| E2 | Obra movida, con fecha nueva | 24 h después del cambio | Solo si Alejandra no le escribió | — | Parcial (falta demora y condición) |
| E3 | Fecha nueva tras una suspensión | Al confirmar la fecha nueva de un cliente marcado | Solo clientes marcados; desmarca | — | No |
| 1 | Obra terminada | Al cerrar la etapa de obra | — | Video V2 después | Sí |
| 2 | Encuesta | Al día siguiente de "Obra terminada" | — | — | No: "encuesta creada" + demora |
| 3 | Ya podés encender | Cuando UTE habilita | Deja hecho el paso de habilitación | Video V3 después | Sí |
| 4 | Reporte del mes | Al publicarse el reporte | — | Con el **primero**, video V4 después, una sola vez por cliente | No: "reporte publicado" y "primer reporte" |
| 5 | Mantenimiento agendado | Al agendar un mantenimiento | Solo los dos sin costo (1.º y 2.º) | — | Sí (falta el límite) |
| 5b | Toca un nuevo mantenimiento (pago) | Al año del **último mantenimiento hecho** | Solo quien ya usó los dos sin costo | — | No |
| 6 | Alerta de la planta | — | **En espera** hasta afinar la mesa de Soporte. No se carga. | — | — |

## 2. Los textos

**A. Acceso al portal**
> Hola {{cliente.nombre}}, cómo estás? Ya tenés tu acceso al portal de Voltia, donde vas a poder seguir tu proyecto: el trámite con UTE etapa por etapa, de qué lado está cada una, tus documentos y, cuando esté funcionando, lo que genera tu instalación. Entrá a {{portal.link}} , tocá "Entrar con un código por mail" y escribí tu mail: te llega un código para entrar. Cualquier duda, escribinos por acá.

**B1. Aviso del papel de UTE**
> Hola {{cliente.nombre}}, cómo estás? Te contamos cómo viene tu trámite con UTE: la semana pasada mandamos la primera parte y estamos esperando su respuesta. Cuando respondan, puede que te llegue un aviso de UTE que parece un pedido de aumento de potencia: no lo es, es normal y no tenés que hacer nada. El avance lo podés seguir en el portal de Voltia, en la sección Trámite UTE.

**B1 foto** (uno o dos minutos después)
> [foto F1] Así es el aviso de UTE del que te hablamos. Si te llega, no tenés que hacer nada.

**B2. Luz verde de UTE**
> Hola {{cliente.nombre}}, cómo estás? Buenas noticias: UTE nos dio luz verde y el trámite sigue avanzando. Lo podés ir viendo en el portal de Voltia, en la sección Trámite UTE.

**C. Fecha de obra**
> Hola {{cliente.nombre}}, cómo estás? Tenemos la instalación agendada para el {{obra.fecha}}. Te queda bien ese día? Hace falta que alguien reciba al equipo al principio, para abrir y mostrar el acceso al techo. En general no trabajamos adentro, pero si el equipo puede usar un baño, nos ayuda mucho. Cualquier cosa, escribinos por acá.

**D. Recordatorio, 2 días antes**
> Hola {{cliente.nombre}}, cómo estás? Te recordamos que el {{obra.fecha}} hacemos la instalación. Acordate de que alguien reciba al equipo al principio para darle acceso al techo, y si pueden usar un baño, nos ayuda mucho. Si surge cualquier cosa, escribinos por acá.

**E1. Obra suspendida, sin fecha nueva** (la fecha es la que se canceló)
> Hola {{cliente.nombre}}, cómo estás? Te avisamos que tuvimos que suspender la instalación que teníamos para el {{obra.fecha}}. Apenas tengamos la nueva fecha te escribimos para coordinarla. Perdón por el cambio.

**E2. Obra movida, con fecha nueva**
> Hola {{cliente.nombre}}, cómo estás? Te avisamos que tuvimos que mover la instalación: la nueva fecha es el {{obra.fecha}}. Te queda bien ese día? Perdón por el cambio, cualquier cosa escribinos por acá.

**E3. Fecha nueva tras una suspensión**
> Hola {{cliente.nombre}}, cómo estás? Como te contamos, tuvimos que suspender la instalación que teníamos agendada. Ya tenemos fecha nueva: el {{obra.fecha}}. Te queda bien ese día? Cualquier cosa, escribinos por acá.

**1. Obra terminada**
> Hola {{cliente.nombre}}, cómo estás? El equipo terminó la instalación. Ahora seguimos con la segunda parte del trámite con UTE, que suele llevar entre 2 y 4 semanas. Hasta que se habilite, el sistema queda apagado y con precinto: es normal. En el portal de Voltia podés seguir cada etapa del trámite, de qué lado está y en qué fecha avanzó: {{portal.link}} . Apenas se termine, te escribimos para que lo enciendas.

**1 video** (uno o dos minutos después)
> [video V2] Te dejamos un video cortito que muestra cómo seguir el trámite en el portal: en qué etapa está, de qué lado está y cuándo avanzó cada una. Este video también te queda en el portal de Voltia, en la sección Videos.

**2. Encuesta**
> Hola {{cliente.nombre}}, cómo estás? Te dejamos una encuesta cortita sobre cómo te fue con la instalación. La encontrás en el portal de Voltia: entrá a {{portal.link}} con tu usuario y andá a la sección Encuestas. Son solo 3 preguntas y nos sirve mucho para mejorar.

**3. Ya podés encender**
> Hola {{cliente.nombre}}, cómo estás? Buenas noticias: ya está habilitada tu instalación y la podés encender. Es muy simple: cortás el precinto y subís la llave de microgeneración del tablero. El inversor no hay que tocarlo. Desde ahí ves lo que generás en el portal de Voltia: {{portal.link}} . Cualquier duda, escribinos por acá.

**3 video**
> [video V3] Acá te mostramos cómo encenderla, paso a paso. Este video también te queda en el portal de Voltia, en la sección Videos.

**4. Reporte del mes**
> Hola {{cliente.nombre}}, cómo estás? Ya está tu reporte del mes, con lo que generaste y lo que ahorraste. Te lo mandamos por mail y también lo tenés en el portal de Voltia: entrá a {{portal.link}} con tu usuario y andá a la sección Reportes. Si no te llegó el mail, avisanos así revisamos por qué. Y si algún número no te cierra con la factura de UTE, escribinos y lo vemos juntos.

**4 video, solo con el primer reporte**
> [video V4] Como es tu primer reporte, te dejamos un video que muestra qué podés ver en él y cómo compararlo con tu factura de UTE. Este video también te queda en el portal de Voltia, en la sección Videos, junto con otro que muestra cómo se ve desde la computadora.

**5. Mantenimiento agendado (solo los dos sin costo)**
> Hola {{cliente.nombre}}, cómo estás? Te agendamos el mantenimiento de tu instalación para el {{evento.fecha}}. Te recordamos que la instalación incluye dos mantenimientos sin costo: uno al primer año y otro al segundo año de habilitada. No hace falta que estés, pero sí que podamos llegar al techo y al tablero. Si ese día no te queda bien, avisanos y lo cambiamos.

**5b. Toca un nuevo mantenimiento (pago)**
> Hola {{cliente.nombre}}, cómo estás? Ya pasó un año desde el último mantenimiento de tu instalación y es buen momento para hacer otro: la limpiamos, ajustamos la tornillería de la estructura y revisamos la parte eléctrica y el inversor. Este mantenimiento ya no está incluido sin costo. Si te interesa, avisanos por acá y te pasamos el precio y una fecha. Además, con un mantenimiento en el último año, si el viento llega a volar paneles, Voltia se hace cargo.

Nota: en el texto del video 1 cambié "Te dejo" por "Te dejamos", por la regla de Nicolás de escribir siempre en plural.

## 3. Lo que hay que programar en Voltia PM

1. **Demora en los avisos**, en horas o días, como opción general (hoy solo existe "faltan N días para la obra").
2. **Nada antes de la bienvenida:** los avisos esperan a que esté hecho `e1_bienvenida`, sin descartarse por la regla
   de 7 días de antigüedad. Disparador "bienvenida hecha" para el A.
3. **Crear solo el usuario del portal** de cada proyecto nuevo, atado al proyecto, antes de que salga el A.
4. **Plantillas con video o foto** que salen como segundo mensaje, uno o dos minutos después del texto. El archivo lo
   baja Meta de una dirección pública o se sube antes a WhatsApp; MP4 corto (el límite es de unos 16 MB, a confirmar).
   Cada video está además en Bunny, Capacitación → clientes.
5. **Disparadores nuevos:** encuesta creada (con demora), reporte publicado, primer reporte publicado (una vez por
   cliente: el aviso sin referencia de mes ya sale una sola vez por proyecto), un año desde el último mantenimiento hecho.
6. **Condición "Alejandra no escribió"** para D, E1 y E2: ningún WhatsApp saliente ni contacto registrado desde el
   hecho. El PM ya guarda lo que ella escribe desde el celular (coexistencia).
7. **Cambios de fecha:** poder cancelar una fecha confirmada sin poner otra (hoy no se puede), elegir E1 o E2 según
   haya fecha nueva, la marca "esperando fecha nueva" y la E3 en lugar de la C.
8. **Mantenimiento:** el aviso 5 solo para los dos sin costo, y una **alerta interna** de mantenimiento próximo o
   vencido, que hoy no existe.
9. **Portal:** botón "No puedo entrar" en la pantalla de ingreso (deja nombre y teléfono y le llega a Experiencia Solar
   como aviso en rojo con plazo, no por WhatsApp) y botón "Agregar otro acceso" para un segundo usuario en el mismo
   proyecto (la base ya lo permite).
10. **En espera:** el botón "Avisar al cliente" de la mesa de Soporte por WhatsApp (mensaje 6), hasta afinar Soporte.

## 4. Material que tiene que pasar Nicolás

| # | Qué | Para |
|---|---|---|
| V1 | Recorrido por el portal | A |
| V2 | Cómo seguir el trámite en el portal | 1 |
| V3 | Cómo encender: cortar el precinto y subir la llave | 3 |
| V4 | Cómo leer el reporte y compararlo con la factura de UTE, versión celular | 4 |
| V5 | Lo mismo, versión computadora (solo en el portal) | 4 |
| F1 | Foto del aviso de UTE que parece aumento de potencia, con los datos tapados | B1 |

## 5. Datos que faltan cargar

Mail de 12 clientes que no lo tienen en ningún lado; lo pide Alejandra: Alberto Mora, Álvaro Fripp, Busquets, Cristian
Noya, Darío Carrato, José González, Luis Raffo, Miguel Dutra, Nicolás Fripp, Robert de Souza, Sebastián Calleros y
Washington Lanfranco.

## 6. Al activar cada mensaje

Se agrega al Manual de Posventa y al capítulo 20 del manual técnico, con su disparador, demora y condiciones. El manual
describe lo que está andando: cada uno entra cuando se activa, no antes.
