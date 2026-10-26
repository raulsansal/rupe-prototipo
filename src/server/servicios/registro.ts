import "server-only";
// ACC-02 (HU 002 y 003, R5, R23): registro de la persona tutora. Solo se leen los campos del formulario: cualquier otro que mande el cliente (rol, estatus, id,
// intentos, fechas…) se IGNORA; el rol, el estatus y las notificaciones salen siempre del servidor.
import { ahoraUTC } from "../dominio/fechas";
import { ErrorApp, formatoInvalido, validacion } from "../errores";
import { abrirSesion, type ResultadoDeAcceso } from "../sesion/autenticacion";
import { errorDePoliticaDeContrasena, hashearContrasena } from "../sesion/contrasenas";
import { leerSecreto } from "../sesion/firma";
import { contextoPorDefecto, type Contexto } from "./contexto";

const REGEX_CORREO = /^[^@ ]+@[^@ ]+\.[^@ ]+$/; // tbl_usuario.correo
const REGEX_TELEFONO = /^[0-9]{10,15}$/; // tbl_usuario.telefono
export type DatosDeRegistro = { nombre: string; correo: string; contrasena: string; telefono: string; aceptaAviso: boolean; versionAviso: string };

const texto = (v: unknown) => (typeof v === "string" ? v : "");

/** Toma del cuerpo SOLO los campos conocidos (lista permitida). */
export function leerDatosDeRegistro(cuerpo: unknown): DatosDeRegistro {
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) throw formatoInvalido("CUERPO_INVALIDO", "El cuerpo de la petición no es válido.");
  const c = cuerpo as Record<string, unknown>;
  return { nombre: texto(c.nombre), correo: texto(c.correo), contrasena: texto(c.contrasena), telefono: texto(c.telefono), aceptaAviso: c.aceptaAviso === true, versionAviso: texto(c.versionAviso) };
}

/** Errores por campo (todos a la vez), con las mismas reglas y textos que el formulario del maquetado. */
export function erroresDeRegistro(d: DatosDeRegistro, versionVigente: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.nombre.trim()) e.nombre = "Escribe tu nombre completo.";
  else if (d.nombre.trim().length > 150) e.nombre = "El nombre no puede pasar de 150 caracteres.";
  const correo = d.correo.trim();
  if (!correo) e.correo = "Escribe tu correo electrónico.";
  else if (!REGEX_CORREO.test(correo) || correo.length > 254) e.correo = "Escribe un correo válido, como nombre@correo.com.";
  const c = errorDePoliticaDeContrasena(d.contrasena);
  if (c) e.contrasena = c;
  if (!d.telefono) e.telefono = "Escribe tu teléfono de contacto.";
  else if (!REGEX_TELEFONO.test(d.telefono)) e.telefono = "El teléfono debe tener de 10 a 15 dígitos, sin espacios ni guiones.";
  if (!d.aceptaAviso) e.aviso = `Debes aceptar el aviso de privacidad v${versionVigente} para registrarte.`;
  return e;
}

/**
 * Crea la persona usuaria (rol Tutor) y su aceptación del aviso en una sola operación (R5): sin aceptación no se guarda nada. Devuelve la sesión abierta
 * (el maquetado manda a /tutor tras registrarse). 422 con errores por campo; 409 si el correo ya existe (sin distinguir mayúsculas) o si la versión del aviso aceptada ya no es la vigente.
 */
export async function registrarTutor(cuerpo: unknown, ctx: Contexto = contextoPorDefecto(), secreto: string = leerSecreto()): Promise<ResultadoDeAcceso> {
  const { repos, reloj } = ctx;
  const d = leerDatosDeRegistro(cuerpo);
  const vigente = await repos.parametros.valor("version_aviso_privacidad");
  const errores = erroresDeRegistro(d, vigente);
  if (Object.keys(errores).length) throw validacion(errores);
  if (d.versionAviso !== vigente) throw new ErrorApp(409, "AVISO_DESACTUALIZADO", "El aviso de privacidad cambió mientras te registrabas: revísalo y acéptalo de nuevo.", "R22", undefined, { versionAviso: vigente });
  const correo = d.correo.trim();
  if (await repos.usuarios.porCorreo(correo)) throw new ErrorApp(409, "CORREO_DUPLICADO", "Ese correo ya está registrado.", undefined, { correo: "Ese correo ya está registrado: inicia sesión o usa otro." });
  const ahora = ahoraUTC(reloj);
  const hashear = ctx.hashear ?? hashearContrasena;
  const usuario = await repos.usuarios.crearConAceptacion(
    { nombreCompleto: d.nombre.trim(), correo, contrasenaHash: await hashear(d.contrasena), telefono: d.telefono, estatus: 1, fechaRegistro: ahora, fechaUltimaModificacion: ahora, intentosFallidos: 0, bloqueadoHasta: null, notificacionesActivas: true, rol: "Tutor" },
    vigente,
    ahora,
  );
  return abrirSesion(usuario, ctx, secreto);
}
