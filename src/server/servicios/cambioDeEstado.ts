import "server-only";
// P5 (HU 042, 043 y 017): la persona tutora cambia el estado de SU caso: localizar, cerrar (cierre confirmado), reactivar y cancelar. Todas pasan por la matriz R12 (`dominio/transiciones.ts`)
// dentro de UNA operación atómica del repositorio (`historial.registrar`): una repetición o una petición simultánea ve el estado nuevo y recibe 409, sin duplicar movimientos.
// Sin bitácora (R24 solo cubre acciones administrativas) y sin notificaciones. El QR NO se toca: sigue vigente tras localizar y tras reactivar (R7/R27); si el caso admite o no
// avistamientos lo decide el historial (R13).
import type { EstadoCaso, TipoMovimiento } from "../../mocks/tipos";
import { sanearMotivo } from "../dominio/motivo";
import { ahoraUTC } from "../dominio/fechas";
import { formatoInvalido, ErrorApp } from "../errores";
import type { SesionActual } from "../sesion/guardas";
import { contextoPorDefecto, type Contexto } from "./contexto";
import { casoDeLaTutora } from "./misRegistros";

export const ACCIONES_DE_ESTADO = ["localizar", "cerrar", "reactivar", "cancelar"] as const;
export type AccionDeEstado = (typeof ACCIONES_DE_ESTADO)[number];

const MOVIMIENTO: Record<AccionDeEstado, { tipo: TipoMovimiento; conMotivo: boolean }> = {
  localizar: { tipo: "localización", conMotivo: false },
  cerrar: { tipo: "cierre confirmado", conMotivo: false },
  reactivar: { tipo: "reactivación", conMotivo: true },
  cancelar: { tipo: "cancelación", conMotivo: true },
};

/** Mensaje amable cuando el caso ya no está en un estado que permite la acción (otra petición o la propia persona ya lo cambió). */
export const MENSAJE_YA_CAMBIO = "El caso ya no está en un estado que permita esta acción. Actualiza la pantalla para ver su estado actual.";

export type ResultadoDeCambio = { folio: string; estado: EstadoCaso; fechaCambio: string };

/**
 * Orden de las comprobaciones: sesión y rol (401/403) → dueño (404 uniforme) → acción (400) → motivo (422) → transición (409). La acción y el motivo se validan DESPUÉS de la guarda:
 * una persona ajena no averigua nada con una acción inválida. El motivo solo se usa en «reactivar» y «cancelar» (en las demás se ignora); el dueño y el actor salen de la sesión.
 */
export async function cambiarEstadoDelCaso(sesion: SesionActual | undefined, folio: string, entrada: { accion?: unknown; motivo?: unknown }, ctx: Contexto = contextoPorDefecto()): Promise<ResultadoDeCambio> {
  const { caso, persona } = await casoDeLaTutora(sesion, folio, ctx);
  const accion = ACCIONES_DE_ESTADO.find((a) => a === entrada.accion);
  if (!accion) throw formatoInvalido("ACCION_INVALIDA", "La acción debe ser «localizar», «cerrar», «reactivar» o «cancelar».");
  const { tipo, conMotivo } = MOVIMIENTO[accion];
  const motivo = conMotivo ? sanearMotivo(entrada.motivo) : undefined;
  try {
    const { movimiento, estado } = await ctx.repos.historial.registrar(caso.idCasoExtravio, { tipo, actor: "Tutor", motivo, idUsuario: persona.idUsuario, fechaHora: ahoraUTC(ctx.reloj) });
    return { folio: caso.folio, estado, fechaCambio: movimiento.fechaHora };
  } catch (e) {
    // La transición ya no vale (409 TRANSICION_INVALIDA): se responde con un mensaje que la pantalla trata como «ya cambió». Los demás errores (motivo) salen tal cual.
    if (e instanceof ErrorApp && e.estado === 409 && e.codigo === "TRANSICION_INVALIDA") throw new ErrorApp(409, "TRANSICION_INVALIDA", MENSAJE_YA_CAMBIO, "R12");
    throw e;
  }
}

export const marcarLocalizado = (sesion: SesionActual | undefined, folio: string, ctx?: Contexto) => cambiarEstadoDelCaso(sesion, folio, { accion: "localizar" }, ctx);
export const cerrarCaso = (sesion: SesionActual | undefined, folio: string, ctx?: Contexto) => cambiarEstadoDelCaso(sesion, folio, { accion: "cerrar" }, ctx);
export const reactivarCaso = (sesion: SesionActual | undefined, folio: string, motivo: unknown, ctx?: Contexto) => cambiarEstadoDelCaso(sesion, folio, { accion: "reactivar", motivo }, ctx);
export const cancelarCaso = (sesion: SesionActual | undefined, folio: string, motivo: unknown, ctx?: Contexto) => cambiarEstadoDelCaso(sesion, folio, { accion: "cancelar", motivo }, ctx);
