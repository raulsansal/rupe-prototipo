// Guardas por rol y por dueño (puras, sin Next): lanzan el error HTTP que corresponde (401 sin sesión, 403 rol, 404 ajeno).
import type { Rol } from "../../mocks/usuarios";
import { noEncontrado, sinPermiso, sinSesion } from "../errores";

export type SesionActual = { idUsuario: number; rol: Rol; nombre: string };

/** 401 sin sesión; 403 si el rol no es el pedido (sin rol pedido basta con tener sesión). */
export function exigirRol(sesion: SesionActual | undefined, rol?: Rol): SesionActual {
  if (!sesion) throw sinSesion();
  if (rol && sesion.rol !== rol) throw sinPermiso();
  return sesion;
}

/** P6: primera línea de cada servicio y ruta del Administrador: 401 sin sesión y 403 con cualquier otro rol (la tutora). El rol sale SIEMPRE del almacén en cada petición, no de la cookie. */
export const exigirAdministrador = (sesion: SesionActual | undefined): SesionActual => exigirRol(sesion, "Administrador");

/**
 * R32: solo la persona tutora dueña consulta el detalle y edita o cancela; el Administrador consulta y modera (no edita).
 * Una tutora que no es la dueña recibe 404 (no se revela que el caso existe).
 */
export function exigirAccesoAlCaso(sesion: SesionActual | undefined, idDuenoDelCaso: number, accion: "consultar" | "editar" | "cancelar"): SesionActual {
  const s = exigirRol(sesion);
  if (s.rol === "Administrador") {
    if (accion === "consultar") return s;
    throw sinPermiso();
  }
  if (s.idUsuario !== idDuenoDelCaso) throw noEncontrado();
  return s;
}

export type ResultadoDeAcceso = "ok" | "sin-sesion" | "prohibido";
/** Para páginas y layouts: sin sesión → ir al inicio de sesión; con otro rol → acceso denegado (403). */
export function resolverAcceso(sesion: SesionActual | undefined, rol: Rol): ResultadoDeAcceso {
  if (!sesion) return "sin-sesion";
  return sesion.rol === rol ? "ok" : "prohibido";
}
