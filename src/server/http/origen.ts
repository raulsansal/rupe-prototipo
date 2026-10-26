// Defensa contra peticiones de otros sitios (CSRF) en las mutaciones: si el navegador manda la cabecera Origin, debe ser el del propio sitio.
// Sin cabecera (herramientas, pruebas, formularios de navegadores antiguos) se acepta: la cookie es SameSite=Lax y de todos modos exige sesión.
import { ErrorApp } from "../errores";
import { esSolicitudHttps } from "../sesion/cookies";

/** Origen del sitio según la petición: esquema (URL o x-forwarded-proto) y host (x-forwarded-host, Host o URL). */
export function origenDelSitio(url: string, cabeceras: Headers): string {
  const host = cabeceras.get("x-forwarded-host")?.split(",")[0].trim() || cabeceras.get("host") || new URL(url).host;
  return `${esSolicitudHttps(url, cabeceras.get("x-forwarded-proto")) ? "https" : "http"}://${host}`;
}

/** 403 `ORIGEN_NO_PERMITIDO` si viene Origin y no coincide con el origen del sitio (incluye el literal «null»). */
export function exigirMismoOrigen(peticion: Request): void {
  const origen = peticion.headers.get("origin");
  if (origen === null) return;
  if (origen !== origenDelSitio(peticion.url, peticion.headers)) throw new ErrorApp(403, "ORIGEN_NO_PERMITIDO", "La petición no viene de este sitio.");
}
