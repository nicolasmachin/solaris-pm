// Template HTML del contrato de instalación de sistema solar fotovoltaico de
// Voltia. Función pura data → HTML string que luego Puppeteer renderiza a PDF.
// Los datos fijos de la Empresa y las cláusulas invariables están acá; sólo las
// variables (encabezado, cliente, inmueble, sistema, precio) salen de `data`.

import fs from "node:fs";
import { fileURLToPath } from "node:url";

import type { ContractDataPublish } from "./schemas/contract.schema.js";

// Logo oficial de Voltia (el mismo asset que usa el generador de propuestas),
// embebido como data URL para que el PDF sea self-contained. Se usa como membrete
// en el header de cada página. Cacheado (se lee del disco una sola vez).
let logoDataUrlCache: string | null = null;
function voltiaLogoDataUrl(): string {
  if (logoDataUrlCache) return logoDataUrlCache;
  const p = fileURLToPath(new URL("../../templates/proposal-v2/assets/voltia-mark-blue.png", import.meta.url));
  const buf = fs.readFileSync(p);
  logoDataUrlCache = `data:image/png;base64,${buf.toString("base64")}`;
  return logoDataUrlCache;
}

// Datos fijos de la Empresa (Voltia).
export const VOLTIA_EMPRESA = {
  representante: "MACHIN JUSTET NICOLAS FERNANDO",
  rut: "150733900014",
  nombreFantasia: "VOLTIA",
  categoriaUte: "Categoría A",
  domicilio: "Río Branco 1585, Montevideo, Uruguay",
  soporteEmail: "soporte@voltia.com.uy",
  soporteTel: "098 640 651",
  soporteHorario: "lunes a viernes de 9:00 a 17:00 horas",
} as const;

function esc(s: string | number | undefined | null): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtUsd(n: number | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "______";
  return n.toLocaleString("es-UY", { maximumFractionDigits: 0 });
}

function fmtNum(n: number | undefined, dec = 0): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "______";
  return n.toLocaleString("es-UY", { maximumFractionDigits: dec });
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
function partesFecha(iso: string | undefined): { dia: string; mes: string; anio: string; largo: string } {
  if (!iso) return { dia: "__", mes: "______", anio: "____", largo: "____________" };
  const [y, m, d] = iso.slice(0, 10).split("-").map((p) => Number.parseInt(p, 10));
  if (!y || !m || !d) return { dia: "__", mes: "______", anio: String(y || "____"), largo: esc(iso) };
  const mes = MESES[m - 1] ?? "";
  return { dia: String(d), mes, anio: String(y), largo: `${d} de ${mes} de ${y}` };
}

const STYLES = `
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; font-size: 10.5pt; line-height: 1.5; }
  h1 { font-size: 15pt; text-align: center; margin: 0 0 18px; letter-spacing: .3px; }
  h2 { font-size: 11.5pt; margin: 16px 0 6px; color: #111; }
  p { margin: 0 0 8px; text-align: justify; }
  ul { margin: 0 0 8px; padding-left: 20px; }
  li { margin: 0 0 3px; }
  .intro { margin: 0 0 12px; }
  .datos { margin: 4px 0 10px; }
  .datos .row { padding: 2px 0; }
  .datos .k { color: #555; font-weight: 600; }
  table.tec { width: 100%; border-collapse: collapse; margin: 4px 0 12px; }
  table.tec td { padding: 4px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  table.tec td.k { width: 46%; color: #555; font-weight: 600; }
  .firmas { margin-top: 90px; display: flex; justify-content: space-between; gap: 40px; }
  .firma { flex: 1; border-top: 1px solid #333; padding-top: 6px; font-size: 9.5pt; }
  .notas { margin-top: 12px; font-size: 9.5pt; color: #444; white-space: pre-wrap; }
  .muted { color: #666; }
`;

