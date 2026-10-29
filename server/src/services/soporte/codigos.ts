// Qué quiere decir cada código de falla de los inversores Growatt, en criollo.
//
// Tomado de los manuales de las líneas MIN/MAX. Son los que más aparecen; el
// resto se muestra con el texto que manda Growatt. **A confirmar** con el
// manual de cada modelo si un caso no cierra: los números se comparten entre
// líneas pero no siempre con el mismo sentido.

export type CodigoFalla = { titulo: string; queHacer: string; llaveDelCliente?: boolean };

export const CODIGOS_GROWATT: Record<number, CodigoFalla> = {
  302: {
    titulo: "El inversor no ve la red de UTE (sin conexión de corriente alterna)",
    queHacer:
      "Casi siempre es la llave de microgeneración bajada o saltada en el tablero. Si está arriba, revisar el térmico y el diferencial del inversor, o un corte de UTE.",
    llaveDelCliente: true,
  },
  300: {
    titulo: "Tensión de la red fuera de rango",
    queHacer: "La red de UTE está alta o baja. Si se repite seguido, medir la tensión y revisar los parámetros de red.",
  },
  304: {
    titulo: "Frecuencia de la red fuera de rango",
    queHacer: "Problema de la red; si persiste, revisar parámetros de red.",
  },
  303: {
    titulo: "Problema con la tierra (PE)",
    queHacer: "Revisar la conexión a tierra del inversor.",
  },
  405: {
    titulo: "Falla del relé de salida del inversor",
    queHacer:
      "El inversor no logra conectarse a la red por el relé interno. Growatt indica reiniciarlo; si vuelve a aparecer, es garantía del inversor (caso Irigaray, MID 10KTL3-XL2, 22 al 26-oct-2026: tres días en falla con sol).",
  },
  203: {
    titulo: "Aislamiento bajo de los paneles",
    queHacer:
      "Un cable o conector de los paneles con fuga a tierra (humedad a la mañana). Suele arrancar tarde o cortar. Medir aislamiento por string.",
  },
  201: {
    titulo: "Corriente de fuga alta",
    queHacer: "Fuga a tierra en el lado de los paneles. Revisar cableado y conectores.",
  },
  202: {
    titulo: "Tensión de los paneles demasiado alta",
    queHacer: "Más paneles en serie de los que admite la entrada. Revisar el diseño del string.",
  },
};

export function describirCodigo(code: number | null, textoGrowatt: string | null): CodigoFalla | null {
  if (code == null || code === 0) return null;
  return CODIGOS_GROWATT[code] ?? { titulo: textoGrowatt ? `Falla del inversor: ${textoGrowatt}` : `Falla del inversor (código ${code})`, queHacer: "Ver el código en el manual del inversor." };
}
