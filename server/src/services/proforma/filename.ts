// Nombre del archivo de la proforma generada.
// Formato: "Proforma BBVA Voltia - {cliente} - V{n}.pdf".

export function sanitizeClientName(nombre: string): string {
  const clean = (nombre ?? "")
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean || "Cliente";
}

export function proformaPdfFilename(nombre: string, versionNumber: number): string {
  return `Proforma BBVA Voltia - ${sanitizeClientName(nombre)} - V${versionNumber}.pdf`;
}