export function renderContractHtml(data: ContractDataPublish): string {
  const c = data.cliente;
  const inst = data.instalacion;
  const s = data.sistema;
  const e = VOLTIA_EMPRESA;
  const f = partesFecha(data.contrato.fecha);
  const inicioObra = partesFecha(data.contrato.fechaInicioObra).largo;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${STYLES}</style></head><body>
  <h1>CONTRATO DE INSTALACIÓN DE SISTEMA SOLAR FOTOVOLTAICO</h1>

  <p class="intro">En la ciudad de ${esc(data.contrato.lugar)}, a los ${f.dia} días del mes de ${f.mes} de ${f.anio}.</p>

  <p>Entre por una parte <strong>${esc(e.representante)}</strong>, RUT ${esc(e.rut)}, nombre de fantasía
  <strong>${esc(e.nombreFantasia)}</strong>, con firma instaladora habilitada por UTE – ${esc(e.categoriaUte)},
  con domicilio en calle ${esc(e.domicilio)}, en adelante "la Empresa",</p>
  <p>y por la otra parte:</p>
  <div class="datos">
    <div class="row"><span class="k">Cliente:</span> ${esc(c.nombre)}</div>
    <div class="row"><span class="k">Documento de identidad:</span> ${esc(c.documento)}</div>
  </div>
  <p>en adelante "el Cliente", se celebra el presente Contrato de Instalación de Sistema Solar Fotovoltaico,
  el cual se regirá por las siguientes cláusulas:</p>

  <h2>1. Objeto del contrato</h2>
  <p>La Empresa se compromete a suministrar, instalar y poner en funcionamiento un sistema solar fotovoltaico
  on-grid, sin baterías, bajo la modalidad llave en mano, en el siguiente inmueble del Cliente:</p>
  <div class="datos">
    <div class="row"><span class="k">Dirección:</span> ${esc(inst.direccion)}</div>
    <div class="row"><span class="k">Ciudad:</span> ${esc(inst.ciudad)}</div>
    <div class="row"><span class="k">Departamento:</span> ${esc(inst.departamento)}</div>
  </div>
  <p>La instalación se realizará de acuerdo con las condiciones técnicas y económicas aceptadas por el Cliente,
  las cuales se detallan en las cláusulas siguientes del presente contrato.</p>

  <h2>2. Descripción del sistema fotovoltaico</h2>
  <p><strong>2.1 Generación solar</strong></p>
  <table class="tec">
    <tr><td class="k">Cantidad de paneles solares</td><td>${esc(s.cantidadPaneles)}</td></tr>
    <tr><td class="k">Potencia unitaria de cada panel</td><td>${esc(s.potenciaUnitariaWp)} Wp</td></tr>
    <tr><td class="k">Potencia total instalada en paneles</td><td>${fmtNum(s.potenciaTotalKwp, 2)} kWp</td></tr>
    <tr><td class="k">Marca de los paneles</td><td>${esc(s.marcaPaneles)}</td></tr>
  </table>
  <p><strong>2.2 Inversor</strong></p>
  <table class="tec">
    <tr><td class="k">Cantidad de inversores</td><td>${esc(s.cantidadInversores)}</td></tr>
    <tr><td class="k">Potencia nominal del inversor</td><td>${fmtNum(s.potenciaInversorKw, 2)} kW</td></tr>
    <tr><td class="k">Marca del inversor</td><td>${esc(s.marcaInversor)}</td></tr>
    <tr><td class="k">Conectividad para monitoreo</td><td>Sí</td></tr>
  </table>
  <p><strong>2.3 Estructura y montaje</strong></p>
  <table class="tec">
    <tr><td class="k">Tipo de techo</td><td>${esc(s.tipoTecho)}</td></tr>
    <tr><td class="k">Sistema de montaje</td><td>Estructura de aluminio y anclajes certificados</td></tr>
    <tr><td class="k">Orientación principal de los paneles</td><td>Norte</td></tr>
  </table>

  <h2>3. Energía estimada</h2>
  <table class="tec">
    <tr><td class="k">Generación anual estimada</td><td>${fmtNum(s.generacionAnualKwh)} kWh/año</td></tr>
  </table>
  <p class="muted">La generación es una estimación basada en ubicación, orientación, potencia instalada y datos
  históricos, pudiendo variar según condiciones climáticas y hábitos de consumo.</p>

  <h2>4. Alcance del servicio</h2>
  <p>El servicio incluye, entre otros:</p>
  <ul>
    <li>Relevamiento técnico y asesoramiento previo.</li>
    <li>Proyecto de ingeniería y diseño del sistema.</li>
    <li>Suministro de equipos y materiales.</li>
    <li>Instalación completa del sistema fotovoltaico.</li>
    <li>Puesta en marcha técnica del sistema.</li>
    <li>Tramitación administrativa ante UTE para la habilitación.</li>
    <li>Garantías, mantenimiento y soporte según lo establecido en este contrato.</li>
  </ul>

  <h2>5. Precio y condiciones de pago</h2>
  <table class="tec">
    <tr><td class="k">Precio total del sistema</td><td>USD ${fmtUsd(data.comercial.precioTotalUsd)} IVA inc.</td></tr>
  </table>
  <p><strong>5.1 Seña de confirmación.</strong> Al momento de confirmar la contratación, el Cliente deberá abonar
  una seña mínima de USD 500 (quinientos dólares estadounidenses). Dicha seña tiene como finalidad reservar la
  fecha de instalación y aplica tanto a pagos directos como a operaciones con financiamiento.</p>
  <p><strong>5.2 Modalidad con financiamiento bancario.</strong> En caso de que el Cliente opte por financiamiento
  bancario, el monto a solicitar al banco será el total del valor acordado menos la seña abonada. En caso de que
  el crédito no sea aprobado por la entidad financiera, la seña abonada será reintegrada al Cliente, sin penalidad alguna.</p>
  <p><strong>5.3 Modalidad de pago directo.</strong> Si el Cliente opta por pago directo, deberá abonar según el
  siguiente calendario de pagos:</p>
  <ul>
    <li>50% del valor total del servicio con una anticipación mínima de 15 días corridos respecto a la fecha confirmada de instalación.</li>
    <li>30% del valor total del servicio dentro de un plazo máximo de 5 (cinco) días corridos posteriores a la finalización de la obra.</li>
    <li>20% del valor total del servicio (saldo restante) al finalizar la habilitación por parte de UTE.</li>
  </ul>
  <p>El cumplimiento de este plazo es condición necesaria para garantizar la logística, la adquisición de
  materiales y la ejecución del servicio.</p>

  <h2>6. Tramitación y habilitación ante UTE</h2>
  <p>La Empresa realizará todos los trámites necesarios ante UTE para la habilitación del sistema, comprometiéndose
  a realizar el mejor esfuerzo para minimizar los tiempos de habilitación, informando al Cliente el estado del
  trámite con una periodicidad máxima de 7 días corridos hasta su resolución. El Cliente reconoce que los plazos
  finales de habilitación dependen tanto de Voltia como de UTE. El detalle del proceso de habilitación puede
  consultarse en: https://www.voltia.com.uy/UTE</p>

  <h2>7. Garantías</h2>
  <p>Los equipos y trabajos realizados cuentan con las siguientes garantías:</p>
  <ul>
    <li>Paneles solares: 10 años.</li>
    <li>Inversor: 5 años.</li>
    <li>Componentes eléctricos: 3 años.</li>
    <li>Mano de obra e instalación: 3 años.</li>
  </ul>
  <p>La vida útil estimada del sistema fotovoltaico es de aproximadamente 25 años.</p>

  <h2>8. Pérdida de garantía</h2>
  <p>La garantía quedará automáticamente anulada si el sistema fotovoltaico es intervenido, modificado o manipulado
  por personal ajeno a Voltia sin autorización previa y expresa. Esto incluye, sin limitarse a: cambio, retiro o
  reubicación de paneles solares; reconfiguración del inversor; manipulación de tableros eléctricos, protecciones o cableados.</p>

  <h2>9. Exoneración de responsabilidad por accidentes</h2>
  <p>La Empresa asume la total responsabilidad por la seguridad de su personal durante la ejecución de los trabajos,
  cumpliendo con todas las obligaciones legales y manteniendo vigente el seguro de accidentes de trabajo correspondiente.
  El Cliente queda exonerado de toda responsabilidad civil, laboral o penal por accidentes, lesiones o daños que
  pudieran sufrir los trabajadores de la Empresa durante la instalación, salvo que dichos accidentes sean consecuencia
  directa de condiciones peligrosas preexistentes que el Cliente haya ocultado deliberadamente.</p>

  <h2>10. Obligaciones de la Empresa</h2>
  <ul>
    <li>Ejecutar la instalación conforme a las normas técnicas y de seguridad vigentes.</li>
    <li>Cumplir con todas las obligaciones legales, laborales y de seguridad social respecto a su personal.</li>
    <li>Mantener vigente la cobertura de seguro de accidentes laborales.</li>
    <li>Gestionar la tramitación ante UTE.</li>
    <li>Brindar capacitación básica al Cliente para el uso y monitoreo del sistema.</li>
    <li>Cumplir con las garantías, mantenimiento y soporte acordados.</li>
  </ul>

  <h2>11. Obligaciones del Cliente</h2>
  <ul>
    <li>Facilitar el acceso a la propiedad en las fechas y horarios acordados.</li>
    <li>Garantizar condiciones seguras de trabajo.</li>
    <li>Cumplir con los pagos en los plazos establecidos.</li>
    <li>Informar a la Empresa sobre cualquier condición estructural o eléctrica preexistente que pueda representar un riesgo.</li>
  </ul>

  <h2>12. Soporte y consultas técnicas</h2>
  <p>Toda consulta técnica o solicitud de soporte deberá canalizarse en primera instancia a través del correo
  electrónico: ${esc(e.soporteEmail)}. En segunda instancia, el Cliente podrá comunicarse al teléfono: ${esc(e.soporteTel)}.
  Horario de atención: ${esc(e.soporteHorario)}.</p>

  <h2>13. Plazo del contrato</h2>
  <p>El presente contrato establece las condiciones generales del servicio prestado por la Empresa, incluyendo
  instalación, garantías, mantenimiento, soporte y responsabilidades, manteniéndose vigente durante toda la vida
  útil del sistema en lo que resulte aplicable.</p>

  <h2>14. Plazos de instalación</h2>
  <p>La fecha de inicio de obra se establece de forma tentativa para el día ${esc(inicioObra)}, quedando sujeta a la
  obtención previa de la aprobación por parte de UTE del caso de consulta presentado en el marco del trámite de
  Microgeneración. La Empresa se compromete a coordinar el inicio de la instalación una vez se cuente con dicha
  aprobación. La fecha definitiva de inicio de obra será confirmada o reprogramada en acuerdo con el Cliente una vez
  recibido el visto bueno de UTE. Una vez iniciados los trabajos, la instalación del sistema fotovoltaico se ejecutará
  en un plazo máximo de 15 días corridos. Dicho plazo podrá extenderse únicamente por causas ajenas a la Empresa,
  tales como condiciones climáticas adversas, demoras en la provisión de equipos, restricciones del Cliente o
  situaciones de fuerza mayor.</p>

  <h2>15. Mantenimiento</h2>
  <p>La Empresa garantiza al Cliente la realización de un mantenimiento anual sin costo, durante los primeros 2 (dos)
  años posteriores a la instalación. Dicho mantenimiento incluye: mantenimiento preventivo eléctrico del sistema;
  ensayos de funcionamiento del inversor; mantenimiento preventivo de las estructuras de montaje; y lavado de los paneles solares.</p>

  <h2>16. Aceptación</h2>
  <p>Leído que fue el presente contrato, ambas partes manifiestan su plena conformidad, firmando dos ejemplares de
  un mismo tenor y a un solo efecto.</p>

  ${data.notas ? `<div class="notas"><strong>Observaciones:</strong> ${esc(data.notas)}</div>` : ""}

  <div class="firmas">
    <div class="firma">Firma Cliente:<br><span class="muted">Aclaración:</span></div>
    <div class="firma">Firma VOLTIA:<br><span class="muted">Aclaración:</span></div>
  </div>
  </body></html>`;
}

// Puppeteer header/footer. Header con el logo de Voltia (membrete en cada página);
// footer con número de página centrado.
export function buildHeaderHtml(): string {
  return `<div style="width:100%; box-sizing:border-box; padding:3mm 18mm 0; text-align:center;">
    <img src="${voltiaLogoDataUrl()}" style="height:34px; width:auto;" />
  </div>`;
}
export function buildFooterHtml(): string {
  return `<div style="width:100%; font-size:8pt; color:#999; text-align:center;">
    <span class="pageNumber"></span> / <span class="totalPages"></span>
  </div>`;
}
