// Tablero (HU 055) y reporte estadístico (HU 056): reglas PURAS sobre «hechos» (casos y avistamientos ya reducidos a lo que se cuenta, con identificadores de catálogo y días de la Ciudad de México).
// La base histórica sembrada y la capa real (lo creado después de la siembra) se convierten a los MISMOS hechos, así que hay una sola función de cálculo. Sin acceso al almacén ni a Next.
import { ESTADOS_ACTIVOS, ESTADOS_CASO, type EstadoCaso } from "../../mocks/tipos";
import { esDiaReal } from "./filtrosAvistamientos";

export const INICIO_DE_DATOS = "2026-06-01";
const INICIO_DEL_PERIODO_PREDETERMINADO = "2026-10-01";
export const TIPOS_DE_CIERRE = ["Cierre confirmado", "Cancelación", "Deshabilitación"] as const;
export type TipoDeCierre = (typeof TIPOS_DE_CIERRE)[number];

export type HechoCaso = {
  /** `b…` base histórica, `r…` caso nuevo, `s…` caso sembrado (solo sirve para atribuir avistamientos nuevos al filtrar). */
  clave: string;
  /** false = caso sembrado: no suma como «caso» en ninguna cifra. */
  cuenta: boolean;
  /** Día (AAAA-MM-DD, Ciudad de México) del registro. */
  dia: string;
  idAlcaldia: number;
  idCategoriaMotivo: number;
  estado: EstadoCaso;
  /** Cierre VIGENTE: solo si el caso está hoy «Cerrado». Una restauración lo quita. `dia` es el del movimiento de cierre. */
  cierre?: { tipo: TipoDeCierre; dia: string };
  /** Días entre el registro y la localización vigente; solo en casos que cuentan como localizados. */
  diasALocalizar?: number;
};
export type HechoAvistamiento = { dia: string; idAlcaldia: number; idsEstadoAnimal: readonly number[]; visible: boolean; claveCaso: string };
export type Hechos = { casos: readonly HechoCaso[]; avistamientos: readonly HechoAvistamiento[] };

export type Periodo = { desde: string; hasta: string };
const dentro = (dia: string, p: Periodo) => dia >= p.desde && dia <= p.hasta;
const sumar = (r: Record<number, number>, k: number) => void (r[k] = (r[k] ?? 0) + 1);

/** Del 1 de octubre de 2026 (o de hoy, si hoy es anterior) hasta hoy. */
export const periodoPredeterminado = (hoy: string): Periodo => ({ desde: hoy < INICIO_DEL_PERIODO_PREDETERMINADO ? hoy : INICIO_DEL_PERIODO_PREDETERMINADO, hasta: hoy });

export type ErroresDePeriodo = { desde?: string; hasta?: string };
/** Periodo del tablero: ambas fechas reales, «Desde» no posterior a «Hasta», sin pasar de hoy ni antes del inicio de los datos. */
export function erroresDePeriodo({ desde, hasta }: Periodo, hoy: string): ErroresDePeriodo {
  const e: ErroresDePeriodo = {};
  if (!esDiaReal(desde)) e.desde = "Elige una fecha válida.";
  if (!esDiaReal(hasta)) e.hasta = "Elige una fecha válida.";
  if (e.desde || e.hasta) return e;
  if (desde > hasta) e.hasta = "«Desde» no puede ser posterior a «Hasta».";
  else if (hasta > hoy) e.hasta = "El periodo no puede terminar después de hoy.";
  else if (desde < INICIO_DE_DATOS) e.desde = "No hay datos anteriores al 1 de junio de 2026.";
  return e;
}

const esLocalizado = (c: HechoCaso) => c.estado === "Localizado" || c.cierre?.tipo === "Cierre confirmado";

export type CifrasTablero = {
  casosActivos: number; casosLocalizados: number; totalCasos: number; totalAvistamientos: number;
  /** Días promedio registro → localización de los localizados del periodo; null si no hay. */
  promedioLocalizacion: number | null;
  avistamientosOcultos: number;
  porCategoriaMotivo: Record<number, number>;
  porEstadoCaso: Record<EstadoCaso, number>;
  cierres: Record<TipoDeCierre, number>;
  porEstadoAnimal: Record<number, number>;
  porAlcaldiaAvistamiento: Record<number, number>;
};

