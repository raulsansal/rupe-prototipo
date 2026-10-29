import "server-only";
// P5 (HU 040 y 046): seguimiento de los avistamientos por la persona tutora dueña y enlace público de estatus. Cada servicio aplica por sí mismo la guarda de sesión, rol y dueño (R32).
// Las marcas «visto» y «relevante» son SOLO del prototipo (sin columna en el diccionario): nunca salen por las funciones públicas ni de Administrador.
import type { EstadoCaso } from "../../mocks/tipos";
import { exigirBasePublica, type BasePublica } from "../config/urlPublica";
import { ahoraUTC } from "../dominio/fechas";
import { estadoActual } from "../dominio/transiciones";
import { conflictoDeEstado, formatoInvalido, noEncontrado } from "../errores";
import { urlDeEstatus } from "../qr/matrizQr";
import type { SesionActual } from "../sesion/guardas";
import { exigirRol } from "../sesion/guardas";
import type { Avistamiento } from "../tipos";
import { contextoPorDefecto, historialDe, type Contexto } from "./contexto";
import { casoDeLaTutora } from "./misRegistros";

/** El avistamiento VISIBLE del caso propio; el id de otro caso, oculto, inexistente o mal formado es el MISMO 404. */
async function avistamientoPropio(sesion: SesionActual | undefined, folio: string, id: string, ctx: Contexto) {
  const c = await casoDeLaTutora(sesion, folio, ctx);
  const n = /^\d{1,9}$/.test(String(id)) ? Number(id) : NaN;
  const av: Avistamiento | undefined = Number.isFinite(n) ? await ctx.repos.avistamientos.porId(n) : undefined;
  if (!av || !av.visible || av.idCasoExtravio !== c.caso.idCasoExtravio) throw noEncontrado();
  return { ...c, av };
}

export type ResultadoDeApertura = { id: number; /** Era nuevo: se marcó como visto ahora. */ marcado: boolean; estado: EstadoCaso; /** El caso pasó de «Avistamiento reportado» a «En seguimiento». */ cambioDeEstado: boolean };

/**
 * HU 040, regla 3: «al abrir el detalle de un avistamiento nuevo, si el caso está en Avistamiento reportado, pasa a En seguimiento» (movimiento «avistamiento revisado», automático).
 * La pantalla lo llama con un POST al montar el detalle SOLO si el avistamiento es nuevo; el servidor nunca escribe al renderizar. IDEMPOTENTE: repetirlo no duplica movimientos
 * (`marcado: false`). Con el caso Localizado o Cerrado solo se marca como visto: la matriz no mueve el estado.
 */
export async function abrirAvistamiento(sesion: SesionActual | undefined, folio: string, id: string, ctx: Contexto = contextoPorDefecto()): Promise<ResultadoDeApertura> {
  const { av } = await avistamientoPropio(sesion, folio, id, ctx);
  const r = await ctx.repos.avistamientos.marcarVisto(av.idAvistamiento, ahoraUTC(ctx.reloj));
  return { id: av.idAvistamiento, marcado: r.cambio, estado: r.estado, cambioDeEstado: r.movimiento !== undefined };
}

/** HU 040: «Marcar como relevante», reversible y solo para la persona dueña. Idempotente. El valor debe ser booleano (400 si no). */
export async function marcarRelevante(sesion: SesionActual | undefined, folio: string, id: string, relevante: unknown, ctx: Contexto = contextoPorDefecto()): Promise<{ id: number; relevante: boolean }> {
  const { av } = await avistamientoPropio(sesion, folio, id, ctx);
  if (typeof relevante !== "boolean") throw formatoInvalido("RELEVANTE_INVALIDO", "«relevante» debe ser verdadero o falso.");
  await ctx.repos.avistamientos.marcarRelevante(av.idAvistamiento, relevante);
  return { id: av.idAvistamiento, relevante };
}

/** Campana de la persona tutora: avistamientos NUEVOS y VISIBLES de TODOS sus casos (baja al abrir el detalle de cada uno). */
export async function contarAvistamientosNuevos(sesion: SesionActual | undefined, ctx: Contexto = contextoPorDefecto()): Promise<number> {
  const persona = exigirRol(sesion, "Tutor");
  const propios = new Set<number>();
  for (const caso of await ctx.repos.casos.todos()) {
    const perro = await ctx.repos.casos.perro(caso.idPerro);
    if (perro && perro.idUsuario === persona.idUsuario) propios.add(caso.idCasoExtravio);
  }
  return (await ctx.repos.avistamientos.todos()).filter((a) => propios.has(a.idCasoExtravio) && a.visible && a.vistoPorTutora === false).length;
}

export const MENSAJE_ESTATUS_NO_COMPARTIBLE = "Un caso cerrado ya no se comparte.";

/**
 * HU 046: enlace público de consulta de estatus, `<base>/estatus/<FOLIO>`: SIEMPRE el folio (nunca el token del QR) y nunca datos personales. Disponible en cualquier estado salvo
 * Cerrado (409). `null` si falta la URL pública (la pantalla avisa); sin ruta de desarrollo ni datos de la persona en el enlace.
 */
export async function enlaceDeEstatus(sesion: SesionActual | undefined, folio: string, base: BasePublica, ctx: Contexto = contextoPorDefecto()): Promise<string | null> {
  const { caso } = await casoDeLaTutora(sesion, folio, ctx);
  const estado = estadoActual(await historialDe(ctx.repos, caso.idCasoExtravio));
  if (estado === "Cerrado") throw conflictoDeEstado("CASO_CERRADO", MENSAJE_ESTATUS_NO_COMPARTIBLE);
  if (!base.ok) return null;
  return urlDeEstatus(exigirBasePublica(base).base, caso.folio);
}
