import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { bloquesDeFicha } from "../../lib/ficha/aHoja";
import { MARGEN_PT, PAGINA_PT, type FichaParaHoja, type TamanoHoja } from "../../lib/ficha/composicion";
import { CASOS_MODERACION } from "../../mocks/moderacion";
import { generarTokenQr } from "../dominio/qr";
import { leerPdf } from "../pruebas/pdf";
import { nuevoContexto } from "../pruebas/auxiliares";
import { matrizQr, urlDelQr } from "../qr/matrizQr";
import { fichaDelTutor } from "../servicios/misRegistros";
import type { SesionActual } from "../sesion/guardas";
import { fichaParaHoja } from "../../lib/ficha/aHoja";
import { formatearFechaLarga } from "../../lib/formato";
import { generarFichaPdf } from "./generarFichaPdf";

const TAMANOS: TamanoHoja[] = ["carta", "media-carta"];
const BASE = "https://nombre-largo.vercel.app";
const AHORA = new Date("2026-10-18T12:00:00Z");
const ROSA: SesionActual = { idUsuario: 2, rol: "Tutor", nombre: "Rosa Hernández Ficticia" };
const LUIS: SesionActual = { idUsuario: 5, rol: "Tutor", nombre: "Luis Navarro Ficticio" };
const palabras = (n: number, b: string) => b.repeat(Math.ceil(n / b.length)).slice(0, n).trim();
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

const NORMAL: FichaParaHoja = { nombre: "Max", sexo: "Macho", raza: "Mestizo/No identificada", edad: "11 años", tamano: "Mediano", color: "Café con blanco", caracteristicasDistintivas: "Mancha blanca en el pecho y collar rojo", fechaExtravio: "2026-10-26", coloniaZona: "Del Valle Centro", alcaldia: "Benito Juárez", folio: "RUPE-K7M4XQ9T" };
const PEOR: FichaParaHoja = {
  nombre: palabras(50, "Wolfgang Wilhelmina Wenceslao Wellington Winston "), sexo: "Macho", raza: palabras(50, "Schnauzer Gigante Cruzado Con Pastor Belga Malinoi "), edad: "11 años", tamano: "Mediano",
  color: palabras(50, "Marrón Chocolate Oscuro Con Manchas Blancas Y Grises "), folio: "RUPE-K7M4XQ9T", fechaExtravio: "2026-10-26", alcaldia: "La Magdalena Contreras",
  caracteristicasDistintivas: palabras(300, "Mancha blanca en el pecho, oreja izquierda caída, cola corta y rizada, cicatriz pequeña en la pata trasera derecha, collar rojo con una placa metálica, muy amigable con los niños pero asustadizo. "),
  coloniaZona: palabras(100, "Unidad Habitacional Vicente Guerrero Super Manzana Cuatro Sección Norte Oriente "),
};

const generar = async (ficha: FichaParaHoja, tamano: TamanoHoja, foto?: Uint8Array, url = urlDelQr(BASE, generarTokenQr())) =>
  generarFichaPdf({ ficha, fechaLarga: formatearFechaLarga(ficha.fechaExtravio), dominio: "nombre-largo.vercel.app", tamano, qr: matrizQr(url), foto, ahora: AHORA });

async function fotoGrande(ancho = 1600, alto = 1200) {
  const ruido = Buffer.alloc(ancho * alto * 3);
  for (let i = 0; i < ruido.length; i++) ruido[i] = (i * 31 + ((i / 3) | 0) * 7) % 256;
  return Uint8Array.from(await sharp(ruido, { raw: { width: ancho, height: alto, channels: 3 } }).jpeg({ quality: 70 }).toBuffer());
}

test("PDF · tamaño de página exacto (Carta 612×792 y Media carta 612×396 pt), una página y archivo razonable", async () => {
  const foto = await fotoGrande();
  for (const t of TAMANOS) {
    const pdf = await generar(NORMAL, t, foto);
    const r = await leerPdf(pdf);
    assert.deepEqual([r.paginas, r.ancho, r.alto], [1, PAGINA_PT[t].ancho, PAGINA_PT[t].alto]);
    assert.ok(pdf.length > 5_000 && pdf.length < 600_000, `${t}: ${pdf.length} bytes`);
    assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), "%PDF-");
  }
});

test("PDF · metadatos sin datos personales: título genérico con el folio y el sistema como autor", async () => {
  const doc = await PDFDocument.load(await generar(NORMAL, "carta"), { updateMetadata: false });
  assert.equal(doc.getTitle(), "Ficha de búsqueda RUPE-K7M4XQ9T");
  assert.deepEqual([doc.getAuthor(), doc.getCreator(), doc.getProducer()], ["RUPE", "RUPE", "RUPE"]);
  assert.deepEqual(doc.getKeywords() ?? "", "");
});

