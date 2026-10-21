import { PosicionFinanciera } from '../components/finance/PosicionFinanciera';
import { PorConciliar } from '../components/finance/PorConciliar';
import { FinancePendientesTab } from './FinancePendientesTab';

// Inicio de Finanzas: cómo estamos (posición), lo que falta conciliar y lo que
// hay que pagar y cobrar (Pendientes). Es la entrada por defecto del módulo.
export function FinanceInicioTab() {
  return (
    <div className="space-y-6">
      <PosicionFinanciera />
      <PorConciliar />
      <FinancePendientesTab />
    </div>
  );
}
