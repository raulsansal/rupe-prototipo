import "server-only";
// HU 049 a 052 (P6b): catálogos de alcaldías, razas, motivos y estados del animal por el Administrador. `exigirAdministrador` primero, en cada servicio. Cada acción es UNA transacción del repositorio:
// el cambio + su entrada de bitácora (R24); la unicidad, los protegidos y «la última opción activa» se comprueban ahí dentro. Reactivar = editar con `activo:true` (R9). Un valor desactivado deja de
// ofrecerse en formularios nuevos pero los casos que ya lo usan lo siguen mostrando (se guarda el id y los nombres se resuelven sobre TODAS las filas).
// Búsqueda y paginación en el servidor, por la URL: una página inválida se corrige a la 1 y una que se pasa del final, a la última.
import { esTipoCatalogo, REGLAS_CATALOGO, type TipoCatalogo } from "../../../config/catalogos";
import { impedimentoParaDesactivar, normalizarNombre, type FilaCatalogo } from "../../dominio/catalogos";
import { ahoraUTC } from "../../dominio/fechas";
import { paginar } from "../../dominio/paginacion";
import { noEncontrado } from "../../errores";
import { aCatalogoAdmin, type CatalogoAdmin } from "../../serializadores/admin";
import { exigirAdministrador, type SesionActual } from "../../sesion/guardas";
import { contextoPorDefecto, type Contexto } from "../contexto";

const POR_PAGINA = 6;

export type CategoriaVista = { id: number; nombre: string };
export type ListadoDeCatalogo = { tipo: TipoCatalogo; items: CatalogoAdmin[]; categorias: CategoriaVista[]; pagina: number; totalPaginas: number; total: number; porPagina: number; filtros: { texto?: string } };

const tipoValido = (t: string): TipoCatalogo => {
  if (!esTipoCatalogo(t)) throw noEncontrado(); // 404 uniforme: no revela qué catálogos existen
  return t;
};
const parseId = (id: string): number => {
  if (!/^\d{1,9}$/.test(String(id))) throw noEncontrado();
  return Number(id);
};

/** Las filas del catálogo en la vista común del dominio y sus categorías (las de motivos y estados son fijas del sistema). */
async function leerCatalogo(tipo: TipoCatalogo, ctx: Contexto): Promise<{ filas: FilaCatalogo[]; categorias: CategoriaVista[] }> {
  const c = ctx.repos.catalogos;
  switch (tipo) {
    case "alcaldias":
      return { filas: (await c.alcaldias()).map((x) => ({ id: x.idAlcaldia, nombre: x.nombre, clave: x.claveGeoestadistica, activo: x.estatus === 1 })), categorias: [] };
    case "razas":
      return { filas: (await c.razas()).map((x) => ({ id: x.idRaza, nombre: x.nombre, clave: null, activo: x.estatus === 1 })), categorias: [] };
    case "motivos":
      return {
        filas: (await c.motivos()).map((x) => ({ id: x.idMotivo, nombre: x.nombre, clave: null, idCategoria: x.idCategoriaMotivo, descripcion: x.descripcion, activo: x.estatus === 1 })),
        categorias: (await c.categoriasMotivo()).map((x) => ({ id: x.idCategoriaMotivo, nombre: x.nombre })),
      };
    case "estados-animal":
      return {
        filas: (await c.estadosAnimal()).map((x) => ({ id: x.idEstadoAnimal, nombre: x.nombre, clave: null, idCategoria: x.idCategoriaEstadoAnimal, descripcion: x.descripcion, activo: x.estatus === 1 })),
        categorias: (await c.categoriasEstadoAnimal()).map((x) => ({ id: x.idCategoriaEstadoAnimal, nombre: x.nombre })),
      };
  }
}