test("PDF · contiene folio, nombre, sexo, fecha y lugar (alcaldía y colonia) en el MISMO orden que la hoja en pantalla, en ambos tamaños", async () => {
  for (const t of TAMANOS) {
    const texto = norm((await leerPdf(await generar(NORMAL, t))).texto);
    let desde = 0;
    for (const b of bloquesDeFicha({ ...NORMAL, tamano: "mediano", edadValor: 11, edadUnidad: "años", fotografiaUrl: "/x", estado: "En búsqueda", fechaExtravio: NORMAL.fechaExtravio } as never, "nombre-largo.vercel.app", t)) {
      const buscado = norm(`${b.texto}`);
      const i = texto.indexOf(buscado, desde);
      assert.ok(i >= desde, `${t}: falta o está fuera de orden el bloque «${b.id}» (${buscado.slice(0, 40)})`);
      desde = i + buscado.length;
    }
    for (const dato of ["rupe-k7m4xq9t", "macho", "benito juárez", "del valle centro", "26 de octubre de 2026"]) assert.ok(texto.includes(dato), `${t}: falta «${dato}»`);
  }
});

test("PDF · peores casos de texto (máximos de las validaciones, palabras sin espacios, emoji y caracteres no soportados): sin excepciones y todo el texto dentro de los márgenes", async () => {
  const sinEspacios: FichaParaHoja = { ...PEOR, nombre: "W".repeat(50), raza: "R".repeat(50), color: "C".repeat(50), coloniaZona: "Q".repeat(100), caracteristicasDistintivas: "Z".repeat(300) };
  const raros: FichaParaHoja = { ...NORMAL, nombre: "Max 🐶🔥 犬 Макс", caracteristicasDistintivas: "​‮\u0000cola\u0007 كلب 🐕‍🦺 ñandú ¿¡Ü!", coloniaZona: "Tlalpan 🏘 ⁠Centro", color: "Café ☕" };
  for (const ficha of [PEOR, sinEspacios, raros]) for (const t of TAMANOS) {
    const r = await leerPdf(await generar(ficha, t));
    assert.equal(r.paginas, 1);
    assert.ok(r.texto.includes("RUPE-K7M4XQ9T"), `${t}: el folio debe estar siempre`);
    const { ancho, alto } = PAGINA_PT[t];
    for (const e of r.elementos) {
      assert.ok(e.x >= MARGEN_PT - 1 && e.x + e.ancho <= ancho - MARGEN_PT + 1.5, `${t}: «${e.texto.slice(0, 20)}» sale de los márgenes en x (${e.x.toFixed(1)} + ${e.ancho.toFixed(1)})`);
      assert.ok(e.y >= MARGEN_PT - 3 && e.y + e.alto <= alto - MARGEN_PT + 3, `${t}: «${e.texto.slice(0, 20)}» sale de los márgenes en y (${e.y.toFixed(1)})`);
    }
  }
  const texto = (await leerPdf(await generar(raros, "carta"))).texto;
  assert.ok(texto.includes("ñandú") && texto.includes("¿¡Ü!"), "acentos, ñ, ¿ y ¡ se conservan");
  assert.ok(!/🐶|犬|Макс|كلب|​|‮/.test(texto), "lo que la fuente no dibuja se sustituye");
});

test("PDF · NUNCA datos de la persona tutora, token en texto, calle, referencias, momento, motivo ni descripción: los 12 casos sembrados y uno nuevo, en ambos tamaños", async () => {
  const { ctx, almacen } = nuevoContexto();
  const usuarios = almacen.usuarios;
  for (const c of CASOS_MODERACION) {
    const sesion = LUIS.idUsuario === almacen.perros.find((p) => p.nombre === c.nombre)!.idUsuario ? LUIS : ROSA;
    const ficha = await fichaDelTutor(sesion, c.folio, ctx);
    const caso = almacen.casos.find((x) => x.folio === c.folio)!;
    const token = almacen.qr.find((q) => q.idCasoExtravio === caso.idCasoExtravio && q.fechaInvalidacion === null)!.tokenPublico;
    const dueno = usuarios.find((u) => u.idUsuario === sesion.idUsuario)!;
    for (const t of TAMANOS) {
      const r = await leerPdf(await generar(fichaParaHoja(ficha), t, undefined, urlDelQr(BASE, token)));
      const texto = norm(r.texto);
      assert.ok(texto.includes(c.folio.toLowerCase()) && texto.includes(c.nombre.toLowerCase()) && texto.includes(c.sexo.toLowerCase()) && texto.includes(norm(c.alcaldia)), `${c.folio} ${t}: faltan datos públicos`);
      const prohibidos = [token, c.direccionAproximada, c.referenciasDelLugar, c.descripcionCircunstancias, c.motivo, c.momentoDelDia, dueno.nombreCompleto, dueno.correo, dueno.telefono, "@"].filter((v): v is string => !!v && v.length > 3);
      for (const p of prohibidos) assert.ok(!texto.includes(norm(p)), `${c.folio} ${t}: el PDF contiene un dato reservado («${p.slice(0, 18)}…»)`);
    }
  }
  assert.equal(CASOS_MODERACION.length, 12);
});
