import "server-only";
// Contraseñas: bcryptjs (JavaScript puro). R23: mínimo 8 caracteres con letras y números. bcrypt solo lee los primeros 72 BYTES, así que se rechaza
// una contraseña más larga en lugar de truncarla en silencio (la HU 002 no fija máximo; se reporta como desviación mínima).
import { compare, hash, hashSync } from "bcryptjs";
import { randomBytes } from "node:crypto";

/** Costo de bcrypt: bajo lo bastante para que el arranque y las pruebas no se vuelvan lentos, sin ser trivial. */
export const COSTO_BCRYPT = 10;
export const MAXIMO_BYTES_CONTRASENA = 72;
export const bytesDe = (texto: string) => Buffer.byteLength(texto, "utf8");

/** Mensaje de error de la política (o undefined si cumple). */
export function errorDePoliticaDeContrasena(c: string): string | undefined {
  if (c.length < 8 || !/\p{L}/u.test(c) || !/\p{Nd}/u.test(c)) return "La contraseña debe tener mínimo 8 caracteres, con letras y números.";
  if (bytesDe(c) > MAXIMO_BYTES_CONTRASENA) return `La contraseña no puede pasar de ${MAXIMO_BYTES_CONTRASENA} bytes (los acentos y símbolos ocupan más de uno): acórtala.`;
  return undefined;
}

export type Comparar = (contrasena: string, hash: string) => Promise<boolean>;
export type Hashear = (contrasena: string) => Promise<string>;
export const compararContrasena: Comparar = (c, h) => compare(c, h);
export const hashearContrasena: Hashear = (c) => hash(c, COSTO_BCRYPT);

/** Hash de relleno con el MISMO costo: se compara contra él cuando la cuenta no existe, para que el tiempo de respuesta no delate si existe. */
export const HASH_SENUELO = hashSync(randomBytes(16).toString("hex"), COSTO_BCRYPT);
