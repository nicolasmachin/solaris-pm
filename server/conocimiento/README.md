# Base de conocimiento de Voltia

Es lo que consulta el **asistente de IA interno de Voltia PM**: el que usa el
equipo (asesores, Experiencia Solar, quien sea) para preguntar y para que lo
ayude, por ejemplo, a armar la respuesta a un cliente. Cubre cómo funciona la
microgeneración, qué promete Voltia y qué no, equipos, techos, pagos, garantías,
criterios internos (markup, cotizador, errores que ya se cometieron) e
ingeniería.

**El asistente le habla al equipo, no al cliente.** Por eso la base puede tener
información interna. Cuando ayuda a redactar algo para un cliente, respeta lo
marcado como *interno* o *no se le dice al cliente*. Un bot para clientes es
otro proyecto, y va a usar solo la parte que se le puede decir al cliente.

**No es un manual de trabajo.** Los manuales dicen cómo trabaja cada área. Esta
base junta lo que hace falta saber para contestar.

## Archivos

| Archivo | Qué tiene |
|---|---|
| `01-criterios-y-tono.md` | Cómo se contesta: qué se firma, qué se estima, qué no se promete, honestidad, usted o vos |
| `02-ute-y-microgeneracion.md` | Cómo funciona la microgeneración con UTE: las dos aprobaciones, el excedente, el tope anual, el contrato de 10 años, la potencia |
| `03-generacion-y-ahorro.md` | Energía, ahorro y factura; estaciones; "genera poco", "no veo el ahorro"; tarifas; auto eléctrico |
| `04-equipos.md` | Paneles, inversores, trifásico, baterías e híbridos, corte de luz, sustituciones |
| `05-techos-y-montaje.md` | Inclinación, coplanar y el 10 % de paneles de cortesía, cada tipo de techo, impermeabilización |
| `06-precio-pago-financiacion.md` | Seña, pago directo, financiación bancaria, cuota contra ahorro, condiciones especiales |
| `07-garantias-mantenimiento-granizo.md` | Garantías, pérdida de garantía, mantenimiento, limpieza, Plan de Protección contra Granizo |
| `08-obra-plazos-y-costos-aparte.md` | Plazos de punta a punta, el día de la obra, qué cuesta aparte de la propuesta |
| `cifras-vigentes.md` | **Todos los números que cambian** (tarifas, tasas, precios), con fecha y fuente |
| `pendientes.md` | Lo que la base todavía no sabe o no está decidido. La IA no lo responde: lo marca ❓ |
| `casos/` | Preguntas reales de clientes y la respuesta que se les dio. Sirven de ejemplo de tono y criterio |
| `enciclopedia.md` | Lo compilado del historial de Nicolás con Claude (ago–oct 2026): empresa y equipo, cotizador y markup, criterios técnicos de venta, plantillas, objeciones, cotizaciones no estándar, ingeniería, soporte Growatt, casos. **Alimenta a los archivos de tema, no los reemplaza** |
| `enciclopedia-tecnica.md` | Segundo compilado (otro proyecto de Claude): embudo y tiempos reales de Voltia PM, pipeline de obra, UTE, ingeniería DC/AC, tableros, tierra, redes, smart meters, estructura y viento, tipologías, entregables, diagnóstico y casos resueltos, componentes, lecciones. Misma regla: alimenta, no reemplaza |

**Si dos archivos dicen cosas distintas:** manda el archivo de tema (`01` a `08`)
y, para números, `cifras-vigentes.md`. Lo que se corrige en un lado se corrige en
el otro.

## Reglas para la IA

1. **Cada respuesta dice de dónde sale:**
   - ✅ **dato**: de esta base o de Voltia PM (la propuesta, la minuta, la ficha del cliente).
   - ⚠️ **deducción**: la IA la razonó a partir de datos; un humano la revisa antes de mandarla.
   - ❓ **no se sabe o lo decide Voltia**: no se inventa; se marca para que lo conteste quien corresponde.
2. **Las condiciones comerciales no las decide la IA**: descuentos, cambios en la
   forma de pago, incluir algo que la propuesta excluye, plazos especiales. Se
   marcan ❓ con la pregunta concreta para quien vende.
3. **Los números que cambian salen de `cifras-vigentes.md`** y se citan con su
   vigencia. Si la cifra tiene más de un año, se avisa que hay que confirmarla.
4. **Lo marcado [A CONFIRMAR] no se afirma** como política cerrada.
5. Lo que está en `casos/` es ejemplo de **cómo** se contesta. Los números de un
   caso son de ese cliente, no se trasladan a otro.

## Cómo se mantiene

- **Cada pregunta que la IA no pudo contestar** y que después contestó alguien de
  Voltia se agrega al archivo del tema. Así la próxima vez ya está.
- **Si cambia algo en un manual** (el de Ventas, el de Posventa, el de Gerencia)
  que también está acá, se corrige acá. Cada punto dice de qué manual sale.
- **Cada respuesta final que se mande a un cliente** con un listado de preguntas
  se guarda en `casos/`.
- Cuando una cifra cambia (tarifa UTE nueva, precio nuevo), se cambia **solo** en
  `cifras-vigentes.md`, con la fecha.

Armada el 27-oct-2026 a partir del historial de Nicolás con Claude, el Manual de
Posventa (Anexo E), el de Ventas, el de Gerencia, el contrato tipo, la skill de ingeniería y cinco respuestas a clientes
(Cameto, Ruiz, Rodríguez, el cliente del Wallbox y Dutra, de agosto a octubre de 2026).
