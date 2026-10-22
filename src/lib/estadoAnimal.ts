// Reglas de selección de los estados del animal (R3 del diccionario). Funciones puras: la interfaz solo las aplica.
import { CATEGORIAS_ESTADO_ANIMAL, ESTADOS_ANIMAL, ID_CATEGORIA_CONDUCTA, ID_ESTADO_FALLECIDO, type EstadoAnimal } from "../mocks/catalogos";

/** Estados elegidos por categoría: ids de la categoría (varios en «Integridad», uno o ninguno en las demás). */
export type SeleccionEstadoAnimal = Record<number, number[]>;

export const SELECCION_VACIA: SeleccionEstadoAnimal = { 1: [], 2: [], 3: [], 4: [] };

const estado = (id: number): EstadoAnimal => ESTADOS_ANIMAL.find((e) => e.id === id)!;

export const idsDe = (s: SeleccionEstadoAnimal): number[] => Object.values(s).flat();

export const hayFallecido = (s: SeleccionEstadoAnimal) => s[1].includes(ID_ESTADO_FALLECIDO);

/** La categoría Conducta no aplica si el estado es «Fallecido». */
export const categoriaDeshabilitada = (idCategoria: number, s: SeleccionEstadoAnimal) => idCategoria === ID_CATEGORIA_CONDUCTA && hayFallecido(s);

/** Una opción de «Integridad» se deshabilita si hay una excluyente elegida (y no es ella) o si ella es excluyente y ya hay otras. */
export function opcionDeshabilitada(id: number, s: SeleccionEstadoAnimal): boolean {
  const e = estado(id);
  if (categoriaDeshabilitada(e.idCategoria, s)) return true;
  if (CATEGORIAS_ESTADO_ANIMAL.find((c) => c.id === e.idCategoria)?.seleccion !== "multiple") return false;
  const elegidos = s[e.idCategoria];
  if (elegidos.includes(id)) return false;
  const hayExcluyente = elegidos.some((x) => estado(x).excluyente);
  const hayCombinable = elegidos.some((x) => !estado(x).excluyente);
  return hayExcluyente || (e.excluyente && hayCombinable);
}

/** Marca o desmarca una opción de «Integridad». Al elegir «Fallecido» se vacía Conducta. */
export function alternarIntegridad(s: SeleccionEstadoAnimal, id: number): SeleccionEstadoAnimal {
  if (opcionDeshabilitada(id, s)) return s;
  const elegidos = s[1].includes(id) ? s[1].filter((x) => x !== id) : [...s[1], id];
  return { ...s, 1: elegidos, 3: elegidos.includes(ID_ESTADO_FALLECIDO) ? [] : s[3] };
}

/** Elige una opción de una categoría de selección única; `undefined` quita la selección. */
export function elegirUnica(s: SeleccionEstadoAnimal, idCategoria: number, id: number | undefined): SeleccionEstadoAnimal {
  if (categoriaDeshabilitada(idCategoria, s)) return s;
  return { ...s, [idCategoria]: id === undefined ? [] : [id] };
}

/** Errores de las categorías obligatorias (1 y 2); vacío si todo está bien. */
export function erroresEstadoAnimal(s: SeleccionEstadoAnimal): Partial<Record<number, string>> {
  const errores: Partial<Record<number, string>> = {};
  if (s[1].length === 0) errores[1] = "Elige al menos una opción de integridad física y salud.";
  if (s[2].length === 0) errores[2] = "Elige una opción de contención y ubicación.";
  return errores;
}

/** Nombres de los estados elegidos, en el orden del catálogo (así se guardan en el avistamiento). */
export const nombresElegidos = (s: SeleccionEstadoAnimal): string[] => ESTADOS_ANIMAL.filter((e) => idsDe(s).includes(e.id)).map((e) => e.nombre);
