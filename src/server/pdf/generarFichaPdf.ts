import "server-only";
// PDF REAL de la ficha de búsqueda (HU 019, 020, 022 y 027) con pdf-lib: JavaScript puro, sin navegador ni binarios, así que corre con `next start`. La composición (medidas, topes de línea,
// textos y orden) sale de src/lib/ficha/composicion.ts, la MISMA que usa la hoja en pantalla. El QR se dibuja en vectores a partir de la matriz de qrcode (nítido al imprimir).
// La hoja NUNCA lleva datos de la persona tutora, el token en texto, la calle, las referencias, el momento del día, el motivo ni la descripción: recibe solo campos públicos.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, clip, endPath, grayscale, popGraphicsState, pushGraphicsState, rectangle, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import {
  GEOMETRIA_CARTA as C, MARGEN_PT, MODULOS_ZONA_DE_SILENCIO, OPACIDAD_RELLENO, PAGINA_PT, PT_POR_CM, QR_SIMBOLO_CM, RELLENO_FOTO, TIPOGRAFIA, ajustarSegmentos, esCaracterDeLaHoja,
  fotoVisible, geometriaDeHoja, limpiarTextoParaHoja, type Bloque, type BloqueId, type FichaParaHoja, type Segmento, type TamanoHoja,
} from "../../lib/ficha/composicion";
import { contenidoDeFicha } from "../../lib/ficha/composicion";
import type { MatrizQr } from "../qr/matrizQr";

export type EntradaPdf = {
  ficha: FichaParaHoja;
  /** Fecha del extravío ya formateada («26 de octubre de 2026»). */
  fechaLarga: string;
  /** Dominio de consulta que se imprime en el pie (host de la base pública). */
  dominio: string;
  tamano: TamanoHoja;
  qr: MatrizQr;
  /** Bytes de la fotografía (JPEG o PNG). Sin foto se dibuja un recuadro «Fotografía no disponible». */
  foto?: Uint8Array;
  ahora: Date;
};

const CARPETA_FUENTES = join(process.cwd(), "src", "server", "pdf", "fuentes");
export const PESOS = { r: 400, m: 500, b: 700, x: 800 } as const;
const cacheFuentes = new Map<number, Uint8Array>();
export const bytesDeFuente = (peso: number) => cacheFuentes.get(peso) ?? (cacheFuentes.set(peso, Uint8Array.from(readFileSync(join(CARPETA_FUENTES, `montserrat-${peso}.woff`)))), cacheFuentes.get(peso)!);
const RUTA_LOGO = join(process.cwd(), "public", "brand", "logo_hor_primario.png");
const LOGO_PROPORCION = 1772 / 709;
// Colores del papel (la hoja es siempre negro sobre blanco): solo niveles de gris de pdf-lib, sin valores de color fuera de globals.css.
const NEGRO = grayscale(0);
const BORDE = grayscale(0.83);
const NEUTRO = grayscale(0.957);
const BLANCO = grayscale(1);
const GRIS_TEXTO = grayscale(0.37);

type Fuentes = Record<keyof typeof PESOS, PDFFont>;

/** Genera el PDF (Carta 612×792 pt o Media carta horizontal 612×396 pt). Nunca lanza por el texto: lo que la fuente no dibuja se sustituye por «?». */
export async function generarFichaPdf(entrada: EntradaPdf): Promise<Uint8Array> {
  const { tamano } = entrada;
  const pagina = PAGINA_PT[tamano];
  const doc = await PDFDocument.create({ updateMetadata: false }); // sin esto pdf-lib pisa autor y productor con su nombre
  doc.registerFontkit(fontkit);
  // Metadatos sin datos personales: título genérico con el folio; autor, creador y productor son el sistema.
  doc.setTitle(`Ficha de búsqueda ${entrada.ficha.folio}`);
  doc.setAuthor("RUPE");
  doc.setCreator("RUPE");
  doc.setProducer("RUPE");
  doc.setSubject("Ficha de búsqueda de un perro extraviado");
  doc.setKeywords([]);
  doc.setCreationDate(entrada.ahora);
  doc.setModificationDate(entrada.ahora);
  const fuentes = {} as Fuentes;
  for (const [k, peso] of Object.entries(PESOS) as [keyof typeof PESOS, number][]) fuentes[k] = await doc.embedFont(bytesDeFuente(peso), { subset: true });
  const hoja = doc.addPage([pagina.ancho, pagina.alto]);
  const dibujante = new Dibujante(hoja, fuentes, pagina.alto);
  const foto = await incrustarFoto(doc, entrada.foto);
  let logo: PDFImage | undefined;
  try {
    logo = await doc.embedPng(readFileSync(RUTA_LOGO));
  } catch {
    logo = undefined; // sin el archivo del logotipo se escribe «RUPE»
  }
  if (tamano === "carta") componerCarta(dibujante, entrada, foto, logo);
  else componerMediaCarta(dibujante, entrada, foto, logo);
  return doc.save();
}

