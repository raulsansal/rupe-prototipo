// Cookie de sesión FIRMADA: base64url(payload JSON) + "." + base64url(HMAC-SHA256). El secreto viene de la variable de entorno RUPE_SESION_SECRETO (solo se
// documenta su nombre). La firma se compara en tiempo constante. Este módulo no toca Next ni el almacén.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Rol } from "../../mocks/usuarios";

export type PayloadSesion = { sid: string; idUsuario: number; rol: Rol; /** Expiración, en segundos desde la época. */ exp: number };
export const VARIABLE_SECRETO = "RUPE_SESION_SECRETO";
const MINIMO_SECRETO = 16;

export function leerSecreto(entorno: Record<string, string | undefined> = process.env): string {
  const s = entorno[VARIABLE_SECRETO];
  if (!s || s.length < MINIMO_SECRETO) throw new Error(`Falta la variable de entorno ${VARIABLE_SECRETO} (mínimo ${MINIMO_SECRETO} caracteres).`);
  return s;
}

const b64 = (b: Buffer) => b.toString("base64url");
const firmaDe = (cuerpo: string, secreto: string) => createHmac("sha256", secreto).update(cuerpo).digest();

export function firmar(payload: PayloadSesion, secreto: string): string {
  const cuerpo = b64(Buffer.from(JSON.stringify(payload)));
  return `${cuerpo}.${b64(firmaDe(cuerpo, secreto))}`;
}

/** Devuelve el payload si la firma es válida y no ha expirado; si no, undefined (nunca lanza por un valor mal formado). */
export function verificar(valor: string | undefined, secreto: string, ahoraSegundos: number = Math.floor(Date.now() / 1000)): PayloadSesion | undefined {
  if (!valor) return undefined;
  const partes = valor.split(".");
  if (partes.length !== 2) return undefined;
  const [cuerpo, firma] = partes;
  const esperada = firmaDe(cuerpo, secreto);
  let recibida: Buffer;
  try {
    recibida = Buffer.from(firma, "base64url");
  } catch {
    return undefined;
  }
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return undefined;
  try {
    const p = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")) as PayloadSesion;
    if (typeof p.sid !== "string" || typeof p.idUsuario !== "number" || (p.rol !== "Administrador" && p.rol !== "Tutor") || typeof p.exp !== "number") return undefined;
    return p.exp > ahoraSegundos ? p : undefined;
  } catch {
    return undefined;
  }
}
