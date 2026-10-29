import "server-only";
// «Mis registros» (P2b): las pantallas de la persona tutora leen el ALMACÉN, no los mocks. Cada servicio aplica por sí mismo la guarda de sesión, rol Tutor y dueño
// (R32): el dueño sale SIEMPRE de la sesión; un caso ajeno, uno inexistente y un folio mal formado responden exactamente lo mismo (404). El almacén guarda ids; aquí se
// resuelven a los NOMBRES del catálogo (fuente de verdad) y se arman los tipos de mocks/tipos.ts que ya esperan los componentes.
import { construirHistorial } from "../../mocks/casos";
import { esFallecido } from "../../mocks/avistamientos";
import { PATRON_FOLIO, type Alcaldia, type CasoTutor, type EstadoCaso, type FichaPublica, type FichaTutor, type MovimientoHistorial } from "../../mocks/tipos";
import { normalizarFolio } from "../dominio/folio";
import { estadoActual } from "../dominio/transiciones";
import { noEncontrado } from "../errores";
import type { CasoExtravio, Fotografia, Perro } from "../tipos";
import { exigirAccesoAlCaso, exigirRol, type SesionActual } from "../sesion/guardas";
import { contextoPorDefecto, historialDe, type Contexto } from "./contexto";

type Nombres = { raza: string; alcaldia: Alcaldia; motivo: string };
type Cargado = { caso: CasoExtravio; perro: Perro; foto: Fotografia | undefined; historial: MovimientoHistorial[]; nombres: Nombres; estado: EstadoCaso };

async function nombresDe(caso: CasoExtravio, perro: Perro, ctx: Contexto): Promise<Nombres> {
  const { catalogos } = ctx.repos;
  const [razas, alcaldias, motivos] = [await catalogos.razas(), await catalogos.alcaldias(), await catalogos.motivos()];
  return {
    raza: razas.find((r) => r.idRaza === perro.idRaza)?.nombre ?? "",
    alcaldia: (alcaldias.find((a) => a.idAlcaldia === caso.idAlcaldia)?.nombre ?? "") as Alcaldia,
    motivo: motivos.find((m) => m.idMotivo === caso.idMotivo)?.nombre ?? "",
  };
}

async function cargar(caso: CasoExtravio, perro: Perro, ctx: Contexto): Promise<Cargado> {
  const [foto, historial, nombres] = [await ctx.repos.casos.fotografia(perro.idFotografia), await historialDe(ctx.repos, caso.idCasoExtravio), await nombresDe(caso, perro, ctx)];
  return { caso, perro, foto, historial, nombres, estado: estadoActual(historial) ?? "En búsqueda" };
}

/** El caso de la sesión por su folio: 401/403 por sesión o rol; ajeno, inexistente y folio mal formado son el MISMO 404. */
async function casoPropio(sesion: SesionActual | undefined, folio: string, ctx: Contexto): Promise<Cargado> {
  const persona = exigirRol(sesion, "Tutor");
  const f = normalizarFolio(folio);
  const caso = PATRON_FOLIO.test(f) ? await ctx.repos.casos.porFolio(f) : undefined;
  const perro = caso && (await ctx.repos.casos.perro(caso.idPerro));
  if (!caso || !perro) throw noEncontrado();
  exigirAccesoAlCaso(persona, perro.idUsuario, "consultar"); // otra persona tutora: 404
  return cargar(caso, perro, ctx);
}

/** «Localizado el 9 oct»: la fecha del movimiento de localización solo se deriva para los casos «Localizado» (el resto no la muestra). */
const fechaDeLocalizacion = (c: Cargado) => (c.estado === "Localizado" ? c.historial[c.historial.length - 1]?.fechaHora : undefined);

function aFicha(c: Cargado): FichaTutor {
  const p = c.perro;
  const ficha: FichaTutor = {
    nombre: p.nombre, sexo: p.sexo, raza: p.razaEspecificada ?? c.nombres.raza, edadValor: p.edadValor, edadUnidad: p.edadUnidad, tamano: p.tamano, color: p.color,
    fotografiaUrl: c.foto?.referenciaArchivo ?? "", fechaExtravio: c.caso.fechaExtravio, alcaldia: c.nombres.alcaldia, coloniaZona: c.caso.coloniaZona, folio: c.caso.folio as FichaPublica["folio"], estado: c.estado,
    fechaCambioEstado: fechaDeLocalizacion(c),
  };
  if (p.caracteristicasDistintivas) ficha.caracteristicasDistintivas = p.caracteristicasDistintivas;
  return ficha;
}

