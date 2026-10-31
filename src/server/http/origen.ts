// Defensa contra peticiones de otros sitios (CSRF) en las mutaciones: si el navegador manda la cabecera Origin, debe ser el del propio sitio.
// Sin cabecera (herramientas, pruebas, formularios de navegadores antiguos) se acepta: la cookie es SameSite=Lax y de todos modos exige sesión.
import { ErrorApp } from "../errores";
import { VARIABLE_URL_PUBLICA, validarBase } from "../config/urlPublica";
import { esSolicitudHttps } from "../sesion/cookies";

/** Origen del sitio según la petición: esquema (URL o x-forwarded-proto) y host (x-forwarded-host, Host o URL). */
export function origenDelSitio(url: string, cabeceras: Headers): string {
  const host = cabeceras.get("x-forwarded-host")?.split(",")[0].trim() || cabeceras.get("host") || new URL(url).host;
  return `${esSolicitudHttps(url, cabeceras.get("x-forwarded-proto")) ? "https" : "http"}://${host}`;
}

/** Origen de `RUPE_URL_PUBLICA` (normalizado) si está definida y es válida: detrás de un túnel o proxy que no reenvía el host original, el navegador manda ESE Origin. */
export const origenPublicoConfigurado = (entorno: Record<string, string | undefined> = process.env): string | undefined => {
  const v = entorno[VARIABLE_URL_PUBLICA]?.trim();
  return v ? validarBase(v) : undefined;
};

/** 403 `ORIGEN_NO_PERMITIDO` si viene Origin y no coincide con el origen del sitio ni con el de `RUPE_URL_PUBLICA` (incluye el literal «null»). */
export function exigirMismoOrigen(peticion: Request, entorno: Record<string, string | undefined> = process.env): void {
  const origen = peticion.headers.get("origin");
  if (origen === null) return;
  if (origen === origenPublicoConfigurado(entorno)) return;
  if (origen !== origenDelSitio(peticion.url, peticion.headers)) throw new ErrorApp(403, "ORIGEN_NO_PERMITIDO", "La petición no viene de este sitio.");
}
