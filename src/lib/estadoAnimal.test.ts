import assert from "node:assert/strict";
import { test } from "node:test";
import { ESTADOS_ANIMAL } from "../mocks/catalogos";
import { alternarIntegridad, bajoResguardo, categoriaDeshabilitada, elegirUnica, IDS_BAJO_RESGUARDO, nombresElegidos, opcionDeshabilitada, SELECCION_VACIA, type OpcionDeEstado } from "./estadoAnimal";

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

// ---- P6b (D5): el Administrador puede AGREGAR estados al catálogo; las reglas trabajan sobre las opciones que entrega el servidor, no sobre la lista del maquetado ----
const CON_NUEVOS: (OpcionDeEstado & { nombre: string })[] = [
  ...ESTADOS_ANIMAL.map((e) => ({ id: e.id, idCategoria: e.idCategoria, excluyente: e.excluyente, nombre: e.nombre })),
  { id: 18, idCategoria: 1, excluyente: false, nombre: "Cojea levemente" }, // ids que NO existen en el maquetado
  { id: 19, idCategoria: 3, excluyente: false, nombre: "Juguetón" },
  { id: 20, idCategoria: 4, excluyente: false, nombre: "Con microchip visible" },
];

test("D5 · un estado nuevo de «Integridad» es combinable: no truena, se combina con los combinables y respeta a los excluyentes 1, 5 y 6", () => {
  assert.equal(opcionDeshabilitada(18, SELECCION_VACIA, CON_NUEVOS), false);
  assert.equal(opcionDeshabilitada(18, { ...SELECCION_VACIA, 1: [2] }, CON_NUEVOS), false, "con «Herido» se combina");
  for (const excluyente of [1, 5, 6]) {
    assert.equal(opcionDeshabilitada(18, { ...SELECCION_VACIA, 1: [excluyente] }, CON_NUEVOS), true, `con el excluyente ${excluyente} no se combina`);
    assert.equal(opcionDeshabilitada(excluyente, { ...SELECCION_VACIA, 1: [18] }, CON_NUEVOS), true, `el excluyente ${excluyente} no se elige con el nuevo`);
  }
  assert.deepEqual(alternarIntegridad({ ...SELECCION_VACIA, 1: [2] }, 18, CON_NUEVOS)[1], [2, 18]);
  assert.deepEqual(alternarIntegridad({ ...SELECCION_VACIA, 1: [1] }, 18, CON_NUEVOS)[1], [1], "no se agrega junto a un excluyente");
});

test("D5 · «Fallecido» (5) vacía y deshabilita Conducta también para un estado nuevo de Conducta; Identificación sigue disponible; los nombres incluyen al nuevo", () => {
  const f = alternarIntegridad({ ...SELECCION_VACIA, 3: [19] }, 5, CON_NUEVOS);
  assert.deepEqual([f[1], f[3]], [[5], []]);
  assert.equal(categoriaDeshabilitada(3, f), true);
  assert.deepEqual(elegirUnica(f, 3, 19), f, "no se puede elegir en una categoría deshabilitada");
  assert.deepEqual(elegirUnica(f, 4, 20)[4], [20]);
  assert.deepEqual(nombresElegidos({ ...SELECCION_VACIA, 1: [18, 2], 3: [19], 2: [7], 4: [20] }, CON_NUEVOS), ["Herido / lesionado", "Libre en vía pública (suelto o en movimiento)", "Cojea levemente", "Juguetón", "Con microchip visible"]);
});