/** «Mis registros» (HU 015): SOLO los casos de la persona de la sesión, por fecha de creación descendente. Un caso cancelado o cerrado se ve igual que en el maquetado. */
export async function listarCasosDelTutor(sesion: SesionActual | undefined, ctx: Contexto = contextoPorDefecto()): Promise<FichaTutor[]> {
  const persona = exigirRol(sesion, "Tutor");
  const propios: Cargado[] = [];
  for (const caso of await ctx.repos.casos.todos()) {
    const perro = await ctx.repos.casos.perro(caso.idPerro);
    if (perro && perro.idUsuario === persona.idUsuario) propios.push(await cargar(caso, perro, ctx));
  }
  return propios.sort((a, b) => b.caso.fechaRegistro.localeCompare(a.caso.fechaRegistro) || b.caso.idCasoExtravio - a.caso.idCasoExtravio).map(aFicha);
}

/**
 * Detalle del caso (TUT-05): la vista de la persona tutora dueña, sin su nombre, correo ni teléfono y sin el token del QR. `estadoForzado` es SOLO de las variantes del
 * maquetado (?estado=… para capturas y pruebas): sintetiza el historial como antes; sin él, el historial es el real.
 */
export async function casoDelTutor(sesion: SesionActual | undefined, folio: string, opciones: { estadoForzado?: EstadoCaso } = {}, ctx: Contexto = contextoPorDefecto()): Promise<CasoTutor> {
  const c = await casoPropio(sesion, folio, ctx);
  const { perro, caso, nombres } = c;
  const forzado = opciones.estadoForzado && opciones.estadoForzado !== c.estado ? opciones.estadoForzado : undefined;
  const estado = forzado ?? c.estado;
  const historial = forzado ? construirHistorial(forzado, caso.fechaRegistro) : c.historial;
  return {
    nombre: perro.nombre, sexo: perro.sexo, edadValor: perro.edadValor, edadUnidad: perro.edadUnidad, tamano: perro.tamano, color: perro.color, caracteristicasDistintivas: perro.caracteristicasDistintivas,
    razaEspecificada: perro.razaEspecificada, raza: nombres.raza, fotografiaUrl: c.foto?.referenciaArchivo ?? "",
    folio: caso.folio as CasoTutor["folio"], fechaExtravio: caso.fechaExtravio, momentoDelDia: caso.momentoDelDia, coloniaZona: caso.coloniaZona, direccionAproximada: caso.direccionAproximada,
    referenciasDelLugar: caso.referenciasDelLugar, descripcionCircunstancias: caso.descripcionCircunstancias, alcaldia: nombres.alcaldia, motivo: nombres.motivo, estado,
    fechaCambioEstado: forzado ? undefined : fechaDeLocalizacion(c), fechaRegistro: caso.fechaRegistro, historial,
  };
}

/** Ficha de búsqueda (TUT-07): solo columnas P, con la foto propia (privada). El QR sigue siendo ilustrativo (P3). */
export async function fichaDelTutor(sesion: SesionActual | undefined, folio: string, ctx: Contexto = contextoPorDefecto()): Promise<FichaPublica> {
  const { fechaCambioEstado, ...ficha } = aFicha(await casoPropio(sesion, folio, ctx));
  void fechaCambioEstado;
  return ficha;
}

/** Para editar y notificaciones (pantallas pendientes): solo confirma que el caso es de la persona de la sesión (404 si no). */
export async function exigirCasoPropio(sesion: SesionActual | undefined, folio: string, ctx: Contexto = contextoPorDefecto()): Promise<{ folio: string }> {
  return { folio: (await casoPropio(sesion, folio, ctx)).caso.folio };
}

// ----------------------------------------------------------------------------------------------------------------------------- avistamientos
export type AvistamientoDelCaso = {
  id: number; fechaHora: string; alcaldia: string; coloniaZona?: string; direccionAproximada?: string; referencias?: string; latitud: number; longitud: number;
  estadosAnimal: string[]; comentario?: string; fotografiaUrl: string; fallecido: boolean;
  /** La ubicación es una ESTIMACIÓN simulada del Prototipo (sin mapa): las pantallas lo avisan. */
  ubicacionSimulada: boolean;
};