const cerosPorEstado = () => Object.fromEntries(ESTADOS_CASO.map((e) => [e, 0])) as Record<EstadoCaso, number>;
const cerosPorCierre = () => Object.fromEntries(TIPOS_DE_CIERRE.map((t) => [t, 0])) as Record<TipoDeCierre, number>;

/** HU 055. Casos registrados en el periodo (activos, localizados, estado, motivo); cierres por la FECHA del movimiento de cierre; avistamientos visibles por su fecha, los ocultos aparte (R29). */
export function calcularTablero(h: Hechos, p: Periodo): CifrasTablero {
  const casos = h.casos.filter((c) => c.cuenta && dentro(c.dia, p));
  const enPeriodo = h.avistamientos.filter((a) => dentro(a.dia, p));
  const visibles = enPeriodo.filter((a) => a.visible);
  const localizados = casos.filter(esLocalizado);
  const dias = localizados.map((c) => c.diasALocalizar).filter((x): x is number => x !== undefined);
  const r: CifrasTablero = {
    casosActivos: casos.filter((c) => ESTADOS_ACTIVOS.includes(c.estado)).length, casosLocalizados: localizados.length, totalCasos: casos.length, totalAvistamientos: visibles.length,
    promedioLocalizacion: dias.length ? Math.round((dias.reduce((s, x) => s + x, 0) / dias.length) * 10) / 10 : null,
    avistamientosOcultos: enPeriodo.length - visibles.length,
    porCategoriaMotivo: {}, porEstadoCaso: cerosPorEstado(), cierres: cerosPorCierre(), porEstadoAnimal: {}, porAlcaldiaAvistamiento: {},
  };
  for (const c of casos) {
    sumar(r.porCategoriaMotivo, c.idCategoriaMotivo);
    r.porEstadoCaso[c.estado]++;
  }
  // Los cierres son movimientos con fecha (HU 055, regla 6): cuentan los del periodo, aunque el caso se haya registrado antes.
  for (const c of h.casos) if (c.cuenta && c.cierre && dentro(c.cierre.dia, p)) r.cierres[c.cierre.tipo]++;
  for (const a of visibles) {
    sumar(r.porAlcaldiaAvistamiento, a.idAlcaldia);
    for (const id of a.idsEstadoAnimal) sumar(r.porEstadoAnimal, id); // cuenta avistamientos, no animales: uno con varios estados cuenta en cada uno
  }
  return r;
}

export type FiltrosReporte = { desde: string; hasta: string; idAlcaldia?: number; idCategoria?: number; estadoCaso?: EstadoCaso };
export type ErroresDeFiltros = { desde?: string; hasta?: string; alcaldia?: string; categoria?: string; estadoCaso?: string };
export type CifrasReporte = {
  totalCasos: number; casosLocalizados: number;
  /** Porcentaje con un decimal; null si ningún caso cuenta (todos cancelados o deshabilitados). */
  tasaRecuperacion: number | null;
  avistamientosOcultos: number;
  porCategoriaMotivo: Record<number, number>;
  porEstadoCaso: Record<EstadoCaso, number>;
  /** Cierre vigente de los casos del filtro (suma = casos «Cerrado»). */
  cierres: Record<TipoDeCierre, number>;
  porEstadoAnimal: Record<number, number>;
  porAlcaldiaAvistamiento: Record<number, number>;
};

/** Catálogos contra los que se validan los filtros opcionales (ids existentes). La alcaldía filtra la del CASO: «Fuera de la Ciudad de México» no la ofrece nadie (R14). */
export type OpcionesValidas = { alcaldias: ReadonlySet<number>; categorias: ReadonlySet<number> };
const entero = (t: string) => (/^\d{1,9}$/.test(t) ? Number(t) : NaN);

/**
 * Valida lo que llega de la URL o del cuerpo (texto sin confiar). El rango es obligatorio (HU 056, regla 1); alcaldía, categoría y estado son opcionales (regla 3). Si hay errores, `filtros` es undefined.
 * El reporte no limita «Hasta» a hoy: un periodo futuro simplemente no tiene datos.
 */
