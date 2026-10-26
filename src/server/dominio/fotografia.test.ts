import assert from "node:assert/strict";
import { test } from "node:test";
import { GIF, HTML, jpeg, PNG_1X1, SVG } from "../pruebas/imagenes";
import { detectarFormato, limiteDeBytes, validarFotografiaRecibida } from "./fotografia";

const ok = (bytes: Uint8Array, tipo: string, mb = 4) => validarFotografiaRecibida({ bytes, tipoDeclarado: tipo }, mb);
const error = (r: ReturnType<typeof ok>) => ("error" in r ? r.error : undefined);

test("HU 011 · el tipo REAL sale de los bytes de cabecera: JPEG y PNG válidos", () => {
  assert.equal(detectarFormato(jpeg()), "JPG");
  assert.equal(detectarFormato(PNG_1X1), "PNG");
  assert.deepEqual(ok(jpeg(), "image/jpeg"), { formato: "JPG", tipoMime: "image/jpeg" });
  assert.deepEqual(ok(PNG_1X1, "image/png"), { formato: "PNG", tipoMime: "image/png" });
  assert.deepEqual(ok(PNG_1X1, "IMAGE/PNG"), { formato: "PNG", tipoMime: "image/png" });
});

test("HU 011 · rechazo: GIF, SVG, HTML, texto, vacío y truncado no son JPG ni PNG aunque se declaren como imagen", () => {
  for (const bytes of [GIF, SVG, HTML, Uint8Array.from(Buffer.from("texto cualquiera")), new Uint8Array(0), Uint8Array.from([0xff, 0xd8]), Uint8Array.from([0x89, 0x50, 0x4e, 0x47])]) {
    for (const tipo of ["image/jpeg", "image/png", "application/octet-stream"]) assert.ok(error(ok(bytes, tipo)), `${bytes.length} bytes como ${tipo}`);
  }
  assert.equal(error(ok(GIF, "image/png")), "La fotografía debe ser JPG o PNG.");
  assert.match(error(ok(new Uint8Array(0), "image/png"))!, /obligatoria/);
  assert.match(error(validarFotografiaRecibida(undefined, 4))!, /obligatoria/);
});

test("HU 011 · rechazo: el tipo declarado no coincide con el real (un PNG que se anuncia como JPEG y al revés)", () => {
  assert.equal(error(ok(PNG_1X1, "image/jpeg")), "La fotografía debe ser JPG o PNG.");
  assert.equal(error(ok(jpeg(), "image/png")), "La fotografía debe ser JPG o PNG.");
  assert.equal(error(ok(jpeg(), "")), "La fotografía debe ser JPG o PNG.");
});

test("R11 · el tamaño máximo sale del parámetro (4 MB) y nunca pasa del tope técnico de 4.5 MB", () => {
  assert.equal(limiteDeBytes(4), 4 * 1024 * 1024);
  assert.equal(limiteDeBytes(10), Math.floor(4.5 * 1024 * 1024));
  assert.deepEqual(ok(jpeg(4 * 1024 * 1024), "image/jpeg"), { formato: "JPG", tipoMime: "image/jpeg" }); // justo en el límite
  assert.match(error(ok(jpeg(4 * 1024 * 1024 + 1), "image/jpeg"))!, /no puede pesar más de 4 MB/);
  assert.match(error(ok(jpeg(Math.floor(4.5 * 1024 * 1024) + 1), "image/jpeg", 10))!, /no puede pesar más de 4.5 MB/); // el parámetro no sube el tope
});
