import assert from "node:assert/strict";
import { test } from "node:test";
import { PORTADA_ALT, PORTADA_ALT_ES_PROVISIONAL, PORTADA_ALTO, PORTADA_ANCHO, PORTADA_ARCHIVOS, PORTADA_OBJECT_POSITION, PORTADA_SIZES } from "./portada";

test("config de la portada · valores válidos: dos archivos por tema, object-position en porcentajes y dimensiones positivas", () => {
  assert.deepEqual(Object.keys(PORTADA_ARCHIVOS).sort(), ["claro", "oscuro"]);
  assert.ok(Object.values(PORTADA_ARCHIVOS).every((r) => /^\/portada\/portada-(claro|oscuro)\.jpg$/.test(r)));
  assert.match(PORTADA_OBJECT_POSITION, /^\d{1,3}% \d{1,3}%$/);
  assert.ok(PORTADA_ANCHO > 0 && PORTADA_ALTO > 0 && PORTADA_SIZES.length > 0);
  assert.ok(PORTADA_ALT.length > 20 && typeof PORTADA_ALT_ES_PROVISIONAL === "boolean");
});

test("config de la portada · el recorte privilegia el suelo (object-position vertical al centro)", () => {
  assert.equal(PORTADA_OBJECT_POSITION, "50% 50%");
});
