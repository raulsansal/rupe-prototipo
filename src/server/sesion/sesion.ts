import "server-only";
// Helpers de sesión para páginas y rutas del servidor (cookie firmada, HttpOnly, SameSite=Lax).
import { cookies } from "next/headers";
import { NOMBRE_COOKIE, esSolicitudHttps, opcionesCookie } from "./cookies";
import { sesionDeCookie } from "./autenticacion";
import type { SesionActual } from "./guardas";

/** La sesión de la petición en curso, o undefined. */
export async function obtenerSesion(): Promise<SesionActual | undefined> {
  return sesionDeCookie((await cookies()).get(NOMBRE_COOKIE)?.value);
}

/** Pone la cookie de sesión; Secure solo si la petición llegó por HTTPS. */
export async function establecerCookieDeSesion(valor: string, peticion: Request, maxAge?: number): Promise<void> {
  (await cookies()).set(NOMBRE_COOKIE, valor, opcionesCookie(esSolicitudHttps(peticion.url, peticion.headers.get("x-forwarded-proto")), maxAge));
}

export async function borrarCookieDeSesion(): Promise<void> {
  (await cookies()).delete(NOMBRE_COOKIE);
}
