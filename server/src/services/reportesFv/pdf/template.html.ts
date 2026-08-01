// Template del PDF del reporte fotovoltaico. Función pura: view-model → HTML.
//
// Port literal del cuerpo de templates/reporte.html del sistema Python. Los
// importes ya llegan formateados como strings (ver types.ts): el template sólo
// antepone `$`, `USD ` o unidades, igual que el Jinja original. Los `{% for %}`
// pasan a .map().join(""), los `{% if %}` a ternarios, y los filtros Jinja
// (upper/lower/float/replace) se reimplementan a mano.

import { LOGO_VOLTIA_DATA_URI } from "./logo.js";
import { REPORTE_FV_STYLES } from "./styles.js";
import type { ReporteFvPdfInput, TarifaPdf } from "./types.js";

// Escapa las 5 entidades, necesario porque se interpola texto libre (nombre de
// cliente, notas) tanto en el cuerpo como dentro de atributos.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Contenido de un segmento de barra apilada según su ancho (lógica del Jinja). */
function segLabel(ancho: number, pct: string, kwh: string): string {
  if (ancho >= 16) return `${pct}% - ${kwh} kWh`;
  if (ancho >= 8) return `${pct}%`;
  return "";
}

/** Una celda `<td>$valor</td>` por tarifa mostrada. */
function celdas(tarifas: TarifaPdf[], valor: (t: TarifaPdf) => string): string {
  return tarifas.map((t) => `<td>${valor(t)}</td>`).join("");
}

/** Una línea de summary-card por tarifa. */
function summaryLines(tarifas: TarifaPdf[], valor: (t: TarifaPdf) => string): string {
  return tarifas
    .map(
      (t) =>
        `<div class="summary-line"><span class="summary-line-label">${esc(t.label)}</span><span class="summary-line-value">${valor(t)}</span></div>`,
    )
    .join("");
}

