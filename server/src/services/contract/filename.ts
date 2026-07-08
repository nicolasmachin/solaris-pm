// Nombre del archivo del contrato generado.
// Formato: "Contrato Voltia - {cliente} - V{n}.pdf". Conserva nombre completo y
// espacios; sólo saca caracteres inválidos de filesystem.

export function sanitizeClientName(nombre: string): string {
  const clean = (nombre ?? "")
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean || "Cliente";
}

export function contractPdfFilename(nombre: string, versionNumber: number): string {
  return `Contrato Voltia - ${sanitizeClientName(nombre)} - V${versionNumber}.pdf`;
}
