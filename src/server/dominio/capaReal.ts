// Capa real de las estadísticas (P6c): convierte lo que el repositorio entrega de los casos y avistamientos CREADOS DESPUÉS de la siembra en «hechos» (ver estadisticas.ts). Puro, sin acceso al almacén.
// Un avistamiento nuevo sobre un caso SEMBRADO cuenta (el caso entra solo para atribuirlo al filtrar, con `cuenta: false`); cualquier otra acción sobre los sembrados no mueve cifras.
import type { EstadoCaso, TipoMovimiento } from "../../mocks/tipos";
import { diaCDMX } from "./filtrosAvistamientos";
import type { HechoAvistamiento, HechoCaso, Hechos, TipoDeCierre } from "./estadisticas";

export type MarcaDeSiembra = { idCasoMax: number; idAvistamientoMax: number };
/** Catálogos vigentes leídos en la MISMA pasada que los datos (los rótulos son siempre el nombre actual). */
export type CatalogosEstadisticos = {
  alcaldias: { id: number; nombre: string; activo: boolean }[];
  categoriasMotivo: { id: number; nombre: string }[];
  categoriasEstadoAnimal: { id: number; nombre: string }[];
  estadosAnimal: { id: number; idCategoria: number; nombre: string; activo: boolean }[];
  estadosCaso: { id: number; nombre: EstadoCaso }[];
};
/** Proyección del caso para las estadísticas: sin folio, sin persona dueña, sin dirección ni referencias. */
export type CasoParaEstadisticas = {
  idCasoExtravio: number; esNuevo: boolean; fechaRegistro: string; idAlcaldia: number; idCategoriaMotivo: number; idEstadoCaso: number;
  movimientos: { tipoMovimiento: TipoMovimiento; fechaHora: string }[];
};
export type AvistamientoParaEstadisticas = { fechaHoraAvistamiento: string; idAlcaldia: number; idsEstadoAnimal: number[]; visible: boolean; idCasoExtravio: number };
export type DatosEstadisticos = {
  /** Base histórica inmutable (ya en hechos con ids). */
  base: Hechos;
  marca: MarcaDeSiembra;
  /** Casos nuevos y los sembrados que recibieron avistamientos nuevos. */
  casos: CasoParaEstadisticas[];
  /** Solo avistamientos nuevos (id mayor que la marca). */
  avistamientos: AvistamientoParaEstadisticas[];
  catalogos: CatalogosEstadisticos;
};

const MS_DIA = 86_400_000;
export const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / MS_DIA);
const CIERRE_DE_MOVIMIENTO: Partial<Record<TipoMovimiento, TipoDeCierre>> = { "cierre confirmado": "Cierre confirmado", cancelación: "Cancelación", deshabilitación: "Deshabilitación" };

/** Un caso de la capa real. Cierre = el movimiento que dejó el caso «Cerrado» (si lo restauraron ya no hay). Localización = la última «localización» (una reactivación posterior saca al caso de los localizados). */
export function hechoDeCaso(c: CasoParaEstadisticas, nombreDeEstado: (id: number) => EstadoCaso): HechoCaso {
  const estado = nombreDeEstado(c.idEstadoCaso);
  const dia = diaCDMX(c.fechaRegistro);
  const ultimo = c.movimientos[c.movimientos.length - 1];
  const tipo = estado === "Cerrado" && ultimo ? CIERRE_DE_MOVIMIENTO[ultimo.tipoMovimiento] : undefined;
  const hecho: HechoCaso = { clave: `${c.esNuevo ? "r" : "s"}${c.idCasoExtravio}`, cuenta: c.esNuevo, dia, idAlcaldia: c.idAlcaldia, idCategoriaMotivo: c.idCategoriaMotivo, estado };
  if (tipo && ultimo) hecho.cierre = { tipo, dia: diaCDMX(ultimo.fechaHora) };
  if (estado === "Localizado" || tipo === "Cierre confirmado") {
    const loc = [...c.movimientos].reverse().find((m) => m.tipoMovimiento === "localización");
    if (loc) hecho.diasALocalizar = diasEntre(dia, diaCDMX(loc.fechaHora));
  }
  return hecho;
}

export function hechosDeCapaReal(d: DatosEstadisticos): Hechos {
  const nombre = new Map(d.catalogos.estadosCaso.map((e) => [e.id, e.nombre]));
  const casos = d.casos.map((c) => hechoDeCaso(c, (id) => nombre.get(id)!));
  const avistamientos: HechoAvistamiento[] = d.avistamientos.map((a) => ({
    dia: diaCDMX(a.fechaHoraAvistamiento), idAlcaldia: a.idAlcaldia, idsEstadoAnimal: a.idsEstadoAnimal, visible: a.visible,
    claveCaso: `${d.casos.find((c) => c.idCasoExtravio === a.idCasoExtravio)?.esNuevo === false ? "s" : "r"}${a.idCasoExtravio}`,
  }));
  return { casos, avistamientos };
}

/** Base histórica + capa real, en ese orden. */
export const hechosCompletos = (d: DatosEstadisticos): Hechos => {
  const real = hechosDeCapaReal(d);
  return { casos: [...d.base.casos, ...real.casos], avistamientos: [...d.base.avistamientos, ...real.avistamientos] };
};
