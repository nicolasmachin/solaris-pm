// Inversores distintos en una misma propuesta.
//
// El sistema tiene dos formas de decir qué inversores lleva:
//
//   - La clásica: `potenciaInversorKw` + `marcaInversor` + `cantidadInversores`.
//     Todos los inversores son iguales. Es lo que tienen todas las versiones
//     publicadas antes de esta funcionalidad.
//   - La lista `sistema.inversores`, con marca, potencia y (opcional) paneles de
//     cada uno. Recién con DOS o más elementos la propuesta pasa a "inversores
//     distintos". Con 0 o 1 se ignora y manda la forma clásica: así ninguna
//     versión ya emitida puede cambiar de precio.
//
// En modo distintos los tres campos clásicos quedan DERIVADOS de la lista
// (`sincronizarSistemaInversores`) solo para que lo que los lee aguas abajo
// —contrato, proforma, conector del chat, versiones viejas del cliente— tenga
// algo coherente: cantidad = largo de la lista, potencia = SUMA de kW (potencia
// total de inversores), marca = marcas unidas con " + ".
//
// Funciones puras, sin I/O. El cliente tiene una copia del reparto en
// client/src/lib/inversores.ts para mostrar el valor automático mientras se
// escribe; mantenerlas en sincronía.

export interface InversorItem {
  marca: string;
  potenciaKw: number;
  /** Paneles que lleva este inversor. Ausente = se reparte solo. */
  paneles?: number;
}

export interface InversorResuelto {
  marca: string;
  potenciaKw: number;
  paneles: number;
  /** true si los paneles los cargó el usuario; false si salen del reparto. */
  panelesManual: boolean;
}

interface SistemaConInversores {
  cantidadPaneles?: number;
  potenciaInversorKw?: number;
  cantidadInversores?: number;
  marcaInversor?: string;
  inversores?: Partial<InversorItem>[];
}

/** La lista de inversores si la propuesta está en modo distintos (≥2), si no null. */
export function listaInversoresDistintos(
  sistema: SistemaConInversores | undefined | null,
): InversorItem[] | null {
  const lista = sistema?.inversores;
  if (!Array.isArray(lista) || lista.length < 2) return null;
  return lista.map((i) => ({
    marca: typeof i.marca === "string" ? i.marca : "",
    potenciaKw: typeof i.potenciaKw === "number" && Number.isFinite(i.potenciaKw) ? i.potenciaKw : 0,
    ...(typeof i.paneles === "number" && Number.isFinite(i.paneles) && { paneles: i.paneles }),
  }));
}

/**
 * Reparte `total` paneles en proporción a `pesos` (las potencias), con el
 * método de los mayores restos: cada uno recibe la parte entera de su cuota y
 * los paneles que sobran van, de a uno, a los que tuvieron el resto más grande.
 * La suma da SIEMPRE exacto `total`.
 *
 * Desempates (para que el resultado sea estable): resto más grande, después
 * potencia más grande, después el que está primero en la lista.
 *
 * Si todos los pesos son 0 (potencias sin cargar), reparte en partes iguales.
 */
export function repartirProporcional(total: number, pesos: number[]): number[] {
  const n = pesos.length;
  if (n === 0) return [];
  const t = Math.max(0, Math.trunc(total));
  const limpios = pesos.map((p) => (Number.isFinite(p) && p > 0 ? p : 0));
  const suma = limpios.reduce((a, b) => a + b, 0);
  const base = suma > 0 ? limpios : limpios.map(() => 1);
  const sumaBase = suma > 0 ? suma : n;

  const cuotas = base.map((p) => (t * p) / sumaBase);
  const enteros = cuotas.map((c) => Math.floor(c));
  let sobran = t - enteros.reduce((a, b) => a + b, 0);

  const orden = cuotas
    .map((c, i) => ({ i, resto: c - Math.floor(c), peso: base[i] }))
    .sort((a, b) => b.resto - a.resto || b.peso - a.peso || a.i - b.i);
  for (let k = 0; sobran > 0; k = (k + 1) % n, sobran--) enteros[orden[k].i] += 1;
  return enteros;
}

