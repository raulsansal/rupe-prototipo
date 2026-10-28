// Prepara una imagen para el Prototipo: aplica la orientación EXIF, limita el lado mayor SIN ampliar, aplana la transparencia sobre blanco y escribe un JPEG
// SIN metadatos (EXIF, ubicación, perfil). Módulo puro (sin rutas ni consola) para probarlo; lo usan `registrarExtravio`, `scripts/preparar-fotos.ts` y sus pruebas.
// `sharp` es dependencia normal desde P3: el servidor re-codifica toda foto subida (POST /api/casos) y `npm run preparar-fotos` usa este mismo módulo. Sin import «server-only»: lo usan también los scripts.
import sharp from "sharp";

export const LADO_MAXIMO_CASO = 1600;
export const ANCHO_MAXIMO_PORTADA = 2520;
export const CALIDAD_JPEG = 82;

export type Resultado = { bytes: Buffer; ancho: number; alto: number };
export type Verificacion = { esJpeg: boolean; sinExif: boolean; ancho: number; alto: number; lado: number };

type Limite = { tipo: "lado"; maximo: number } | { tipo: "ancho"; maximo: number };

/** Re-codifica `origen` (JPG, PNG o WebP) como JPEG sin metadatos; nunca amplía. `calidad` baja solo para cumplir un peso máximo en bytes (portadas). */
export async function prepararImagen(origen: Buffer | Uint8Array, limite: Limite, { calidad = CALIDAD_JPEG, pesoMaximo }: { calidad?: number; pesoMaximo?: number } = {}): Promise<Resultado> {
  const base = () => {
    const tuberia = sharp(origen).rotate().flatten({ background: { r: 255, g: 255, b: 255 } }); // .rotate() sin argumentos aplica la orientación EXIF; flatten: fondo blanco bajo transparencia
    return limite.tipo === "lado" ? tuberia.resize({ width: limite.maximo, height: limite.maximo, fit: "inside", withoutEnlargement: true }) : tuberia.resize({ width: limite.maximo, withoutEnlargement: true });
  };
  let q = calidad;
  for (;;) {
    // Por omisión sharp NO copia metadatos (no se llama a withMetadata/keepExif): el resultado sale sin EXIF.
    const { data, info } = await base().jpeg({ quality: q, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    if (!pesoMaximo || data.length <= pesoMaximo || q <= 50) return { bytes: data, ancho: info.width, alto: info.height };
    q -= 6;
  }
}

/** Relee el resultado y comprueba que es JPEG, que no conserva EXIF ni ICC y su tamaño. */
export async function verificarResultado(bytes: Buffer | Uint8Array): Promise<Verificacion> {
  const m = await sharp(bytes).metadata();
  const ancho = m.width ?? 0;
  const alto = m.height ?? 0;
  return { esJpeg: m.format === "jpeg", sinExif: !m.exif && !m.icc && !m.xmp && !m.iptc, ancho, alto, lado: Math.max(ancho, alto) };
}
