import assert from "node:assert/strict";
import { test } from "node:test";
import { bajoResguardo, IDS_BAJO_RESGUARDO, SELECCION_VACIA } from "./estadoAnimal";
import { ESTADOS_ANIMAL } from "../mocks/catalogos";

test("Resguardo · los ids 8, 9 y 10 son «Resguardado», «En clínica o veterinaria» y «En albergue» de Contención y ubicación", () => {
  const nombres = IDS_BAJO_RESGUARDO.map((id) => ESTADOS_ANIMAL.find((e) => e.id === id));
  assert.deepEqual(nombres.map((e) => [e?.idCategoria, e?.nombre]), [[2, "Resguardado / En custodia temporal"], [2, "En clínica o veterinaria"], [2, "En albergue / Centro de control"]]);
});

test("Resguardo · depende SOLO de «Contención y ubicación»: con 8, 9 o 10 sí (también con «Fallecido»); con «Libre» o sin elegir, no", () => {
  for (const id of [8, 9, 10]) {
    assert.equal(bajoResguardo({ ...SELECCION_VACIA, 1: [1], 2: [id] }), true, `id ${id}`);
    assert.equal(bajoResguardo({ ...SELECCION_VACIA, 1: [5], 2: [id] }), true, `Fallecido + id ${id}`);
  }
  assert.equal(bajoResguardo({ ...SELECCION_VACIA, 1: [5], 2: [7] }), false, "Fallecido + Libre");
  assert.equal(bajoResguardo({ ...SELECCION_VACIA, 1: [1], 2: [7] }), false);
  assert.equal(bajoResguardo(SELECCION_VACIA), false);
  assert.equal(bajoResguardo({ ...SELECCION_VACIA, 1: [8], 3: [10], 4: [9] }), false, "ids de otras categorías no cuentan");
});
