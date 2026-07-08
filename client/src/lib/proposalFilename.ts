// Nombre del archivo descargado de una propuesta comercial v2.
// Formato pedido: "Propuesta Comercial Voltia - {Nombre del cliente} - V{n}[ - Resumen].pdf"
// Conserva el nombre completo del cliente y los espacios; solo saca los
// caracteres inválidos de nombre de archivo (/ \ : * ? " < > |).

function sanitizeNombre(name: string | null | undefined): string {
  const clean = (name ?? "")
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean || "Cliente";
}

export function proposalPdfFilename(
  clientName: string | null | undefined,
  versionNumber: number | null | undefined,
  kind: "full" | "summary",
): string {
  const cliente = sanitizeNombre(clientName);
  const version = versionNumber != null ? ` - V${versionNumber}` : "";
  const resumen = kind === "summary" ? " - Resumen" : "";
  return `Propuesta Comercial Voltia - ${cliente}${version}${resumen}.pdf`;
}

// Variante para el Excel de entrada de una propuesta (mismo esquema de nombre).
export function proposalExcelFilename(
  clientName: string | null | undefined,
  versionNumber: number | null | undefined,
): string {
  const cliente = sanitizeNombre(clientName);
  const version = versionNumber != null ? ` - V${versionNumber}` : "";
  return `Propuesta Comercial Voltia - ${cliente}${version}.xlsx`;
}
