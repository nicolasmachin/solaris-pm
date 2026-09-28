# Lo que surgió del anexo de preguntas frecuentes

> Armado por Nicolás el 27-09-2026 junto con el Anexo E del Manual de Posventa
> ("Las preguntas que hacen los clientes"). El anexo quedó en el manual; esto es
> lo que pide cambios de sistema o confirmaciones de política, y por eso no va ahí.
> Revisado contra el código el 28-09-2026: tres de los once cambios ya existían.

## Cambios de sistema (Voltia PM)

| # | Cambio | Estado real |
|---|---|---|
| 1 | **Bitácora con tipo "consulta del cliente"** y el tema del anexo | **A medias.** La bitácora ya guarda canal, dirección y **motivo**, y uno de los motivos es `CONSULTA`. Lo que falta es el **tema del anexo** (1 a 20), para medir consultas por instalación y ver qué paso falla más. |
| 2 | **Alerta al finalizar el trámite UTE**, aviso en 24-48 h | **Ya existe.** Es la Regla de Oro: al finalizar el trámite arranca el reloj, a las 24 h recuerda a Experiencia Solar, a las 48 h escala a Administración, el cliente aparece con triángulo rojo y encabeza el correo de la mañana. Lo que no hace es recordar el cobro del 20 %. |
| 3 | **Métrica de UTE partida en dos**: consulta (enviada → aprobada) y habilitación (desde fin de obra) | Pendiente. Coincide con la redefinición de tiempos UTE que ya estaba anotada. |
| 4 | **Quién tiene la pelota** en cada trámite UTE, visible en la ficha | Pendiente. Es lo que evita decir "estamos esperando a UTE" sin verificar. |
| 5 | **Curva de potencia de un día soleado por mes** | A verificar si existe en algún lado; si no, al reporte mensual o a la propuesta. |
| 6 | **Detectar clientes sin fecha de corte** cargada en el portal | Pendiente. |
| 7 | **Mantenimientos**: registro del último por cliente, recordatorio de los gratis del año 1 y 2 y antes de que venza el segundo | Pendiente. **Ojo con el alcance**: se decidió que el sistema **recuerda, no agenda solo** — la fecha la propone y la confirma una persona (ver Manual de Posventa, cap. 12 y Anexo D). |
| 8 | **Cobertura de granizo**: qué clientes la tienen y el cobro anual | Pendiente. Depende de cerrar la política (abajo). |
| 9 | **Ampliaciones**: lead vinculado al cliente existente | **A medias.** El proyecto de ampliación ya se vincula al original (`parentProjectId`); lo que falta es que el **lead** nazca vinculado, para medir ventas que salen de la postventa. |
| 10 | **Tickets**: distinguir los que abre el cliente de los que abre Experiencia Solar | **Ya existe** (`origenCliente` en el ticket). Falta **medirlo**: la proporción, para ver si avanza el autoservicio. |
| 11 | **Tipo de sistema en la ficha** (conectado a red o híbrido con baterías) | Pendiente. Hace falta cuando entren los híbridos (tema 15 del anexo). |

## Pendientes a confirmar (política)

- **Anticipación del aviso de fecha de instalación:** por ahora no se define, "te
  avisamos con tiempo".
- **Granizo:** que son USD 12 y no pesos; forma de cobro; condiciones para dar un
  siniestro por válido; si va por aseguradora o directo; tope o fondo para una
  tormenta que afecte varias obras a la vez.
- **Escalamiento de fallas técnicas:** provisoriamente a Operaciones; definir en
  interna del equipo.
- **Sistemas híbridos con baterías:** actualizar el tema 15 cuando entren.
- **Garantías:** fuera del anexo porque nadie lo preguntó; se agrega si aparece.

## Material a producir

- **Videos de reconexión del wifi**, uno por marca de inversor (tema 16). Anotado
  también en `material-para-el-cliente.md`.
