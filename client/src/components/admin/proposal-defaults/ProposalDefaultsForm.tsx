import type {
  FlaggedValue,
  NestedFlagged,
  ProposalDefaultsData,
} from "../../../types/proposals-v2";
import { isFlaggedValue } from "../../../types/proposals-v2";
import { ElectricaMultiplierInput } from "./ElectricaMultiplierInput";
import { SeasonalFactorsInput } from "./SeasonalFactorsInput";
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
  rendimientoAnualKwhPorKwp: "Rendimiento anual (kWh/kWp)",
  metrosCuadradosPorPanel: "Metros cuadrados por panel (m²)",
  marcaPanelesDefault: "Marca paneles por defecto",
  potenciaPanelWDefault: "Potencia por panel por defecto (W)",
  marcaInversorDefault: "Marca inversor por defecto",
  costoFijoTotalPesosMes: "Costo fijo total ($/mes)",
  negociosPromedioMes: "Negocios promedio por mes",
  costoFletePorKm: "Flete ($/km)",
  costoNaftaTotalPesos: "Nafta total ($)",
  costoAlojamientoPesos: "Alojamiento ($)",
  costoViaticosPesos: "Viáticos ($)",
  costoOtrosPesos: "Otros costos variables ($)",
  tarifaCatAPorHora: "Tarifa Electricista ($/h)",
  tarifaCatCPorHora: "Tarifa Capataz ($/h)",
  tarifaCatDPorHora: "Tarifa CAT D ($/h)",
  horasManoDeObraPorInstalacion: "Horas por instalación",
  comisionVendedorPorcentaje: "Comisión vendedor (%)",
  comisionBbvaPorcentaje: "Comisión BBVA (%)",
  factorAhorroSimple: "Factor ahorro tarifa Simple",
  factorAhorroDoble: "Factor ahorro tarifa Doble",
  factorAhorroTriple: "Factor ahorro tarifa Triple",
  cotizacionDolarDefault: "Cotización dólar por defecto",
  markupPorcentajeDefault: "Markup por defecto (%)",
  distanciaInstalacionKmDefault: "Distancia instalación por defecto (km)",
  bbva24mInteresUI: "BBVA 24 cuotas — tasa anual (PMT)",
  bbva36mInteresUI: "BBVA 36 cuotas — tasa anual (PMT)",
  bbva60mInteresUI: "BBVA 60 cuotas — tasa anual (PMT)",
  cotizacionUI: "Cotización UI (Unidad Indexada)",
  bbva24mGastosAdminCapital: "BBVA 24 cuotas — gastos admin (% capital)",
  bbva36mGastosAdminCapital: "BBVA 36 cuotas — gastos admin (% capital)",
  bbva60mGastosAdminCapital: "BBVA 60 cuotas — gastos admin (% capital)",
  bbva24mFactorCuota: "BBVA 24 cuotas — factor cuota",
  bbva36mFactorCuota: "BBVA 36 cuotas — factor cuota",
  bbva60mFactorCuota: "BBVA 60 cuotas — factor cuota",
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
const SECTIONS: { title: string; keys?: string[]; nested?: string; custom?: "seasonal" | "electrica" }[] = [
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
  {
    title: "Instalación eléctrica — multiplicador por tamaño",
    custom: "electrica",
  },
  {
    title: "Equipos por defecto",
    keys: ["marcaPanelesDefault", "potenciaPanelWDefault", "marcaInversorDefault"],
  },
  {
    title: "Generación y dimensionamiento",
    keys: ["rendimientoAnualKwhPorKwp", "metrosCuadradosPorPanel"],
    custom: "seasonal",
  },
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
      "tarifaCatAPorHora",
      "tarifaCatCPorHora",
      "tarifaCatDPorHora",
      "horasManoDeObraPorInstalacion",
    ],
  },
  { title: "Comisiones", keys: ["comisionVendedorPorcentaje", "comisionBbvaPorcentaje"] },
  {
    title: "Factor de ahorro por tarifa",
    keys: ["factorAhorroSimple", "factorAhorroDoble", "factorAhorroTriple"],
  },
  { title: "Plazos de entrega", nested: "plazos" },
  {
    title: "Financiación BBVA",
    keys: [
      "bbva24mInteresUI",
      "bbva36mInteresUI",
      "bbva60mInteresUI",
      "cotizacionUI",
      "bbva24mGastosAdminCapital",
      "bbva36mGastosAdminCapital",
      "bbva60mGastosAdminCapital",
      "bbva24mFactorCuota",
      "bbva36mFactorCuota",
      "bbva60mFactorCuota",
    ],
  },
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

// Sufijo / rango visual por variable (solo donde aporta claridad).
const FIELD_META: Record<string, { suffix?: string; min?: number; max?: number }> = {
  markupPorcentajeDefault: { suffix: "%", min: 0, max: 100 },
  potenciaPanelWDefault: { suffix: "W", min: 100, max: 1000 },
};

export function ProposalDefaultsForm({
  data,
  onChange,
  disabled,
}: {
  data: ProposalDefaultsData;
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
                      suffix={FIELD_META[key]?.suffix}
                      min={FIELD_META[key]?.min}
                      max={FIELD_META[key]?.max}
                      onChange={(next) => updateVar(key, next)}
                    />
                  );
                })}
            {section.custom === "seasonal" &&
            data.factoresGeneracionMensual &&
            isFlaggedValue(data.factoresGeneracionMensual) ? (
              <SeasonalFactorsInput
                entry={data.factoresGeneracionMensual}
                disabled={disabled}
                onChange={(next) => updateVar("factoresGeneracionMensual", next)}
              />
            ) : null}
            {section.custom === "electrica" &&
            data.multiplicadorElectricaEscalones &&
            isFlaggedValue(data.multiplicadorElectricaEscalones) ? (
              <ElectricaMultiplierInput
                entry={data.multiplicadorElectricaEscalones}
                disabled={disabled}
                onChange={(next) => updateVar("multiplicadorElectricaEscalones", next)}
              />
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}
