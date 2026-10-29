// HU 018 y 037 (P6a): reglas de la moderación de registros y de avistamientos, del lado del servidor. La transición de estado la valida la matriz R12 (`transiciones.ts`); aquí viven
// las preguntas que las pantallas y los servicios hacen ANTES de intentar la acción y los textos de los errores. Funciones puras.
import type { EstadoCaso, MovimientoHistorial } from "../../mocks/tipos";
import { LIMITE_MOTIVO } from "../../lib/moderacion";
import { conflictoDeEstado } from "../errores";

export { LIMITE_MOTIVO };

/** HU 018, regla 4: solo se deshabilita un caso que no esté en «Cerrado» (sí uno «Localizado»: la matriz dice «cualquiera menos Cerrado»). */
export const puedeDeshabilitar = (estado: EstadoCaso) => estado !== "Cerrado";

/** HU 018, regla 5: solo se restaura un caso cerrado por deshabilitación: el último movimiento es una deshabilitación. Los cancelados y los cerrados tras una localización no. */
export const puedeRestaurar = (h: readonly MovimientoHistorial[]) => h.length > 0 && h[h.length - 1].tipo === "deshabilitación";

/** Cómo se cerró un caso «Cerrado» (el último movimiento): sirve para decir por qué no se puede restaurar. */
export type CierreDelCaso = "cierre confirmado" | "cancelación" | "deshabilitación";
export const cierreDelCaso = (h: readonly MovimientoHistorial[]): CierreDelCaso | undefined => {
  const u = h[h.length - 1];
  return u && u.estado === "Cerrado" ? (u.tipo as CierreDelCaso) : undefined;
};

export const MENSAJE_YA_CAMBIO_ADMIN = "El registro ya no está en un estado que permita esta acción. Actualiza la pantalla para ver su estado actual.";
export const errorCasoYaCambio = () => conflictoDeEstado("TRANSICION_INVALIDA", MENSAJE_YA_CAMBIO_ADMIN, "R12");

export const MENSAJE_AVISTAMIENTO_OCULTO = "El avistamiento ya está oculto.";
export const MENSAJE_AVISTAMIENTO_VISIBLE = "El avistamiento ya es visible.";
export const errorAvistamientoYaOculto = () => conflictoDeEstado("AVISTAMIENTO_YA_OCULTO", MENSAJE_AVISTAMIENTO_OCULTO);
export const errorAvistamientoYaVisible = () => conflictoDeEstado("AVISTAMIENTO_YA_VISIBLE", MENSAJE_AVISTAMIENTO_VISIBLE);
