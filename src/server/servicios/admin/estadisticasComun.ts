import "server-only";
// Piezas comunes del tablero y de Reportes (P6c): leer base + capa real de una pasada y poner los RÓTULOS vigentes del catálogo a cifras que se cuentan por identificador.
import { createHash } from "node:crypto";
import { ESTADOS_CASO } from "../../../mocks/tipos";
import { hechosCompletos, type CatalogosEstadisticos, type DatosEstadisticos } from "../../dominio/capaReal";
import { TIPOS_DE_CIERRE, type CifrasReporte, type CifrasTablero, type FiltrosReporte, type Hechos } from "../../dominio/estadisticas";
import type { BarraAdmin, GrupoEstadoAnimalAdmin } from "../../serializadores/admin";
import type { Contexto } from "../contexto";

export async function leerHechos(ctx: Contexto): Promise<{ datos: DatosEstadisticos; hechos: Hechos }> {
  const datos = await ctx.repos.estadisticas.leer();
  return { datos, hechos: hechosCompletos(datos) };
}

/** Texto de un valor sin confiar: una cadena (recortada), un número entero como cadena, o vacío. Cualquier otra cosa queda como valor inválido (no coincide con nada). */
export const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : v === undefined || v === null ? "" : "\u0000invalido");

/** «Ileso / Buen estado» se rotula como el tablero de siempre; lo que va entre paréntesis al final del nombre no se muestra. */
const sinParentesis = (n: string) => n.replace(/ \(.*\)$/, "");

export const barrasDeMotivo = (c: CatalogosEstadisticos, r: Record<number, number>): BarraAdmin[] => c.categoriasMotivo.map((x) => ({ id: x.id, nombre: x.nombre, valor: r[x.id] ?? 0 }));
export const barrasDeEstadoCaso = (c: CatalogosEstadisticos, r: Record<string, number>): BarraAdmin[] => ESTADOS_CASO.map((nombre) => ({ id: c.estadosCaso.find((e) => e.nombre === nombre)?.id, nombre, valor: r[nombre] ?? 0 }));
export const barrasDeCierre = (r: Record<string, number>): BarraAdmin[] => TIPOS_DE_CIERRE.map((nombre) => ({ nombre, valor: r[nombre] ?? 0 }));
/** Todas las filas del catálogo (activas e inactivas, también las creadas después), agrupadas por categoría en el orden del catálogo. */
export const gruposDeEstadoAnimal = (c: CatalogosEstadisticos, r: Record<number, number>): GrupoEstadoAnimalAdmin[] =>
  c.categoriasEstadoAnimal.map((cat) => ({ id: cat.id, categoria: cat.nombre, barras: c.estadosAnimal.filter((e) => e.idCategoria === cat.id).sort((x, y) => x.id - y.id).map((e) => ({ id: e.id, nombre: sinParentesis(e.nombre), valor: r[e.id] ?? 0 })) }));
/** Solo alcaldías con avistamientos, de mayor a menor y, a igual valor, por id. Incluye las inactivas y «Fuera de la Ciudad de México». */
export const barrasDeAlcaldia = (c: CatalogosEstadisticos, r: Record<number, number>): BarraAdmin[] =>
  c.alcaldias.filter((a) => (r[a.id] ?? 0) > 0).map((a) => ({ id: a.id, nombre: a.nombre, valor: r[a.id] })).sort((x, y) => y.valor - x.valor || x.id! - y.id!);

export const rotularTablero = (c: CatalogosEstadisticos, t: CifrasTablero) => ({
  porMotivo: barrasDeMotivo(c, t.porCategoriaMotivo), porEstadoCaso: barrasDeEstadoCaso(c, t.porEstadoCaso), cierres: barrasDeCierre(t.cierres),
  porEstadoAnimal: gruposDeEstadoAnimal(c, t.porEstadoAnimal), porAlcaldia: barrasDeAlcaldia(c, t.porAlcaldiaAvistamiento),
});

/**
 * HU 057, regla 1: huella de lo que el reporte DICE (filtros resueltos y cifras por identificador, sin rótulos ni hora de generación). La calcula SIEMPRE el servidor; el cliente solo la devuelve para
 * comprobar que lo que va a exportar sigue siendo lo que vio. Es una comparación, no una credencial.
 */
export function huellaDeReporte(f: FiltrosReporte, r: CifrasReporte): string {
  const orden = (x: Record<number, number>) => Object.entries(x).sort(([a], [b]) => Number(a) - Number(b));
  const canon = JSON.stringify({
    f: [f.desde, f.hasta, f.idAlcaldia ?? null, f.idCategoria ?? null, f.estadoCaso ?? null],
    c: [r.totalCasos, r.casosLocalizados, r.tasaRecuperacion, r.avistamientosOcultos, orden(r.porCategoriaMotivo), ESTADOS_CASO.map((e) => r.porEstadoCaso[e]), TIPOS_DE_CIERRE.map((t) => r.cierres[t]), orden(r.porEstadoAnimal), orden(r.porAlcaldiaAvistamiento)],
  });
  return createHash("sha256").update(canon).digest("hex").slice(0, 32);
}
