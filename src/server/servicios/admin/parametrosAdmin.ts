import "server-only";
// HU 054 (P6b): parámetros del sistema por el Administrador. `exigirAdministrador` primero. Modificar o restablecer es UNA transacción del repositorio con una entrada de bitácora por parámetro que
// cambió (valor anterior → nuevo, R24); sin cambios no se escribe nada. Efectos reales: la versión del aviso obliga a re-aceptarlo en el siguiente inicio de sesión (R22, se lee del almacén en cada
// petición); el tamaño máximo gobierna la validación de fotos y el límite de cuerpo; la expiración del token solo se guarda (la recuperación de contraseña no está en el Prototipo).
import { ahoraUTC } from "../../dominio/fechas";
import type { CambioDeParametro } from "../../dominio/parametros";
import { aParametroAdmin, type ParametroAdmin } from "../../serializadores/admin";
import { exigirAdministrador, type SesionActual } from "../../sesion/guardas";
import { contextoPorDefecto, type Contexto } from "../contexto";

export type ResultadoDeParametros = { parametros: ParametroAdmin[]; cambios: CambioDeParametro[]; sinCambios: boolean; /** La versión del aviso cambió: las personas usuarias deberán aceptarlo de nuevo al iniciar sesión (R22). */ avisoReaceptacion: boolean };

const vista = (p: { clave: string; descripcion: string; valor: string; valorPorDefecto: string }) => aParametroAdmin(p);

export async function listarParametros(sesion: SesionActual | undefined, ctx: Contexto = contextoPorDefecto()): Promise<{ parametros: ParametroAdmin[] }> {
  exigirAdministrador(sesion);
  return { parametros: (await ctx.repos.parametros.todos()).map(vista) };
}

const resultado = (r: { parametros: Parameters<typeof vista>[0][]; cambios: CambioDeParametro[] }): ResultadoDeParametros => ({
  parametros: r.parametros.map(vista), cambios: r.cambios, sinCambios: r.cambios.length === 0, avisoReaceptacion: r.cambios.some((c) => c.clave === "version_aviso_privacidad"),
});

/** Cuerpo: `{ version_aviso_privacidad?, expiracion_token_minutos?, tamano_maximo_archivo_mb? }` con uno o más. 422 por parámetro si alguno no vale (no se cambia ninguno). */
export async function modificarParametros(sesion: SesionActual | undefined, entrada: unknown, ctx: Contexto = contextoPorDefecto()): Promise<ResultadoDeParametros> {
  const admin = exigirAdministrador(sesion);
  return resultado(await ctx.repos.administracion.modificarParametros(entrada, { idAdministrador: admin.idUsuario, fecha: ahoraUTC(ctx.reloj) }));
}

export async function restablecerParametros(sesion: SesionActual | undefined, ctx: Contexto = contextoPorDefecto()): Promise<ResultadoDeParametros> {
  const admin = exigirAdministrador(sesion);
  return resultado(await ctx.repos.administracion.restablecerParametros({ idAdministrador: admin.idUsuario, fecha: ahoraUTC(ctx.reloj) }));
}
