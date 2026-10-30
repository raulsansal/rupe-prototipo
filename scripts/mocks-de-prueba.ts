// ORÁCULOS DE PRUEBA: lo que las pantallas de la persona tutora mostraban cuando leían los mocks (antes de P2b). Solo lo usan los scripts de verificación, para comparar
// contra lo que sirve el almacén; NADA de src/ debe importar este archivo, salvo sus pruebas (*.test.ts).
import { CASOS_ORIGEN, type CasoOrigen } from "../src/mocks/casos";
import { AVISTAMIENTOS, type AvistamientoRecibido } from "../src/mocks/avistamientos";
import { CATEGORIAS_ESTADO_ANIMAL, CATEGORIAS_MOTIVO, ESTADOS_ANIMAL } from "../src/mocks/catalogos";
import { AVISTAMIENTOS_TABLERO, CASOS_TABLERO, HOY_FICTICIO, INICIO_DATOS, MOVIMIENTOS_CIERRE, TIPOS_CIERRE } from "../src/mocks/tablero";
import { ALCALDIAS, ESTADOS_CASO, FUERA_DE_LA_CIUDAD, type EstadoCaso } from "../src/mocks/tipos";

/** «Mis registros» de la persona tutora 1 (dueña de los casos de CASOS_ORIGEN): por fecha de creación descendente (HU 015). */
export const casosDeLaPersonaTutora = (): CasoOrigen[] => [...CASOS_ORIGEN].sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro));

/** Avistamientos visibles de un caso, por fecha descendente (HU 039). */
export const avistamientosDelCaso = (folio: string): AvistamientoRecibido[] => AVISTAMIENTOS.filter((a) => a.folio === folio).sort((a, b) => b.fechaHora.localeCompare(a.fechaHora));

/** Orden cronológico (más antiguo primero): numera los marcadores del mapa (HU 047 y 048). */
export const avistamientosCronologicos = (folio: string): AvistamientoRecibido[] => [...avistamientosDelCaso(folio)].reverse();

// ---- P6c: ORÁCULO CONGELADO del tablero y de Reportes (el cálculo del maquetado, por NOMBRE, sobre la base sintética). Es el que usaban las pantallas antes de P6c; ahora solo sirve para comprobar que
// el servidor da las mismas cifras. Las funciones se copiaron sin cambiar una línea de cálculo. ----
export { AVISTAMIENTOS_TABLERO, CASOS_TABLERO, HOY_FICTICIO, MOVIMIENTOS_CIERRE };
export const PERIODO_PREDETERMINADO_ORACULO = { desde: "2026-10-01", hasta: HOY_FICTICIO } as const;
const PESOS_ALCALDIA_ORACULO = ALCALDIAS.map((a) => a as string).concat(FUERA_DE_LA_CIUDAD);


export type PeriodoOraculo = { desde: string; hasta: string };
const dentro = (f: string, p: PeriodoOraculo) => f >= p.desde && f <= p.hasta;

export type BarraOraculo = { nombre: string; valor: number };
export type ResumenTableroOraculo = {
  casosActivos: number;
  casosLocalizados: number;
  totalCasos: number;
  totalAvistamientos: number;
  /** Días promedio entre el registro y la localización; null si no hay casos localizados en el periodo. */
  promedioLocalizacion: number | null;
  avistamientosOcultos: number;
  porMotivo: BarraOraculo[];
  porEstadoCaso: BarraOraculo[];
  cierres: BarraOraculo[];
  porEstadoAnimal: { categoria: string; barras: BarraOraculo[] }[];
  porAlcaldia: BarraOraculo[];
};

