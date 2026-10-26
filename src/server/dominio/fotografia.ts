// Fotografía recibida (HU 011, R11): el tipo REAL sale de los bytes de cabecera, no de la extensión ni del tipo que declara el cliente. Los bytes viven en
// memoria (sin BLOB ni archivo). El servidor NO quita metadatos (EXIF): la reducción por canvas del navegador los descarta; antes de publicar fichas
// (P3/P4) habrá que re-codificar en el servidor.
export type FormatoFoto = "JPG" | "PNG";
export const TIPO_MIME: Record<FormatoFoto, string> = { JPG: "image/jpeg", PNG: "image/png" };
export const MAXIMO_TECNICO_MB = 4.5; // R11

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** JPEG empieza con FF D8 FF; PNG con su firma de 8 bytes. Cualquier otra cosa (GIF, SVG, texto, HTML…) no es una foto admitida. */
export function detectarFormato(bytes: Uint8Array): FormatoFoto | undefined {
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "JPG";
  if (bytes.length >= 12 && FIRMA_PNG.every((b, i) => bytes[i] === b)) return "PNG";
  return undefined;
}

export const limiteDeBytes = (maximoMb: number) => Math.floor(Math.min(maximoMb, MAXIMO_TECNICO_MB) * 1024 * 1024);

export type ResultadoFoto = { formato: FormatoFoto; tipoMime: string } | { error: string };

/** Valida la parte «fotografia»: obligatoria, no vacía, dentro del tamaño, tipo real JPG o PNG y coincidente con el tipo declarado. */
export function validarFotografiaRecibida(foto: { bytes: Uint8Array; tipoDeclarado: string } | undefined, maximoMb: number): ResultadoFoto {
  if (!foto || foto.bytes.length === 0) return { error: "La fotografía es obligatoria. Toma o elige una foto de tu perro." };
  if (foto.bytes.length > limiteDeBytes(maximoMb)) return { error: `La fotografía no puede pesar más de ${Math.min(maximoMb, MAXIMO_TECNICO_MB)} MB.` };
  const formato = detectarFormato(foto.bytes);
  if (!formato || foto.tipoDeclarado.toLowerCase() !== TIPO_MIME[formato]) return { error: "La fotografía debe ser JPG o PNG." };
  return { formato, tipoMime: TIPO_MIME[formato] };
}
