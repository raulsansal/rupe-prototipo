// Tokens del QR DETERMINISTAS para las verificaciones del PDF: el resultado no depende del azar de cada corrida.
import { generarTokenQr } from "../../src/server/dominio/qr";

/** Generador de bytes xorshift32 con semilla fija (solo para pruebas: los tokens reales usan crypto). */
export function bytesDeterministas(semilla: number): (n: number) => Uint8Array {
  let x = semilla >>> 0 || 1;
  return (n) => Uint8Array.from({ length: n }, () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x & 0xff;
  });
}

/** `n` tokens base62 de 32 caracteres, siempre los mismos para la misma semilla. */
export function tokensDeterministas(n: number, semilla = 20261028): string[] {
  const fuente = bytesDeterministas(semilla);
  return Array.from({ length: n }, () => generarTokenQr(fuente));
}

/** Tokens que alguna vez fallaron al leerse en una medición (se agregan aquí para que no vuelvan a fallar). */
export const TOKENS_FIJOS: string[] = ["7rPjrfCKyLDAX9QVSm0mhNiUdrvFjf5w"]; // falló a 112 ppp en Media carta en la medición de 300 tokens (28 oct 2026)
