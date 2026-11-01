// Reglas de la moderación de registros (HU 018, R12 del diccionario) y de avistamientos (HU 037). La regla de negocio vive en `server/dominio`; aquí queda solo lo que usan la interfaz y las pruebas.
import type { MovimientoHistorial } from "../mocks/tipos";

/** Longitud máxima del motivo de moderación (tbl_historial_estado_caso.motivo y tbl_avistamiento.motivo_moderacion, VARCHAR 300). */
export const LIMITE_MOTIVO = 300;

/** Cerrado por deshabilitación: el último movimiento es una deshabilitación (el estado del caso es el del último movimiento). */
export const esDeshabilitado = (h: readonly MovimientoHistorial[]) => h[h.length - 1].tipo === "deshabilitación";

/** Valida el motivo obligatorio (MOD-08 y MOD-09); devuelve el mensaje de error o undefined. */
export function errorDeMotivo(motivo: string): string | undefined {
  if (!motivo.trim()) return "Escribe el motivo para continuar.";
  if (motivo.trim().length > LIMITE_MOTIVO) return `El motivo no puede pasar de ${LIMITE_MOTIVO} caracteres.`;
  return undefined;
}
