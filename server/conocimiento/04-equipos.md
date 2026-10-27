# Equipos

## Qué se instala

- **Los modelos de cada cliente salen de su propuesta en Voltia PM**: paneles,
  inversor, cantidad. La IA los toma de ahí, no de esta base.
- Equipos que Voltia usa hoy (octubre 2026; ver `cifras-vigentes.md`):
  - **Paneles JA Solar de 620 W.**
  - **Inversores Growatt.** Para **trifásico 230 V** (la red trifásica típica en
    Uruguay sin neutro), la línea **MID KTL3-XL2** (por ejemplo MID 12KTL3-XL2,
    MID 20KTL3-XL2). Es la línea que Voltia tiene instalada y funcionando en otras
    obras trifásicas. (Respuesta a Dutra.)
  - **Huawei** en algunas obras; es la opción híbrida cuando hay trifásico 400 V
    con neutro.
- **Fichas técnicas:** se adjuntan las de los modelos de la propuesta. [Pendiente:
  dónde están las fichas en Voltia PM para que la IA las adjunte.]
- **Inversor más grande que los paneles:** a veces se elige un inversor con margen
  (por ejemplo, 20 kW para 18 kWp) para que el cliente pueda **sumar paneles en el
  futuro sin cambiarlo**.

## Sustituciones

**Los equipos que se instalan son los del contrato**, que el cliente firma antes
de empezar la obra. Si hay cualquier cambio respecto a la propuesta, queda
reflejado en el contrato: **nada se modifica sin su firma**. (Respuesta a Dutra.)

## Baterías, híbridos y cortes de luz

- **Todos los sistemas que Voltia instala hoy son conectados a red (on-grid), sin
  baterías.**
- **Si se corta la luz, el sistema se apaga solo por seguridad**, para no
  energizar una línea donde puede haber alguien trabajando. Vuelve solo cuando
  vuelve la luz. No es una falla. (Anexo E, tema 15.)
- El inversor on-grid **no admite baterías**.
- **Híbrido en trifásico 230 V sin neutro: existe en el mercado, pero hoy Voltia
  no lo consigue en plaza.** Se va a traer. (Nicolás, 27-oct-2026.) Lo que se le
  dijo a Dutra ("no hay en el mercado") no es exacto: lo correcto es "hoy no lo
  conseguimos".
- **Cómo se le dice al cliente** (sin exponer a Voltia como empresa chica: nunca
  "no se consigue en plaza" ni "no lo conseguimos"). Frase propuesta, a confirmar
  por Nicolás: *"Para redes trifásicas de 230 V sin neutro, como la tuya, hoy la
  oferta de inversores híbridos es muy acotada. Por eso te instalamos un inversor
  conectado a la red y, cuando quieras sumar baterías, lo cambiamos por el
  híbrido."* (El "sin costo" va solo si el cliente compró híbrido.)
- **Criterio con quien compra híbrido:** se le instala un inversor on-grid y,
  **cuando quiera conectar baterías, se le cambia por el híbrido sin costo**.
  Es un compromiso con ese cliente: si compró híbrido, cuando quiera usar la
  función híbrida hay que dársela. [Pendiente: que quede registrado en la ficha
  de cada cliente que compró híbrido y recibió on-grid.]
- **Trifásico 400 V con neutro:** hay opción híbrida Huawei, se cotiza aparte.
- **Monofásico:** [A CONFIRMAR qué opción híbrida ofrece Voltia.]
- Si alguien le ofrece un híbrido, recomendarle **verificar que sea compatible con
  su tipo de red**.

## Vida útil del inversor

Un inversor como el Growatt dura normalmente **entre 10 y 15 años**. El costo de
reemplazo depende de los precios de ese momento (referencia en
`cifras-vigentes.md`). Los paneles duran mucho más (vida útil del sistema,
alrededor de 25 años). (Rodríguez.)

## Cargador del auto eléctrico

**El cargador (Wallbox u otro) no tiene nada que ver con el inversor.** Es una
carga más de la casa, como un aire acondicionado o un termotanque. No hay
inversores compatibles o incompatibles con cargadores. Se conecta desde la bornera
de interconexión, no desde el ICP general. (Caso Wallbox, oct-2026.)

## Monitoreo

- **La aplicación del inversor** (de la marca) muestra la generación en tiempo
  real y el histórico.
- **Para ver también el consumo y lo inyectado a la red hace falta un medidor
  inteligente**, que se agrega como opcional. (Rodríguez.) [A CONFIRMAR si hoy va
  de serie en todas las obras.]
- **El portal de Voltia** muestra el avance del trámite, los reportes, la
  generación y el consumo (curva del día, días, meses y años en Growatt; en Huawei
  por ahora sin la curva del día).
- Si la aplicación no muestra datos, casi siempre es **conectividad** (cambió la
  contraseña del wifi o el router): con la luz del inversor en verde, genera bien.
  (Anexo E, temas 6 y 16.)
