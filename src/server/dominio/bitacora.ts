// HU 058 y R24 (P6a): la bitácora de acciones administrativas. Aquí se valida una entrada ANTES de insertarla (motivo obligatorio solo en «deshabilitar caso» y «ocultar avistamiento»;
// el motivo y el detalle con su largo máximo) y se arma el identificador de lo afectado como lo define el diccionario (`id_afectada`: id del caso, `catálogo:id`, clave del parámetro…).
// Funciones puras; la inserción y su inmutabilidad (R15: solo agregar y leer) son del repositorio.
import { ENTIDAD_DE_TIPO, TIPOS_ACCION, TIPOS_CON_MOTIVO, type Entidad, type TipoAccion } from "../../mocks/bitacora";
import { LIMITE_MOTIVO } from "../../lib/moderacion";
import { reglaDeNegocio } from "../errores";

export { ENTIDAD_DE_TIPO, TIPOS_ACCION, TIPOS_CON_MOTIVO };
export type { Entidad, TipoAccion };
export const LIMITE_DETALLE = 600;
export const LIMITE_AFECTADA = 50;

export type EntradaNueva = { tipoAccion: TipoAccion; idAfectada: string; motivo?: string; detalle?: string };

/** Etiquetas de catálogo en `id_afectada` (HU 058 / diccionario): `alcaldia:12`, `raza:6`, `motivo:2`, `estado_animal:16`. */
export const ETIQUETAS_CATALOGO = ["alcaldia", "raza", "motivo", "estado_animal"] as const;
export const idDeCatalogo = (etiqueta: (typeof ETIQUETAS_CATALOGO)[number], id: number) => `${etiqueta}:${id}`;

/** Lanza 422 si la entrada no cumple las reglas de la bitácora; devuelve la entrada con el motivo y el detalle recortados. */
export function validarEntrada(e: EntradaNueva): EntradaNueva {
  if (!TIPOS_ACCION.includes(e.tipoAccion)) throw reglaDeNegocio("R24", "Tipo de acción de bitácora desconocido.", "TIPO_DE_ACCION_INVALIDO");
  const idAfectada = e.idAfectada.trim();
  if (!idAfectada || idAfectada.length > LIMITE_AFECTADA) throw reglaDeNegocio("R24", "La entidad afectada de la bitácora no es válida.", "ENTIDAD_INVALIDA");
  const motivo = e.motivo?.trim() || undefined;
  if (TIPOS_CON_MOTIVO.includes(e.tipoAccion) && !motivo) throw reglaDeNegocio("R24", "Esta acción exige un motivo.", "MOTIVO_OBLIGATORIO");
  if (motivo && motivo.length > LIMITE_MOTIVO) throw reglaDeNegocio("R24", `El motivo no puede pasar de ${LIMITE_MOTIVO} caracteres.`, "MOTIVO_LARGO");
  const detalle = e.detalle?.trim() || undefined;
  if (detalle && detalle.length > LIMITE_DETALLE) throw reglaDeNegocio("R24", `El detalle no puede pasar de ${LIMITE_DETALLE} caracteres.`, "DETALLE_LARGO");
  return { tipoAccion: e.tipoAccion, idAfectada, ...(motivo ? { motivo } : {}), ...(detalle ? { detalle } : {}) };
}
