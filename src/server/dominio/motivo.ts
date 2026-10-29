// R34: los textos libres de la persona usuaria se sanean antes de guardarse. El motivo de una reactivación o cancelación (HU 043, HU 017) se limpia aquí; su obligatoriedad y su largo
// (≤ 300) los valida la matriz R12 (`estadoDeLlegada`) sobre el texto YA saneado.
import { reglaDeNegocio } from "../errores";

/**
 * Motivo saneado: sin etiquetas ni caracteres de control, con los espacios recortados. `undefined` si no hay texto (vacío o solo etiquetas). Lanza 422 si no es texto.
 * Un motivo que sobra (acciones que no lo piden) no se llama aquí: se ignora.
 */
export function sanearMotivo(texto: unknown): string | undefined {
  if (texto === undefined || texto === null) return undefined;
  if (typeof texto !== "string") throw reglaDeNegocio("R34", "El motivo debe ser texto.", "MOTIVO_INVALIDO");
  const limpio = texto.replace(/<[^>]*>/g, "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  return limpio || undefined;
}
