// Datos ficticios del tablero del Administrador (HU 055). Se generan con un generador pseudoaleatorio de semilla fija, así que
// son los mismos en cada carga. Respetan las reglas del diccionario: estados del animal (R3), cierres por tipo, alcaldía propia
// del avistamiento (con «Fuera de la Ciudad de México») y avistamientos ocultos fuera de las cuentas.
import { CATEGORIAS_MOTIVO, ESTADOS_ANIMAL } from "./catalogos";
import { ALCALDIAS, FUERA_DE_LA_CIUDAD, type AlcaldiaAvistamiento, type EstadoCaso } from "./tipos";

/** «Hoy» de la maqueta (la lámina 4.13 muestra el periodo del 1 al 18 de octubre de 2026). */
export const HOY_FICTICIO = "2026-10-18";
export const INICIO_DATOS = "2026-06-01";
export const PERIODO_PREDETERMINADO = { desde: "2026-10-01", hasta: HOY_FICTICIO } as const;

export type TipoCierre = "Cierre confirmado" | "Cancelación" | "Deshabilitación";
type CasoTablero = { fecha: string; categoriaMotivo: number; estado: EstadoCaso; cierre?: TipoCierre; fechaCierre?: string; diasALocalizar?: number };
type AvistamientoTablero = { fecha: string; alcaldia: AlcaldiaAvistamiento; estados: string[]; visible: boolean };

function generador(semilla: number) {
  let a = semilla;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const aleatorio = generador(20261018);
const elegir = <T,>(opciones: readonly (readonly [T, number])[]): T => {
  let r = aleatorio() * opciones.reduce((s, [, p]) => s + p, 0);
  for (const [v, p] of opciones) if ((r -= p) <= 0) return v;
  return opciones[opciones.length - 1][0];
};
const entero = (min: number, max: number) => min + Math.floor(aleatorio() * (max - min + 1));
const msDia = 86400000;
const dia = (iso: string, mas = 0) => new Date(Date.parse(`${iso}T12:00:00Z`) + mas * msDia).toISOString().slice(0, 10);
const diferencia = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / msDia);

const nombresEstado = (ids: number[]) => ids.map((i) => ESTADOS_ANIMAL.find((e) => e.id === i)!.nombre);

function generarCasos(): CasoTablero[] {
  const casos: CasoTablero[] = [];
  for (let d = INICIO_DATOS; d <= HOY_FICTICIO; d = dia(d, 1)) {
    for (let i = entero(6, 11); i > 0; i--) {
      const edad = diferencia(d, HOY_FICTICIO);
      const categoriaMotivo = elegir([[1, 27], [2, 25], [3, 22], [4, 17], [5, 9]] as const);
      const pCerrado = Math.min(0.5, edad / 220);
      const pLocalizado = Math.min(0.3, 0.06 + edad / 120);
      const r = aleatorio();
      if (r < pCerrado) {
        const cierre = elegir([["Cierre confirmado", 60], ["Cancelación", 25], ["Deshabilitación", 15]] as const);
        const diasALocalizar = cierre === "Cierre confirmado" ? entero(1, 14) : undefined;
        const fechaCierre = dia(d, Math.min(edad, (diasALocalizar ?? entero(1, 10)) + entero(1, 12)));
        casos.push({ fecha: d, categoriaMotivo, estado: "Cerrado", cierre, fechaCierre, diasALocalizar });
      } else if (r < pCerrado + pLocalizado) {
        casos.push({ fecha: d, categoriaMotivo, estado: "Localizado", diasALocalizar: Math.min(Math.max(edad, 1), entero(1, 14)) });
      } else {
        casos.push({ fecha: d, categoriaMotivo, estado: elegir([["Extraviado", 10], ["En búsqueda", 40], ["Avistamiento reportado", 25], ["En seguimiento", 25]] as const) });
      }
    }
  }
  return casos;
}

const PESOS_ALCALDIA: [AlcaldiaAvistamiento, number][] = [...ALCALDIAS.map((a, i) => [a, [9, 6, 8, 7, 2, 12, 11, 4, 14, 2, 5, 2, 3, 5, 5, 4][i]] as [AlcaldiaAvistamiento, number]), [FUERA_DE_LA_CIUDAD, 2]];

