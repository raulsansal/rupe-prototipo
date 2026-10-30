// Base HISTÓRICA sintética del tablero y de Reportes (HU 055 y 056): los datos que seed/baseHistorica.ts asocia a ids y congela. Ya no se calcula nada aquí (el cálculo vive en server/dominio/estadisticas.ts;
// el del maquetado quedó como oráculo de pruebas, fuera de src).
// Datos ficticios del tablero del Administrador (HU 055). Se generan con un generador pseudoaleatorio de semilla fija, así que
// son los mismos en cada carga. Respetan las reglas del diccionario: estados del animal (R3), cierres por tipo, alcaldía propia
// del avistamiento (con «Fuera de la Ciudad de México») y avistamientos ocultos fuera de las cuentas.
import { ESTADOS_ANIMAL } from "./catalogos";
import { ALCALDIAS, FUERA_DE_LA_CIUDAD, type Alcaldia, type AlcaldiaAvistamiento, type EstadoCaso } from "./tipos";

/** Último día de la base sintética (la lámina 4.13 muestra el periodo del 1 al 18 de octubre de 2026). */
export const HOY_FICTICIO = "2026-10-18";
export const INICIO_DATOS = "2026-06-01";

export type TipoCierre = "Cierre confirmado" | "Cancelación" | "Deshabilitación";
export type CasoTablero = { fecha: string; categoriaMotivo: number; estado: EstadoCaso; cierre?: TipoCierre; fechaCierre?: string; diasALocalizar?: number; alcaldia: Alcaldia };
/** `casoIdx`: posición del caso (en CASOS_TABLERO) al que pertenece el avistamiento; sirve a los reportes (HU 056, regla 4). */
export type AvistamientoTablero = { fecha: string; alcaldia: AlcaldiaAvistamiento; estados: string[]; visible: boolean; casoIdx: number };
type CasoBase = Omit<CasoTablero, "alcaldia">;
type AvistamientoBase = Omit<AvistamientoTablero, "casoIdx">;
/** Hash determinista por posición: asigna alcaldía y caso sin tocar el generador pseudoaleatorio (las cifras del tablero no cambian). */
const hash = (i: number) => Math.imul(i + 1, 2654435761) >>> 0;

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

function generarCasos(): CasoBase[] {
  const casos: CasoBase[] = [];
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

function generarAvistamientos(): AvistamientoBase[] {
  const lista: AvistamientoBase[] = [];
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

const CASOS: CasoTablero[] = generarCasos().map((c, i) => ({ ...c, alcaldia: ALCALDIAS[hash(i) % ALCALDIAS.length] }));
export const CASOS_TABLERO: readonly CasoTablero[] = CASOS;
export const TIPOS_CIERRE = ["Cierre confirmado", "Cancelación", "Deshabilitación"] as const;
/** Movimientos de cierre con su fecha (cierre confirmado, cancelación o deshabilitación), derivados de los casos cerrados. */
export const MOVIMIENTOS_CIERRE: readonly { folioIndice: number; fecha: string; tipo: TipoCierre }[] = CASOS.flatMap((c, i) => (c.cierre && c.fechaCierre ? [{ folioIndice: i, fecha: c.fechaCierre, tipo: c.cierre }] : []));
/** Cada avistamiento pertenece a un caso ya registrado ese día o antes (de los más recientes), sin usar el generador. */
export const AVISTAMIENTOS_TABLERO: readonly AvistamientoTablero[] = generarAvistamientos().map((a, i) => {
  const hasta = CASOS.filter((c) => c.fecha <= a.fecha).length;
  return { ...a, casoIdx: hasta - 1 - (hash(i + 17) % Math.min(hasta, 60)) };
});
