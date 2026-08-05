import guideHtml from "./viaje/sao-paulo-guide.html?raw";

// Módulo provisional: guía del viaje comercial a São Paulo (Intersolar 2026).
// Solo visible para Nicolás y Gabriel (ver useTravelViewer). La guía es un
// documento HTML autocontenido con su propio tema y scripts, así que se embebe
// en un iframe aislado para que no choque con los estilos de la app.
export function ViajeSaoPaulo() {
  return (
    <div className="-m-6 md:-m-6">
      <iframe
        title="Guía de viaje — Intersolar São Paulo 2026"
        srcDoc={guideHtml}
        className="block w-full border-0"
        style={{ height: "calc(100vh - 52px)", background: "#070B18" }}
      />
    </div>
  );
}