/** Avistamientos VISIBLES del caso (los ocultos por moderación no salen), por fecha del avistamiento descendente (HU 039). Hoy solo los sembrados: los reales son de P4. */
async function visiblesDelCaso(c: Cargado, ctx: Contexto): Promise<AvistamientoDelCaso[]> {
  const { repos } = ctx;
  const [alcaldias, estados] = [await repos.catalogos.alcaldias(), await repos.catalogos.estadosAnimal()];
  const lista: AvistamientoDelCaso[] = [];
  for (const a of await repos.avistamientos.deCaso(c.caso.idCasoExtravio)) {
    if (!a.visible) continue;
    const ids = await repos.avistamientos.estadosDe(a.idAvistamiento);
    const estadosAnimal = estados.filter((e) => ids.includes(e.idEstadoAnimal)).map((e) => e.nombre);
    lista.push({
      id: a.idAvistamiento, fechaHora: a.fechaHoraAvistamiento, alcaldia: alcaldias.find((x) => x.idAlcaldia === a.idAlcaldia)?.nombre ?? "", coloniaZona: a.coloniaZona, direccionAproximada: a.direccionAproximada,
      referencias: a.referenciasDelLugar, latitud: a.latitud, longitud: a.longitud, estadosAnimal, comentario: a.comentario, fotografiaUrl: (await repos.casos.fotografia(a.idFotografia))?.referenciaArchivo ?? "",
      fallecido: esFallecido({ estadosAnimal }), ubicacionSimulada: a.ubicacionSimulada === true,
    });
  }
  return lista.sort((x, y) => y.fechaHora.localeCompare(x.fechaHora) || y.id - x.id);
}

export type ListaDeAvistamientos = {
  folio: string; nombrePerro: string; fotografiaPerro: string; registro: string; sexo: string; raza: string; tamano: string; color: string;
  items: { id: number; fechaHora: string; alcaldia: string; coloniaZona?: string; estados: string[]; fotografiaUrl?: string; fallecido: boolean }[];
};

/** TUT-08: un avistamiento «Fallecido» llega a la lista sin fotografía ni estados (solo el aviso sobrio, HU 039). */
export async function avistamientosDelCaso(sesion: SesionActual | undefined, folio: string, ctx: Contexto = contextoPorDefecto()): Promise<ListaDeAvistamientos> {
  const c = await casoPropio(sesion, folio, ctx);
  const items = (await visiblesDelCaso(c, ctx)).map((a) => ({ id: a.id, fechaHora: a.fechaHora, alcaldia: a.alcaldia, coloniaZona: a.coloniaZona, ubicacionSimulada: a.ubicacionSimulada, estados: a.fallecido ? [] : a.estadosAnimal, fotografiaUrl: a.fallecido ? undefined : a.fotografiaUrl, fallecido: a.fallecido }));
  return { folio: c.caso.folio, nombrePerro: c.perro.nombre, fotografiaPerro: c.foto?.referenciaArchivo ?? "", registro: c.caso.fechaRegistro, sexo: c.perro.sexo, raza: c.perro.razaEspecificada ?? c.nombres.raza, tamano: c.perro.tamano, color: c.perro.color, items };
}

/** TUT-10: el detalle de un avistamiento visible del caso; otro id (de otro caso, oculto o inexistente) es 404. */
export async function avistamientoDelCaso(sesion: SesionActual | undefined, folio: string, id: string, ctx: Contexto = contextoPorDefecto()): Promise<AvistamientoDelCaso & { folio: string }> {
  const c = await casoPropio(sesion, folio, ctx);
  const a = (await visiblesDelCaso(c, ctx)).find((x) => String(x.id) === id);
  if (!a) throw noEncontrado();
  return { ...a, folio: c.caso.folio };
}

/** TUT-09: marcadores en orden cronológico (el más antiguo primero), que numera los puntos y traza la ruta. */
export async function puntosDelMapa(sesion: SesionActual | undefined, folio: string, ctx: Contexto = contextoPorDefecto()) {
  const c = await casoPropio(sesion, folio, ctx);
  const puntos = [...(await visiblesDelCaso(c, ctx))].reverse().map(({ id, fechaHora, alcaldia, coloniaZona, latitud, longitud, ubicacionSimulada }) => ({ id, fechaHora, alcaldia, coloniaZona, latitud, longitud, ubicacionSimulada }));
  return { folio: c.caso.folio, registro: c.caso.fechaRegistro, puntos };
}
