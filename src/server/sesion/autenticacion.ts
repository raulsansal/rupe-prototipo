import "server-only";
// Inicio y cierre de sesión simulados. La contraseña se compara contra su hash bcrypt (R23); R17: cinco intentos fallidos bloquean 15 minutos;
// R18: la sesión dura 8 horas, hay varias a la vez y cerrar sesión cierra solo la actual; R19: deshabilitar o restablecer cierra todas.
import { compare } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { ahoraUTC } from "../dominio/fechas";
import { ErrorApp } from "../errores";
import { contextoPorDefecto, type Contexto } from "../servicios/contexto";
import { DURACION_SESION_SEGUNDOS } from "./cookies";
import { firmar, leerSecreto, verificar } from "./firma";
import type { SesionActual } from "./guardas";

const INTENTOS_PARA_BLOQUEO = 5;
const MINUTOS_DE_BLOQUEO = 15;
export const hashDeToken = (t: string) => createHash("sha256").update(t).digest("hex");
const credencialesInvalidas = () => new ErrorApp(401, "CREDENCIALES_INVALIDAS", "El correo o la contraseña no son correctos.");

export async function iniciarSesion(correo: string, contrasena: string, ctx: Contexto = contextoPorDefecto(), secreto: string = leerSecreto()): Promise<{ valorCookie: string; sesion: SesionActual; maxAge: number }> {
  const { repos, reloj } = ctx;
  const usuario = await repos.usuarios.porCorreo(correo);
  if (!usuario || !usuario.contrasenaHash) throw credencialesInvalidas();
  const ahora = reloj();
  if (usuario.bloqueadoHasta && Date.parse(usuario.bloqueadoHasta) > ahora.getTime()) throw new ErrorApp(403, "CUENTA_BLOQUEADA", "Demasiados intentos fallidos. Inténtalo de nuevo en unos minutos.", "R17");
  if (usuario.estatus === 0) throw new ErrorApp(403, "CUENTA_DESHABILITADA", "Tu cuenta está deshabilitada.");
  if (!(await compare(contrasena, usuario.contrasenaHash))) {
    const intentos = usuario.intentosFallidos + 1;
    await repos.usuarios.guardar(intentos >= INTENTOS_PARA_BLOQUEO ? { ...usuario, intentosFallidos: 0, bloqueadoHasta: new Date(ahora.getTime() + MINUTOS_DE_BLOQUEO * 60_000).toISOString() } : { ...usuario, intentosFallidos: intentos });
    throw credencialesInvalidas();
  }
  await repos.usuarios.guardar({ ...usuario, intentosFallidos: 0, bloqueadoHasta: null });
  const sid = randomBytes(32).toString("hex");
  const exp = Math.floor(ahora.getTime() / 1000) + DURACION_SESION_SEGUNDOS;
  await repos.sesiones.crear({ tokenHash: hashDeToken(sid), fechaInicio: ahoraUTC(reloj), fechaExpiracion: new Date(exp * 1000).toISOString(), fechaCierre: null, idUsuario: usuario.idUsuario });
  return { valorCookie: firmar({ sid, idUsuario: usuario.idUsuario, rol: usuario.rol, exp }, secreto), sesion: { idUsuario: usuario.idUsuario, rol: usuario.rol, nombre: usuario.nombreCompleto }, maxAge: DURACION_SESION_SEGUNDOS };
}

/** La sesión de una cookie: firma válida, no expirada, registrada y sin cerrar, y usuario activo (el rol sale del usuario, no de la cookie). */
export async function sesionDeCookie(valor: string | undefined, ctx: Contexto = contextoPorDefecto(), secreto: string = leerSecreto()): Promise<SesionActual | undefined> {
  const p = verificar(valor, secreto, Math.floor(ctx.reloj().getTime() / 1000));
  if (!p) return undefined;
  const sesion = await ctx.repos.sesiones.porTokenHash(hashDeToken(p.sid));
  if (!sesion || sesion.fechaCierre || Date.parse(sesion.fechaExpiracion) <= ctx.reloj().getTime()) return undefined;
  const usuario = await ctx.repos.usuarios.porId(sesion.idUsuario);
  return usuario && usuario.estatus === 1 ? { idUsuario: usuario.idUsuario, rol: usuario.rol, nombre: usuario.nombreCompleto } : undefined;
}

/** R18: cierra solo la sesión de esta cookie. */
export async function cerrarSesion(valor: string | undefined, ctx: Contexto = contextoPorDefecto(), secreto: string = leerSecreto()): Promise<void> {
  const p = verificar(valor, secreto, Math.floor(ctx.reloj().getTime() / 1000));
  const sesion = p && (await ctx.repos.sesiones.porTokenHash(hashDeToken(p.sid)));
  if (sesion) await ctx.repos.sesiones.cerrar(sesion.idSesion, ahoraUTC(ctx.reloj));
}

/** R19: al deshabilitar a la persona usuaria (o restablecer su contraseña) se cierran todas sus sesiones. */
export const cerrarTodasLasSesiones = (idUsuario: number, ctx: Contexto = contextoPorDefecto()) => ctx.repos.sesiones.cerrarTodasDe(idUsuario, ahoraUTC(ctx.reloj));