export function validarFiltrosDeReporte(entrada: { desde: string; hasta: string; alcaldia: string; categoria: string; estadoCaso: string }, validas: OpcionesValidas): { filtros?: FiltrosReporte; errores: ErroresDeFiltros } {
  const e: ErroresDeFiltros = {};
  const { desde, hasta } = entrada;
  if (!desde) e.desde = "El rango de fechas es obligatorio: indica «Desde».";
  else if (!esDiaReal(desde)) e.desde = "Elige una fecha válida.";
  if (!hasta) e.hasta = "El rango de fechas es obligatorio: indica «Hasta».";
  else if (!esDiaReal(hasta)) e.hasta = "Elige una fecha válida.";
  if (!e.desde && !e.hasta && desde > hasta) e.hasta = "«Hasta» no puede ser anterior a «Desde».";
  const f: FiltrosReporte = { desde, hasta };
  if (entrada.alcaldia) {
    const id = entero(entrada.alcaldia);
    if (validas.alcaldias.has(id)) f.idAlcaldia = id;
    else e.alcaldia = "Elige una alcaldía de la lista.";
  }
  if (entrada.categoria) {
    const id = entero(entrada.categoria);
    if (validas.categorias.has(id)) f.idCategoria = id;
    else e.categoria = "Elige una categoría de motivo de la lista.";
  }
  if (entrada.estadoCaso) {
    if ((ESTADOS_CASO as readonly string[]).includes(entrada.estadoCaso)) f.estadoCaso = entrada.estadoCaso as EstadoCaso;
    else e.estadoCaso = "Elige un estado del caso de la lista.";
  }
  return Object.keys(e).length ? { errores: e } : { filtros: f, errores: e };
}

/** HU 056. null si no hay casos en el periodo y filtros (no se genera reporte). Los avistamientos son los de los casos que cumplen los filtros (reglas 4 y 8), sembrados incluidos solo para atribuirlos. */
export function generarReporte(h: Hechos, f: FiltrosReporte): CifrasReporte | null {
  const cumple = (c: HechoCaso) => dentro(c.dia, f) && (f.idAlcaldia === undefined || c.idAlcaldia === f.idAlcaldia) && (f.idCategoria === undefined || c.idCategoriaMotivo === f.idCategoria) && (f.estadoCaso === undefined || c.estado === f.estadoCaso);
  const delFiltro = h.casos.filter(cumple);
  const casos = delFiltro.filter((c) => c.cuenta);
  if (casos.length === 0) return null;
  const claves = new Set(delFiltro.map((c) => c.clave));
  const avistamientos = h.avistamientos.filter((a) => claves.has(a.claveCaso));
  const visibles = avistamientos.filter((a) => a.visible);
  const localizados = casos.filter(esLocalizado);
  // HU 056, regla 6: la tasa no cuenta los casos cancelados ni los deshabilitados (ni en el numerador ni en el denominador). Los cierres confirmados SÍ cuentan en ambos lados.
  const contables = casos.filter((c) => c.cierre?.tipo !== "Cancelación" && c.cierre?.tipo !== "Deshabilitación");
  const r: CifrasReporte = {
    totalCasos: casos.length, casosLocalizados: localizados.length,
    tasaRecuperacion: contables.length ? Math.round((localizados.length / contables.length) * 1000) / 10 : null,
    avistamientosOcultos: avistamientos.length - visibles.length,
    porCategoriaMotivo: {}, porEstadoCaso: cerosPorEstado(), cierres: cerosPorCierre(), porEstadoAnimal: {}, porAlcaldiaAvistamiento: {},
  };
  for (const c of casos) {
    sumar(r.porCategoriaMotivo, c.idCategoriaMotivo);
    r.porEstadoCaso[c.estado]++;
    if (c.cierre) r.cierres[c.cierre.tipo]++;
  }
  for (const a of visibles) {
    sumar(r.porAlcaldiaAvistamiento, a.idAlcaldia); // alcaldía del propio avistamiento, no la del caso
    for (const id of a.idsEstadoAnimal) sumar(r.porEstadoAnimal, id);
  }
  return r;
}
