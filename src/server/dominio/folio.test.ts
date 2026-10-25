import assert from "node:assert/strict";
import { test } from "node:test";
import { PATRON_FOLIO } from "../../mocks/tipos";
import { ErrorApp } from "../errores";
import { ALFABETO_FOLIO, generarFolio, generarFolioUnico, normalizarFolio } from "./folio";

test("R26 · el folio generado cumple el patrón RUPE-[A-HJ-NP-Z2-9]{8} (1000 folios)", () => {
  assert.equal(ALFABETO_FOLIO.length, 32);
  for (let i = 0; i < 1000; i++) assert.match(generarFolio(), PATRON_FOLIO);
});

test("R26 · reintenta ante coincidencia y entrega el primer folio libre", async () => {
  let n = 0;
  const secuencia = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2];
  const folio = await generarFolioUnico((f) => f === "RUPE-AAAAAAAA" || f === "RUPE-BBBBBBBB", { aleatorio: () => secuencia[n++] });
  assert.equal(folio, "RUPE-CCCCCCCC");
});

test("R26 · rechazo: si todos los intentos coinciden, no se entrega folio (422)", async () => {
  await assert.rejects(generarFolioUnico(() => true, { intentos: 3 }), (e) => e instanceof ErrorApp && e.estado === 422 && e.regla === "R26");
});

test("R26 · la consulta no distingue mayúsculas ni espacios en los extremos", () => {
  assert.equal(normalizarFolio("  rupe-k7m4xq9t "), "RUPE-K7M4XQ9T");
});
