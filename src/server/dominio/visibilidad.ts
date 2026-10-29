// R33, R13, HU 024, 025, 028 y 038: qué responde cada acceso público según el ÚLTIMO movimiento del caso (estado y tipo de cierre).
//
//  situación del caso             (a) ficha pública        (b) consulta de estatus por folio   (c) acceso por folio para reportar
//                                 HU 024/025, R33          HU 038, R33                         HU 028, R13, R33
//  Extraviado/En búsqueda/…/Seg.  se muestra               se muestra (estatus y fecha)        permitido
//  Localizado                     se muestra (HU 024)      se muestra                          409 «no admite avistamientos» (R13)
//  Cerrado · cierre confirmado    404 (HU 024/025, R33)    se muestra «Cerrado» (HU 038)       409 «no admite avistamientos» (R13)
//  Cerrado · cancelación          404 (R33)                404 (R33, HU 038)                   404 (R33: «no se encuentra»)
//  Cerrado · deshabilitación      404 (R33)                404 (R33, HU 038)                   404 (R33; R13 incluye a los deshabilitados)
//  folio inexistente              404                      404                                 404
//
// Todos los 404 son idénticos entre sí (no se revela por qué). Contradicción entre las HU: la 024/025 ocultan todo caso «Cerrado» y la 038
// solo cancelados y deshabilitados; se resuelve por alcance (ficha pública frente a consulta de estatus), y R33 las concilia.
import type { MovimientoHistorial } from "../../mocks/tipos";
import { MENSAJE_QR_NO_VIGENTE } from "../config/mensajes";
import { conflictoDeEstado, noEncontrado } from "../errores";

export type TipoCierre = "cierre confirmado" | "cancelación" | "deshabilitación";
export type Situacion = { estado: MovimientoHistorial["estado"]; cierre?: TipoCierre };

export function situacionDe(h: readonly MovimientoHistorial[]): Situacion | undefined {
  const m = h[h.length - 1];
  if (!m) return undefined;
  return m.estado === "Cerrado" ? { estado: "Cerrado", cierre: m.tipo as TipoCierre } : { estado: m.estado };
}

export const MENSAJE_NO_ENCONTRADO = "No encontramos ese folio.";
export const errorNoEncontrado = () => noEncontrado(MENSAJE_NO_ENCONTRADO);

/** Canal QR: un token inexistente, mal formado, regenerado o de un caso que no se muestra responde SIEMPRE lo mismo, sin revelar si existió (R27, R33). */
export { MENSAJE_QR_NO_VIGENTE };
export const errorQrNoVigente = () => noEncontrado(MENSAJE_QR_NO_VIGENTE, "QR_NO_VIGENTE");

export const fichaPublicaVisible = (s: Situacion | undefined) => !!s && s.estado !== "Cerrado";
export const estatusPorFolioVisible = (s: Situacion | undefined) => !!s && !(s.estado === "Cerrado" && (s.cierre === "cancelación" || s.cierre === "deshabilitación"));

export type AccesoReportar = "permitido" | "no-encontrado" | "no-admite";
export function accesoParaReportar(s: Situacion | undefined): AccesoReportar {
  if (!s) return "no-encontrado";
  if (s.estado === "Cerrado" && (s.cierre === "cancelación" || s.cierre === "deshabilitación")) return "no-encontrado";
  return s.estado === "Localizado" || s.estado === "Cerrado" ? "no-admite" : "permitido";
}

/** R13 y R33: lanza 404 (no se encuentra) o 409 (no admite avistamientos) si el caso no acepta el reporte. */
export function exigirAdmiteAvistamientos(s: Situacion | undefined): void {
  const a = accesoParaReportar(s);
  if (a === "no-encontrado") throw errorNoEncontrado();
  if (a === "no-admite") throw conflictoDeEstado("CASO_NO_ADMITE_AVISTAMIENTOS", "Este registro ya no admite avistamientos.", "R13");
}
