// Ayudas de las pruebas del PDF: extracción del texto (pdfjs-dist, devDependency) y trama de bits del QR para decodificarlo con jsQR.
import jsQR from "jsqr";

type Pdfjs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let lib: Promise<Pdfjs> | undefined;

/** Texto de la página 1 en el orden en que se dibujó, y el tamaño de la página en puntos. */
export type ElementoDeTexto = { texto: string; x: number; y: number; ancho: number; alto: number };
export async function leerPdf(bytes: Uint8Array): Promise<{ texto: string; lineas: string[]; elementos: ElementoDeTexto[]; paginas: number; ancho: number; alto: number }> {
  const pdfjs = await (lib ??= import("pdfjs-dist/legacy/build/pdf.mjs"));
  const doc = await pdfjs.getDocument({ data: Uint8Array.from(bytes), useSystemFonts: false, verbosity: 0 }).promise;
  const pagina = await doc.getPage(1);
  const v = pagina.getViewport({ scale: 1 });
  const contenido = await pagina.getTextContent();
  const lineas = contenido.items.map((i) => ("str" in i ? i.str : "")).filter((s) => s.trim() !== "");
  const elementos = contenido.items.flatMap((i) => ("str" in i && i.str.trim() !== "" ? [{ texto: i.str, x: i.transform[4], y: i.transform[5], ancho: i.width, alto: i.height }] : []));
  const resultado = { elementos, texto: lineas.join(" ").replace(/\s+/g, " ").trim(), lineas, paginas: doc.numPages, ancho: Math.round(v.width * 100) / 100, alto: Math.round(v.height * 100) / 100 };
  return resultado;
}

/** Imagen RGBA del QR (negro sobre blanco) con zona de silencio, `escala` píxeles por módulo; `reducir` simula un reescalado a la baja (vecino más cercano). */
export function rasterizarMatriz(filas: boolean[][], escala = 8, silencio = 4): { data: Uint8ClampedArray; ancho: number; alto: number } {
  const n = filas.length;
  const lado = (n + 2 * silencio) * escala;
  const data = new Uint8ClampedArray(lado * lado * 4).fill(255);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!filas[y][x]) continue;
    for (let dy = 0; dy < escala; dy++) for (let dx = 0; dx < escala; dx++) {
      const i = (((y + silencio) * escala + dy) * lado + (x + silencio) * escala + dx) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
  }
  return { data, ancho: lado, alto: lado };
}

/** Decodifica un QR de una imagen RGBA con jsQR: devuelve el texto y la versión, o undefined si no se pudo leer. */
export function decodificarQr(img: { data: Uint8ClampedArray; ancho: number; alto: number }): { texto: string; version: number } | undefined {
  const r = jsQR(img.data, img.ancho, img.alto, { inversionAttempts: "dontInvert" });
  return r ? { texto: r.data, version: r.version } : undefined;
}
