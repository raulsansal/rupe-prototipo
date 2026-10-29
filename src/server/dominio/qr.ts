// R7, R27 y R6: token público del QR con generador seguro (32 caracteres, base62, distinto del folio y sensible a mayúsculas) y un solo QR activo por caso.
import { randomBytes, timingSafeEqual } from "node:crypto";

export const ALFABETO_TOKEN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; // 62 símbolos
export const LONGITUD_TOKEN = 32;
export type FuenteDeBytes = (n: number) => Uint8Array;

/** Muestreo con rechazo (bytes ≥ 248 se descartan) para que los 62 símbolos sean equiprobables. */
export function generarTokenQr(bytes: FuenteDeBytes = (n) => randomBytes(n)): string {
  let token = "";
  while (token.length < LONGITUD_TOKEN) {
    for (const b of bytes(LONGITUD_TOKEN)) {
      if (b < 248 && token.length < LONGITUD_TOKEN) token += ALFABETO_TOKEN[b % 62];
    }
  }
  return token;
}

export const esTokenValido = (t: string) => t.length === LONGITUD_TOKEN && [...t].every((c) => ALFABETO_TOKEN.includes(c));

export type RegistroQr = { idCodigoQr: number; idCasoExtravio: number; tokenPublico: string; fechaGeneracion: string; fechaInvalidacion: string | null };
export const qrActivo = (qrs: readonly RegistroQr[], idCaso: number) => qrs.find((q) => q.idCasoExtravio === idCaso && q.fechaInvalidacion === null);

export const FORMATO_TOKEN = /^[A-Za-z0-9]{32}$/;
/** Un token válido de formato tiene exactamente 32 caracteres base62; cualquier otra cosa se trata como inexistente sin compararla. */
export const esFormatoDeToken = (t: unknown): t is string => typeof t === "string" && FORMATO_TOKEN.test(t);

/** Comparación en TIEMPO CONSTANTE de dos cadenas (el tiempo no depende de en qué posición difieren). Longitudes distintas: falso. */
export function igualesEnTiempoConstante(a: string, b: string): boolean {
  const [x, y] = [Buffer.from(a, "utf8"), Buffer.from(b, "utf8")];
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Código QR que tiene ese token (vigente o no), comparado en tiempo constante: se recorren TODOS los códigos sin cortar al encontrar uno, así el tiempo no revela cuál
 * coincidió ni cuántos caracteres. El token se compara tal cual: «ABC» y «abc» son distintos (E6).
 */
export function qrPorToken<T extends { tokenPublico: string }>(qrs: readonly T[], token: string): T | undefined {
  if (!esFormatoDeToken(token)) return undefined;
  let hallado: T | undefined;
  for (const q of qrs) if (igualesEnTiempoConstante(q.tokenPublico, token) && hallado === undefined) hallado = q;
  return hallado;
}

/** Solo cuenta un QR vigente (R27). */
export const qrVigentePorToken = (qrs: readonly RegistroQr[], token: string) => {
  const q = qrPorToken(qrs, token);
  return q && q.fechaInvalidacion === null ? q : undefined;
};

/** R7: la regeneración invalida el anterior y crea el nuevo (el llamador las aplica en una sola operación). */
export function planRegeneracion(qrs: readonly RegistroQr[], idCaso: number, ahora: string, generar: () => string = generarTokenQr) {
  const anterior = qrActivo(qrs, idCaso);
  let token = generar();
  while (qrs.some((q) => q.tokenPublico === token)) token = generar();
  return { invalidar: anterior ? [anterior.idCodigoQr] : [], nuevo: { idCasoExtravio: idCaso, tokenPublico: token, fechaGeneracion: ahora, fechaInvalidacion: null } };
}
