// Ayudas de las pruebas: un almacén sembrado aparte (sin tocar el singleton) y un reloj fijo.
import { randomBytes } from "node:crypto";
import { almacenVacio, type Almacen } from "../memoria/almacen";
import { crearRepositorios } from "../memoria/repos";
import { sembrar } from "../seed/seed";
import type { Contexto } from "../servicios/contexto";

/** Instante fijo de las pruebas: 18 de octubre de 2026, 12:00 UTC (6:00 en la Ciudad de México). */
export const AHORA = new Date("2026-10-18T12:00:00Z");

/** Contraseñas y secreto ALEATORIOS de cada corrida: ningún valor de credencial vive en el código. */
export const secretoAleatorio = () => randomBytes(24).toString("hex");

export function nuevoContexto(entorno: Record<string, string | undefined> = {}, reloj: () => Date = () => AHORA): { ctx: Contexto; almacen: Almacen } {
  const almacen = sembrar(almacenVacio(), entorno);
  return { ctx: { repos: crearRepositorios(() => almacen), reloj }, almacen };
}
