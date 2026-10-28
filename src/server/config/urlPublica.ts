import "server-only";
// URL pública base del sitio: de ella salen el enlace del QR (<base>/ficha/<token>) y el que se comparte (<base>/ficha/<FOLIO>).
// 1) RUPE_URL_PUBLICA (solo el NOMBRE de la variable vive en .env.example): se valida; https es obligatorio salvo en hosts locales o de red privada (para escanear con un teléfono en la red local).
// 2) Sin variable: el origen de la petición, SOLO si su host es local o de red privada (localhost, 127.x, ::1, 10.x, 172.16–31.x, 192.168.x, *.local). La «validación de Origin» de las mutaciones
//    compara contra Host (que quien llama controla) y en los GET no hay Origin: no basta para decidir a dónde apunta un QR impreso.
// 3) Sin variable y con otro host: no hay base (el QR no se genera; los servicios responden 503 CONFIGURACION_FALTANTE). En P7 (Vercel) hay que definirla con el dominio https.
import { ErrorApp } from "../errores";
import { MENSAJE_FALTA_URL } from "./mensajes";

export const VARIABLE_URL_PUBLICA = "RUPE_URL_PUBLICA";
export { MENSAJE_FALTA_URL } from "./mensajes";

/** Host local o de red privada (RFC 1918) o .local: ahí se admite http. */
export function esHostLocalOPrivado(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h === "::1") return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return false;
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Origen (esquema + host[:puerto]) si `valor` es una URL base válida: http/https, sin credenciales, ruta, parámetros ni ancla; https salvo hosts locales o privados. */
export function validarBase(valor: string): string | undefined {
  let u: URL;
  try {
    u = new URL(valor.trim());
  } catch {
    return undefined;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
  if (u.username || u.password || u.search || u.hash || (u.pathname !== "/" && u.pathname !== "")) return undefined;
  if (u.protocol === "http:" && !esHostLocalOPrivado(u.hostname)) return undefined;
  return u.origin;
}

export type BasePublica = { ok: true; base: string; dominio: string } | { ok: false; mensaje: string };

/**
 * Resuelve la base. `origenPeticion` es el origen visto en la petición (sin validar). Sin petición y sin variable, en desarrollo se usa http://localhost:3000.
 */
export function resolverBasePublica({ entorno = process.env, origenPeticion, produccion = process.env.NODE_ENV === "production" }: { entorno?: Record<string, string | undefined>; origenPeticion?: string; produccion?: boolean } = {}): BasePublica {
  const configurada = entorno[VARIABLE_URL_PUBLICA]?.trim();
  if (configurada) {
    const base = validarBase(configurada);
    return base ? { ok: true, base, dominio: new URL(base).host } : { ok: false, mensaje: MENSAJE_FALTA_URL };
  }
  if (origenPeticion) {
    const base = validarBase(origenPeticion);
    if (base && esHostLocalOPrivado(new URL(base).hostname)) return { ok: true, base, dominio: new URL(base).host };
    return { ok: false, mensaje: MENSAJE_FALTA_URL };
  }
  if (!produccion) return { ok: true, base: "http://localhost:3000", dominio: "localhost:3000" };
  return { ok: false, mensaje: MENSAJE_FALTA_URL };
}

/** 503 sin datos internos: la configuración que falta es del sitio, no de la persona. */
export function exigirBasePublica(base: BasePublica): { base: string; dominio: string } {
  if (!base.ok) throw new ErrorApp(503, "CONFIGURACION_FALTANTE", "La ficha no puede generar su código QR en este momento.");
  return base;
}

/** Origen visto en las cabeceras de la petición (sin validar): solo sirve para el respaldo de hosts locales o de red privada. */
export function origenDeCabeceras(cabeceras: Headers, esquemaPorOmision?: "http" | "https"): string | undefined {
  const host = cabeceras.get("x-forwarded-host")?.split(",")[0].trim() || cabeceras.get("host");
  if (!host) return undefined;
  const proto = cabeceras.get("x-forwarded-proto")?.split(",")[0].trim();
  const hostname = host.replace(/:\d+$/, "");
  return `${proto === "https" || proto === "http" ? proto : (esquemaPorOmision ?? (esHostLocalOPrivado(hostname) ? "http" : "https"))}://${host}`;
}

/** Base pública para una petición (ruta API o página): `RUPE_URL_PUBLICA` o, sin ella, el origen si el host es local o privado. */
export const basePublicaDeCabeceras = (cabeceras: Headers): BasePublica => resolverBasePublica({ origenPeticion: origenDeCabeceras(cabeceras) });
