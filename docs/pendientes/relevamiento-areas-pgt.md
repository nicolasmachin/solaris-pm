# Relevamiento de las áreas para el PGT y los manuales

Lo que Nicolás va contando, área por área, al repasar el capítulo 3 del PGT
(1-oct-2026). Es **material de trabajo**: de acá sale el resumen para el PGT y
el detalle para el manual de cada área. Lo que dice acá es palabra de Nicolás;
lo que todavía no está confirmado se marca *(a confirmar)*.

---

## Ventas

### El camino, como un embudo

1. **La consulta.** Las acciones de **Marketing** generan que la gente escriba;
   las consultas les llegan a los asesores comerciales a su casilla.
2. **El speech.** El asesor le responde con un mensaje genérico, el *speech*:
   un orden de precio y mucha información, y le dice que si quiere avanzar
   mande determinada información (la factura de UTE, etc.). Acá ya queda gente
   por el camino: al ver el precio, muchos se filtran.
3. **El lead.** Los que mandan la factura de UTE califican como **lead**, y
   recién ahí se registran en Voltia PM (el CRM interno).
4. **La propuesta comercial.** Se les arma y se les envía.
5. **La visita de venta.** A los que quieren seguir avanzando se les ofrece una
   visita de venta. **La hace Nicolás.** De la visita queda registro.

### La visita de venta y la minuta

- La visita comercial **incluye el relevamiento técnico**, para no tener que
  volver a la casa del cliente con una visita de Ingeniería: **se va una sola
  vez**.
- Al salir del cliente, Nicolás genera con **un bot de Telegram** (desarrollado
  por él) **la minuta de la visita**, con todo el detalle de la reunión y del
  relevamiento técnico.
- **Nombre:** ahora se le dice **"resumen de la visita"**, porque "minuta" era
  un nombre técnico que no todos entendían (Nicolás le sigue diciendo minuta).
- **Qué tiene el resumen:**
  - lo conversado con el cliente;
  - cómo es el techo;
  - el sistema de montaje acordado y definido;
  - las medidas;
  - las características de la instalación eléctrica: si el suministro es
    trifásico o monofásico, las distancias;
  - un **video** con la ubicación de todas las cosas;
  - **tomas aéreas con dron**;
  - **fotos**.
- *(sigue)*

### Lo que contó después (1-oct)

- La visita deja un documento profesional que se le envía al cliente; es donde
  más se convierte (Nicolás dio "más del 60 % entre visitas y ventas cerradas":
  dato de coyuntura, no va al manual).
- Después sigue la conversación con el asesor y se confirma o no la venta. Todo
  queda registrado en el CRM (pipeline comercial: Nuevo lead, Cotizado,
  Reclamado, Agendar visita, Visitado, Cerrado ganado / perdido).
- **Conversión total:** de 100 consultas se cierran ~2 (2 %). Nicolás lo quiere
  en el PGT, como orden de magnitud.
- **Marketing:** sin manual por ahora. Contenido, redes sociales y publicidad en
  redes; lo lleva Nicolás solo.
- **Fin del trabajo de Ventas:** cuando el cliente confirma. El asesor marca el
  lead como ganado → se crea el proyecto con todos los datos y adjuntos del lead.
  El asesor completa el **Onboarding** (10 subetapas en
  `server/src/services/pipeline-definitions.ts`). Completo el onboarding, pasa a
  Ingeniería (pre-ingeniería) y deja de ser de Ventas.
- **Después:** el asesor sigue el cobro: plan de pagos (pago directo) o proforma +
  trámite con el banco (financiación), para que no quede en zona gris.
- **Comisión** por venta cerrada.

### Preguntas abiertas

- ¿Marketing va como un área más del PGT, o solo como el origen de las consultas?
- El speech: ¿es un texto fijo? Si lo es, se cita entero en el manual de Ventas.
- La visita de venta la hace Nicolás: en el manual va por rol (¿Gerencia
  Comercial?).

---

## Ingeniería

- **No hace relevamiento.** Es todo trabajo de oficina.
- Todo lo que recibe está en el **resumen de la visita** (la minuta) y su
  material.
- El bot de Telegram que arma el resumen **adjunta las fotos al documento** y
  **también las sube al lead como imágenes**. Los **videos** los comparte
  Nicolás en el bot y se adjuntan al lead, pero **no van en la minuta**.
- Al ganar el lead, todo eso **pasa al proyecto**, y es el insumo de Ingeniería.
- *(sigue)*
- **Ojo:** el manual de Ingeniería y el PGT (regla 5, "relevamiento") todavía
  hablan de una visita de relevamiento de Ingeniería: corregir cuando se cierre
  esta parte.
