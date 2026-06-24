import type {
  CoverOverlay,
  FlaggedValue,
  NestedFlagged,
  ProposalDefaultsData,
} from "../../../types/proposals-v2";
import { isFlaggedValue } from "../../../types/proposals-v2";
import { VariableInput } from "./VariableInput";

// Etiquetas legibles por variable.
const LABELS: Record<string, string> = {
  precioPanelUsdSinIva: "Panel (USD sin IVA)",
  precioEstructuraUsdSinIva: "Estructura (USD sin IVA)",
  precioElectricaMonoUsdSinIva: "Eléctrica monofásica (USD sin IVA)",
  precioElectricaTriUsdSinIva: "Eléctrica trifásica (USD sin IVA)",
  precioInversorMonoSub7Usd: "Inversor mono <7 kW (USD)",
  precioInversorMonoSup7Usd: "Inversor mono ≥7 kW (USD)",
  precioInversorTriSub11Usd: "Inversor tri <11 kW (USD)",
  precioInversorTri12Usd: "Inversor tri (paneles <13) (USD)",
  precioInversorTri21Usd: "Inversor tri <21 kW (USD)",
  precioInversorTri31Usd: "Inversor tri <31 kW (USD)",
  precioInversorTri51Usd: "Inversor tri <51 kW (USD)",
  precioInversorTriMas: "Inversor tri ≥51 kW (USD)",
  precioMeterMonoUsd: "Meter monofásico (USD)",
  precioMeterTriUsd: "Meter trifásico (USD)",
  marcaPanelesDefault: "Marca paneles por defecto",
  marcaInversorDefault: "Marca inversor por defecto",
  costoFijoTotalPesosMes: "Costo fijo total ($/mes)",
  negociosPromedioMes: "Negocios promedio por mes",
  costoFletePorKm: "Flete ($/km)",
  costoNaftaTotalPesos: "Nafta total ($)",
  costoAlojamientoPesos: "Alojamiento ($)",
  costoViaticosPesos: "Viáticos ($)",
  costoOtrosPesos: "Otros costos variables ($)",
  horasCatAPorKwp: "Horas CAT A por kWp",
  horasCatCPorKwp: "Horas CAT C por kWp",
  horasCatDPorKwp: "Horas CAT D por kWp",
  tarifaCatAPorHora: "Tarifa CAT A ($/h)",
  tarifaCatCPorHora: "Tarifa CAT C ($/h)",
  tarifaCatDPorHora: "Tarifa CAT D ($/h)",
  margenManoDeObra: "Margen mano de obra (multiplicador)",
  comisionVendedorPorcentaje: "Comisión vendedor (%)",
  comisionBbvaPorcentaje: "Comisión BBVA (%)",
  cotizacionDolarDefault: "Cotización dólar por defecto",
  markupPorcentajeDefault: "Markup por defecto (%)",
  distanciaInstalacionKmDefault: "Distancia instalación por defecto (km)",
  bbva24mInteresUI: "BBVA 24 cuotas — interés (UI)",
  bbva36mInteresUI: "BBVA 36 cuotas — interés (UI)",
  bbva60mInteresUI: "BBVA 60 cuotas — interés (UI)",
  precioSeguroGranizoUsdPorPanelAno: "Seguro granizo (USD/panel/año)",
  // plazos (nested)
  diasPagoInicial: "Días pago inicial",
  diasCoordinacion: "Días coordinación",
  diasInstalacion: "Días instalación",
  diasHabilitacion: "Días habilitación UTE",
  textoFirma: "Texto: firma",
  textoCoordinacion: "Texto: coordinación",
  textoInstalacion: "Texto: instalación",
  textoHabilitacion: "Texto: habilitación",
};

