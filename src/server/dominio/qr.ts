// R7, R27 y R6: token público del QR con generador seguro (32 caracteres, base62, distinto del folio y sensible a mayúsculas) y un solo QR activo por caso.
import { randomBytes } from "node:crypto";

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

/** El token se compara tal cual: «ABC» y «abc» son tokens distintos (E6). Solo cuenta un QR vigente (R27). */
export const qrVigentePorToken = (qrs: readonly RegistroQr[], token: string) => qrs.find((q) => q.tokenPublico === token && q.fechaInvalidacion === null);

/** R7: la regeneración invalida el anterior y crea el nuevo (el llamador las aplica en una sola operación). */
export function planRegeneracion(qrs: readonly RegistroQr[], idCaso: number, ahora: string, generar: () => string = generarTokenQr) {
  const anterior = qrActivo(qrs, idCaso);
  let token = generar();
  while (qrs.some((q) => q.tokenPublico === token)) token = generar();
  return { invalidar: anterior ? [anterior.idCodigoQr] : [], nuevo: { idCasoExtravio: idCaso, tokenPublico: token, fechaGeneracion: ahora, fechaInvalidacion: null } };
}
