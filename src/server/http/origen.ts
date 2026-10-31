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

/**
 * Túnel de desarrollo (Dev Tunnels de VS Code): al reenviar al servidor local REESCRIBE el Origin de la dirección pública a `http://localhost:<puerto>` (medido con el túnel real; los
 * Origin ajenos pasan intactos). Se acepta ese Origin reescrito SOLO si se cumplen TODAS: (a) `RUPE_URL_PUBLICA` está definida y es https; (b) el Host es loopback y el Origin es
 * exactamente `http://<Host>` (mismo puerto); (c) el primer `x-forwarded-host` es el host de `RUPE_URL_PUBLICA` y `x-forwarded-proto` es https; (d) si viene `Sec-Fetch-Site`, vale `same-origin`.
 */
function esOrigenReescritoPorTunel(peticion: Request, origen: string, entorno: Record<string, string | undefined>): boolean {
  const publico = origenPublicoConfigurado(entorno);
  if (!publico || new URL(publico).protocol !== "https:") return false; // (a)
  const host = peticion.headers.get("host");
  if (!host) return false;
  let hostname: string;
  try {
    hostname = new URL(`http://${host}`).hostname;
  } catch {
    return false;
  }
  if ((hostname !== "localhost" && hostname !== "127.0.0.1") || origen !== `http://${host}`) return false; // (b)
  const reenviadoPor = peticion.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const proto = peticion.headers.get("x-forwarded-proto")?.split(",")[0].trim().toLowerCase();
  if (reenviadoPor !== new URL(publico).host || proto !== "https") return false; // (c)
  const sitio = peticion.headers.get("sec-fetch-site");
  return sitio === null || sitio === "same-origin"; // (d): un navegador que pide desde otra página marca cross-site o same-site
}

/** 403 `ORIGEN_NO_PERMITIDO` si viene Origin y no coincide con el origen del sitio ni con el de `RUPE_URL_PUBLICA` (incluye el literal «null»). */
export function exigirMismoOrigen(peticion: Request, entorno: Record<string, string | undefined> = process.env): void {
  const origen = peticion.headers.get("origin");
  if (origen === null) return;
  if (origen === origenPublicoConfigurado(entorno)) return;
  if (esOrigenReescritoPorTunel(peticion, origen, entorno)) return;
  if (origen !== origenDelSitio(peticion.url, peticion.headers)) throw new ErrorApp(403, "ORIGEN_NO_PERMITIDO", "La petición no viene de este sitio.");
}
