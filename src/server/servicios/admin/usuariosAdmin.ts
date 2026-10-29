import "server-only";
// HU 008 y 009 (P6a): gestión de cuentas y roles por el Administrador. `exigirAdministrador` primero. Cada acción es UNA transacción: cambio + (R19) cierre de sesiones + entrada de bitácora (R24).
// R21: no se deshabilita ni se cambia el rol al último administrador activo (409 ULTIMO_ADMINISTRADOR). Si la acción es sobre la PROPIA cuenta, cierra la propia sesión y exige `confirmarSesionPropia`
// (409 CONFIRMACION_REQUERIDA): la pantalla pide confirmación y reintenta. El rol sale del almacén en cada petición, no de la cookie: una degradación vale de inmediato.
import { ahoraUTC } from "../../dominio/fechas";
import { paginar } from "../../dominio/paginacion";
import { esUltimoAdministradorActivo, validarRol } from "../../dominio/usuarios";
import { noEncontrado } from "../../errores";
import { aUsuarioAdmin, type UsuarioAdmin } from "../../serializadores/admin";
import { exigirAdministrador, type SesionActual } from "../../sesion/guardas";
import { contextoPorDefecto, type Contexto } from "../contexto";
import type { Rol } from "../../tipos";

const POR_PAGINA = 5;
const sinAcentos = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export type ListadoDeUsuarios = { items: UsuarioAdmin[]; pagina: number; totalPaginas: number; total: number; porPagina: number; filtros: { texto?: string; estatus?: "activo" | "inactivo" }; errores: { estatus?: string } };

/** ADM-03: cuentas para gestionar, por id, con búsqueda por nombre o correo (sin acentos) y filtro Activo/Inactivo; páginas de 5. Solo lo necesario: sin teléfono, hash ni intentos. */
export async function listarUsuarios(sesion: SesionActual | undefined, entrada: { texto?: unknown; estatus?: unknown; pagina?: unknown } = {}, ctx: Contexto = contextoPorDefecto()): Promise<ListadoDeUsuarios> {
  const admin = exigirAdministrador(sesion);
  const filtros: ListadoDeUsuarios["filtros"] = {};
  const errores: ListadoDeUsuarios["errores"] = {};
  const texto = typeof entrada.texto === "string" ? entrada.texto.trim().slice(0, 100) : "";
  if (texto) filtros.texto = texto;
  const e = typeof entrada.estatus === "string" ? entrada.estatus.trim() : "";
  if (e === "activo" || e === "inactivo") filtros.estatus = e;
  else if (e) errores.estatus = "Elige «Activo» o «Inactivo».";
  const todos = [...(await ctx.repos.usuarios.todos())].sort((a, b) => a.idUsuario - b.idUsuario);
  const filas = todos
    .filter((u) => (!filtros.texto || sinAcentos(`${u.nombreCompleto} ${u.correo}`).includes(sinAcentos(filtros.texto))) && (!filtros.estatus || (filtros.estatus === "activo") === (u.estatus === 1)))
    .map((u) => aUsuarioAdmin({ id: u.idUsuario, nombreCompleto: u.nombreCompleto, correo: u.correo, rol: u.rol, activo: u.estatus === 1, fechaUltimaModificacion: u.fechaUltimaModificacion, esLaPersonaActual: u.idUsuario === admin.idUsuario, esUltimoAdministradorActivo: esUltimoAdministradorActivo(todos, u.idUsuario) }));
  return { ...paginar(filas, entrada.pagina, POR_PAGINA), filtros, errores };
}

const parseId = (id: string): number => {
  if (!/^\d{1,9}$/.test(String(id))) throw noEncontrado();
  return Number(id);
};
async function existe(id: string, ctx: Contexto): Promise<number> {
  const n = parseId(id);
  if (!(await ctx.repos.usuarios.porId(n))) throw noEncontrado();
  return n;
}

export type ResultadoDeCuenta = { id: number; activo: boolean; rol: Rol; sesionesCerradas: number; /** La acción fue sobre la propia cuenta: su sesión quedó cerrada y la pantalla debe llevarla a iniciar sesión. */ cerroSuPropiaSesion: boolean };

export async function deshabilitarUsuario(sesion: SesionActual | undefined, id: string, { confirmarSesionPropia = false }: { confirmarSesionPropia?: boolean } = {}, ctx: Contexto = contextoPorDefecto()): Promise<ResultadoDeCuenta> {
  const admin = exigirAdministrador(sesion);
  const n = await existe(id, ctx);
  const r = await ctx.repos.administracion.deshabilitarUsuario(n, { idAdministrador: admin.idUsuario, fecha: ahoraUTC(ctx.reloj), confirmarSesionPropia });
  return { id: n, activo: false, rol: r.usuario.rol, sesionesCerradas: r.sesionesCerradas, cerroSuPropiaSesion: r.esLaPropiaCuenta };
}

export async function habilitarUsuario(sesion: SesionActual | undefined, id: string, ctx: Contexto = contextoPorDefecto()): Promise<ResultadoDeCuenta> {
  const admin = exigirAdministrador(sesion);
  const n = await existe(id, ctx);
  const r = await ctx.repos.administracion.habilitarUsuario(n, { idAdministrador: admin.idUsuario, fecha: ahoraUTC(ctx.reloj) });
  return { id: n, activo: true, rol: r.usuario.rol, sesionesCerradas: 0, cerroSuPropiaSesion: false };
}

export async function cambiarRol(sesion: SesionActual | undefined, id: string, rol: unknown, { confirmarSesionPropia = false }: { confirmarSesionPropia?: boolean } = {}, ctx: Contexto = contextoPorDefecto()): Promise<ResultadoDeCuenta & { rolAnterior: Rol }> {
  const admin = exigirAdministrador(sesion);
  const n = await existe(id, ctx);
  const nuevo = validarRol(rol);
  const r = await ctx.repos.administracion.cambiarRolDeUsuario(n, nuevo, { idAdministrador: admin.idUsuario, fecha: ahoraUTC(ctx.reloj), confirmarSesionPropia });
  return { id: n, activo: r.usuario.estatus === 1, rol: r.usuario.rol, rolAnterior: r.rolAnterior, sesionesCerradas: r.sesionesCerradas, cerroSuPropiaSesion: r.esLaPropiaCuenta };
}
