import "server-only";
// HU 018 y 016 (P6a): moderación de registros de extravío por el Administrador. Cada servicio llama PRIMERO a `exigirAdministrador` (401 sin sesión, 403 con otro rol); el folio mal formado o inexistente
// es el mismo 404. Deshabilitar y restaurar son UNA transacción con su entrada de bitácora (R24). Las respuestas salen de `serializadores/admin.ts`: nunca llevan datos de la persona tutora ni el token del QR.
import { ESTADOS_CASO, PATRON_FOLIO, type Alcaldia, type EstadoCaso } from "../../../mocks/tipos";
import { normalizarFolio } from "../../dominio/folio";
import { puedeDeshabilitar, puedeRestaurar, cierreDelCaso } from "../../dominio/moderacion";
import { sanearMotivo } from "../../dominio/motivo";
import { paginar } from "../../dominio/paginacion";
import { ahoraUTC } from "../../dominio/fechas";
import { estadoActual } from "../../dominio/transiciones";
import { noEncontrado } from "../../errores";
import { aRegistroAdminDetalle, aRegistroAdminLista, type RegistroAdminDetalle, type RegistroAdminLista } from "../../serializadores/admin";
import { exigirAdministrador, type SesionActual } from "../../sesion/guardas";
import type { CasoExtravio } from "../../tipos";
import { contextoPorDefecto, historialDe, type Contexto } from "../contexto";

const POR_PAGINA = 5;

/** Motivo y fecha de la deshabilitación vigente (el último movimiento es una deshabilitación); si no, nada. */
const moderacionVigente = (h: { tipo: string; motivo?: string; fechaHora: string }[]) => {
  const m = h[h.length - 1];
  return m && m.tipo === "deshabilitación" ? { motivo: m.motivo ?? "", fechaHora: m.fechaHora } : undefined;
};

async function casoPorFolio(folio: string, ctx: Contexto): Promise<CasoExtravio> {
  const f = normalizarFolio(folio);
  const caso = PATRON_FOLIO.test(f) ? await ctx.repos.casos.porFolio(f) : undefined;
  if (!caso) throw noEncontrado();
  return caso;
}

/** Foto del perro de un caso: la vía exclusiva del Administrador si hay bytes subidos (también en un caso deshabilitado), o el marcador sembrado del maquetado. */
async function urlDeFoto(caso: CasoExtravio, idFotografia: number, ctx: Contexto): Promise<string> {
  const subida = await ctx.repos.casos.contenidoDeFotografia(idFotografia);
  if (subida) return `/api/admin/registros/${caso.folio}/fotografia`;
  return (await ctx.repos.casos.fotografia(idFotografia))?.referenciaArchivo ?? "";
}

async function vistaDeLista(caso: CasoExtravio, ctx: Contexto): Promise<RegistroAdminLista> {
  const [perro, alcaldias, historial] = [(await ctx.repos.casos.perro(caso.idPerro))!, await ctx.repos.catalogos.alcaldias(), await historialDe(ctx.repos, caso.idCasoExtravio)];
  const estado = estadoActual(historial)!;
  return aRegistroAdminLista({
    folio: caso.folio, nombre: perro.nombre, fotografiaUrl: await urlDeFoto(caso, perro.idFotografia, ctx), fechaRegistro: caso.fechaRegistro, alcaldia: alcaldias.find((a) => a.idAlcaldia === caso.idAlcaldia)?.nombre ?? "",
    estado, puedeDeshabilitar: puedeDeshabilitar(estado), puedeRestaurar: puedeRestaurar(historial), cierre: cierreDelCaso(historial),
    moderacion: moderacionVigente(historial),
  });
}

export type ListadoDeRegistros = { items: RegistroAdminLista[]; pagina: number; totalPaginas: number; total: number; porPagina: number; filtros: { estado?: EstadoCaso; alcaldia?: number }; errores: { estado?: string; alcaldia?: string }; alcaldias: { id: number; nombre: string }[]; estados: readonly EstadoCaso[] };

/** ADM-04: todos los registros, del más reciente al más antiguo, con filtros por estado y alcaldía validados aquí (un filtro inválido no se aplica y se informa) y páginas de 5. */
export async function listarRegistros(sesion: SesionActual | undefined, entrada: { estado?: unknown; alcaldia?: unknown; pagina?: unknown } = {}, ctx: Contexto = contextoPorDefecto()): Promise<ListadoDeRegistros> {
  exigirAdministrador(sesion);
  const alcaldias = await ctx.repos.catalogos.alcaldias();
  const filtros: ListadoDeRegistros["filtros"] = {};
  const errores: ListadoDeRegistros["errores"] = {};
  const estado = typeof entrada.estado === "string" ? entrada.estado.trim() : "";
  if ((ESTADOS_CASO as readonly string[]).includes(estado)) filtros.estado = estado as EstadoCaso;
  else if (estado) errores.estado = "Elige un estado de la lista.";
  const alc = typeof entrada.alcaldia === "string" ? entrada.alcaldia.trim() : "";
  if (alc) {
    const id = /^\d{1,3}$/.test(alc) ? Number(alc) : NaN;
    if (alcaldias.some((a) => a.idAlcaldia === id)) filtros.alcaldia = id;
    else errores.alcaldia = "Elige una alcaldía de la lista.";
  }
  const casos = [...(await ctx.repos.casos.todos())].sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro) || b.idCasoExtravio - a.idCasoExtravio);
  const vistas: RegistroAdminLista[] = [];
  for (const c of casos) {
    if (filtros.alcaldia !== undefined && c.idAlcaldia !== filtros.alcaldia) continue;
    const v = await vistaDeLista(c, ctx);
    if (!filtros.estado || v.estado === filtros.estado) vistas.push(v);
  }
  const p = paginar(vistas, entrada.pagina, POR_PAGINA);
  return { ...p, filtros, errores, alcaldias: alcaldias.map((a) => ({ id: a.idAlcaldia, nombre: a.nombre })), estados: ESTADOS_CASO };
}

