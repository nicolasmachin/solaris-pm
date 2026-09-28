// Template HTML de "Plan de Protección contra Granizo — Condiciones generales"
// (documento para el cliente) con el Anexo A completado y el Anexo B en blanco.
// Función pura data → HTML que Puppeteer pasa a PDF.
//
// El texto de las condiciones es el del PDF aprobado por Nicolás (sep-2026). Si
// cambia, se edita acá y se sube PLAN_GRANIZO_DOC_TEMPLATE_VERSION (schema.ts)
// para que cada versión publicada deje registro de qué texto se firmó.
//
// Regla dura de vocabulario: NO es un seguro. Nada de "seguro", "póliza",
// "prima", "siniestro" ni "asegurado" en este documento.

import fs from "node:fs";
import { fileURLToPath } from "node:url";

import type { PlanGranizoDocData } from "./schema.js";

let logoCache: string | null = null;
function voltiaLogoDataUrl(): string {
  if (logoCache) return logoCache;
  const p = fileURLToPath(new URL("../../../templates/proposal-v2/assets/voltia-mark-blue.png", import.meta.url));
  logoCache = `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;
  return logoCache;
}

function esc(s: string | number | undefined | null): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function usd(n: number): string {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function fechaLarga(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map((x) => Number.parseInt(x, 10));
  if (!y || !m || !d) return esc(iso);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

const AZUL = "#1836B2";

const STYLES = `
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #1c2333; font-size: 10pt; line-height: 1.5; margin: 0; }
  .kicker { font-size: 8pt; letter-spacing: 2px; font-weight: 700; color: ${AZUL}; text-transform: uppercase; margin: 0 0 6px; }
  h1 { font-size: 26pt; line-height: 1.05; margin: 0 0 6px; color: #10131f; letter-spacing: -.5px; }
  .subtitulo { font-size: 14pt; color: ${AZUL}; font-weight: 700; margin: 0 0 12px; }
  .lead { font-size: 11pt; color: #3a3e50; margin: 0 0 16px; }
  .tiles { display: flex; gap: 10px; margin: 0 0 18px; }
  .tile { flex: 1; border: 1px solid #e3e6ef; border-radius: 8px; padding: 10px 12px; }
  .tile .big { font-size: 16pt; font-weight: 800; color: #10131f; line-height: 1.1; }
  .tile .small { font-size: 8pt; color: #6b7188; margin-top: 3px; }
  h2 { font-size: 13pt; margin: 18px 0 8px; color: #10131f; page-break-after: avoid; }
  h2 .n { color: ${AZUL}; margin-right: 6px; }
  p { margin: 0 0 8px; text-align: justify; }
  ul, ol { margin: 0 0 8px; padding-left: 20px; }
  li { margin: 0 0 4px; }
  table.def { width: 100%; border-collapse: collapse; margin: 0 0 8px; }
  table.def td { padding: 7px 6px; border-top: 1px solid #e3e6ef; vertical-align: top; }
  table.def td.k { width: 28%; font-weight: 700; font-size: 9pt; }
  .box { border-radius: 8px; padding: 10px 14px; margin: 0 0 10px; page-break-inside: avoid; }
  .box.ok { background: #edf6ef; }
  .box.no { background: #fdeeee; }
  .box.info { background: #f1f4fc; }
  .pasos { list-style: none; padding: 0; }
  .pasos li { display: flex; gap: 8px; margin-bottom: 7px; }
  .pasos .num { flex: none; width: 18px; height: 18px; border-radius: 50%; background: ${AZUL}; color: #fff; font-size: 8pt; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
  .nota { font-size: 8.5pt; color: #6b7188; }
  .anexo { page-break-before: always; }
  table.form { width: 100%; border-collapse: collapse; margin: 8px 0 14px; }
  table.form td { border: 1px solid #d9dcec; padding: 8px 10px; font-size: 9.5pt; }
  table.form td.k { width: 42%; background: #f1f4fc; font-weight: 700; }
  .firmas { display: flex; gap: 24px; margin-top: 70px; }
  .firma { flex: 1; border-top: 1.5px solid #10131f; padding-top: 5px; font-size: 8.5pt; color: #6b7188; }
  .firma.corta { flex: .6; }
  .check { display: inline-block; width: 11px; height: 11px; border: 1.5px solid ${AZUL}; border-radius: 2px; margin-right: 8px; vertical-align: -1px; }
`;

export function renderPlanGranizoHtml(data: PlanGranizoDocData): string {
  const c = data.cliente;
  const p = data.plan;
  const e = data.empresa;
  const precio = usd(p.precioPorPanelUsd);
  const contacto = [c.telefono, c.email].map((x) => x?.trim()).filter(Boolean).join(" · ");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${STYLES}</style></head><body>

  <div class="kicker">Documento para el cliente</div>
  <h1>Plan de Protección<br>contra Granizo</h1>
  <div class="subtitulo">Condiciones generales</div>
  <p class="lead">Si el granizo daña los paneles de su instalación, Voltia los repone sin costo adicional: panel nuevo, mano de obra y puesta en marcha incluidos.</p>

  <div class="tiles">
    <div class="tile"><div class="big">USD ${precio}</div><div class="small">por panel, por año<br>IVA incluido</div></div>
    <div class="tile"><div class="big">Todo incluido</div><div class="small">panel, traslado, mano de obra<br>y puesta en marcha</div></div>
    <div class="tile"><div class="big">Sin deducible</div><div class="small">no paga nada más<br>al momento de reponer</div></div>
  </div>

  <h2><span class="n">1</span>Qué es este plan</h2>
  <p>Voltia se compromete a reponer, sin costo adicional, los paneles solares del Cliente que resulten dañados por granizo, a cambio de un cargo anual de <strong>USD ${precio} por panel, IVA incluido</strong>.</p>
  <p>Las partes son <strong>${esc(e.razonSocial)}</strong> (RUT ${esc(e.rut)}, domicilio fiscal ${esc(e.domicilio)}), en adelante "Voltia", y la persona o empresa indicada en el Anexo A, en adelante "el Cliente".</p>
  <p>Este plan es un <strong>servicio de reposición prestado directamente por Voltia</strong> sobre instalaciones que Voltia construyó. No es una póliza de seguro ni está emitido por una compañía aseguradora. Voltia responde con su propio stock, personal y recursos.</p>

  <h2><span class="n">2</span>Definiciones</h2>
  <table class="def">
    <tr><td class="k">Granizo</td><td>Precipitación de hielo en forma de piedras que impacta directamente sobre los paneles.</td></tr>
    <tr><td class="k">Evento</td><td>Una tormenta de granizo en una fecha determinada. Todos los daños de ese día cuentan como un solo evento.</td></tr>
    <tr><td class="k">Instalación</td><td>El conjunto de paneles conectados al inversor cuyo número de serie figura en el Anexo A. Cada instalación tiene su propio plan.</td></tr>
    <tr><td class="k">Panel cubierto</td><td>Cada panel de la instalación, construida por Voltia en la dirección indicada en el Anexo A.</td></tr>
    <tr><td class="k">Daño cubierto</td><td>Rotura del vidrio, fisura visible de celdas o deformación del marco causada por granizo, que Voltia verifica en sitio.</td></tr>
    <tr><td class="k">Reposición</td><td>Retiro del panel dañado y colocación de uno nuevo, funcionando y conectado.</td></tr>
    <tr><td class="k">Período de carencia</td><td>Los primeros 30 días corridos desde el pago de la primera anualidad, en los que el plan todavía no cubre.</td></tr>
  </table>

  <h2><span class="n">3</span>Qué cubre</h2>
  <div class="box ok">
    <p>Ante un daño cubierto, Voltia repone cada panel afectado e incluye:</p>
    <ul>
      <li>El panel nuevo.</li>
      <li>La mano de obra de desmontaje y montaje.</li>
      <li>El traslado a la obra y el retiro del panel dañado.</li>
      <li>La puesta en marcha y la verificación de que la instalación vuelve a generar.</li>
    </ul>
  </div>
  <ul>
    <li><strong>Todos los paneles:</strong> la adhesión es por la totalidad de los paneles de la instalación. No se aceptan planes sobre una parte de ellos.</li>
    <li><strong>Instalaciones existentes:</strong> al adherirse, el Cliente envía fotos actuales de los paneles. Quedan como registro de su estado al inicio del plan.</li>
    <li><strong>Ampliaciones:</strong> si Voltia amplía la instalación, los paneles nuevos se suman al plan desde su puesta en marcha. Se cobra la parte proporcional a los meses que faltan hasta la próxima anualidad.</li>
  </ul>

  <h2><span class="n">4</span>Qué no cubre</h2>
  <div class="box no">
    <ol>
      <li><strong>Otros equipos:</strong> inversor, estructura, cableado, protecciones, medidor y tableros.</li>
      <li><strong>Otras causas:</strong> viento, rayo, sobretensión, incendio, inundación, caída de árboles u objetos, robo, vandalismo o golpes.</li>
      <li><strong>Daños previos:</strong> los que existían antes de la adhesión, incluidos los visibles en las fotos de inicio, o que ocurrieron durante el período de carencia.</li>
      <li><strong>Microfisuras no visibles:</strong> las que solo se detectan con equipos especiales, salvo que el panel pierda más de 20 % de generación frente a los paneles vecinos.</li>
      <li><strong>Pérdida de generación:</strong> la energía no generada o el ahorro perdido mientras se repone el panel.</li>
      <li><strong>Intervenciones de terceros:</strong> instalaciones modificadas, ampliadas o reparadas por alguien que no sea Voltia.</li>
      <li><strong>Daños estéticos:</strong> marcas o abolladuras en el marco que no afectan el funcionamiento.</li>
      <li><strong>Falta de pago:</strong> eventos ocurridos con la anualidad vencida e impaga.</li>
    </ol>
  </div>

  <h2><span class="n">5</span>Vigencia, precio y renovación</h2>
  <ul>
    <li><strong>Precio:</strong> USD ${precio} por panel por año, IVA incluido. Ejemplo: una instalación de 10 paneles paga USD ${usd(p.precioPorPanelUsd * 10)} al año.</li>
    <li><strong>Pago:</strong> por adelantado, una vez al año, por transferencia bancaria o el medio que Voltia indique.</li>
    <li><strong>Inicio:</strong> la cobertura empieza al terminar el período de carencia de 30 días desde el primer pago. Si el Cliente se adhiere al contratar la obra, la carencia no aplica y la cobertura arranca con la puesta en marcha.</li>
    <li><strong>Duración:</strong> 12 meses desde el inicio.</li>
    <li><strong>Renovación:</strong> automática por períodos de 12 meses. Voltia avisa el vencimiento y cualquier cambio de precio con 30 días de anticipación. Si se paga en fecha, no hay nueva carencia.</li>
    <li><strong>Atraso:</strong> si la anualidad no se paga dentro de los 15 días del vencimiento, el plan queda suspendido. Para reactivarlo se paga la anualidad y corre una nueva carencia de 30 días.</li>
  </ul>

  <h2><span class="n">6</span>Qué hacer si graniza</h2>
  <ul class="pasos">
    <li><span class="num">1</span><span><strong>No tocar los paneles.</strong> Un vidrio roto puede dejar partes con tensión. Si es seguro hacerlo, apagar el inversor desde su llave.</span></li>
    <li><span class="num">2</span><span><strong>Avisar a Voltia dentro de los 10 días hábiles</strong> del evento, por WhatsApp o correo, con los datos del formulario del Anexo B.</span></li>
    <li><span class="num">3</span><span><strong>Enviar fotos</strong> de los paneles, tomadas desde el suelo o un lugar seguro. Nunca subir al techo.</span></li>
    <li><span class="num">4</span><span><strong>Inspección:</strong> Voltia visita la instalación dentro de los 10 días hábiles siguientes al aviso y confirma por escrito qué paneles se reponen.</span></li>
    <li><span class="num">5</span><span><strong>Reposición:</strong> Voltia coordina la fecha con el Cliente y repone los paneles (ver sección 7).</span></li>
  </ul>
  <p class="nota">Los avisos fuera de plazo se atienden igual, pero Voltia puede rechazarlos si ya no es posible confirmar que el daño fue por granizo.</p>

  <h2><span class="n">7</span>Reposición: plazos y límites</h2>
  <ul>
    <li><strong>Plazo:</strong> Voltia repone los paneles dentro de los 30 días corridos desde la inspección. Si la tormenta afecta a muchas instalaciones a la vez, el plazo puede extenderse hasta 60 días, atendiendo por orden de aviso.</li>
    <li><strong>Panel equivalente:</strong> si el modelo original ya no se fabrica, Voltia coloca uno de potencia igual o mayor, compatible con el inversor y la estructura existentes. Puede diferir en marca, color o medidas.</li>
    <li><strong>Límite anual:</strong> hasta la cantidad total de paneles cubiertos por cada período de 12 meses. Es decir, cada panel se repone como máximo una vez por año.</li>
    <li><strong>Sin deducible:</strong> el Cliente no paga nada adicional por la reposición.</li>
    <li><strong>Garantía del panel nuevo:</strong> la que otorga el fabricante, desde la fecha de reposición.</li>
    <li><strong>Propiedad:</strong> los paneles dañados retirados pasan a ser de Voltia.</li>
  </ul>

  <h2><span class="n">8</span>Obligaciones, baja y jurisdicción</h2>
  <p><strong>El Cliente se compromete a:</strong></p>
  <ul>
    <li>Pagar la anualidad en fecha.</li>
    <li>Dar acceso a la instalación para inspecciones y reposiciones.</li>
    <li>Avisar a Voltia antes de modificar, ampliar o mudar la instalación.</li>
    <li>Avisar si cambia el titular del inmueble o de la instalación.</li>
  </ul>
  <p><strong>Baja del plan:</strong></p>
  <ul>
    <li>El Cliente puede darse de baja en cualquier momento por escrito. La anualidad en curso no se reintegra.</li>
    <li>Voltia puede no renovar el plan avisando con 30 días de anticipación al vencimiento. En ese caso cubre hasta el final del período pago.</li>
    <li>Voltia puede dar de baja el plan si el Cliente declara un daño falso o si terceros intervienen la instalación.</li>
    <li>Voltia puede prestar este plan a través de terceros, o reemplazarlo por una cobertura equivalente contratada con una aseguradora habilitada, avisando al Cliente con 30 días de anticipación. Si el Cliente no está de acuerdo, puede darse de baja y se le reintegra la parte no usada de la anualidad.</li>
  </ul>
  <p><strong>Otros:</strong></p>
  <ul>
    <li><strong>Cambio de inversor:</strong> si el inversor se sustituye, el plan sigue vigente y Voltia actualiza el número de serie registrado.</li>
    <li><strong>Cambio de titular:</strong> el plan se transfiere al nuevo dueño de la instalación si este acepta estas condiciones.</li>
    <li><strong>Datos personales:</strong> Voltia usa los datos del Cliente solo para gestionar este plan, conforme a la Ley 18.331.</li>
    <li><strong>Ley y jurisdicción:</strong> rige la ley uruguaya. Cualquier diferencia se resuelve ante los tribunales de Montevideo.</li>
  </ul>

  <section class="anexo">
    <div class="kicker">Anexo A · Para firmar</div>
    <h1 style="font-size:22pt">Solicitud de adhesión</h1>
    <p class="lead">Con esta hoja firmada y el pago de la primera anualidad, el plan queda activo. La cobertura empieza según la sección 5: con la puesta en marcha si la instalación es nueva, o 30 días después del primer pago si ya existía.</p>
    <table class="form">
      <tr><td class="k">Cliente (nombre o razón social)</td><td>${esc(c.nombre)}</td></tr>
      <tr><td class="k">C.I. / RUT</td><td>${esc(c.documento)}</td></tr>
      <tr><td class="k">Dirección de la instalación</td><td>${esc(c.direccion)}</td></tr>
      <tr><td class="k">Número de serie del inversor</td><td>${esc(p.inversorSerie)}</td></tr>
      <tr><td class="k">Teléfono y correo</td><td>${esc(contacto)}</td></tr>
      <tr><td class="k">Cantidad de paneles</td><td>${p.cantidadPaneles}</td></tr>
      <tr><td class="k">Instalación nueva o existente</td><td>${p.instalacion === "NUEVA" ? "Nueva" : "Existente"}</td></tr>
      <tr><td class="k">Fotos actuales de los paneles (solo existentes)</td><td>${
        p.instalacion === "EXISTENTE" ? `Adjuntas: ${p.fotosAdjuntas ? "sí" : "no"}` : "No corresponde"
      }</td></tr>
      <tr><td class="k">Anualidad (USD, IVA incluido)</td><td>USD ${usd(p.anualidadUsd)}</td></tr>
    </table>
    <div class="box info"><p style="margin:0">El Cliente declara que <strong>recibió, leyó y acepta</strong> las Condiciones generales del Plan de Protección contra Granizo de Voltia, que forman parte de esta solicitud.</p></div>
    <p class="nota">Fecha de emisión: ${fechaLarga(data.fecha)}.</p>
    <div class="firmas">
      <div class="firma">Firma del Cliente</div><div class="firma">Aclaración</div><div class="firma corta">Fecha</div>
    </div>
    <div class="firmas" style="margin-top:60px">
      <div class="firma">Por ${esc(e.razonSocial)}</div><div class="firma">Aclaración</div><div class="firma corta">Fecha</div>
    </div>
  </section>

  <section class="anexo">
    <div class="kicker">Anexo B · Guardar para cuando haga falta</div>
    <h1 style="font-size:22pt">Reporte de daño por granizo</h1>
    <p class="lead">Si graniza y ve paneles dañados, responda estas preguntas y envíelas a Voltia por WhatsApp o correo dentro de los 10 días hábiles.</p>
    <table class="form">
      <tr><td class="k">Nombre del titular</td><td></td></tr>
      <tr><td class="k">Dirección de la instalación</td><td></td></tr>
      <tr><td class="k">Teléfono de contacto</td><td></td></tr>
      <tr><td class="k">Fecha del granizo</td><td></td></tr>
      <tr><td class="k">Hora aproximada</td><td></td></tr>
      <tr><td class="k">¿Cuántos paneles ve dañados? (aproximado)</td><td></td></tr>
      <tr><td class="k">¿La instalación sigue generando? (sí / no / no sé)</td><td></td></tr>
      <tr><td class="k">¿Apagó el inversor? (sí / no)</td><td></td></tr>
      <tr><td class="k">Días y horarios en que podemos visitarlo</td><td></td></tr>
    </table>
    <h2 style="margin-top:6px">Fotos para adjuntar</h2>
    <p>Siempre desde el suelo o un lugar seguro. <strong>Nunca suba al techo.</strong></p>
    <p><span class="check"></span>Vista general de los paneles</p>
    <p><span class="check"></span>Detalle del daño, si se ve sin subir</p>
    <p><span class="check"></span>Pantalla del inversor o de la aplicación de monitoreo</p>
    <div class="box no" style="margin-top:12px">
      <p style="margin:0 0 4px;font-weight:800;color:#8a1c1c;letter-spacing:1px;font-size:9pt">POR SEGURIDAD</p>
      <p style="margin:0">No toque los paneles ni los cables. Un vidrio roto puede dejar partes con tensión aunque no haya sol. Si puede hacerlo sin riesgo, apague el inversor desde su llave.</p>
    </div>
    <p class="nota">Voltia confirma la recepción y coordina la inspección.</p>
  </section>
  </body></html>`;
}

export function buildHeaderHtml(): string {
  return `<div style="width:100%; box-sizing:border-box; padding:3mm 18mm 0; font-family:Helvetica, Arial, sans-serif; display:flex; justify-content:space-between; align-items:center;">
    <img src="${voltiaLogoDataUrl()}" style="height:30px; width:auto;" />
    <span style="font-size:7pt; color:#6b7188;">Energía solar fotovoltaica · Uruguay</span>
  </div>`;
}

export function buildFooterHtml(razonSocial: string): string {
  return `<div style="width:100%; box-sizing:border-box; padding:0 18mm; font-family:Helvetica, Arial, sans-serif; font-size:7pt; color:#6b7188; display:flex; justify-content:space-between;">
    <span>Plan de Protección contra Granizo · Condiciones generales · ${esc(razonSocial)}</span>
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;
}
