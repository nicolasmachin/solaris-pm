import type { EstadoPlan } from "../../api/planGranizo.api";
import { ESTADO_PLAN_AYUDA, ESTADO_PLAN_LABEL, ESTADO_PLAN_TONO, TONO_CLASES } from "./estado";

export function EstadoPlanChip({ estado, texto }: { estado: EstadoPlan; texto?: string }) {
  return (
    <span
      title={ESTADO_PLAN_AYUDA[estado]}
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONO_CLASES[ESTADO_PLAN_TONO[estado]]}`}
    >
      {texto ?? ESTADO_PLAN_LABEL[estado]}
    </span>
  );
}
