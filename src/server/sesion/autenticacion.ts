import "server-only";
// Inicio y cierre de sesión. R17: 5 intentos fallidos bloquean 15 minutos; R18: sesión de 8 h, varias a la vez, cerrar solo cierra la actual; R19: deshabilitar
// o restablecer cierra todas; R22: reaceptación del aviso si su versión cambió. Orden de las comprobaciones (para no delatar si una cuenta existe):
//   1) bloqueo (se ve igual para cuentas con y sin existencia: los correos inexistentes también cuentan intentos);
//   2) contraseña, SIEMPRE con bcrypt (contra un hash señuelo si la cuenta no existe: mismo costo, mismo tiempo);
//   3) solo con contraseña correcta se revelan «cuenta deshabilitada» (HU 008) y «aviso desactualizado» (R22).
import { createHash, randomBytes } from "node:crypto";
import { ahoraUTC } from "../dominio/fechas";
import { ErrorApp } from "../errores";
import type { Usuario } from "../tipos";
import { contextoPorDefecto, type Contexto } from "../servicios/contexto";
import { compararContrasena, HASH_SENUELO } from "./contrasenas";
import { DURACION_SESION_SEGUNDOS } from "./cookies";
import { firmar, leerSecreto, verificar } from "./firma";
import type { SesionActual } from "./guardas";

export const INTENTOS_PARA_BLOQUEO = 5;
export const MINUTOS_DE_BLOQUEO = 15;
export const hashDeToken = (t: string) => createHash("sha256").update(t).digest("hex");
const credencialesInvalidas = () => new ErrorApp(401, "CREDENCIALES_INVALIDAS", "El correo o la contraseña no son correctos.");
const cuentaBloqueada = () => new ErrorApp(403, "CUENTA_BLOQUEADA", "Demasiados intentos fallidos: la cuenta está bloqueada 15 minutos. Inténtalo de nuevo más tarde.", "R17");

export type EntradaDeAcceso = { correo: string; contrasena: string; aceptarAviso?: boolean };
export type ResultadoDeAcceso = { valorCookie: string; sesion: SesionActual; maxAge: number };

/** Abre una sesión NUEVA (identificador aleatorio propio en cada inicio; nunca se reutiliza uno anterior). */
export async function abrirSesion(usuario: Pick<Usuario, "idUsuario" | "rol" | "nombreCompleto">, ctx: Contexto, secreto: string = leerSecreto()): Promise<ResultadoDeAcceso> {
  const sid = randomBytes(32).toString("hex");
  const exp = Math.floor(ctx.reloj().getTime() / 1000) + DURACION_SESION_SEGUNDOS;
  await ctx.repos.sesiones.crear({ tokenHash: hashDeToken(sid), fechaInicio: ahoraUTC(ctx.reloj), fechaExpiracion: new Date(exp * 1000).toISOString(), fechaCierre: null, idUsuario: usuario.idUsuario });
  return { valorCookie: firmar({ sid, idUsuario: usuario.idUsuario, rol: usuario.rol, exp }, secreto), sesion: { idUsuario: usuario.idUsuario, rol: usuario.rol, nombre: usuario.nombreCompleto }, maxAge: DURACION_SESION_SEGUNDOS };
}

export async function iniciarSesion(entrada: EntradaDeAcceso, ctx: Contexto = contextoPorDefecto(), secreto: string = leerSecreto()): Promise<ResultadoDeAcceso> {
  const { repos, reloj } = ctx;
  const ahora = reloj().getTime();
  const correo = entrada.correo.trim().toLowerCase();
  const usuario = await repos.usuarios.porCorreo(correo);
  // Estado de intentos: el de la cuenta, o el del correo sin cuenta.
  let estado = usuario ? { intentos: usuario.intentosFallidos, bloqueadoHasta: usuario.bloqueadoHasta } : await repos.intentos.de(correo);
  const guardar = async (e: typeof estado) => {
    estado = e;
    if (usuario) await repos.usuarios.guardar({ ...usuario, intentosFallidos: e.intentos, bloqueadoHasta: e.bloqueadoHasta });
    else await repos.intentos.guardar(correo, e);
  };
  if (estado.bloqueadoHasta) {
    if (Date.parse(estado.bloqueadoHasta) > ahora) throw cuentaBloqueada();
    await guardar({ intentos: 0, bloqueadoHasta: null }); // el bloqueo venció
  }
  const comparar = ctx.comparar ?? compararContrasena;
  const correcta = (await comparar(entrada.contrasena, usuario?.contrasenaHash ?? HASH_SENUELO)) && !!usuario?.contrasenaHash;
  if (!correcta) {
    const intentos = estado.intentos + 1;
    if (intentos >= INTENTOS_PARA_BLOQUEO) {
      await guardar({ intentos: 0, bloqueadoHasta: new Date(ahora + MINUTOS_DE_BLOQUEO * 60_000).toISOString() });
      throw cuentaBloqueada();
    }
    await guardar({ intentos, bloqueadoHasta: null });
    throw credencialesInvalidas();
  }
  if (estado.intentos !== 0 || estado.bloqueadoHasta) await guardar({ intentos: 0, bloqueadoHasta: null });
  const cuenta = usuario!;
  if (cuenta.estatus === 0) throw new ErrorApp(403, "CUENTA_DESHABILITADA", "Tu cuenta está deshabilitada; contacta a quien administra RUPE.");
  // R22: la última aceptación (mayor fecha, desempate por id) se compara POR VALOR con la versión vigente.
  const vigente = await repos.parametros.valor("version_aviso_privacidad");
  const ultima = await repos.aceptaciones.ultimaDe(cuenta.idUsuario);
  if (ultima?.versionAviso !== vigente) {
    if (!entrada.aceptarAviso) throw new ErrorApp(409, "AVISO_DESACTUALIZADO", "Debes aceptar la nueva versión del aviso de privacidad para continuar.", "R22", undefined, { versionAviso: vigente });
    await repos.aceptaciones.agregar({ versionAviso: vigente, fechaHora: ahoraUTC(reloj), idUsuario: cuenta.idUsuario });
  }
  return abrirSesion(cuenta, ctx, secreto);
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

/** R18 y HU 007: cierra solo la sesión de esta cookie (el identificador queda invalidado en el almacén). */
export async function cerrarSesion(valor: string | undefined, ctx: Contexto = contextoPorDefecto(), secreto: string = leerSecreto()): Promise<void> {
  const p = verificar(valor, secreto, Math.floor(ctx.reloj().getTime() / 1000));
  const sesion = p && (await ctx.repos.sesiones.porTokenHash(hashDeToken(p.sid)));
  if (sesion) await ctx.repos.sesiones.cerrar(sesion.idSesion, ahoraUTC(ctx.reloj));
}

/** R19: al deshabilitar a la persona usuaria (o restablecer su contraseña) se cierran todas sus sesiones. */
export const cerrarTodasLasSesiones = (idUsuario: number, ctx: Contexto = contextoPorDefecto()) => ctx.repos.sesiones.cerrarTodasDe(idUsuario, ahoraUTC(ctx.reloj));
