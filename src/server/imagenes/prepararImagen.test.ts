import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { LADO_MAXIMO_CASO, prepararImagen, verificarResultado } from "./prepararImagen";

const lienzo = (ancho: number, alto: number, fondo = { r: 200, g: 120, b: 40, alpha: 1 }) => sharp({ create: { width: ancho, height: alto, channels: 4, background: fondo } });

test("prepararFoto · reduce a 1600 px de lado mayor, JPEG y sin ampliar", async () => {
  const grande = await lienzo(3200, 2000).png().toBuffer();
  const r = await prepararImagen(grande, { tipo: "lado", maximo: LADO_MAXIMO_CASO });
  const v = await verificarResultado(r.bytes);
  assert.deepEqual([v.esJpeg, v.ancho, v.alto], [true, 1600, 1000]);
  const chica = await lienzo(600, 700).webp().toBuffer();
  const c = await verificarResultado((await prepararImagen(chica, { tipo: "lado", maximo: LADO_MAXIMO_CASO })).bytes);
  assert.deepEqual([c.ancho, c.alto], [600, 700]); // no amplía
});

test("prepararFoto · la salida no conserva EXIF ni ubicación y aplica la orientación", async () => {
  // JPEG de 400×200 con orientación EXIF 6 (girar 90°) y metadatos de ubicación: debe salir de 200×400 y sin EXIF.
  const conExif = await lienzo(400, 200).jpeg().withExif({ IFD0: { Copyright: "prueba", Make: "camara-ficticia" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "19/1 25/1 0/1" } }).withMetadata({ orientation: 6 }).toBuffer();
  assert.ok((await sharp(conExif).metadata()).exif, "el origen de la prueba debe traer EXIF");
  const r = await prepararImagen(conExif, { tipo: "lado", maximo: LADO_MAXIMO_CASO });
  const v = await verificarResultado(r.bytes);
  assert.equal(v.sinExif, true);
  assert.deepEqual([r.ancho, r.alto], [200, 400]);
  assert.equal(Buffer.from(r.bytes).includes(Buffer.from("camara-ficticia")), false);
});

test("prepararFoto · la transparencia queda sobre fondo blanco", async () => {
  const transparente = await lienzo(100, 100, { r: 0, g: 0, b: 0, alpha: 0 }).png().toBuffer();
  const r = await prepararImagen(transparente, { tipo: "lado", maximo: LADO_MAXIMO_CASO });
  const { data } = await sharp(r.bytes).raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] >= 250 && data[1] >= 250 && data[2] >= 250);
});

test("prepararFoto · portada: ancho máximo y peso máximo bajando la calidad", async () => {
  const ruido = Buffer.alloc(1600 * 900 * 3);
  for (let i = 0; i < ruido.length; i++) ruido[i] = (i * 7919) % 256;
  const origen = await sharp(ruido, { raw: { width: 1600, height: 900, channels: 3 } }).png().toBuffer();
  const sinTope = await prepararImagen(origen, { tipo: "ancho", maximo: 1200 });
  const conTope = await prepararImagen(origen, { tipo: "ancho", maximo: 1200 }, { pesoMaximo: Math.floor(sinTope.bytes.length / 2) });
  assert.equal(sinTope.ancho, 1200);
  assert.ok(conTope.bytes.length < sinTope.bytes.length);
});