function generarAvistamientos(): AvistamientoTablero[] {
  const lista: AvistamientoTablero[] = [];
  for (let d = INICIO_DATOS; d <= HOY_FICTICIO; d = dia(d, 1)) {
    for (let i = entero(8, 16); i > 0; i--) {
      // Reglas del catálogo: «Ileso», «Fallecido» y «No se puede determinar» solos; «Fallecido» sin Conducta.
      const salud = elegir([["ileso", 40], ["fallecido", 3], ["indeterminado", 6], ["combinadas", 51]] as const);
      const integridad = salud === "ileso" ? [1] : salud === "fallecido" ? [5] : salud === "indeterminado" ? [6] : [...new Set(Array.from({ length: entero(1, 3) }, () => entero(2, 4)))];
      const contencion = elegir([[7, 52], [8, 24], [9, 10], [10, 14]] as const);
      const conducta = salud === "fallecido" || aleatorio() < 0.3 ? [] : [elegir([[11, 34], [12, 36], [13, 18], [14, 12]] as const)];
      const identificacion = aleatorio() < 0.25 ? [] : [elegir([[15, 14], [16, 24], [17, 62]] as const)];
      lista.push({ fecha: d, alcaldia: elegir(PESOS_ALCALDIA), estados: nombresEstado([...integridad, contencion, ...conducta, ...identificacion]), visible: aleatorio() > 0.03 });
    }
  }
  return lista;
}

const CASOS = generarCasos();
export const CASOS_TABLERO: readonly CasoTablero[] = CASOS;
export const TIPOS_CIERRE = ["Cierre confirmado", "Cancelación", "Deshabilitación"] as const;
/** Movimientos de cierre con su fecha (cierre confirmado, cancelación o deshabilitación), derivados de los casos cerrados. */
export const MOVIMIENTOS_CIERRE: readonly { folioIndice: number; fecha: string; tipo: TipoCierre }[] = CASOS.flatMap((c, i) => (c.cierre && c.fechaCierre ? [{ folioIndice: i, fecha: c.fechaCierre, tipo: c.cierre }] : []));
const AVISTAMIENTOS = generarAvistamientos();

export type Periodo = { desde: string; hasta: string };
const dentro = (f: string, p: Periodo) => f >= p.desde && f <= p.hasta;

export type Barra = { nombre: string; valor: number };
export type ResumenTablero = {
  casosActivos: number;
  casosLocalizados: number;
  totalCasos: number;
  totalAvistamientos: number;
  /** Días promedio entre el registro y la localización; null si no hay casos localizados en el periodo. */
  promedioLocalizacion: number | null;
  avistamientosOcultos: number;
  porMotivo: Barra[];
  porEstadoCaso: Barra[];
  cierres: Barra[];
  porEstadoAnimal: { categoria: string; barras: Barra[] }[];
  porAlcaldia: Barra[];
};

/** Todos los indicadores y gráficas del tablero para un periodo (HU 055). */
export function calcularTablero(p: Periodo): ResumenTablero {
  const casos = CASOS.filter((c) => dentro(c.fecha, p));
  const visibles = AVISTAMIENTOS.filter((a) => a.visible && dentro(a.fecha, p));
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
    avistamientosOcultos: AVISTAMIENTOS.filter((a) => !a.visible && dentro(a.fecha, p)).length,
    porMotivo: CATEGORIAS_MOTIVO.map((c) => ({ nombre: c.nombre, valor: casos.filter((x) => x.categoriaMotivo === c.id).length })),
    porEstadoCaso: estadosCaso.map((e) => ({ nombre: e, valor: casos.filter((c) => c.estado === e).length })),
    // Los cierres son movimientos con fecha (HU 055, regla 6): cuentan los que ocurren en el periodo, aunque el caso se haya registrado antes.
    cierres: TIPOS_CIERRE.map((t) => ({ nombre: t, valor: MOVIMIENTOS_CIERRE.filter((m) => m.tipo === t && dentro(m.fecha, p)).length })),
    porEstadoAnimal: [1, 2, 3, 4].map((id) => ({
      categoria: ["Integridad física y salud", "Contención y ubicación", "Conducta", "Identificación visible"][id - 1],
      // Un avistamiento con varios estados se cuenta en cada uno (HU 055, regla 4).
      barras: ESTADOS_ANIMAL.filter((e) => e.idCategoria === id).map((e) => ({ nombre: e.nombre.replace(/ \(.*\)$/, ""), valor: visibles.filter((a) => a.estados.includes(e.nombre)).length })),
    })),
    porAlcaldia: PESOS_ALCALDIA.map(([a]) => ({ nombre: a, valor: visibles.filter((v) => v.alcaldia === a).length })).filter((b) => b.valor > 0).sort((x, y) => y.valor - x.valor),
  };
}

/** Valida el periodo del selector; devuelve el mensaje de error o undefined. */
export function errorDePeriodo({ desde, hasta }: Periodo): string | undefined {
  if (!desde || !hasta) return "Elige las dos fechas del periodo.";
  if (desde > hasta) return "«Desde» no puede ser posterior a «Hasta».";
  if (hasta > HOY_FICTICIO) return "El periodo no puede terminar después de hoy.";
  if (desde < INICIO_DATOS) return "No hay datos anteriores al 1 de junio de 2026.";
  return undefined;
}
