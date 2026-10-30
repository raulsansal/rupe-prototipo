// Estructura de un PDF: las imágenes que dibuja la PRIMERA página (con su tamaño propio y el tamaño con que se dibujan, en puntos). Sirve para comprobar que un logotipo va incrustado y sin deformar.
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef } from "pdf-lib";

export type ImagenEnPdf = { nombre: string; ancho: number; alto: number; dibujadaAncho: number; dibujadaAlto: number; x: number; y: number };

export async function imagenesDePrimeraPagina(pdf: Uint8Array): Promise<ImagenEnPdf[]> {
  const doc = await PDFDocument.load(pdf);
  const pagina = doc.getPage(0);
  const recursos = pagina.node.Resources();
  const xobjetos = recursos?.lookup(PDFName.of("XObject"));
  const imagenes = new Map<string, { ancho: number; alto: number }>();
  if (xobjetos instanceof PDFDict) {
    for (const [nombre, ref] of xobjetos.entries()) {
      const obj = ref instanceof PDFRef ? doc.context.lookup(ref) : ref;
      const dic = obj instanceof PDFRawStream ? obj.dict : undefined;
      if (dic?.get(PDFName.of("Subtype")) === PDFName.of("Image")) imagenes.set(nombre.decodeText(), { ancho: (dic.lookup(PDFName.of("Width")) as PDFNumber).asNumber(), alto: (dic.lookup(PDFName.of("Height")) as PDFNumber).asNumber() });
    }
  }
  const contenido = pagina.node.Contents();
  const flujos = (contenido instanceof PDFArray ? contenido.asArray().map((r) => doc.context.lookup(r)) : [contenido]).filter((f): f is PDFRawStream => f instanceof PDFRawStream);
  const texto = flujos.map((f) => Buffer.from(decodePDFRawStream(f).decode()).toString("latin1")).join("\n");
  const salida: ImagenEnPdf[] = [];
  // pdf-lib dibuja una imagen con varias `cm` seguidas (traslación y escala) dentro de q … Q: se componen (cada `cm` se aplica antes que las anteriores) para obtener posición y tamaño finales.
  for (const m of texto.matchAll(/\/(\S+) Do/g)) {
    const img = imagenes.get(m[1]);
    if (!img) continue;
    const bloque = texto.slice(texto.lastIndexOf("q", m.index), m.index);
    let M = [1, 0, 0, 1, 0, 0];
    for (const c of bloque.matchAll(/([\d.\-]+) ([\d.\-]+) ([\d.\-]+) ([\d.\-]+) ([\d.\-]+) ([\d.\-]+) cm/g)) {
      const [a, b, c2, d, e, f] = c.slice(1).map(Number);
      M = [a * M[0] + b * M[2], a * M[1] + b * M[3], c2 * M[0] + d * M[2], c2 * M[1] + d * M[3], e * M[0] + f * M[2] + M[4], e * M[1] + f * M[3] + M[5]];
    }
    salida.push({ nombre: m[1], ...img, dibujadaAncho: M[0], dibujadaAlto: M[3], x: M[4], y: M[5] });
  }
  return salida;
}
