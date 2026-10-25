// R26 y R31: folio 'RUPE-' + 8 caracteres aleatorios (A–Z sin I ni O, y 2–9), único, con reintento si coincide; la consulta no distingue mayúsculas.
import { randomInt } from "node:crypto";
import { PATRON_FOLIO } from "../../mocks/tipos";
import { reglaDeNegocio } from "../errores";

export const ALFABETO_FOLIO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 símbolos
export type Aleatorio = (maximoExclusivo: number) => number;

export function generarFolio(aleatorio: Aleatorio = (n) => randomInt(n)): string {
  let sufijo = "";
  for (let i = 0; i < 8; i++) sufijo += ALFABETO_FOLIO[aleatorio(ALFABETO_FOLIO.length)];
  return `RUPE-${sufijo}`;
}

export const esFolioValido = (folio: string) => PATRON_FOLIO.test(folio);

/** R26: la consulta ignora mayúsculas y espacios en los extremos; el folio guardado siempre está en mayúsculas. */
export const normalizarFolio = (entrada: string) => entrada.trim().toUpperCase();

/** Genera un folio que no exista todavía; reintenta ante coincidencia (R26). */
export async function generarFolioUnico(existe: (folio: string) => boolean | Promise<boolean>, { aleatorio, intentos = 10 }: { aleatorio?: Aleatorio; intentos?: number } = {}): Promise<string> {
  for (let i = 0; i < intentos; i++) {
    const folio = generarFolio(aleatorio);
    if (!(await existe(folio))) return folio;
  }
  throw reglaDeNegocio("R26", "No fue posible generar un folio único.", "FOLIO_NO_GENERADO");
}
