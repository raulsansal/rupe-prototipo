import { fechaLocalISO } from "./formato";
import { BITACORA, type AccionBitacora, type TipoAccion } from "../mocks/bitacora";

export type FiltroBitacora = { tipo: "" | TipoAccion; desde: string; hasta: string };
export const SIN_FILTRO_BITACORA: FiltroBitacora = { tipo: "", desde: "", hasta: "" };

/** HU 058: filtros por tipo de acción y por fecha (día local de la Ciudad de México). */
export function filtrarBitacora(f: FiltroBitacora, acciones: readonly AccionBitacora[] = BITACORA): AccionBitacora[] {
  return acciones.filter((a) => {
    const dia = fechaLocalISO(a.fechaHora);
    return (!f.tipo || a.tipo === f.tipo) && (!f.desde || dia >= f.desde) && (!f.hasta || dia <= f.hasta);
  });
}