/** HU 016, vista del Administrador: todos los campos del perro y del extravío (con los reservados del extravío) y el historial, en solo lectura; nunca datos de la persona tutora ni el token del QR. */
export async function detalleRegistro(sesion: SesionActual | undefined, folio: string, ctx: Contexto = contextoPorDefecto()): Promise<RegistroAdminDetalle> {
  exigirAdministrador(sesion);
  const caso = await casoPorFolio(folio, ctx);
  const [perro, catalogos, historial] = [(await ctx.repos.casos.perro(caso.idPerro))!, ctx.repos.catalogos, await historialDe(ctx.repos, caso.idCasoExtravio)];
  const [alcaldias, razas, motivos, lista] = [await catalogos.alcaldias(), await catalogos.razas(), await catalogos.motivos(), await vistaDeLista(caso, ctx)];
  return aRegistroAdminDetalle({
    ...lista, sexo: perro.sexo, raza: razas.find((r) => r.idRaza === perro.idRaza)?.nombre ?? "", razaEspecificada: perro.razaEspecificada, edadValor: perro.edadValor, edadUnidad: perro.edadUnidad, tamano: perro.tamano, color: perro.color,
    caracteristicasDistintivas: perro.caracteristicasDistintivas, fechaExtravio: caso.fechaExtravio, coloniaZona: caso.coloniaZona, momentoDelDia: caso.momentoDelDia, direccionAproximada: caso.direccionAproximada,
    referenciasDelLugar: caso.referenciasDelLugar, motivo: motivos.find((m) => m.idMotivo === caso.idMotivo)?.nombre ?? "", descripcionCircunstancias: caso.descripcionCircunstancias, historial,
    alcaldia: (alcaldias.find((a) => a.idAlcaldia === caso.idAlcaldia)?.nombre ?? lista.alcaldia) as Alcaldia,
  });
}

export type ResultadoDeModeracion = { folio: string; estado: EstadoCaso; fechaCambio: string };

/** HU 018: deshabilita un caso que no esté «Cerrado». Motivo obligatorio ≤ 300 y saneado (R34). 409 si el caso ya no lo permite (también ante una repetición o una cancelación simultánea de la tutora). */
export async function deshabilitarCaso(sesion: SesionActual | undefined, folio: string, motivo: unknown, ctx: Contexto = contextoPorDefecto()): Promise<ResultadoDeModeracion> {
  const admin = exigirAdministrador(sesion);
  const caso = await casoPorFolio(folio, ctx);
  const limpio = sanearMotivo(motivo);
  const r = await ctx.repos.administracion.deshabilitarCaso(caso.idCasoExtravio, { motivo: limpio ?? "", idAdministrador: admin.idUsuario, fecha: ahoraUTC(ctx.reloj) });
  return { folio: caso.folio, estado: r.estado, fechaCambio: r.movimiento.fechaHora };
}

/** HU 018: restaura SOLO un caso cerrado por deshabilitación, al estado que tenía antes. Los cancelados y los cerrados tras una localización dan 409. */
export async function restaurarCaso(sesion: SesionActual | undefined, folio: string, ctx: Contexto = contextoPorDefecto()): Promise<ResultadoDeModeracion> {
  const admin = exigirAdministrador(sesion);
  const caso = await casoPorFolio(folio, ctx);
  const r = await ctx.repos.administracion.restaurarCaso(caso.idCasoExtravio, { idAdministrador: admin.idUsuario, fecha: ahoraUTC(ctx.reloj) });
  return { folio: caso.folio, estado: r.estado, fechaCambio: r.movimiento.fechaHora };
}

/**
 * Vía EXCLUSIVA del Administrador a la foto del perro (también de un caso deshabilitado, que la ficha pública oculta con 404 por R33). Sin sesión 401, tutora 403; folio mal formado, inexistente o sin foto
 * subida (marcador sembrado) = el mismo 404. La ruta responde `image/jpeg`, `no-store` y `nosniff`; la pública no se toca.
 */
export async function fotografiaDelPerroAdmin(sesion: SesionActual | undefined, folio: string, ctx: Contexto = contextoPorDefecto()): Promise<{ tipo: "image/jpeg"; bytes: Uint8Array }> {
  exigirAdministrador(sesion);
  const caso = await casoPorFolio(folio, ctx);
  const perro = (await ctx.repos.casos.perro(caso.idPerro))!;
  const contenido = await ctx.repos.casos.contenidoDeFotografia(perro.idFotografia);
  if (!contenido || contenido.tipo !== "image/jpeg") throw noEncontrado();
  return { tipo: "image/jpeg", bytes: contenido.bytes };
}
