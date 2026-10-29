import "server-only";
// HU 037 (P6a): moderación de avistamientos por el Administrador. `exigirAdministrador` primero. El avistamiento llega SIN dirección, colonia, referencias, coordenadas ni las marcas internas de la tutora
// (`serializadores/admin.ts`); el comentario sí. PATRÓN DE FOTO SENSIBLE (P4): la dirección de la foto de un avistamiento «Fallecido» no sale en los listados y el detalle solo la incluye con `verFoto`.
import { esFallecido } from "../../../mocks/avistamientos";
import { diaCDMX, validarRangoDeDias } from "../../dominio/filtrosAvistamientos";
import { sanearMotivo } from "../../dominio/motivo";
import { paginar } from "../../dominio/paginacion";
import { ahoraUTC } from "../../dominio/fechas";
import { noEncontrado, reglaDeNegocio } from "../../errores";
import { aAvistamientoAdmin, type AvistamientoAdmin } from "../../serializadores/admin";
import { exigirAdministrador, type SesionActual } from "../../sesion/guardas";
import type { Avistamiento } from "../../tipos";
import { contextoPorDefecto, type Contexto } from "../contexto";

const POR_PAGINA = 5;

async function vista(av: Avistamiento, ctx: Contexto, { conFoto }: { conFoto: boolean }, previos?: { casos: Map<number, string>; alcaldias: Map<number, string>; estados: Map<number, string> }): Promise<AvistamientoAdmin> {
  const { repos } = ctx;
  const casos = previos?.casos ?? new Map((await repos.casos.todos()).map((c) => [c.idCasoExtravio, c.folio]));
  const alcaldias = previos?.alcaldias ?? new Map((await repos.catalogos.alcaldias()).map((a) => [a.idAlcaldia, a.nombre]));
  const catalogoEstados = previos?.estados ?? new Map((await repos.catalogos.estadosAnimal()).map((e) => [e.idEstadoAnimal, e.nombre]));
  const estadosAnimal = (await repos.avistamientos.estadosDe(av.idAvistamiento)).map((id) => catalogoEstados.get(id) ?? "").filter(Boolean);
  const fallecido = esFallecido({ estadosAnimal });
  const foto = await repos.casos.fotografia(av.idFotografia);
  let fechaModeracion: string | undefined;
  if (!av.visible) fechaModeracion = [...(await repos.bitacora.todas())].filter((b) => b.tipoAccion === "ocultar avistamiento" && b.idAfectada === String(av.idAvistamiento)).sort((x, y) => y.fechaHora.localeCompare(x.fechaHora))[0]?.fechaHora;
  return aAvistamientoAdmin({
    id: av.idAvistamiento, folio: casos.get(av.idCasoExtravio) ?? "", fechaHora: av.fechaHoraAvistamiento, alcaldia: alcaldias.get(av.idAlcaldia) ?? "", estadosAnimal, comentario: av.comentario,
    fotografiaUrl: fallecido && !conFoto ? undefined : foto?.referenciaArchivo, fallecido, visible: av.visible, motivoModeracion: av.visible ? undefined : av.motivoModeracion, fechaModeracion,
  });
}

const parseId = (id: string): number => {
  if (!/^\d{1,9}$/.test(String(id))) throw noEncontrado();
  return Number(id);
};
async function avistamientoPorId(id: string, ctx: Contexto): Promise<Avistamiento> {
  const av = await ctx.repos.avistamientos.porId(parseId(id));
  if (!av) throw noEncontrado();
  return av;
}

export type ListadoDeAvistamientos = { items: AvistamientoAdmin[]; pagina: number; totalPaginas: number; total: number; porPagina: number; filtros: { estatus?: "visible" | "oculto"; desde?: string; hasta?: string }; errores: { estatus?: string; desde?: string; hasta?: string } };

