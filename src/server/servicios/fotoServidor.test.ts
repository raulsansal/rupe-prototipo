import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { ErrorApp } from "../errores";
import { verificarResultado } from "../imagenes/prepararImagen";
import { nuevoContexto } from "../pruebas/auxiliares";
import type { SesionActual } from "../sesion/guardas";
import { registrarExtravio } from "./extravio";

// HU 011 regla 6: el SERVIDOR re-codifica toda fotografía subida (orientación aplicada, lado máximo 1600 px, JPEG, sin metadatos).
const ROSA: SesionActual = { idUsuario: 2, rol: "Tutor", nombre: "Rosa Hernández Ficticia" };
const datos = () => ({
  nombre: "Pelusa", sexo: "Hembra", idRaza: 1, edad: { valor: 3, unidad: "años" }, tamano: "pequeño", color: "Blanco", caracteristicas: "Mancha café en la oreja", fechaExtravio: "2026-10-18", momento: "tarde",
  alcaldia: "Coyoacán", colonia: "Del Carmen", calle: "Calle Reservada 99", referencias: "Referencia reservada", idMotivo: 1, descripcion: "Descripción reservada",
});
const lienzo = (ancho: number, alto: number) => sharp({ create: { width: ancho, height: alto, channels: 3, background: { r: 200, g: 120, b: 40 } } });

async function guardada(bytes: Uint8Array, tipo: string) {
  const { ctx, almacen } = nuevoContexto();
  const r = await registrarExtravio(ROSA, { datos: datos(), foto: { bytes, tipoDeclarado: tipo } }, ctx);
  const perro = almacen.perros.find((p) => p.nombre === "Pelusa" && almacen.casos.find((c) => c.idPerro === p.idPerro)?.folio === r.folio)!;
  const foto = almacen.fotografias.find((f) => f.idFotografia === perro.idFotografia)!;
  return { foto, contenido: almacen.contenidosFoto[foto.idFotografia] };
}

test("Foto subida · un JPEG con EXIF, GPS y orientación sale SIN metadatos y con la orientación aplicada", async () => {
  const origen = await lienzo(400, 200).jpeg().withExif({ IFD0: { Make: "camara-ficticia" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "19/1 25/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "99/1 8/1 0/1" } }).withMetadata({ orientation: 6 }).toBuffer();
  const antes = await sharp(origen).metadata();
  assert.ok(antes.exif && antes.orientation === 6, "el origen de la prueba trae EXIF y orientación");
  const { foto, contenido } = await guardada(Uint8Array.from(origen), "image/jpeg");
  const v = await verificarResultado(contenido.bytes);
  assert.equal(v.esJpeg, true);
  assert.equal(v.sinExif, true);
  assert.deepEqual([v.ancho, v.alto], [200, 400], "orientación 6 aplicada: 400×200 pasa a 200×400");
  assert.equal(Buffer.from(contenido.bytes).includes(Buffer.from("camara-ficticia")), false);
  assert.equal((await sharp(contenido.bytes).metadata()).orientation, undefined);
  assert.deepEqual([foto.formato, foto.tamanoBytes, contenido.tipo], ["JPG", contenido.bytes.length, "image/jpeg"]);
});

test("Foto subida · PNG y JPEG válidos se aceptan (el PNG se guarda como JPEG) y lo grande se reduce a 1600 px sin ampliar lo pequeño", async () => {
  const png = Uint8Array.from(await lienzo(300, 200).png().toBuffer());
  const a = await guardada(png, "image/png");
  assert.deepEqual([a.contenido.tipo, (await verificarResultado(a.contenido.bytes)).esJpeg], ["image/jpeg", true]);
  const grande = Uint8Array.from(await lienzo(3200, 2400).jpeg().toBuffer());
  const g = await verificarResultado((await guardada(grande, "image/jpeg")).contenido.bytes);
  assert.deepEqual([g.ancho, g.alto], [1600, 1200]);
  const chica = await verificarResultado((await guardada(Uint8Array.from(await lienzo(120, 80).jpeg().toBuffer()), "image/jpeg")).contenido.bytes);
  assert.deepEqual([chica.ancho, chica.alto], [120, 80]);
});

test("Foto subida · un archivo con cabecera válida pero corrupto o truncado se rechaza con el mismo mensaje y no guarda nada", async () => {
  const valido = await lienzo(400, 300).jpeg().toBuffer();
  const truncado = Uint8Array.from(valido.subarray(0, Math.floor(valido.length / 3)));
  const ruido = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(300).fill(7), 0xff, 0xd9]);
  for (const bytes of [truncado, ruido]) {
    const { ctx, almacen } = nuevoContexto();
    const antes = [almacen.fotografias.length, almacen.casos.length, almacen.perros.length, almacen.qr.length];
    const e = await registrarExtravio(ROSA, { datos: datos(), foto: { bytes, tipoDeclarado: "image/jpeg" } }, ctx).then(() => undefined, (x: unknown) => x);
    assert.ok(e instanceof ErrorApp && e.estado === 422);
    assert.deepEqual(e.campos, { foto: "La fotografía debe ser JPG o PNG." });
    assert.deepEqual([almacen.fotografias.length, almacen.casos.length, almacen.perros.length, almacen.qr.length], antes);
  }
});
