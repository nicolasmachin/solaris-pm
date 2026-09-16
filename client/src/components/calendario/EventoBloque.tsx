import type { CSSProperties } from "react";

import { TIPO_CALENDARIO_META, type AgendaEvento } from "../../api/agenda.api";

/** Gris de "ya pasó / completado", el mismo que usan las obras terminadas. */
const COMPLETADO_COLOR = "#9AA0A6";

interface Props {
  evento: AgendaEvento;
  /** Alto del carril. Manda qué se puede dibujar adentro. */
  slotHeight: number;
  /** Ancho de la celda del día, para decidir si entra el texto. */
  cellWidth: number;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * Un evento de agenda en la grilla del mes.
 *
 * El fondo sigue siendo el color del EQUIPO, igual que las obras: el equipo ya
 * tiene ese código aprendido. El TIPO se marca con una barra vertical de 3 px a
 * la izquierda, que es la única señal que entra sin robarle ancho al nombre del
 * cliente (en celular cada día mide ~48 px) ni alto al carril.
 *
 * El ícono aparece solo cuando hay lugar, con el mismo criterio escalonado que
 * ya usa el texto de las obras.
 */
export function EventoBloque({ evento, slotHeight, cellWidth, isSelected, onClick }: Props) {
  const meta = TIPO_CALENDARIO_META[evento.tipo];
  const completado = evento.completadoEn !== null;
  const fondo = completado ? COMPLETADO_COLOR : evento.teamColor;

  // Escalonado por espacio, mismo criterio que ya usa el texto de las obras.
  // En la vista Mes el carril mide 22 px, así que el ícono siempre entra; lo que
  // manda es el ancho del día, que en celular ronda los 48 px.
  //   ancho >= 56  → ícono + nombre
  //   ancho >= 26  → solo el ícono (dice el tipo sin recortar el nombre a 4 letras)
  //   menos        → solo la barra de color
  const soloIcono = cellWidth < 56;
  const hayLugarParaIcono = slotHeight >= 14 && cellWidth >= 26;
  const hayLugarParaTexto = slotHeight >= 14 && !soloIcono;

  const style: CSSProperties = {
    height: slotHeight,
    background: fondo,
    borderRadius: 4,
    // La barra del tipo: se dibuja con un borde izquierdo para que no ocupe un
    // nodo aparte ni se corra con el padding del texto.
    borderLeft: `3px solid ${completado ? COMPLETADO_COLOR : meta.color}`,
    outline: isSelected ? "2px solid var(--color-accent)" : undefined,
    outlineOffset: isSelected ? "-2px" : undefined,
    display: "flex",
    alignItems: "center",
    justifyContent: soloIcono ? "center" : "flex-start",
    gap: 3,
    paddingLeft: soloIcono ? 0 : 4,
    paddingRight: 3,
    overflow: "hidden",
    cursor: "pointer",
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={style}
      title={`${meta.corto}: ${evento.titulo}${evento.teamName ? ` — ${evento.teamName}` : ""}`}
    >
      {hayLugarParaIcono && (
        <span style={{ fontSize: soloIcono ? 11 : 9, lineHeight: 1 }} aria-hidden>
          {meta.icono}
        </span>
      )}
      {hayLugarParaTexto && (
        <span
          className="truncate"
          style={{ fontSize: 10, lineHeight: 1, color: "#0C3B6E", fontWeight: 500 }}
        >
          {evento.titulo}
        </span>
      )}
    </div>
  );
}