// Secciones colapsables y qué claves van en cada una.
const SECTIONS: { title: string; keys?: string[]; nested?: string }[] = [
  {
    title: "Precios de equipamiento",
    keys: [
      "precioPanelUsdSinIva",
      "precioEstructuraUsdSinIva",
      "precioElectricaMonoUsdSinIva",
      "precioElectricaTriUsdSinIva",
      "precioInversorMonoSub7Usd",
      "precioInversorMonoSup7Usd",
      "precioInversorTriSub11Usd",
      "precioInversorTri12Usd",
      "precioInversorTri21Usd",
      "precioInversorTri31Usd",
      "precioInversorTri51Usd",
      "precioInversorTriMas",
      "precioMeterMonoUsd",
      "precioMeterTriUsd",
    ],
  },
  { title: "Marcas por defecto", keys: ["marcaPanelesDefault", "marcaInversorDefault"] },
  {
    title: "Costos del negocio",
    keys: [
      "costoFijoTotalPesosMes",
      "negociosPromedioMes",
      "costoFletePorKm",
      "costoNaftaTotalPesos",
      "costoAlojamientoPesos",
      "costoViaticosPesos",
      "costoOtrosPesos",
    ],
  },
  {
    title: "Mano de obra",
    keys: [
      "horasCatAPorKwp",
      "horasCatCPorKwp",
      "horasCatDPorKwp",
      "tarifaCatAPorHora",
      "tarifaCatCPorHora",
      "tarifaCatDPorHora",
      "margenManoDeObra",
    ],
  },
  { title: "Comisiones", keys: ["comisionVendedorPorcentaje", "comisionBbvaPorcentaje"] },
  { title: "Plazos de entrega", nested: "plazos" },
  { title: "Tasas BBVA", keys: ["bbva24mInteresUI", "bbva36mInteresUI", "bbva60mInteresUI"] },
  {
    title: "Otros",
    keys: [
      "cotizacionDolarDefault",
      "markupPorcentajeDefault",
      "distanciaInstalacionKmDefault",
      "precioSeguroGranizoUsdPorPanelAno",
    ],
  },
];

function labelFor(key: string): string {
  return LABELS[key] ?? key;
}

export function ProposalDefaultsForm({
  data,
  coverOverlay,
  onChange,
  disabled,
}: {
  data: ProposalDefaultsData;
  coverOverlay: CoverOverlay | null;
  onChange: (next: ProposalDefaultsData) => void;
  disabled: boolean;
}) {
  function updateVar(key: string, entry: FlaggedValue) {
    onChange({ ...data, [key]: entry });
  }
  function updateNested(parent: string, child: string, entry: FlaggedValue) {
    const node = (data[parent] ?? {}) as NestedFlagged;
    onChange({ ...data, [parent]: { ...node, [child]: entry } });
  }

  return (
    <div className="space-y-3">
      {/* Tapa: placeholder hasta Fase D */}
      <details className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4" open>
        <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text-primary)]">Tapa</summary>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          Próximamente: upload de tapa PDF en Fase D. Coordenadas del overlay (solo lectura por ahora):
        </p>
        {coverOverlay ? (
          <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-[var(--color-text-secondary)]">
            <li>Nombre: x={coverOverlay.clientName.x}, y={coverOverlay.clientName.y}, size={coverOverlay.clientName.fontSize}</li>
            <li>Ciudad: x={coverOverlay.city.x}, y={coverOverlay.city.y}, size={coverOverlay.city.fontSize}</li>
            <li>Fecha: x={coverOverlay.date.x}, y={coverOverlay.date.y}, size={coverOverlay.date.fontSize}</li>
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">Sin coordenadas configuradas.</p>
        )}
      </details>

      {SECTIONS.map((section) => (
        <details
          key={section.title}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4"
        >
          <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text-primary)]">
            {section.title}
          </summary>
          <div className="mt-2 divide-y divide-[var(--color-border)]/60">
            {section.nested
              ? Object.entries((data[section.nested] ?? {}) as NestedFlagged).map(([childKey, entry]) => (
                  <VariableInput
                    key={childKey}
                    label={labelFor(childKey)}
                    entry={entry}
                    disabled={disabled}
                    onChange={(next) => updateNested(section.nested!, childKey, next)}
                  />
                ))
              : section.keys?.map((key) => {
                  const entry = data[key];
                  if (!entry || !isFlaggedValue(entry)) return null;
                  return (
                    <VariableInput
                      key={key}
                      label={labelFor(key)}
                      entry={entry}
                      disabled={disabled}
                      onChange={(next) => updateVar(key, next)}
                    />
                  );
                })}
          </div>
        </details>
      ))}
    </div>
  );
}