/** ADM-05: todos los avistamientos (visibles y ocultos), del más reciente al más antiguo, con filtros por estatus y por día del avistamiento (CDMX) validados aquí, y páginas de 5. */
export async function listarAvistamientos(sesion: SesionActual | undefined, entrada: { estatus?: unknown; desde?: unknown; hasta?: unknown; pagina?: unknown } = {}, ctx: Contexto = contextoPorDefecto()): Promise<ListadoDeAvistamientos> {
  exigirAdministrador(sesion);
  const errores: ListadoDeAvistamientos["errores"] = {};
  const filtros: ListadoDeAvistamientos["filtros"] = {};
  const e = typeof entrada.estatus === "string" ? entrada.estatus.trim() : "";
  if (e === "visible" || e === "oculto") filtros.estatus = e;
  else if (e) errores.estatus = "Elige «Visible» u «Oculto».";
  const rango = validarRangoDeDias(entrada);
  Object.assign(filtros, { ...(rango.desde ? { desde: rango.desde } : {}), ...(rango.hasta ? { hasta: rango.hasta } : {}) });
  Object.assign(errores, rango.errores);
  const previos = {
    casos: new Map((await ctx.repos.casos.todos()).map((c) => [c.idCasoExtravio, c.folio])), alcaldias: new Map((await ctx.repos.catalogos.alcaldias()).map((a) => [a.idAlcaldia, a.nombre])),
    estados: new Map((await ctx.repos.catalogos.estadosAnimal()).map((x) => [x.idEstadoAnimal, x.nombre])),
  };
  const todos = [...(await ctx.repos.avistamientos.todos())].sort((a, b) => b.fechaHoraAvistamiento.localeCompare(a.fechaHoraAvistamiento) || b.idAvistamiento - a.idAvistamiento);
  const elegidos = todos.filter((a) => {
    const dia = diaCDMX(a.fechaHoraAvistamiento);
    return (!filtros.estatus || (filtros.estatus === "visible") === a.visible) && (!filtros.desde || dia >= filtros.desde) && (!filtros.hasta || dia <= filtros.hasta);
  });
  const p = paginar(elegidos, entrada.pagina, POR_PAGINA);
  return { ...p, items: await Promise.all(p.items.map((a) => vista(a, ctx, { conFoto: false }, previos))), filtros, errores };
}

/** HU 037: detalle en solo lectura. La foto de un avistamiento «Fallecido» solo se entrega con `verFoto` (aviso «Esta imagen puede resultar sensible» y botón «Ver fotografía»). */
export async function detalleAvistamiento(sesion: SesionActual | undefined, id: string, { verFoto = false }: { verFoto?: boolean } = {}, ctx: Contexto = contextoPorDefecto()): Promise<AvistamientoAdmin> {
  exigirAdministrador(sesion);
  return vista(await avistamientoPorId(id, ctx), ctx, { conFoto: verFoto });
}

export type ResultadoDeAvistamiento = { id: number; visible: boolean; fechaCambio: string };

/** HU 037: oculta un avistamiento visible. Motivo obligatorio ≤ 300 y saneado; 409 si ya está oculto. Deja de verse en el historial de la tutora (no se elimina). */
export async function ocultarAvistamiento(sesion: SesionActual | undefined, id: string, motivo: unknown, ctx: Contexto = contextoPorDefecto()): Promise<ResultadoDeAvistamiento> {
  const admin = exigirAdministrador(sesion);
  const av = await avistamientoPorId(id, ctx);
  const limpio = sanearMotivo(motivo);
  if (!limpio) throw reglaDeNegocio("R24", "Escribe el motivo para continuar.", "MOTIVO_OBLIGATORIO");
  const fecha = ahoraUTC(ctx.reloj);
  await ctx.repos.administracion.ocultarAvistamiento(av.idAvistamiento, { motivo: limpio, idAdministrador: admin.idUsuario, fecha });
  return { id: av.idAvistamiento, visible: false, fechaCambio: fecha };
}

/** HU 037: restaura un avistamiento oculto (limpia el motivo). 409 si ya es visible. */
export async function restaurarAvistamiento(sesion: SesionActual | undefined, id: string, ctx: Contexto = contextoPorDefecto()): Promise<ResultadoDeAvistamiento> {
  const admin = exigirAdministrador(sesion);
  const av = await avistamientoPorId(id, ctx);
  const fecha = ahoraUTC(ctx.reloj);
  await ctx.repos.administracion.restaurarAvistamiento(av.idAvistamiento, { idAdministrador: admin.idUsuario, fecha });
  return { id: av.idAvistamiento, visible: true, fechaCambio: fecha };
}
