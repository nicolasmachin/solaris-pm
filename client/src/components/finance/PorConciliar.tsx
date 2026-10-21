import { useNavigate } from 'react-router-dom';
import { FaltaCargarBanco } from './FaltaCargarBanco';

// "Por conciliar": todo lo que falta que se encuentre en una sola lista. Por
// ahora, lo del banco que no está cargado en Voltia PM; "Cargar" lleva a
// Movimientos con el formulario completado.
export function PorConciliar() {
  const navigate = useNavigate();
  return (
    <FaltaCargarBanco
      onCargar={(p) => {
        const q = new URLSearchParams({
          new: '1', tipo: p.tipo, accountId: p.accountId, fecha: p.fecha,
          descripcion: p.descripcion, monto: p.monto, moneda: p.moneda,
        });
        navigate(`/finanzas/movimientos?${q.toString()}`);
      }}
    />
  );
}
