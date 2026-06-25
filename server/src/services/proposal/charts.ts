import type { ScriptableScaleContext } from "chart.js";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import ChartDataLabels from "chartjs-plugin-datalabels";
import type { Context as DLContext } from "chartjs-plugin-datalabels";

const BLUE = "#1836B2";
const BLUE_DARK = "#122a8f";
const BLUE_LIGHT = "#A7C7E7";

// Formato uruguayo (miles con ".") para los valores arriba de las barras.
function fmtNum(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const canvas = new ChartJSNodeCanvas({
  width: 700,
  height: 350,
  backgroundColour: "white",
  chartCallback: (ChartJS) => {
    ChartJS.register(ChartDataLabels);
  },
});

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export async function renderGeneracionMensualChart(generacionMensualKwh: number[]): Promise<string> {
  return canvas.renderToDataURL({
    type: "bar",
    data: {
      labels: MESES,
      datasets: [{ data: generacionMensualKwh, backgroundColor: BLUE, borderRadius: 4 }],
    },
    options: {
      layout: { padding: { top: 22, bottom: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: {
          anchor: "end",
          align: "top",
          color: BLUE_DARK,
          font: { size: 10, weight: "bold" },
          formatter: (v: number) => fmtNum(v),
        },
      },
      scales: {
        y: {
          title: { display: true, text: "kWh por mes", color: "#6b7280", font: { size: 11 } },
          ticks: { color: "#9aa3b2", font: { size: 10 } },
          grid: { color: "#eef0f4" },
        },
        x: { ticks: { color: "#6b7280", font: { size: 11 } }, grid: { display: false } },
      },
    },
  });
}

export async function renderRetornoInversionChart(retornoInversion16Anios: number[]): Promise<string> {
  const colors = retornoInversion16Anios.map((v) => (v >= 0 ? BLUE : BLUE_LIGHT));
  return canvas.renderToDataURL({
    type: "bar",
    data: {
      labels: retornoInversion16Anios.map((_, i) => String(i)),
      datasets: [{ data: retornoInversion16Anios, backgroundColor: colors, borderRadius: 3 }],
    },
    options: {
      layout: { padding: { top: 18, bottom: 18 } },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: {
          anchor: (ctx: DLContext) => ((ctx.dataset.data[ctx.dataIndex] as number) >= 0 ? "end" : "start"),
          align: (ctx: DLContext) => ((ctx.dataset.data[ctx.dataIndex] as number) >= 0 ? "top" : "bottom"),
          color: (ctx: DLContext) => ((ctx.dataset.data[ctx.dataIndex] as number) >= 0 ? BLUE_DARK : "#6f7f9e"),
          font: { size: 8, weight: "bold" },
          formatter: (v: number) => fmtNum(v),
        },
      },
      scales: {
        y: {
          title: { display: true, text: "USD acumulado", color: "#6b7280", font: { size: 11 } },
          ticks: { color: "#9aa3b2", font: { size: 10 } },
          // Resalta la línea de equilibrio (y=0).
          grid: { color: (ctx: ScriptableScaleContext) => (ctx.tick.value === 0 ? "#9fb0cf" : "#eef0f4") },
        },
        x: {
          title: { display: true, text: "Año", color: "#6b7280", font: { size: 11 } },
          ticks: { color: "#6b7280", font: { size: 10 } },
          grid: { display: false },
        },
      },
    },
  });
}
