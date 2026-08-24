import type { InstallerPayment } from "../../api/pagosInstalador.api";

// Resumen para pegarle al instalador por WhatsApp (los *...* son su negrita).
//
// Muestra lo que está en curso —lo que todavía se le debe— y de lo ya saldado
// solo **las últimas tres obras** (por fecha de obra): un instalador con veinte
// obras cerradas generaría un mensaje ilegible, y lo que importa es dónde quedó
// la cuenta.

function fmtUsd(v: number): string {
  return "US$ " + v.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

/**
 * "20 ago" a partir del prefijo de la fecha ISO, sin pasar por `Date`.
 *
 * Las fechas llegan como medianoche UTC (así las arma `parseDateOnly` del
 * backend). Formatearlas con `toLocaleDateString` las corre un día para atrás en
 * Uruguay (-03): un pago del 20 se mostraba como 19. Mismo criterio que
 * `formatDate` en `utils/date.ts`.
 */
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${Number(d)} ${MESES[Number(m) - 1] ?? m}`;
}

function etiqueta(p: InstallerPayment): string {
  return p.projectCode ? `${p.projectCode} · ${p.clientName}` : p.clientName;
}

/**
 * `payments` tiene que venir ya filtrado por instalador. Los que no tienen
 * instalador asignado se descartan: todavía no son de nadie.
 */
export function buildResumenInstalador(nombre: string, payments: InstallerPayment[]): string {
  const asignados = payments.filter((p) => p.installerId !== null);

  const enCurso = asignados
    .filter((p) => p.status !== "PAGADO")
    .sort((a, b) => a.fechaTrabajo.localeCompare(b.fechaTrabajo));

  // Las últimas tres saldadas, ordenadas por fecha de obra (más reciente primero).
  const ultimasPagadas = asignados
    .filter((p) => p.status === "PAGADO")
    .sort((a, b) => b.fechaTrabajo.localeCompare(a.fechaTrabajo))
    .slice(0, 3);

  const saldoTotal = enCurso.reduce((acc, p) => acc + p.saldoUsd, 0);

  const lineas: string[] = [];
  lineas.push(`*Pagos — ${nombre}*`);

  if (enCurso.length === 0 && ultimasPagadas.length === 0) {
    lineas.push("");
    lineas.push("No hay trabajos registrados.");
    return lineas.join("\n");
  }

  if (enCurso.length > 0) {
    lineas.push("");
    lineas.push(`⏳ *Pendiente: ${fmtUsd(saldoTotal)}*`);
    lineas.push("");
    lineas.push("*En curso y por cobrar*");
    for (const p of enCurso) {
      // Si ya se entregó algo, se aclara: el instalador tiene que poder atar el
      // adelanto que recibió con lo que falta.
      const detalle =
        p.pagadoUsd > 0
          ? `${fmtUsd(p.montoUsd)} — cobrado ${fmtUsd(p.pagadoUsd)}, falta ${fmtUsd(p.saldoUsd)}`
          : fmtUsd(p.montoUsd);
      lineas.push(`• ${etiqueta(p)} — ${detalle}`);
    }
  } else {
    lineas.push("");
    lineas.push("✅ *No queda nada pendiente.*");
  }

  if (ultimasPagadas.length > 0) {
    lineas.push("");
    lineas.push(ultimasPagadas.length === 1 ? "*Último trabajo saldado*" : "*Últimos trabajos saldados*");
    for (const p of ultimasPagadas) {
      const cuando = fmtDate(p.fechaTrabajo);
      lineas.push(`✅ ${etiqueta(p)} — ${fmtUsd(p.montoUsd)}${cuando ? ` (${cuando})` : ""}`);
    }
  }

  return lineas.join("\n");
}
