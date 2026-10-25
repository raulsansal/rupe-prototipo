// Reglas de la moderación de registros (HU 018, R12 del diccionario) y de avistamientos (HU 037). Funciones puras: la interfaz solo las aplica.
import type { EstadoCaso, MovimientoHistorial } from "../mocks/tipos";

/** Longitud máxima del motivo de moderación (tbl_historial_estado_caso.motivo y tbl_avistamiento.motivo_moderacion, VARCHAR 300). */
export const LIMITE_MOTIVO = 300;

export const ultimoMovimiento = (h: readonly MovimientoHistorial[]) => h[h.length - 1];
export const estadoActual = (h: readonly MovimientoHistorial[]): EstadoCaso => ultimoMovimiento(h).estado;

/** Cerrado por deshabilitación: el último movimiento es una deshabilitación (el estado del caso es el del último movimiento). */
export const esDeshabilitado = (h: readonly MovimientoHistorial[]) => ultimoMovimiento(h).tipo === "deshabilitación";

/** HU 018, regla 4: solo se deshabilita un caso que no esté en «Cerrado». */
export const puedeDeshabilitar = (h: readonly MovimientoHistorial[]) => estadoActual(h) !== "Cerrado";

/** HU 018, regla 5: solo se restaura un caso cerrado por deshabilitación (no los cancelados ni los cerrados tras una localización). */
export const puedeRestaurar = esDeshabilitado;

/** La restauración lee el movimiento anterior a la deshabilitación (R12). */
export function estadoPrevioADeshabilitacion(h: readonly MovimientoHistorial[]): EstadoCaso | undefined {
  return esDeshabilitado(h) && h.length > 1 ? h[h.length - 2].estado : undefined;
}

/** Motivo de la deshabilitación vigente y su fecha, o undefined si el caso no está deshabilitado. */
export function deshabilitacionVigente(h: readonly MovimientoHistorial[]): { motivo: string; fechaHora: string } | undefined {
  const m = ultimoMovimiento(h);
  return m.tipo === "deshabilitación" ? { motivo: m.motivo ?? "", fechaHora: m.fechaHora } : undefined;
}

export function deshabilitar(h: readonly MovimientoHistorial[], motivo: string, fechaHora: string): MovimientoHistorial[] {
  if (!puedeDeshabilitar(h)) throw new Error("Un caso en «Cerrado» no se puede deshabilitar");
  return [...h, { consecutivo: h.length + 1, fechaHora, tipo: "deshabilitación", estado: "Cerrado", motivo: motivo.trim() }];
}

/** Regresa el caso al estado que tenía antes de la deshabilitación y registra el movimiento. */
export function restaurar(h: readonly MovimientoHistorial[], fechaHora: string): MovimientoHistorial[] {
  const previo = estadoPrevioADeshabilitacion(h);
  if (!previo) throw new Error("Solo se restaura un caso cerrado por deshabilitación");
  return [...h, { consecutivo: h.length + 1, fechaHora, tipo: "restauración", estado: previo }];
}

/** Valida el motivo obligatorio (MOD-08 y MOD-09); devuelve el mensaje de error o undefined. */
export function errorDeMotivo(motivo: string): string | undefined {
  if (!motivo.trim()) return "Escribe el motivo para continuar.";
  if (motivo.trim().length > LIMITE_MOTIVO) return `El motivo no puede pasar de ${LIMITE_MOTIVO} caracteres.`;
  return undefined;
}

/**
 * Por qué un caso cerrado no se deshabilita ni se restaura (HU 018, reglas 4 y 5), según cómo se cerró; undefined si la acción está disponible.
 * Una frase corta cada uno.
 */
export function motivoCasoCerrado(h: readonly MovimientoHistorial[]): string | undefined {
  if (puedeDeshabilitar(h) || puedeRestaurar(h)) return undefined;
  return ultimoMovimiento(h).tipo === "cancelación" ? "Cancelado por la persona tutora: no puede deshabilitarse ni restaurarse." : "Cerrado tras una localización confirmada: no puede deshabilitarse ni restaurarse.";
}

/** Versión corta para la tabla compacta. */
export const motivoCasoCerradoCorto = (h: readonly MovimientoHistorial[]) => (motivoCasoCerrado(h) ? (ultimoMovimiento(h).tipo === "cancelación" ? "Cancelado por la persona tutora" : "Cerrado tras localización confirmada") : undefined);
