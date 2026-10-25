// R3: combinaciones válidas de estados del animal en un avistamiento (el servidor repite las reglas de la interfaz y rechaza lo inválido).
//  · Categoría 1 (obligatoria): o una sola excluyente (1 Ileso, 5 Fallecido, 6 No se puede determinar) o cualquier subconjunto no vacío de combinables (2, 3, 4 y los nuevos).
//  · Categoría 2 (obligatoria): exactamente una.  · Categorías 3 y 4: cero o una.  · «Fallecido» deshabilita la categoría 3 (Conducta).
import { ESTADOS_ANIMAL, ID_CATEGORIA_CONDUCTA, ID_ESTADO_FALLECIDO } from "../../mocks/catalogos";
import { reglaDeNegocio } from "../errores";

/** R3: los ids 1, 5 y 6 (Ileso, Fallecido, No se puede determinar) son excluyentes; los estados nuevos de la categoría 1 son combinables. */
export const IDS_EXCLUYENTES = [1, 5, 6] as const;
export type EstadoDelCatalogo = { id: number; idCategoria: number; excluyente: boolean; activo?: boolean };
const DEL_MOCK: readonly EstadoDelCatalogo[] = ESTADOS_ANIMAL.map((e) => ({ id: e.id, idCategoria: e.idCategoria, excluyente: e.excluyente }));

export function validarEstadosAnimal(ids: readonly number[], catalogo: readonly EstadoDelCatalogo[] = DEL_MOCK): void {
  const falla = (mensaje: string, codigo = "ESTADOS_INVALIDOS") => reglaDeNegocio("R3", mensaje, codigo);
  if (new Set(ids).size !== ids.length) throw falla("Hay estados repetidos.");
  const elegidos = ids.map((id) => catalogo.find((e) => e.id === id) ?? (() => { throw falla(`El estado ${id} no existe.`); })());
  const inactivo = elegidos.find((e) => e.activo === false);
  if (inactivo) throw falla(`El estado ${inactivo.id} está desactivado.`);
  const de = (cat: number) => elegidos.filter((e) => e.idCategoria === cat);
  const integridad = de(1);
  if (integridad.length === 0) throw falla("Elige al menos una opción de integridad física y salud.");
  const excluyente = integridad.find((e) => e.excluyente);
  if (excluyente && integridad.length > 1) throw falla("«Ileso», «Fallecido» y «No se puede determinar» solo se eligen solos.");
  if (de(2).length !== 1) throw falla("Elige una sola opción de contención y ubicación.");
  if (de(ID_CATEGORIA_CONDUCTA).length > 1 || de(4).length > 1) throw falla("En conducta e identificación visible se elige una sola opción.");
  if (integridad.some((e) => e.id === ID_ESTADO_FALLECIDO) && de(ID_CATEGORIA_CONDUCTA).length > 0) throw falla("«Fallecido» deshabilita la categoría Conducta.");
}