/** Todos los indicadores y gráficas del tablero para un periodo (HU 055). */
export function tableroOraculo(p: PeriodoOraculo): ResumenTableroOraculo {
  const casos = CASOS_TABLERO.filter((c) => dentro(c.fecha, p));
  const visibles = AVISTAMIENTOS_TABLERO.filter((a) => a.visible && dentro(a.fecha, p));
  const activos = ["Extraviado", "En búsqueda", "Avistamiento reportado", "En seguimiento"];
  // Localizados: «Localizado» o cerrados por cierre confirmado (HU 055, regla 5).
  const localizados = casos.filter((c) => c.estado === "Localizado" || c.cierre === "Cierre confirmado");
  const dias = localizados.map((c) => c.diasALocalizar).filter((x): x is number => x !== undefined);
  const estadosCaso: EstadoCaso[] = ["Extraviado", "En búsqueda", "Avistamiento reportado", "En seguimiento", "Localizado", "Cerrado"];
  return {
    casosActivos: casos.filter((c) => activos.includes(c.estado)).length,
    casosLocalizados: localizados.length,
    totalCasos: casos.length,
    totalAvistamientos: visibles.length,
    promedioLocalizacion: dias.length ? Math.round((dias.reduce((s, x) => s + x, 0) / dias.length) * 10) / 10 : null,
    avistamientosOcultos: AVISTAMIENTOS_TABLERO.filter((a) => !a.visible && dentro(a.fecha, p)).length,
    porMotivo: CATEGORIAS_MOTIVO.map((c) => ({ nombre: c.nombre, valor: casos.filter((x) => x.categoriaMotivo === c.id).length })),
    porEstadoCaso: estadosCaso.map((e) => ({ nombre: e, valor: casos.filter((c) => c.estado === e).length })),
    // Los cierres son movimientos con fecha (HU 055, regla 6): cuentan los que ocurren en el periodo, aunque el caso se haya registrado antes.
    cierres: TIPOS_CIERRE.map((t) => ({ nombre: t, valor: MOVIMIENTOS_CIERRE.filter((m) => m.tipo === t && dentro(m.fecha, p)).length })),
    porEstadoAnimal: [1, 2, 3, 4].map((id) => ({
      categoria: ["Integridad física y salud", "Contención y ubicación", "Conducta", "Identificación visible"][id - 1],
      // Un avistamiento con varios estados se cuenta en cada uno (HU 055, regla 4).
      barras: ESTADOS_ANIMAL.filter((e) => e.idCategoria === id).map((e) => ({ nombre: e.nombre.replace(/ \(.*\)$/, ""), valor: visibles.filter((a) => a.estados.includes(e.nombre)).length })),
    })),
    porAlcaldia: PESOS_ALCALDIA_ORACULO.map((a) => ({ nombre: a, valor: visibles.filter((v) => v.alcaldia === a).length })).filter((b) => b.valor > 0).sort((x, y) => y.valor - x.valor),
  };
}

/** Valida el periodo del selector; devuelve el mensaje de error o undefined. */
export function errorDePeriodoOraculo({ desde, hasta }: PeriodoOraculo): string | undefined {
  if (!desde || !hasta) return "Elige las dos fechas del periodo.";
  if (desde > hasta) return "«Desde» no puede ser posterior a «Hasta».";
  if (hasta > HOY_FICTICIO) return "El periodo no puede terminar después de hoy.";
  if (desde < INICIO_DATOS) return "No hay datos anteriores al 1 de junio de 2026.";
  return undefined;
}

export type FiltrosReporteOraculo = { desde: string; hasta: string; alcaldia: string; categoria: string; estadoCaso: string };
export const SIN_FILTROS_ORACULO: FiltrosReporteOraculo = { desde: "", hasta: "", alcaldia: "", categoria: "", estadoCaso: "" };

export type ErroresFiltrosOraculo = { desde?: string; hasta?: string };

/** El rango de fechas es obligatorio y «Desde» no puede ser posterior a «Hasta». */
export function erroresDeFiltrosOraculo({ desde, hasta }: FiltrosReporteOraculo): ErroresFiltrosOraculo {
  const e: ErroresFiltrosOraculo = {};
  if (!desde) e.desde = "El rango de fechas es obligatorio: indica «Desde».";
  if (!hasta) e.hasta = "El rango de fechas es obligatorio: indica «Hasta».";
  if (desde && hasta && desde > hasta) e.hasta = "«Hasta» no puede ser anterior a «Desde».";
  return e;
}

export type ResumenReporteOraculo = {
  totalCasos: number;
  casosLocalizados: number;
  /** Porcentaje con un decimal; null si no hay casos que cuenten (todos cancelados o deshabilitados). */
  tasaRecuperacion: number | null;
  avistamientosOcultos: number;
  porMotivo: BarraOraculo[];
  porEstadoCaso: BarraOraculo[];
  cierres: BarraOraculo[];
  porEstadoAnimal: { categoria: string; barras: BarraOraculo[] }[];
  porAlcaldiaAvistamiento: BarraOraculo[];
};

/** Reporte para los filtros dados, o null si no hay casos en el periodo y filtros (no se genera reporte ni exportación). */
export function reporteOraculo(f: FiltrosReporteOraculo): ResumenReporteOraculo | null {
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
