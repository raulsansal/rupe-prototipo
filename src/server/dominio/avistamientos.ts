// Validaciones del avistamiento (HU 029–035, R3, R11, R14, R34).
import { centroDeAlcaldia, type Coordenadas } from "../../mocks/geografia";
import type { Alcaldia } from "../../mocks/tipos";
import { reglaDeNegocio } from "../errores";

export const MAXIMO_TECNICO_MB = 4.5;
export type FotoRecibida = { formato: string; tamanoBytes: number };

/** R11: JPG o PNG y tamaño dentro del parámetro (nunca por encima del límite técnico de 4.5 MB). */
export function validarFotografia(f: FotoRecibida, maximoMb: number): void {
  if (!["JPG", "PNG"].includes(f.formato.toUpperCase())) throw reglaDeNegocio("R11", "La fotografía debe ser JPG o PNG.", "FOTO_FORMATO");
  if (!(f.tamanoBytes > 0) || f.tamanoBytes > Math.min(maximoMb, MAXIMO_TECNICO_MB) * 1024 * 1024) throw reglaDeNegocio("R11", `La fotografía no puede pesar más de ${Math.min(maximoMb, MAXIMO_TECNICO_MB)} MB.`, "FOTO_TAMANO");
}

/** R14: latitud y longitud siempre obligatorias y dentro de rango. */
export function validarCoordenadas(latitud: number, longitud: number): void {
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud) || latitud < -90 || latitud > 90 || longitud < -180 || longitud > 180) throw reglaDeNegocio("R14", "La ubicación del avistamiento no es válida.", "UBICACION_INVALIDA");
}

/** R34: el comentario se sanea antes de guardarse (sin etiquetas ni caracteres de control) y no pasa de 300 caracteres. */
export function sanearComentario(texto: string | undefined): string | undefined {
  if (texto === undefined) return undefined;
  const limpio = texto.replace(/<[^>]*>/g, "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (limpio.length > 300) throw reglaDeNegocio("R34", "El comentario no puede pasar de 300 caracteres.", "COMENTARIO_LARGO");
  return limpio || undefined;
}

/** Desplazamiento máximo (grados, ≈ 440 m) del punto simulado respecto del centro de la alcaldía: mucho menor que la mitad de la distancia entre centros vecinos (≈ 0,04°). */
export const DESPLAZAMIENTO_MAXIMO = 0.004;

/**
 * UBICACIÓN SIMULADA del Prototipo (no hay mapa ni geocodificador): punto determinista cerca del centro de la alcaldía elegida, derivado de un hash de la alcaldía y de la
 * dirección escrita. Es la misma para la misma dirección y siempre cae dentro de la alcaldía elegida. Se guarda con `ubicacionSimulada: true`.
 */
export function ubicacionSimulada(alcaldia: Alcaldia, direccion: string): Coordenadas {
  let h = 2166136261;
  for (const c of `${alcaldia}|${direccion.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim()}`) h = Math.imul(h ^ c.codePointAt(0)!, 16777619) >>> 0;
  const h2 = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  const centrado = (x: number) => ((x & 0xffff) / 0xffff) * 2 - 1; // −1 a 1
  const centro = centroDeAlcaldia(alcaldia);
  const r = (n: number) => Math.round(n * 1e6) / 1e6;
  return { latitud: r(centro.latitud + centrado(h >>> 8) * DESPLAZAMIENTO_MAXIMO), longitud: r(centro.longitud + centrado(h2 >>> 8) * DESPLAZAMIENTO_MAXIMO) };
}

/** Fecha «AAAA-MM-DD» y hora «HH:MM» de la Ciudad de México (UTC−6, sin horario de verano) a un instante UTC en ISO; undefined si no son una fecha y hora reales. */
export function fechaHoraDeCDMX(fecha: string, hora: string): string | undefined {
  const f = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  const t = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!f || !t) return undefined;
  const [a, m, d, hh, mm] = [Number(f[1]), Number(f[2]), Number(f[3]), Number(t[1]), Number(t[2])];
  const utc = new Date(Date.UTC(a, m - 1, d, hh + 6, mm));
  const real = new Date(Date.UTC(a, m - 1, d));
  if (real.getUTCMonth() !== m - 1 || real.getUTCDate() !== d || hh > 23 || mm > 59) return undefined;
  return utc.toISOString().replace(".000Z", "Z");
}
