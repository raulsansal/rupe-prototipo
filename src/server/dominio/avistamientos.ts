// Validaciones del avistamiento (HU 029–035, R3, R11, R14, R34).
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
