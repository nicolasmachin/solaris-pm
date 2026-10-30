+++
nombre = "Seguimiento del speech (al día siguiente)"
activa = true
disparador = "seguimiento"
# Horas desde el último mensaje de la persona: siempre antes de las 24 h, que
# es lo que Meta deja para escribirle.
horas = [20, 23.5]
# Sólo entre estas horas (Uruguay) y estos días (0 = lunes … 5 = sábado).
horario = [8, 21]
dias = [0, 1, 2, 3, 4, 5]
+++
[Seguimiento] Pasó casi un día desde que le contamos el servicio y le pedimos la factura y el techo, y no contestó. Escribile UN mensaje corto (1 o 2 líneas) para retomar, como lo haría Nicolás: saludo según la hora ("Buen día", "Buenas tardes") con su primer nombre si lo tenemos, y preguntale si pudo ver lo que le pasamos o si quiere mandarnos la foto de la factura de UTE para armarle la propuesta. Que suene natural y no insistente; podés cerrar con "cualquier cosa avisame por acá". No repitas el speech ni el precio. Si por la conversación no tiene sentido escribirle (dijo que no le interesa, o ya quedó en algo), devolvé la lista de mensajes vacía. "speech" en false.