function aVista(tipo: TipoCatalogo, f: FilaCatalogo, filas: readonly FilaCatalogo[], categorias: readonly CategoriaVista[]): CatalogoAdmin {
  const r = REGLAS_CATALOGO[tipo];
  const impedimento = f.activo ? impedimentoParaDesactivar(r, filas, f, categorias) : undefined;
  return aCatalogoAdmin({
    id: f.id, nombre: f.nombre, ...(f.clave ? { clave: f.clave } : {}), ...(f.idCategoria !== undefined ? { idCategoria: f.idCategoria, categoria: categorias.find((c) => c.id === f.idCategoria)?.nombre } : {}),
    ...(f.descripcion !== undefined ? { descripcion: f.descripcion } : {}), activo: f.activo, protegido: r.protegidos.includes(f.id), ...(impedimento ? { motivoNoDesactivable: impedimento.message } : {}),
  });
}

/** Listado de un catálogo (todas las filas, activas e inactivas), por id, con búsqueda por nombre o clave sin acentos; páginas de 6. */
export async function listarCatalogo(sesion: SesionActual | undefined, tipoEntrada: string, entrada: { texto?: unknown; pagina?: unknown } = {}, ctx: Contexto = contextoPorDefecto()): Promise<ListadoDeCatalogo> {
  exigirAdministrador(sesion);
  const tipo = tipoValido(tipoEntrada);
  const { filas, categorias } = await leerCatalogo(tipo, ctx);
  const texto = typeof entrada.texto === "string" ? entrada.texto.trim().slice(0, 100) : "";
  const buscado = normalizarNombre(texto);
  const visibles = [...filas].sort((a, b) => a.id - b.id).filter((f) => !buscado || normalizarNombre(`${f.nombre} ${f.clave ?? ""}`).includes(buscado));
  return { tipo, ...paginar(visibles.map((f) => aVista(tipo, f, filas, categorias)), entrada.pagina, POR_PAGINA), categorias, filtros: texto ? { texto } : {} };
}

async function vistaDe(tipo: TipoCatalogo, id: number, ctx: Contexto): Promise<CatalogoAdmin> {
  const { filas, categorias } = await leerCatalogo(tipo, ctx);
  return aVista(tipo, filas.find((f) => f.id === id)!, filas, categorias);
}

export async function altaCatalogo(sesion: SesionActual | undefined, tipoEntrada: string, entrada: unknown, ctx: Contexto = contextoPorDefecto()): Promise<{ item: CatalogoAdmin }> {
  const admin = exigirAdministrador(sesion);
  const tipo = tipoValido(tipoEntrada);
  const r = await ctx.repos.administracion.altaCatalogo(tipo, entrada, { idAdministrador: admin.idUsuario, fecha: ahoraUTC(ctx.reloj) });
  return { item: await vistaDe(tipo, r.fila.id, ctx) };
}

/** Edición; con `activo:true` sobre una fila desactivada la REACTIVA. Sin cambios: `sinCambios:true` y no se escribe nada. */
export async function editarCatalogo(sesion: SesionActual | undefined, tipoEntrada: string, id: string, entrada: unknown, ctx: Contexto = contextoPorDefecto()): Promise<{ item: CatalogoAdmin; sinCambios: boolean; reactivado: boolean }> {
  const admin = exigirAdministrador(sesion);
  const tipo = tipoValido(tipoEntrada);
  const n = parseId(id);
  const r = await ctx.repos.administracion.editarCatalogo(tipo, n, entrada, { idAdministrador: admin.idUsuario, fecha: ahoraUTC(ctx.reloj) });
  return { item: await vistaDe(tipo, n, ctx), sinCambios: r.sinCambios, reactivado: r.reactivado };
}

export async function desactivarCatalogo(sesion: SesionActual | undefined, tipoEntrada: string, id: string, ctx: Contexto = contextoPorDefecto()): Promise<{ item: CatalogoAdmin }> {
  const admin = exigirAdministrador(sesion);
  const tipo = tipoValido(tipoEntrada);
  const n = parseId(id);
  await ctx.repos.administracion.desactivarCatalogo(tipo, n, { idAdministrador: admin.idUsuario, fecha: ahoraUTC(ctx.reloj) });
  return { item: await vistaDe(tipo, n, ctx) };
}
