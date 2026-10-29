// HU 008 y 009 (P6a): reglas de la gestión de cuentas y roles. R21: no se deshabilita ni se cambia el rol al ÚLTIMO administrador activo. Funciones puras sobre el `Usuario` del servidor.
import type { Rol } from "../../mocks/usuarios";
import { conflictoDeEstado, reglaDeNegocio } from "../errores";
import type { Usuario } from "../tipos";

export const ROLES: readonly Rol[] = ["Administrador", "Tutor"];

type Basico = Pick<Usuario, "idUsuario" | "rol" | "estatus">;

/** R21: la persona es administradora activa y no queda otra administradora activa. */
export function esUltimoAdministradorActivo(usuarios: readonly Basico[], idUsuario: number): boolean {
  const u = usuarios.find((x) => x.idUsuario === idUsuario);
  if (!u || u.rol !== "Administrador" || u.estatus !== 1) return false;
  return !usuarios.some((x) => x.idUsuario !== idUsuario && x.rol === "Administrador" && x.estatus === 1);
}

export const errorUltimoAdministrador = () => conflictoDeEstado("ULTIMO_ADMINISTRADOR", "No se puede deshabilitar ni cambiar el rol del último administrador activo.", "R21");
export const errorSinCambioDeCuenta = (mensaje: string) => conflictoDeEstado("SIN_CAMBIO", mensaje);
/** Al actuar sobre la propia cuenta se cierra la propia sesión (R19): hace falta confirmarlo de forma explícita. */
export const errorConfirmarSesionPropia = () => conflictoDeEstado("CONFIRMACION_REQUERIDA", "Esta acción cerrará tu propia sesión. Confírmala para continuar.");

/** El rol debe ser uno válido (HU 009: Administrador o Tutor; el visitante no tiene cuenta). */
export function validarRol(valor: unknown): Rol {
  if (ROLES.includes(valor as Rol)) return valor as Rol;
  throw reglaDeNegocio("R23", "El rol debe ser «Administrador» o «Tutor».", "ROL_INVALIDO");
}
