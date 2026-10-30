import "server-only";
// PDF de la exportación (HU 057) con pdf-lib y Montserrat, igual que la ficha: JavaScript puro, corre con `next start`. Varias páginas, solo agregados (nunca datos de personas) y en niveles de gris
// (la hoja es negro sobre blanco). Lo que la fuente no dibuja (emoji, escrituras no latinas) sale como «?»: el PDF nunca falla por el texto de un catálogo.
import fontkit from "@pdf-lib/fontkit";
import { grayscale, PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";
import { limpiarTextoParaHoja } from "../../lib/ficha/composicion";
import { bytesDeFuente, PESOS } from "../pdf/generarFichaPdf";
import type { ContenidoDeReporte } from "./contenidoDeReporte";

const ANCHO = 612;
const ALTO = 792;
const MARGEN = 48;
const ANCHO_UTIL = ANCHO - 2 * MARGEN;
const PIE = 40;
const NEGRO = grayscale(0);
const GRIS = grayscale(0.37);
const LINEA = grayscale(0.83);

export async function generarPdf(c: ContenidoDeReporte, ahora: Date): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.registerFontkit(fontkit);
  doc.setTitle(c.titulo);
  doc.setAuthor("RUPE");
  doc.setCreator("RUPE");
  doc.setProducer("RUPE");
  doc.setCreationDate(ahora);
  doc.setModificationDate(ahora);
  const normal = await doc.embedFont(bytesDeFuente(PESOS.r), { subset: true });
  const negrita = await doc.embedFont(bytesDeFuente(PESOS.b), { subset: true });
  const soportados = new Set(normal.getCharacterSet());
  const limpio = (t: string) => limpiarTextoParaHoja(t, (cp) => soportados.has(cp));

  let pagina: PDFPage = doc.addPage([ANCHO, ALTO]);
  let y = ALTO - MARGEN;
  const asegurar = (alto: number) => {
    if (y - alto >= PIE + 8) return;
    pagina = doc.addPage([ANCHO, ALTO]);
    y = ALTO - MARGEN;
  };
  /** Divide el texto en líneas que caben en `ancho`; una palabra más larga que la línea se corta por letras. */
  const lineas = (t: string, f: PDFFont, tam: number, ancho: number): string[] => {
    const salida: string[] = [];
    let actual = "";
    for (const palabra of limpio(t).split(" ")) {
      let p = palabra;
      while (f.widthOfTextAtSize(p, tam) > ancho) {
        let n = p.length - 1;
        while (n > 1 && f.widthOfTextAtSize(p.slice(0, n), tam) > ancho) n--;
        if (actual) salida.push(actual);
        salida.push(p.slice(0, n));
        actual = "";
        p = p.slice(n);
      }
      const prueba = actual ? `${actual} ${p}` : p;
      if (actual && f.widthOfTextAtSize(prueba, tam) > ancho) {
        salida.push(actual);
        actual = p;
      } else actual = prueba;
    }
    if (actual) salida.push(actual);
    return salida.length ? salida : [""];
  };
  const texto = (t: string, { f = normal, tam = 10, color = NEGRO, ancho = ANCHO_UTIL, x = MARGEN, interlineado = 1.35 } = {}) => {
    for (const l of lineas(t, f, tam, ancho)) {
      asegurar(tam * interlineado);
      y -= tam * interlineado;
      pagina.drawText(l, { x, y, size: tam, font: f, color });
    }
  };
  const fila = (izq: string, der: string, { f = normal, tam = 10, derNegrita = false } = {}) => {
    const ls = lineas(izq, f, tam, ANCHO_UTIL - 90);
    asegurar(ls.length * tam * 1.35 + 6);
    for (const [i, l] of ls.entries()) {
      y -= tam * 1.35;
      pagina.drawText(l, { x: MARGEN, y, size: tam, font: f, color: NEGRO });
      if (i === 0) {
        const d = limpio(der);
        const fd = derNegrita ? negrita : normal;
        pagina.drawText(d, { x: MARGEN + ANCHO_UTIL - fd.widthOfTextAtSize(d, tam), y, size: tam, font: fd, color: NEGRO });
      }
    }
    y -= 4;
    pagina.drawLine({ start: { x: MARGEN, y }, end: { x: MARGEN + ANCHO_UTIL, y }, thickness: 0.5, color: LINEA });
  };
  const seccion = (t: string) => {
    asegurar(60);
    y -= 14;
    texto(t, { f: negrita, tam: 12 });
    y -= 2;
  };
  const numero = (v: number | null, tipo: "entero" | "porcentaje") => (v === null ? "—" : tipo === "porcentaje" ? `${v.toFixed(1)} %` : String(v));

  texto("RUPE · Registro Único de Perros Extraviados", { f: negrita, tam: 9, color: GRIS });
  texto(c.titulo, { f: negrita, tam: 20, interlineado: 1.5 });
  texto(`Generado el ${c.generado}`, { tam: 9, color: GRIS });
  seccion("Filtros aplicados");
  for (const [k, v] of c.filtros) fila(k, v);
  seccion("Indicadores");
  for (const i of c.indicadores) fila(i.rotulo, numero(i.valor, i.tipo), { f: negrita, tam: 11, derNegrita: true });
  for (const t of c.tablas) {
    seccion(t.titulo);
    fila(t.columnas[0], t.columnas[1], { f: negrita, tam: 9, derNegrita: true });
    for (const [k, v] of t.filas) fila(k, String(v));
  }
  y -= 10;
  for (const n of c.notas) texto(n, { tam: 8.5, color: GRIS });

  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    const t = `Página ${i + 1} de ${paginas.length}`;
    p.drawText(t, { x: ANCHO - MARGEN - normal.widthOfTextAtSize(t, 8), y: PIE - 14, size: 8, font: normal, color: GRIS });
    p.drawText("RUPE · Reporte estadístico", { x: MARGEN, y: PIE - 14, size: 8, font: normal, color: GRIS });
  });
  return await doc.save();
}