async function incrustarFoto(doc: PDFDocument, bytes?: Uint8Array): Promise<PDFImage | undefined> {
  if (!bytes || bytes.length < 4) return undefined;
  try {
    return bytes[0] === 0xff && bytes[1] === 0xd8 ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------- dibujo
class Dibujante {
  private juegos = new Map<PDFFont, Set<number>>();
  constructor(readonly p: PDFPage, readonly f: Fuentes, private alto: number) {}
  /** Coordenada y de la página (origen abajo) para una distancia `arriba` desde el borde superior. */
  y = (arriba: number) => this.alto - arriba;

  limpiar(texto: string, f: PDFFont): string {
    let juego = this.juegos.get(f);
    if (!juego) this.juegos.set(f, (juego = new Set(f.getCharacterSet())));
    return limpiarTextoParaHoja(texto, (cp) => esCaracterDeLaHoja(cp) && juego!.has(cp));
  }
  ancho(texto: string, f: PDFFont, tam: number) {
    return f.widthOfTextAtSize(this.limpiar(texto, f), tam);
  }
  /** Línea base de un texto dentro de una caja de alto `lh` que empieza en `arriba` (centrado como lo hace CSS con la métrica de Montserrat: 0,968 / −0,251). */
  linea(arriba: number, tam: number, lh: number) {
    return this.y(arriba + (lh - 1.219 * tam) / 2 + 0.968 * tam);
  }
  texto(t: string, x: number, arriba: number, f: PDFFont, tam: number, lh: number, color = NEGRO) {
    const s = this.limpiar(t, f);
    if (s) this.p.drawText(s, { x, y: this.linea(arriba, tam, lh), size: tam, font: f, color });
  }
  /** Bloque de texto en líneas (ajuste por palabras, tope de líneas y elipsis). Devuelve el alto usado. */
  bloque(segmentos: Segmento[], x: number, arriba: number, ancho: number, maxLineas: number, tam: number, interlinea: number, fuente: { normal: PDFFont; negrita: PDFFont }, opciones: { centrado?: boolean; mayusculas?: boolean } = {}): number {
    const segs = segmentos.map((s) => ({ ...s, t: this.limpiar(opciones.mayusculas ? s.t.toUpperCase() : s.t, s.negrita ? fuente.negrita : fuente.normal) }));
    const medir = (t: string, negrita: boolean) => (negrita ? fuente.negrita : fuente.normal).widthOfTextAtSize(t, tam);
    const lineas = ajustarSegmentos(segs, maxLineas, ancho, medir);
    const lh = tam * interlinea;
    lineas.forEach((linea, i) => {
      const esp = (n: boolean) => medir(" ", n);
      const total = linea.reduce((a, s, j) => a + medir(s.t, !!s.negrita) + (j ? esp(!!s.negrita) : 0), 0);
      let cx = opciones.centrado ? x + (ancho - total) / 2 : x;
      linea.forEach((s, j) => {
        if (j) cx += esp(!!s.negrita);
        const f = s.negrita ? fuente.negrita : fuente.normal;
        this.p.drawText(s.t, { x: cx, y: this.linea(arriba + i * lh, tam, lh), size: tam, font: f, color: NEGRO });
        cx += medir(s.t, !!s.negrita);
      });
    });
    return lineas.length * lh;
  }
  rectRedondeado(x: number, arriba: number, w: number, h: number, r: number, grosor: number) {
    const q = (n: number) => Math.round(n * 100) / 100;
    const d = `M ${q(r)},0 H ${q(w - r)} Q ${q(w)},0 ${q(w)},${q(r)} V ${q(h - r)} Q ${q(w)},${q(h)} ${q(w - r)},${q(h)} H ${q(r)} Q 0,${q(h)} 0,${q(h - r)} V ${q(r)} Q 0,0 ${q(r)},0 Z`;
    this.p.drawSvgPath(d, { x, y: this.y(arriba), borderColor: NEGRO, borderWidth: grosor });
  }
  /** Etiqueta en mayúsculas alineada a la derecha de la caja (sin espaciado entre letras: con él el texto se extrae del PDF como «F I C H A»). */
  etiqueta(t: string, derecha: number, arriba: number, tam: number, lh: number, f: PDFFont) {
    const s = this.limpiar(t.toUpperCase(), f);
    this.p.drawText(s, { x: derecha - f.widthOfTextAtSize(s, tam), y: this.linea(arriba, tam, lh), size: tam, font: f, color: NEGRO });
  }
}

type Zona = { x: number; arriba: number; ancho: number; alto: number };

function dibujarFoto(d: Dibujante, z: Zona, foto: PDFImage | undefined, tamano: TamanoHoja) {
  const { p } = d;
  const y = d.y(z.arriba + z.alto);
  if (!foto) {
    p.drawRectangle({ x: z.x, y, width: z.ancho, height: z.alto, color: NEUTRO, borderColor: BORDE, borderWidth: 0.75 });
    const msg = "Fotografía no disponible";
    const tam = tamano === "carta" ? 14 : 9;
    p.drawText(d.limpiar(msg, d.f.m), { x: z.x + (z.ancho - d.ancho(msg, d.f.m, tam)) / 2, y: y + z.alto / 2, size: tam, font: d.f.m, color: GRIS_TEXTO });
    return;
  }
  p.drawRectangle({ x: z.x, y, width: z.ancho, height: z.alto, color: RELLENO_FOTO === "neutro" ? NEUTRO : BLANCO });
  p.pushOperators(pushGraphicsState(), rectangle(z.x, y, z.ancho, z.alto), clip(), endPath());
  if (RELLENO_FOTO === "atenuado") {
    const c = fotoVisible({ ancho: z.ancho, alto: z.alto }, foto.width / foto.height, "cubrir");
    const w = Math.max(z.ancho, z.alto * (foto.width / foto.height));
    const h = w / (foto.width / foto.height);
    void c;
    p.drawImage(foto, { x: z.x + (z.ancho - w) / 2, y: y + (z.alto - h) / 2, width: w, height: h, opacity: OPACIDAD_RELLENO });
  }
  const v = fotoVisible({ ancho: z.ancho, alto: z.alto }, foto.width / foto.height, "contenido");
  p.drawImage(foto, { x: z.x + (z.ancho - v.ancho) / 2, y: y + (z.alto - v.alto) / 2, width: v.ancho, height: v.alto });
  p.pushOperators(popGraphicsState());
  p.drawRectangle({ x: z.x, y, width: z.ancho, height: z.alto, borderColor: BORDE, borderWidth: 0.75 });
}

/** Dibuja el QR en vectores (corridas de módulos oscuros). `x`/`arriba` son la esquina del SÍMBOLO (sin zona de silencio). */
function dibujarQr(d: Dibujante, qr: MatrizQr, x: number, arriba: number, simbolo: number) {
  const m = simbolo / qr.modulos;
  qr.filas.forEach((fila, j) => {
    let i = 0;
    while (i < fila.length) {
      if (!fila[i]) {
        i++;
        continue;
      }
      let k = i;
      while (k < fila.length && fila[k]) k++;
      d.p.drawRectangle({ x: x + i * m, y: d.y(arriba + (j + 1) * m) - 0.02, width: (k - i) * m, height: m + 0.04, color: NEGRO, borderWidth: 0 });
      i = k;
    }
  });
}

const porId = (b: Bloque[], id: BloqueId) => b.find((x) => x.id === id);
const tamanoQr = (tamano: TamanoHoja, qr: MatrizQr) => {
  const simbolo = QR_SIMBOLO_CM[tamano] * PT_POR_CM;
  return { simbolo, caja: simbolo * ((qr.modulos + 2 * MODULOS_ZONA_DE_SILENCIO) / qr.modulos), silencio: (simbolo / qr.modulos) * MODULOS_ZONA_DE_SILENCIO };
};

function dibujarCabecera(d: Dibujante, x: number, arriba: number, ancho: number, alto: number, tamano: TamanoHoja, logo?: PDFImage) {
  const T = TIPOGRAFIA[tamano];
  const hLogo = tamano === "carta" ? 20 : 13;
  if (logo) d.p.drawImage(logo, { x, y: d.y(arriba + (alto + hLogo) / 2), width: hLogo * LOGO_PROPORCION, height: hLogo });
  else d.texto("RUPE", x, arriba, d.f.x, hLogo * 0.8, alto);
  d.etiqueta("Ficha de búsqueda", x + ancho, arriba, T.etiqueta.tam, alto, d.f.b);
}

// ------------------------------------------------------------------------------------------------------------------------------------- Carta
function componerCarta(d: Dibujante, e: EntradaPdf, foto: PDFImage | undefined, logo: PDFImage | undefined) {
  const t: TamanoHoja = "carta";
  const T = TIPOGRAFIA[t];
  const g = geometriaDeHoja(t);
  const bloques = contenidoDeFicha(e.ficha, e.fechaLarga, e.dominio, t);
  const x0 = MARGEN_PT;
  const ancho = g.util.ancho;
  const colQr = C.columnaQr;
  const anchoIzq = ancho - colQr - 12;
  const fn = { normal: d.f.m, negrita: d.f.b };
  const fx = { normal: d.f.x, negrita: d.f.x };
  const tq = tamanoQr(t, e.qr);

  // 1) Alto real de la banda inferior (columna izquierda y derecha): la fotografía recibe el resto.
  const medidas = (id: BloqueId, tam: number, inter: number, ancho_: number, segs: (b: Bloque) => Segmento[], f = fn, mayus = false) => {
    const b = porId(bloques, id);
    if (!b) return { b: undefined, lineas: 0 };
    const medir = (s: string, n: boolean) => (n ? f.negrita : f.normal).widthOfTextAtSize(s, tam);
    const lineas = ajustarSegmentos(segs(b).map((s) => ({ ...s, t: d.limpiar(mayus ? s.t.toUpperCase() : s.t, s.negrita ? f.negrita : f.normal) })), b.maxLineas, ancho_, medir).length;
    return { b, lineas };
  };
  const texto = (b: Bloque): Segmento[] => (b.rotulo ? [{ t: b.rotulo, negrita: true }, { t: b.texto }] : [{ t: b.texto }]);
  const nombre = medidas("nombre", T.nombre.tam, T.nombre.interlinea, anchoIzq, (b) => [{ t: b.texto, negrita: true }], fn, true);
  const datos = medidas("datos", T.datos.tam, T.datos.interlinea, anchoIzq, texto);
  const carac = medidas("caracteristicas", T.caracteristicas.tam, T.caracteristicas.interlinea, anchoIzq, texto);
  const lugarAncho = anchoIzq - 2 * 8;
  const fecha = medidas("fecha", T.fechaLugar.tam, T.fechaLugar.interlinea, lugarAncho, texto);
  const lugar = medidas("lugar", T.fechaLugar.tam, T.fechaLugar.interlinea, lugarAncho, texto);
  const indic = medidas("indicacion", T.indicacion.tam, T.indicacion.interlinea, colQr, (b) => [{ t: b.texto, negrita: true }], { normal: d.f.b, negrita: d.f.b });
  const lhNombre = T.nombre.tam * T.nombre.interlinea;
  const lhDatos = T.datos.tam * T.datos.interlinea;
  const lhFecha = T.fechaLugar.tam * T.fechaLugar.interlinea;
  const cajaFechaAlto = (fecha.lineas + lugar.lineas) * lhFecha + 2 * 3 + 2;
  const izq = nombre.lineas * lhNombre + datos.lineas * lhDatos + carac.lineas * T.caracteristicas.tam * T.caracteristicas.interlinea + 4 + cajaFechaAlto;
  const lhFolio = T.folio.tam * T.folio.interlinea;
  const der = indic.lineas * T.indicacion.tam * T.indicacion.interlinea + 4 + tq.caja + 4 + lhFolio;
  const banda = Math.min(Math.max(izq, der), C.bandaMaxima);

  // 2) Encabezado, título y zona de la fotografía.
  let arriba = MARGEN_PT;
  dibujarCabecera(d, x0, arriba, ancho, C.encabezado, t, logo);
  arriba += C.encabezado + C.separacion;
  const titulo = porId(bloques, "titulo")!;
  d.bloque([{ t: titulo.texto }], x0, arriba, ancho, 1, T.titulo.tam, T.titulo.interlinea, fx, { mayusculas: true });
  arriba += C.titulo + C.separacion;
  const alto = g.util.alto - C.encabezado - C.titulo - 4 * C.separacion - banda - C.pie;
  dibujarFoto(d, { x: x0, arriba, ancho, alto }, foto, t);
  arriba += alto + C.separacion;

  // 3) Banda inferior: texto a la izquierda; indicación, QR y folio a la derecha.
  let ya = arriba;
  const seg = (b: Bloque | undefined) => (b ? texto(b) : []);
  ya += d.bloque([{ t: porId(bloques, "nombre")!.texto, negrita: true }], x0, ya, anchoIzq, nombre.b!.maxLineas, T.nombre.tam, T.nombre.interlinea, fn, { mayusculas: true });
  ya += d.bloque(seg(datos.b), x0, ya, anchoIzq, datos.b!.maxLineas, T.datos.tam, T.datos.interlinea, fn);
  if (carac.b) ya += d.bloque(seg(carac.b), x0, ya, anchoIzq, carac.b.maxLineas, T.caracteristicas.tam, T.caracteristicas.interlinea, fn);
  ya += 4;
  d.rectRedondeado(x0, ya, anchoIzq, cajaFechaAlto, 8, 1);
  let yc = ya + 3 + 1;
  yc += d.bloque(seg(fecha.b), x0 + 8, yc, lugarAncho, 1, T.fechaLugar.tam, T.fechaLugar.interlinea, fn);
  d.bloque(seg(lugar.b), x0 + 8, yc, lugarAncho, lugar.b!.maxLineas, T.fechaLugar.tam, T.fechaLugar.interlinea, fn);
  const xd = x0 + ancho - colQr;
  let yd = arriba;
  yd += d.bloque([{ t: porId(bloques, "indicacion")!.texto, negrita: true }], xd, yd, colQr, 3, T.indicacion.tam, T.indicacion.interlinea, { normal: d.f.b, negrita: d.f.b }, { centrado: true });
  yd += 4;
  dibujarQr(d, e.qr, xd + (colQr - tq.simbolo) / 2, yd + tq.silencio, tq.simbolo);
  yd += tq.caja + 4;
  // Folio: 17 pt, y si no cupiera en la columna se reduce (siempre visible y legible, HU 020 regla 3).
  const folio = porId(bloques, "folio")!.texto;
  let tamFolio = T.folio.tam;
  while (d.ancho(folio, d.f.x, tamFolio) > colQr && tamFolio > 10) tamFolio -= 0.5;
  d.texto(folio, xd + (colQr - d.ancho(folio, d.f.x, tamFolio)) / 2, yd, d.f.x, tamFolio, lhFolio);
  // Pie.
  const pie = porId(bloques, "pie")!;
  d.bloque([{ t: pie.texto }], x0, arriba + banda + C.separacion, ancho, pie.maxLineas, T.pie.tam, T.pie.interlinea, { normal: d.f.r, negrita: d.f.r });
}

// ------------------------------------------------------------------------------------------------------------------------------- Media carta
function componerMediaCarta(d: Dibujante, e: EntradaPdf, foto: PDFImage | undefined, logo: PDFImage | undefined) {
  const t: TamanoHoja = "media-carta";
  const T = TIPOGRAFIA[t];
  const g = geometriaDeHoja(t);
  const bloques = contenidoDeFicha(e.ficha, e.fechaLarga, e.dominio, t);
  const x0 = MARGEN_PT;
  const fn = { normal: d.f.m, negrita: d.f.b };
  const fx = { normal: d.f.x, negrita: d.f.x };
  const separacion = 13.5;
  const xc = x0 + g.foto.ancho + separacion;
  const ancho = g.util.ancho - g.foto.ancho - separacion;
  const tq = tamanoQr(t, e.qr);
  dibujarFoto(d, { x: x0, arriba: MARGEN_PT, ancho: g.foto.ancho, alto: g.util.alto }, foto, t);
  const texto = (b: Bloque): Segmento[] => (b.rotulo ? [{ t: b.rotulo, negrita: true }, { t: b.texto }] : [{ t: b.texto }]);
  const b = (id: BloqueId) => porId(bloques, id)!;
  let arriba = MARGEN_PT;
  dibujarCabecera(d, xc, arriba, ancho, 13, t, logo);
  arriba += 13 + 3;
  arriba += d.bloque([{ t: b("titulo").texto }], xc, arriba, ancho, b("titulo").maxLineas, T.titulo.tam, T.titulo.interlinea, fx, { mayusculas: true }) + 3;
  arriba += d.bloque([{ t: b("nombre").texto, negrita: true }], xc, arriba, ancho, 1, T.nombre.tam, T.nombre.interlinea, fn, { mayusculas: true });
  arriba += d.bloque(texto(b("datos")), xc, arriba, ancho, b("datos").maxLineas, T.datos.tam, T.datos.interlinea, fn);
  const carac = bloques.find((x) => x.id === "caracteristicas");
  if (carac) arriba += d.bloque(texto(carac), xc, arriba, ancho, carac.maxLineas, T.caracteristicas.tam, T.caracteristicas.interlinea, fn);
  arriba += 3;
  // Caja de fecha y lugar.
  const anchoCaja = ancho - 2 * 5;
  const medir = (s: string, n: boolean) => (n ? fn.negrita : fn.normal).widthOfTextAtSize(s, T.fechaLugar.tam);
  const nLugar = ajustarSegmentos(texto(b("lugar")).map((s) => ({ ...s, t: d.limpiar(s.t, s.negrita ? fn.negrita : fn.normal) })), b("lugar").maxLineas, anchoCaja, medir).length;
  const lh = T.fechaLugar.tam * T.fechaLugar.interlinea;
  const altoCaja = (1 + nLugar) * lh + 2 * 2 + 1.8;
  d.rectRedondeado(xc, arriba, ancho, altoCaja, 4, 0.9);
  let yc = arriba + 2 + 0.9;
  yc += d.bloque(texto(b("fecha")), xc + 5, yc, anchoCaja, 1, T.fechaLugar.tam, T.fechaLugar.interlinea, fn);
  d.bloque(texto(b("lugar")), xc + 5, yc, anchoCaja, b("lugar").maxLineas, T.fechaLugar.tam, T.fechaLugar.interlinea, fn);
  // Bloque inferior anclado al fondo: línea, folio, indicación + QR y pie. Se calculan las posiciones primero y se dibuja en el orden del contenido (folio, indicación, pie).
  const fondo = MARGEN_PT + g.util.alto;
  const pie = b("pie");
  const lhPie = T.pie.tam * T.pie.interlinea;
  const nPie = ajustarSegmentos([{ t: d.limpiar(pie.texto, d.f.r) }], pie.maxLineas, ancho, (s) => d.f.r.widthOfTextAtSize(s, T.pie.tam)).length;
  const yPie = fondo - nPie * lhPie;
  const yQr = yPie - 3 - tq.caja;
  const lhFolio = T.folio.tam * T.folio.interlinea;
  const yFolio = yQr - 2 - lhFolio;
  const yLinea = yFolio - 3;
  d.p.drawLine({ start: { x: xc, y: d.y(yLinea) }, end: { x: xc + ancho, y: d.y(yLinea) }, thickness: 0.9, color: NEGRO });
  const folio = b("folio").texto;
  let tamFolio = T.folio.tam;
  while (d.ancho(folio, d.f.x, tamFolio) > ancho && tamFolio > 8) tamFolio -= 0.5;
  d.texto(folio, xc, yFolio, d.f.x, tamFolio, lhFolio);
  d.bloque([{ t: b("indicacion").texto, negrita: true }], xc, yQr + (tq.caja - 3 * T.indicacion.tam * T.indicacion.interlinea) / 2, ancho - tq.caja - 6, 3, T.indicacion.tam, T.indicacion.interlinea, { normal: d.f.b, negrita: d.f.b });
  dibujarQr(d, e.qr, xc + ancho - tq.caja + tq.silencio, yQr + tq.silencio, tq.simbolo);
  d.bloque([{ t: pie.texto }], xc, yPie, ancho, pie.maxLineas, T.pie.tam, T.pie.interlinea, { normal: d.f.r, negrita: d.f.r });
}