export function renderReporteFvHtml(input: ReporteFvPdfInput): string {
  const t = input.tarifasMostradas;
  const mesUpper = input.mes.toUpperCase();

  const mailtoSubject = encodeURIComponent(
    `Comentarios sobre reporte fotovoltaico - ${input.cliente} (${input.mes})`,
  );

  const notasHtml =
    input.notasAdicionales.length > 0
      ? input.notasAdicionales
          .map((n) =>
            n.tipo === "alerta"
              ? `<div class="alert-box">${esc(n.texto)}</div>`
              : `<div class="note-box">${esc(n.texto)}</div>`,
          )
          .join("\n")
      : `<div class="empty-notes"></div>`;

  const comoLeerIntro = input.esEmpresa
    ? `En el cuadro siguiente se muestra el análisis económico de la <strong>${esc(input.tarifaContratadaLabel.toLowerCase())}</strong> del cliente, que es la tarifa actualmente configurada para este suministro.<br><br>`
    : `En el cuadro siguiente se muestra una <strong>comparativa de las tres tarifas residenciales posibles de UTE</strong>: simple, doble horario y triple horario.
       Se presentan las tres opciones porque no siempre se tiene certeza de cuál es la tarifa vigente del cliente y además permite visualizar si otra tarifa podría resultar más conveniente.<br><br>`;

  const notasAclaratoriasTarifa = input.esEmpresa
    ? `En este reporte de empresa se muestra únicamente la <strong>${esc(input.tarifaContratadaLabel.toLowerCase())}</strong>, que es la tarifa informada para el cliente en la planilla de constantes.<br><br>`
    : `En este reporte residencial, la <strong>proyección de retorno de la inversión</strong> se calcula tomando como referencia la <strong>tarifa simple</strong>. Las tarifas doble horario y triple horario se muestran con fines comparativos dentro del análisis económico.<br><br>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Reporte fotovoltaico — ${esc(input.cliente)} · ${esc(input.mes)}</title>
<style>${REPORTE_FV_STYLES}</style>
</head>
<body>
    <div class="page">

        <div class="logo-wrap">
            <img src="${LOGO_VOLTIA_DATA_URI}" alt="Voltia" class="logo">
        </div>

        <div class="title">Reporte mensual de rendimiento fotovoltaico</div>
        <div class="subtitle">Simulación energética y económica del sistema instalado</div>

        <div class="section">
            <div class="section-header">Datos generales</div>
            <div class="section-body">
                <div class="grid-2">
                    <table class="data-table">
                        <tr><td class="label">Cliente</td><td class="value">${esc(input.cliente)}</td></tr>
                        <tr><td class="label">Mes calculado</td><td class="value">${esc(input.mes)}</td></tr>
                        <tr><td class="label">Fecha habilitación UTE</td><td class="value">${esc(input.fechaInst)}</td></tr>
                    </table>
                    <table class="data-table">
                        <tr><td class="label">Potencia contratada</td><td class="value">${input.potencia} kW</td></tr>
                        <tr><td class="label">Potencia pico instalada</td><td class="value">${input.potInst} kW</td></tr>
                        <tr><td class="label">Inversión realizada</td><td class="value">USD ${input.inversion}</td></tr>
                    </table>
                </div>
            </div>
        </div>

        <div class="section roi-highlight">
            <div class="roi-topline">
                <div class="roi-copy">
                    <div class="roi-eyebrow">Retorno de la inversión</div>
                    <p class="roi-headline">Ya recuperaste ${input.retornoInversionPct}% de la inversión de tu sistema fotovoltaico.</p>
                    <div class="roi-subtitle">Tu instalación ya te devolvió <strong>USD ${input.inversionRecuperadaUsd}</strong> y restan <strong>USD ${input.inversionFaltanteUsd}</strong> para completar el retorno.</div>
                </div>
                <div class="roi-big-number">${input.retornoInversionPct}%</div>
            </div>
            ${input.estimacionRetornoNota ? `<div class="roi-note">${esc(input.estimacionRetornoNota)}</div>` : ""}
            <div class="roi-progress">
                <div class="roi-progress-fill${input.roiBarraPct < 18 ? " is-small" : ""}" style="width: ${input.roiBarraPct}%;">
                    ${input.roiBarraPct >= 12 ? `${input.retornoInversionPct}%` : ""}
                </div>
            </div>
            <div class="roi-stats">
                <div class="roi-stat"><div class="roi-stat-label">Inversión</div><div class="roi-stat-value">USD ${input.inversion}</div></div>
                <div class="roi-stat"><div class="roi-stat-label">Ahorro acumulado</div><div class="roi-stat-value">USD ${input.ahorroAcumuladoUsd}</div></div>
                <div class="roi-stat"><div class="roi-stat-label">Tiempo restante</div><div class="roi-stat-value">${esc(input.tiempoRestanteRetorno)}</div></div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">Resumen económico mes de ${esc(mesUpper)}</div>
            <div class="section-body">
                <div class="grid-3">
                    <div class="summary-card summary-card-cost">
                        <div class="summary-title">Sin paneles - hubiera pagado</div>
                        <div class="summary-lines">${summaryLines(t, (x) => `$${x.totalSin}`)}</div>
                    </div>
                    <div class="summary-card summary-card-current">
                        <div class="summary-title">Con paneles - pago estimado</div>
                        <div class="summary-lines">${summaryLines(t, (x) => `$${x.totalCon}`)}</div>
                    </div>
                    <div class="summary-card summary-card-savings">
                        <div class="summary-title">Ahorro total</div>
                        <div class="summary-lines">${summaryLines(t, (x) => `$${x.ahorroTotal}`)}</div>
                    </div>
                </div>
                <div class="note-box" style="margin-top: 14px;">
                    <strong>¿Por qué estos montos no coinciden con mi factura de UTE?</strong>
                    Porque no cubren los mismos días. Este reporte analiza el <strong>mes calendario completo</strong>
                    (${esc(input.mes)}, del día 1 al último), mientras que UTE factura el período entre dos lecturas del
                    medidor, que normalmente va de mitad de mes a mitad del mes siguiente. Su factura, entonces,
                    incluye días que aquí no figuran y deja afuera días que sí están en este reporte.
                    Según cómo haya variado su consumo, el importe de la factura puede resultar mayor o menor que el
                    estimado aquí: si el consumo venía en aumento, la factura suele dar más; si venía bajando, menos.
                    Los precios utilizados son los del pliego tarifario vigente de UTE.
                    A esto pueden sumarse conceptos ajenos al consumo que la factura incluye y este reporte no
                    contempla, como multas o recargos por pagos fuera de fecha, o cargos de terceros.
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">Resumen energético mes de ${esc(mesUpper)}</div>
            <div class="section-body">
                <div class="intro" style="margin-bottom: 10px;">
                    Todos los indicadores a continuación corresponden a datos mensuales del período analizado: <strong>${esc(input.mes)}</strong>,
                    tomado como mes calendario completo. Por eso los kWh aquí informados no coinciden exactamente con los
                    de una factura de UTE, que cubre el período entre dos lecturas del medidor.
                </div>
                <div class="grid-3">
                    <div class="kpi-card"><div class="kpi-label">Generación</div><div class="kpi-value">${input.generacion}</div><div class="kpi-unit">kWh</div></div>
                    <div class="kpi-card"><div class="kpi-label">Consumo total</div><div class="kpi-value">${input.consumo}</div><div class="kpi-unit">kWh</div></div>
                    <div class="kpi-card"><div class="kpi-label">Autoconsumo</div><div class="kpi-value">${input.autoconsumo}</div><div class="kpi-unit">kWh</div></div>
                    <div class="kpi-card"><div class="kpi-label">Importación desde UTE</div><div class="kpi-value">${input.importacionRed}</div><div class="kpi-unit">kWh</div></div>
                    <div class="kpi-card"><div class="kpi-label">Exportación mes actual</div><div class="kpi-value">${input.exportacionActual}</div><div class="kpi-unit">kWh</div></div>
                    <div class="kpi-card"><div class="kpi-label">Exportación mes anterior</div><div class="kpi-value">${input.exportacionAnterior}</div><div class="kpi-unit">kWh</div></div>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">Distribución de la energía mes de ${esc(mesUpper)}</div>
            <div class="section-body">
                <div class="bar-wrap">
                    <div class="bar-title">Del consumo total del cliente: cuánto se cubrió con autoconsumo y cuánto se importó desde UTE. Total: ${input.consumoTotal} kWh</div>
                    <div class="stacked-bar">
                        <div class="seg-autoconsumo" style="width: ${input.consumoBarAutoconsumo}%;">${segLabel(input.consumoBarAutoconsumo, input.consumoBarAutoconsumoLabel, input.consumoAutoconsumoKwh)}</div>
                        <div class="seg-red" style="width: ${input.consumoBarRed}%;">${segLabel(input.consumoBarRed, input.consumoBarRedLabel, input.consumoRedKwh)}</div>
                    </div>
                    <div class="legend">
                        <div class="legend-item"><span class="legend-box" style="background:#0a4f86;"></span><span>Autoconsumo</span></div>
                        <div class="legend-item"><span class="legend-box" style="background:#94a3b8;"></span><span>Importado desde UTE</span></div>
                    </div>
                </div>
                <div class="bar-wrap">
                    <div class="bar-title">De la generación total de los paneles: cuánto se utilizó en autoconsumo y cuánto se exportó a UTE. Total: ${input.generacionTotal} kWh</div>
                    <div class="stacked-bar">
                        <div class="seg-autoconsumo" style="width: ${input.generacionBarAutoconsumo}%;">${segLabel(input.generacionBarAutoconsumo, input.generacionBarAutoconsumoLabel, input.generacionAutoconsumoKwh)}</div>
                        <div class="seg-exportada" style="width: ${input.generacionBarExportada}%;">${segLabel(input.generacionBarExportada, input.generacionBarExportadaLabel, input.generacionExportadaKwh)}</div>
                    </div>
                    <div class="legend">
                        <div class="legend-item"><span class="legend-box" style="background:#0a4f86;"></span><span>Autoconsumo</span></div>
                        <div class="legend-item"><span class="legend-box" style="background:#60a5fa;"></span><span>Exportado a UTE</span></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">Cómo leer la comparación económica</div>
            <div class="section-body">
                <div class="intro">
                    ${comoLeerIntro}
                    <ul>
                        <li><strong>Sin paneles - hubiera pagado</strong>: cuánto hubiera pagado el cliente en el mes si no tuviera la instalación fotovoltaica.</li>
                        <li><strong>Con paneles - pago estimado</strong>: cuánto debería pagar actualmente con paneles, considerando generación solar, compra a UTE y el efecto neto de los descuentos por venta.</li>
                        <li><strong>Descuento aplicado en factura por venta de energía a UTE</strong>: parte del beneficio neto por venta que efectivamente se usó para reducir la factura del mes.</li>
                        <li><strong>Ahorro por autoconsumo</strong>: valor económico de la energía solar que el cliente consumió directamente y por eso no tuvo que comprar a UTE.</li>
                        <li><strong>Saldo generado este mes en cuenta corriente UTE</strong>: parte del beneficio neto por venta que no fue necesario usar en la factura del mes y quedó como crédito disponible.</li>
                        <li><strong>Saldo inicial de cuenta corriente UTE</strong>: crédito disponible al comenzar el mes.</li>
                        <li><strong>Saldo aplicado de cuenta corriente UTE</strong>: parte del crédito previo que se utilizó para bajar el pago del mes.</li>
                        <li><strong>Saldo final de cuenta corriente UTE</strong>: crédito que queda disponible luego de aplicar el saldo previo y sumar el nuevo remanente del mes, si existiera.</li>
                        <li><strong>Ahorro total</strong>: suma del ahorro por autoconsumo y del descuento neto por venta de energía a UTE.</li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">${input.esEmpresa ? "Resumen económico según tarifa contratada" : "Resumen económico comparativo"}</div>
            <div class="section-body">
                <table class="compare-table">
                    <thead>
                        <tr><th>Concepto</th>${t.map((x) => `<th>${esc(x.label)}</th>`).join("")}</tr>
                    </thead>
                    <tbody>
                        <tr class="compare-row-emphasis compare-row-cost"><td>Sin paneles - hubiera pagado</td>${celdas(t, (x) => `$${x.totalSin}`)}</tr>
                        <tr class="compare-row-emphasis compare-row-current"><td>Con paneles - pago estimado</td>${celdas(t, (x) => `$${x.totalCon}`)}</tr>
                        <tr><td>Descuento aplicado en factura por venta de energía a UTE</td>${celdas(t, (x) => `$${x.descuentoVenta}`)}</tr>
                        <tr><td>Ahorro por autoconsumo</td>${celdas(t, (x) => `$${x.ahorroAutoconsumo}`)}</tr>
                        <tr><td>Saldo generado este mes en cuenta corriente UTE</td>${celdas(t, (x) => `$${x.saldoGeneradoMes}`)}</tr>
                        <tr><td>Saldo inicial de cuenta corriente UTE</td>${celdas(t, (x) => `$${x.saldoInicial}`)}</tr>
                        <tr><td>Saldo aplicado de cuenta corriente UTE</td>${celdas(t, (x) => `$${x.saldoAplicado}`)}</tr>
                        <tr><td>Saldo final de cuenta corriente UTE</td>${celdas(t, (x) => `$${x.saldoFinal}`)}</tr>
                        <tr class="total-row compare-row-savings"><td>Ahorro total</td>${celdas(t, (x) => `$${x.ahorroTotal}`)}</tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="section">
            <div class="section-header">Desglose del ahorro</div>
            <div class="section-body">
                <table class="compare-table">
                    <thead>
                        <tr><th>Concepto</th>${t.map((x) => `<th>${esc(x.label)}</th>`).join("")}</tr>
                    </thead>
                    <tbody>
                        <tr><td>Ahorro por autoconsumo</td>${celdas(t, (x) => `$${x.ahorroAutoconsumo}`)}</tr>
                        <tr><td>Ahorro por venta de energía a UTE</td>${celdas(t, (x) => `$${x.ahorroVenta}`)}</tr>
                        <tr><td>% del ahorro por autoconsumo</td>${celdas(t, (x) => `${x.pctAutoconsumo}%`)}</tr>
                        <tr><td>% del ahorro por venta a UTE</td>${celdas(t, (x) => `${x.pctVenta}%`)}</tr>
                        <tr class="total-row"><td>Ahorro total</td>${celdas(t, (x) => `$${x.ahorroTotalDesglose}`)}</tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="section">
            <div class="section-header">Acumulados</div>
            <div class="section-body">
                <table class="data-table">
                    <tr><td class="label">Ahorro acumulado total</td><td class="value">$${input.ahorroAcumulado}</td></tr>
                    <tr><td class="label">Ahorro acumulado total en USD</td><td class="value">USD ${input.ahorroAcumuladoUsd}</td></tr>
                    <tr><td class="label">IRPF acumulado pagado</td><td class="value">$${input.irpfAcumulado}</td></tr>
                    <tr><td class="label">Retorno de la inversión</td><td class="value">${input.retornoInversionPct}%</td></tr>
                    <tr><td class="label">Ahorro promedio histórico</td><td class="value">$${input.ahorroPromedioHistorico}</td></tr>
                    <tr><td class="label">Tiempo restante para el retorno total</td><td class="value">${esc(input.tiempoRestanteRetorno)}</td></tr>
                    <tr><td class="label">Tiempo total de retorno de la inversión</td><td class="value">${esc(input.tiempoTotalRetorno)}</td></tr>
                    <tr><td class="label">Mes estimado de retorno de la inversión</td><td class="value">${esc(input.mesRetornoEstimado)}</td></tr>
                    <tr><td class="label">Saldo acumulado en cuenta corriente</td><td class="value">$${input.saldoAcumulado}</td></tr>
                </table>
            </div>
        </div>

        <div class="section">
            <div class="section-header">Control UTE</div>
            <div class="section-body">
                <table class="data-table">
                    <tr><td class="label">Compra acumulada a UTE - año en curso</td><td class="value">${input.importacionAcumulada} kWh</td></tr>
                    <tr><td class="label">Venta acumulada a UTE - año en curso</td><td class="value">${input.exportacionAcumulada} kWh</td></tr>
                    <tr><td class="label">Relación venta / compra - año en curso</td><td class="value">${input.ratioUte}%</td></tr>
                    <tr><td class="label">Estado de control UTE - año en curso</td><td class="value">${esc(input.estadoUte)}</td></tr>
                </table>
            </div>
        </div>

        <div class="section">
            <div class="section-header">Interpretación del análisis económico</div>
            <div class="section-body">
                <div class="note-box">
                    Los importes mostrados en la comparación económica son <strong>estimaciones mensuales</strong> calculadas a partir de la energía generada, la energía comprada a UTE, los descuentos netos por venta de excedentes y, cuando corresponde, la aplicación del saldo disponible en cuenta corriente.
                    <br><br>
                    El <strong>ahorro total</strong> del mes surge de la suma entre el ahorro por autoconsumo y el descuento neto por venta de energía a UTE. El uso de saldo previo en cuenta corriente reduce el pago estimado del mes, pero no se contabiliza como ahorro nuevo.
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">Notas aclaratorias</div>
            <div class="section-body">
                <div class="note-box">
                    Este reporte presenta una <strong>simulación económica estimada</strong> en base a los datos energéticos disponibles del cliente, considerando IVA sobre energía y potencia, energía vendida sin IVA y retención IRPF sobre la energía exportada.
                    <br><br>
                    ${notasAclaratoriasTarifa}
                    En tarifa doble horario se asume la exportación en <strong>fuera de punta</strong>. En tarifa triple horario se asume la exportación en <strong>llano</strong>. El crédito por energía vendida del mes actual se calcula usando la exportación del <strong>mes anterior</strong>. En el cuadro comparativo, el descuento por venta se muestra <strong>neto de IRPF 12%</strong>.
                    <br><br>
                    Para este reporte se utilizó un tipo de cambio de <strong>${input.tipoCambioUsado}</strong> pesos por dólar. Ese valor queda guardado en el histórico de cada reporte para que los acumulados en USD no cambien al actualizar la constante global.
                    <br><br>
                    En las tarifas inteligentes, la proporción del consumo atribuida a cada franja horaria se estimó de forma <strong>aproximada</strong>, ya que no contamos con el desglose real por horario y ese reparto depende de los hábitos de consumo de cada cliente.
                    <br><br>
                    El objetivo del reporte es mostrar con claridad cómo se compone el ahorro económico del sistema fotovoltaico, separando el impacto del <strong>autoconsumo</strong> del impacto de la <strong>venta de excedentes a UTE</strong>.
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">Notas Adicionales</div>
            <div class="section-body additional-notes">
                ${notasHtml}
            </div>
        </div>

        <div class="feedback-wrap">
            <div class="feedback-banner">
                <div class="feedback-copy">
                    <div class="feedback-title">¿Vio un error o tiene una sugerencia para mejorar este informe?</div>
                    <p class="feedback-text">Si nota algún dato extraño o tiene ideas para mejorar este reporte, nos encantaría recibir su comentario.</p>
                    <div class="feedback-contact">Contacto: reportes@voltia.com.uy</div>
                </div>
                <a class="feedback-button" href="mailto:reportes@voltia.com.uy?subject=${mailtoSubject}">Enviar comentario</a>
            </div>
        </div>

        <div class="footer">Voltia · Reporte generado automáticamente</div>
    </div>
</body>
</html>`;
}
