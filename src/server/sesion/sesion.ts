import "server-only";
// Helpers de sesión para páginas y rutas del servidor (cookie firmada, HttpOnly, SameSite=Lax). Las pantallas aún NO los usan: quedan listos y probados.
import { cookies } from "next/headers";
import type { Rol } from "../../mocks/usuarios";
import { NOMBRE_COOKIE, esSolicitudHttps, opcionesCookie } from "./cookies";
import { sesionDeCookie } from "./autenticacion";
import { exigirRol, type SesionActual } from "./guardas";

/** La sesión de la petición en curso, o undefined. */
export async function obtenerSesion(): Promise<SesionActual | undefined> {
  return sesionDeCookie((await cookies()).get(NOMBRE_COOKIE)?.value);
}

/** Guarda por rol para páginas y rutas de Tutor o Administrador: 401 sin sesión, 403 con otro rol. */
export async function requerirSesion(rol?: Rol): Promise<SesionActual> {
  return exigirRol(await obtenerSesion(), rol);
}

/** Pone la cookie de sesión; Secure solo si la petición llegó por HTTPS. */
export async function establecerCookieDeSesion(valor: string, peticion: Request, maxAge?: number): Promise<void> {
  (await cookies()).set(NOMBRE_COOKIE, valor, opcionesCookie(esSolicitudHttps(peticion.url, peticion.headers.get("x-forwarded-proto")), maxAge));
}

export async function borrarCookieDeSesion(): Promise<void> {
  (await cookies()).delete(NOMBRE_COOKIE);
}
