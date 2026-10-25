// ADM-02 (HU 056): cálculo del reporte sobre los datos ficticios del tablero. Los reportes no se almacenan: se calculan al generarlos.
import { CATEGORIAS_ESTADO_ANIMAL, CATEGORIAS_MOTIVO, ESTADOS_ANIMAL } from "../mocks/catalogos";
import { AVISTAMIENTOS_TABLERO, CASOS_TABLERO, TIPOS_CIERRE, type Barra } from "../mocks/tablero";
import { ALCALDIAS, ESTADOS_CASO, FUERA_DE_LA_CIUDAD } from "../mocks/tipos";

export type FiltrosReporte = { desde: string; hasta: string; alcaldia: string; categoria: string; estadoCaso: string };
export const SIN_FILTROS: FiltrosReporte = { desde: "", hasta: "", alcaldia: "", categoria: "", estadoCaso: "" };

export type ErroresFiltros = { desde?: string; hasta?: string };

/** El rango de fechas es obligatorio y «Desde» no puede ser posterior a «Hasta». */
export function erroresDeFiltros({ desde, hasta }: FiltrosReporte): ErroresFiltros {
  const e: ErroresFiltros = {};
  if (!desde) e.desde = "El rango de fechas es obligatorio: indica «Desde».";
  if (!hasta) e.hasta = "El rango de fechas es obligatorio: indica «Hasta».";
  if (desde && hasta && desde > hasta) e.hasta = "«Hasta» no puede ser anterior a «Desde».";
  return e;
}

export type ResumenReporte = {
  totalCasos: number;
  casosLocalizados: number;
  /** Porcentaje con un decimal; null si no hay casos que cuenten (todos cancelados o deshabilitados). */
  tasaRecuperacion: number | null;
  avistamientosOcultos: number;
  porMotivo: Barra[];
  porEstadoCaso: Barra[];
  cierres: Barra[];
  porEstadoAnimal: { categoria: string; barras: Barra[] }[];
  porAlcaldiaAvistamiento: Barra[];
};

/** Reporte para los filtros dados, o null si no hay casos en el periodo y filtros (no se genera reporte ni exportación). */
export function generarReporte(f: FiltrosReporte): ResumenReporte | null {
  const idx = CASOS_TABLERO.flatMap((c, i) => (c.fecha >= f.desde && c.fecha <= f.hasta && (!f.alcaldia || c.alcaldia === f.alcaldia) && (!f.categoria || String(c.categoriaMotivo) === f.categoria) && (!f.estadoCaso || c.estado === f.estadoCaso) ? [i] : []));
  if (idx.length === 0) return null;
  const casos = idx.map((i) => CASOS_TABLERO[i]);
  const propios = new Set(idx);
  // Avistamientos de los casos que cumplen los filtros (regla 4); los visibles se cuentan, los ocultos van aparte (regla 7).
  const delos = AVISTAMIENTOS_TABLERO.filter((a) => propios.has(a.casoIdx));
  const visibles = delos.filter((a) => a.visible);
  const localizados = casos.filter((c) => c.estado === "Localizado" || c.cierre === "Cierre confirmado");
  // Regla 6: la tasa no cuenta los casos cancelados ni deshabilitados.
  const contables = casos.filter((c) => c.cierre !== "Cancelación" && c.cierre !== "Deshabilitación");
  return {
    totalCasos: casos.length,
    casosLocalizados: localizados.length,
    tasaRecuperacion: contables.length ? Math.round((localizados.length / contables.length) * 1000) / 10 : null,
    avistamientosOcultos: delos.length - visibles.length,
    porMotivo: CATEGORIAS_MOTIVO.map((m) => ({ nombre: m.nombre, valor: casos.filter((c) => c.categoriaMotivo === m.id).length })),
    porEstadoCaso: ESTADOS_CASO.map((e) => ({ nombre: e, valor: casos.filter((c) => c.estado === e).length })),
    cierres: TIPOS_CIERRE.map((t) => ({ nombre: t, valor: casos.filter((c) => c.cierre === t).length })),
    porEstadoAnimal: CATEGORIAS_ESTADO_ANIMAL.map((cat) => ({
      categoria: cat.nombre,
      // Un avistamiento con varios estados se cuenta en cada uno.
      barras: ESTADOS_ANIMAL.filter((e) => e.idCategoria === cat.id).map((e) => ({ nombre: e.nombre.replace(/ \(.*\)$/, ""), valor: visibles.filter((a) => a.estados.includes(e.nombre)).length })),
    })),
    // Alcaldía del propio avistamiento (no la del caso), con «Fuera de la Ciudad de México».
    porAlcaldiaAvistamiento: [...ALCALDIAS, FUERA_DE_LA_CIUDAD].map((a) => ({ nombre: a, valor: visibles.filter((v) => v.alcaldia === a).length })).filter((b) => b.valor > 0).sort((x, y) => y.valor - x.valor),
  };
}
