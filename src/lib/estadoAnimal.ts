// Reglas de selección de los estados del animal (R3 del diccionario). Funciones puras: la interfaz solo las aplica.
import { CATEGORIAS_ESTADO_ANIMAL, ESTADOS_ANIMAL, ID_CATEGORIA_CONDUCTA, ID_ESTADO_FALLECIDO, type EstadoAnimal } from "../mocks/catalogos";

/** Estados elegidos por categoría: ids de la categoría (varios en «Integridad», uno o ninguno en las demás). */
export type SeleccionEstadoAnimal = Record<number, number[]>;

/** Mensaje (sin identificadores internos) cuando llega una opción desactivada o inexistente del catálogo; lo usan el servidor y la pantalla. */
export const MENSAJE_OPCION_NO_DISPONIBLE = "Una de las opciones elegidas ya no está disponible. Revisa tus selecciones.";

/** «Contención y ubicación» (categoría 2): ids de «Resguardado / En custodia temporal», «En clínica o veterinaria» y «En albergue / Centro de control». Se identifican por id, no por texto. */
export const IDS_BAJO_RESGUARDO: readonly number[] = [8, 9, 10];
/** El animal está bajo resguardo de quien reporta: depende SOLO de la categoría «Contención y ubicación» (también con «Fallecido» en Integridad). */
export const bajoResguardo = (s: SeleccionEstadoAnimal) => (s[2] ?? []).some((id) => IDS_BAJO_RESGUARDO.includes(id));

export const SELECCION_VACIA: SeleccionEstadoAnimal = { 1: [], 2: [], 3: [], 4: [] };

/**
 * Lo mínimo que las reglas necesitan de un estado. P6b (D5): el Administrador puede AGREGAR estados al catálogo, así que las reglas trabajan sobre las opciones que entrega el servidor (activas),
 * no sobre la lista del maquetado; sin ella se usa la lista del maquetado (solo pruebas y datos ficticios).
 */
export type OpcionDeEstado = Pick<EstadoAnimal, "id" | "idCategoria" | "excluyente"> & { nombre?: string };
const DEL_MAQUETADO: readonly OpcionDeEstado[] = ESTADOS_ANIMAL;
/** R3: solo 1, 5 y 6 son excluyentes; un estado desconocido para la lista (un id que ya no se ofrece) se trata como combinable de «Integridad». */
const estado = (id: number, catalogo: readonly OpcionDeEstado[]): OpcionDeEstado => catalogo.find((e) => e.id === id) ?? { id, idCategoria: 1, excluyente: false };

export const idsDe = (s: SeleccionEstadoAnimal): number[] => Object.values(s).flat();

export const hayFallecido = (s: SeleccionEstadoAnimal) => s[1].includes(ID_ESTADO_FALLECIDO);

/** La categoría Conducta no aplica si el estado es «Fallecido». */
export const categoriaDeshabilitada = (idCategoria: number, s: SeleccionEstadoAnimal) => idCategoria === ID_CATEGORIA_CONDUCTA && hayFallecido(s);

/** Una opción de «Integridad» se deshabilita si hay una excluyente elegida (y no es ella) o si ella es excluyente y ya hay otras. */
export function opcionDeshabilitada(id: number, s: SeleccionEstadoAnimal, catalogo: readonly OpcionDeEstado[] = DEL_MAQUETADO): boolean {
  const e = estado(id, catalogo);
  if (categoriaDeshabilitada(e.idCategoria, s)) return true;
  if (CATEGORIAS_ESTADO_ANIMAL.find((c) => c.id === e.idCategoria)?.seleccion !== "multiple") return false;
  const elegidos = s[e.idCategoria];
  if (elegidos.includes(id)) return false;
  const hayExcluyente = elegidos.some((x) => estado(x, catalogo).excluyente);
  const hayCombinable = elegidos.some((x) => !estado(x, catalogo).excluyente);
  return hayExcluyente || (e.excluyente && hayCombinable);
}

/** Marca o desmarca una opción de «Integridad». Al elegir «Fallecido» se vacía Conducta. */
export function alternarIntegridad(s: SeleccionEstadoAnimal, id: number, catalogo: readonly OpcionDeEstado[] = DEL_MAQUETADO): SeleccionEstadoAnimal {
  if (opcionDeshabilitada(id, s, catalogo)) return s;
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
export const nombresElegidos = (s: SeleccionEstadoAnimal, catalogo: readonly (OpcionDeEstado & { nombre: string })[] = ESTADOS_ANIMAL): string[] => catalogo.filter((e) => idsDe(s).includes(e.id)).map((e) => e.nombre);
