// Reducción de la fotografía EN EL NAVEGADOR antes de enviarla (HU 011, regla 2): se decodifica (aplicando la orientación del EXIF), se dibuja en un lienzo con fondo
// blanco y se vuelve a codificar como JPEG. Así baja de peso y se descartan los metadatos (EXIF, ubicación, dispositivo); un PNG con transparencia queda sobre blanco.
// Nunca se envía el archivo original: si no se puede leer o reducir, no hay foto.
export type ResultadoReduccion = { blob: Blob; ancho: number; alto: number; bytesOriginal: number } | { error: { titulo: string; detalle: string } };

export const LADO_MAXIMO = 1600;
const CALIDADES = [0.85, 0.7, 0.55];
const LADOS = [LADO_MAXIMO, 1200, 900];
export const ERROR_ILEGIBLE = { titulo: "No pudimos leer esta imagen", detalle: "Elige otra foto JPG o PNG" };

const aBlob = (lienzo: HTMLCanvasElement, calidad: number) => new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", calidad));

export async function reducirImagen(archivo: File, maxBytes: number): Promise<ResultadoReduccion> {
  let imagen: ImageBitmap;
  try {
    imagen = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch {
    return { error: ERROR_ILEGIBLE }; // formato no admitido (HEIC, WebP…), archivo corrupto o truncado
  }
  try {
    for (const lado of LADOS) {
      const escala = Math.min(1, lado / Math.max(imagen.width, imagen.height));
      const ancho = Math.max(1, Math.round(imagen.width * escala));
      const alto = Math.max(1, Math.round(imagen.height * escala));
      const lienzo = document.createElement("canvas");
      lienzo.width = ancho;
      lienzo.height = alto;
      const c = lienzo.getContext("2d");
      if (!c) return { error: ERROR_ILEGIBLE };
      c.fillStyle = "white"; // transparencia → blanco (no negro)
      c.fillRect(0, 0, ancho, alto);
      c.drawImage(imagen, 0, 0, ancho, alto);
      for (const calidad of CALIDADES) {
        const blob = await aBlob(lienzo, calidad);
        if (!blob) return { error: ERROR_ILEGIBLE };
        if (blob.size <= maxBytes) return { blob, ancho, alto, bytesOriginal: archivo.size };
      }
    }
    return { error: { titulo: `La foto pesa más de ${Math.round((maxBytes / 1024 / 1024) * 10) / 10} MB`, detalle: "Elige otra o redúcela" } };
  } finally {
    imagen.close();
  }
}
