// R12 y E1: transiciones válidas del estado del caso. El estado actual es el del último movimiento del historial (E1); el consecutivo
// es máximo + 1 por caso (R4). Funciones puras sobre el historial (mismos tipos que el maquetado). Matriz según el diccionario:
//
//  movimiento             origen                                                     llegada                    quién          motivo
//  registro               — (historial vacío)                                        Extraviado                 automático     —
//  ficha generada         Extraviado                                                 En búsqueda                automático     —
//  avistamiento recibido  En búsqueda, Avistamiento reportado, En seguimiento        Avistamiento reportado     automático     —
//  avistamiento revisado  Avistamiento reportado                                     En seguimiento             automático     —
//  localización           Extraviado, En búsqueda, Avistamiento reportado, En seg.   Localizado                 Tutor          —
//  reactivación           Localizado                                                 En seguimiento             Tutor          obligatorio
//  cierre confirmado      Localizado                                                 Cerrado                    Tutor          —
//  cancelación            Extraviado, En búsqueda, Avistamiento reportado, En seg.   Cerrado                    Tutor          obligatorio
//  deshabilitación        cualquiera excepto Cerrado                                 Cerrado                    Administrador  obligatorio
//  restauración           Cerrado por deshabilitación (último movimiento)            estado previo              Administrador  —
import { ESTADOS_ACTIVOS } from "../../mocks/tipos";
import type { EstadoCaso, MovimientoHistorial, TipoMovimiento } from "../../mocks/tipos";
import { LIMITE_MOTIVO } from "../../lib/moderacion";
import { conflictoDeEstado, reglaDeNegocio } from "../errores";

export type Actor = "automático" | "Tutor" | "Administrador";
type Regla = { origen: readonly EstadoCaso[] | "cualquiera-menos-cerrado" | null; llegada: EstadoCaso | "previo"; actor: Actor; motivoObligatorio: boolean };

export const MATRIZ: Record<TipoMovimiento, Regla> = {
  registro: { origen: null, llegada: "Extraviado", actor: "automático", motivoObligatorio: false },
  "ficha generada": { origen: ["Extraviado"], llegada: "En búsqueda", actor: "automático", motivoObligatorio: false },
  "avistamiento recibido": { origen: ["En búsqueda", "Avistamiento reportado", "En seguimiento"], llegada: "Avistamiento reportado", actor: "automático", motivoObligatorio: false },
  "avistamiento revisado": { origen: ["Avistamiento reportado"], llegada: "En seguimiento", actor: "automático", motivoObligatorio: false },
  localización: { origen: ESTADOS_ACTIVOS, llegada: "Localizado", actor: "Tutor", motivoObligatorio: false },
  reactivación: { origen: ["Localizado"], llegada: "En seguimiento", actor: "Tutor", motivoObligatorio: true },
  "cierre confirmado": { origen: ["Localizado"], llegada: "Cerrado", actor: "Tutor", motivoObligatorio: false },
  cancelación: { origen: ESTADOS_ACTIVOS, llegada: "Cerrado", actor: "Tutor", motivoObligatorio: true },
  deshabilitación: { origen: "cualquiera-menos-cerrado", llegada: "Cerrado", actor: "Administrador", motivoObligatorio: true },
  restauración: { origen: ["Cerrado"], llegada: "previo", actor: "Administrador", motivoObligatorio: false },
};

/** E1: el estado actual repite el último movimiento. */
export function estadoActual(h: readonly MovimientoHistorial[]): EstadoCaso | undefined {
  return h.length ? h[h.length - 1].estado : undefined;
}

/** Cerrado por deshabilitación = el último movimiento es una deshabilitación. */
const cerradoPorDeshabilitacion = (h: readonly MovimientoHistorial[]) => h.length > 0 && h[h.length - 1].tipo === "deshabilitación";

/** Estado al que llega el movimiento; lanza 409 si la transición no es válida o 422 si falta el motivo (o sobra de largo). */
export function estadoDeLlegada(h: readonly MovimientoHistorial[], tipo: TipoMovimiento, actor: Actor, motivo?: string): EstadoCaso {
  const r = MATRIZ[tipo];
  if (r.actor !== actor) throw conflictoDeEstado("ACTOR_NO_PERMITIDO", `«${tipo}» no corresponde a ${actor === "automático" ? "una acción manual" : `el rol ${actor}`}.`, "R12");
  const actual = estadoActual(h);
  if (r.origen === null) {
    if (actual !== undefined) throw conflictoDeEstado("TRANSICION_INVALIDA", "El caso ya tiene historial: el registro inicial solo existe una vez.", "R12");
  } else {
    if (actual === undefined) throw conflictoDeEstado("TRANSICION_INVALIDA", `«${tipo}» requiere un caso registrado.`, "R12");
    const permitido = r.origen === "cualquiera-menos-cerrado" ? actual !== "Cerrado" : r.origen.includes(actual);
    if (!permitido) throw conflictoDeEstado("TRANSICION_INVALIDA", `«${tipo}» no es válida desde «${actual}».`, "R12");
    if (tipo === "restauración" && !cerradoPorDeshabilitacion(h)) throw conflictoDeEstado("TRANSICION_INVALIDA", "Solo se restaura un caso cerrado por deshabilitación.", "R12");
  }
  if (r.motivoObligatorio && !motivo?.trim()) throw reglaDeNegocio("R12", `«${tipo}» requiere un motivo.`, "MOTIVO_OBLIGATORIO");
  if (motivo && motivo.trim().length > LIMITE_MOTIVO) throw reglaDeNegocio("R12", `El motivo no puede pasar de ${LIMITE_MOTIVO} caracteres.`, "MOTIVO_LARGO");
  // La restauración regresa al estado previo a la deshabilitación (el movimiento anterior).
  if (r.llegada === "previo") return h[h.length - 2].estado;
  return r.llegada;
}

/** Agrega el movimiento (consecutivo = máximo + 1, R4) y devuelve el historial nuevo; no modifica el original. */
export function registrarMovimiento(h: readonly MovimientoHistorial[], tipo: TipoMovimiento, actor: Actor, fechaHora: string, motivo?: string): MovimientoHistorial[] {
  const estado = estadoDeLlegada(h, tipo, actor, motivo);
  const consecutivo = h.reduce((m, x) => Math.max(m, x.consecutivo), 0) + 1;
  return [...h, { consecutivo, fechaHora, tipo, estado, ...(motivo?.trim() ? { motivo: motivo.trim() } : {}) }];
}
