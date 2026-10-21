import { ParaHacerHoy } from '../components/finance/ParaHacerHoy';
import { PosicionFinanciera } from '../components/finance/PosicionFinanciera';
import { PorConciliar } from '../components/finance/PorConciliar';
import { FinancePendientesTab } from './FinancePendientesTab';

// Inicio de Finanzas: lo que hay que hacer hoy (todas las pantallas juntas),
// cómo estamos (posición), lo que falta conciliar y lo que hay que pagar y
// cobrar (Pendientes). Es la entrada por defecto del módulo.
export function FinanceInicioTab() {
  return (
    <div className="space-y-6">
      <ParaHacerHoy />
      <PosicionFinanciera />
      <PorConciliar />
      <FinancePendientesTab />
    </div>
  );
}
