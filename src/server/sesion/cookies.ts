// Atributos de la cookie de sesión (puros). Secure depende de que la PETICIÓN sea HTTPS (protocolo de la URL o cabecera x-forwarded-proto), no de NODE_ENV:
// así el inicio de sesión funciona con `next start` por HTTP en localhost o en red local. Siempre HttpOnly y SameSite=Lax.
export const NOMBRE_COOKIE = "rupe_sesion";
export const DURACION_SESION_SEGUNDOS = 8 * 3600; // R18

export function esSolicitudHttps(url: string, xForwardedProto?: string | null): boolean {
  if (xForwardedProto) return xForwardedProto.split(",")[0].trim().toLowerCase() === "https";
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export const opcionesCookie = (https: boolean, maxAge: number = DURACION_SESION_SEGUNDOS) => ({ httpOnly: true as const, sameSite: "lax" as const, secure: https, path: "/", maxAge });