/**
 * Paneles de cada inversor. Los que el usuario cargó a mano se respetan tal
 * cual; los que no, se llevan lo que queda del total repartido en proporción a
 * su potencia. Si lo cargado a mano ya supera el total, los automáticos quedan
 * en 0 (y `panelesInversoresDescuadre` lo marca).
 */
export function resolverPanelesInversores(
  cantidadPaneles: number,
  inversores: InversorItem[],
): InversorResuelto[] {
  const manual = inversores.map((i) =>
    typeof i.paneles === "number" && Number.isFinite(i.paneles) ? Math.max(0, Math.trunc(i.paneles)) : null,
  );
  const sumaManual = manual.reduce<number>((a, m) => a + (m ?? 0), 0);
  const autos = inversores.map((_, idx) => idx).filter((idx) => manual[idx] === null);
  const restante = Math.max(0, Math.trunc(cantidadPaneles) - sumaManual);
  const reparto = repartirProporcional(
    restante,
    autos.map((idx) => inversores[idx].potenciaKw),
  );

  return inversores.map((inv, idx) => {
    const m = manual[idx];
    const pos = autos.indexOf(idx);
    return {
      marca: inv.marca,
      potenciaKw: inv.potenciaKw,
      paneles: m ?? reparto[pos] ?? 0,
      panelesManual: m !== null,
    };
  });
}

/**
 * Diferencia entre los paneles asignados a los inversores y los del sistema
 * (0 = cuadra). Solo puede ser distinta de 0 cuando se cargaron paneles a mano:
 * el reparto automático siempre completa el total.
 */
export function panelesInversoresDescuadre(
  cantidadPaneles: number,
  inversores: InversorItem[],
): number {
  const asignados = resolverPanelesInversores(cantidadPaneles, inversores).reduce(
    (a, i) => a + i.paneles,
    0,
  );
  return asignados - Math.trunc(cantidadPaneles);
}

function fmtKw(kw: number): string {
  // Formato uruguayo: coma decimal, sin ceros de más ("8", "6,5").
  return String(Math.round(kw * 100) / 100).replace(".", ",");
}

/** "Growatt + Huawei" (sin repetir marcas, en el orden en que aparecen). */
export function marcasInversores(inversores: InversorItem[]): string {
  const vistas: string[] = [];
  for (const i of inversores) {
    const m = i.marca.trim();
    if (m && !vistas.some((v) => v.toLowerCase() === m.toLowerCase())) vistas.push(m);
  }
  return vistas.join(" + ");
}

/**
 * "1 Growatt de 8 kW + 1 Huawei de 6 kW". Agrupa los iguales (misma marca y
 * potencia): "2 Growatt de 6 kW + 1 Huawei de 8 kW". Respeta el orden en que
 * aparecen en la lista.
 */
export function describirInversores(inversores: InversorItem[]): string {
  const grupos: { marca: string; potenciaKw: number; n: number }[] = [];
  for (const i of inversores) {
    const marca = i.marca.trim();
    const g = grupos.find(
      (x) => x.marca.toLowerCase() === marca.toLowerCase() && x.potenciaKw === i.potenciaKw,
    );
    if (g) g.n += 1;
    else grupos.push({ marca, potenciaKw: i.potenciaKw, n: 1 });
  }
  return grupos
    .map((g) => `${g.n} ${g.marca ? `${g.marca} ` : ""}de ${fmtKw(g.potenciaKw)} kW`)
    .join(" + ");
}

/**
 * Deja los campos clásicos coherentes con la lista. Sin lista (o con menos de
 * dos) devuelve el sistema tal cual. No muta.
 */
export function sincronizarSistemaInversores<T extends SistemaConInversores>(sistema: T): T {
  const lista = listaInversoresDistintos(sistema);
  if (!lista) return sistema;
  const suma = lista.reduce((a, i) => a + i.potenciaKw, 0);
  return {
    ...sistema,
    cantidadInversores: lista.length,
    potenciaInversorKw: Math.round(suma * 1000) / 1000,
    marcaInversor: marcasInversores(lista),
  };
}
