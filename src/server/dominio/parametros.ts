// HU 054 (P6b): reglas de los parámetros del sistema, del lado del servidor. Funciones PURAS: el repositorio las llama dentro de su transacción. La validación de cada valor es la misma de la
// pantalla (`lib/parametros.ts`); aquí solo se arma qué cambia. Solo cambian los parámetros cuyo valor NORMALIZADO es distinto del vigente: sin cambios no se escribe nada (ni bitácora).
import { CLAVES_PARAMETRO, type ClaveParametro } from "../../config/parametros";
import { normalizarParametro } from "../../lib/parametros";
import { validacion } from "../errores";
import type { ParametroSistema } from "../tipos";

export type CambioDeParametro = { clave: ClaveParametro; anterior: string; nuevo: string };

/** R24 / HU 054 regla 6: el detalle de bitácora lleva el valor anterior y el nuevo. */
export const detalleDeParametro = (c: CambioDeParametro) => `${c.anterior} → ${c.nuevo}`;

/** Cuerpo de la modificación: un objeto con uno o más parámetros conocidos. 422 por parámetro si alguno no vale (no se cambia ninguno). */
export function planearCambioDeParametros(entrada: unknown, actuales: readonly ParametroSistema[]): CambioDeParametro[] {
  if (typeof entrada !== "object" || entrada === null || Array.isArray(entrada)) throw validacion({ parametros: "Indica los parámetros que cambian." });
  const e = entrada as Record<string, unknown>;
  const campos: Record<string, string> = {};
  const claves = Object.keys(e);
  if (claves.length === 0) throw validacion({ parametros: "Indica al menos un parámetro." });
  const cambios: CambioDeParametro[] = [];
  for (const clave of claves) {
    if (!(CLAVES_PARAMETRO as readonly string[]).includes(clave)) {
      campos[clave] = "Parámetro desconocido.";
      continue;
    }
    const k = clave as ClaveParametro;
    const bruto = e[k];
    if (typeof bruto !== "string" && typeof bruto !== "number") {
      campos[k] = "El valor debe ser texto o número.";
      continue;
    }
    const r = normalizarParametro(k, String(bruto));
    if ("error" in r) {
      campos[k] = r.error;
      continue;
    }
    const anterior = actuales.find((p) => p.clave === k)!.valor;
    if (r.valor !== anterior) cambios.push({ clave: k, anterior, nuevo: r.valor });
  }
  if (Object.keys(campos).length) throw validacion(campos);
  return cambios;
}

/** «Restablecer valores por defecto»: copia `valorPorDefecto` a `valor` en los que difieren. */
export const planearRestablecimiento = (actuales: readonly ParametroSistema[]): CambioDeParametro[] =>
  actuales.filter((p) => p.valor !== p.valorPorDefecto).map((p) => ({ clave: p.clave, anterior: p.valor, nuevo: p.valorPorDefecto }));
