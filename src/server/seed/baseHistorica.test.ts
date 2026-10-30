import assert from "node:assert/strict";
import { test } from "node:test";
import { AVISTAMIENTOS_TABLERO, CASOS_TABLERO } from "../../mocks/tablero";
import { almacenVacio } from "../memoria/almacen";
import { sembrar } from "./seed";

const a = sembrar(almacenVacio(), {});

test("base histórica · 1204 casos y 1714 avistamientos con identificadores del catálogo; la suma por id es la de los mocks por nombre", () => {
  const { casos, avistamientos } = a.baseHistorica;
  assert.deepEqual([casos.length, avistamientos.length], [CASOS_TABLERO.length, AVISTAMIENTOS_TABLERO.length]);
  const idAlcaldia = new Map(a.alcaldias.map((x) => [x.nombre, x.idAlcaldia]));
  const idEstado = new Map(a.estadosAnimal.map((x) => [x.nombre, x.idEstadoAnimal]));
  const cuenta = (xs: readonly (number | string)[]) => xs.reduce<Record<string, number>>((r, x) => ((r[x] = (r[x] ?? 0) + 1), r), {});
  assert.deepEqual(cuenta(casos.map((c) => c.idAlcaldia)), cuenta(CASOS_TABLERO.map((c) => idAlcaldia.get(c.alcaldia)!)));
  assert.deepEqual(cuenta(avistamientos.map((v) => v.idAlcaldia)), cuenta(AVISTAMIENTOS_TABLERO.map((v) => idAlcaldia.get(v.alcaldia)!)));
  assert.deepEqual(cuenta(avistamientos.flatMap((v) => v.idsEstadoAnimal)), cuenta(AVISTAMIENTOS_TABLERO.flatMap((v) => v.estados.map((n) => idEstado.get(n)!))));
  assert.ok(avistamientos.some((v) => v.idAlcaldia === 17), "hay avistamientos «Fuera de la Ciudad de México» (id 17)");
  assert.equal(casos.filter((c) => c.cierre).length, 357);
});

test("base histórica · cada avistamiento apunta a un caso de la base y todo está congelado (inmutable)", () => {
  const claves = new Set(a.baseHistorica.casos.map((c) => c.clave));
  assert.ok(a.baseHistorica.avistamientos.every((v) => claves.has(v.claveCaso)));
  assert.ok(Object.isFrozen(a.baseHistorica) && Object.isFrozen(a.baseHistorica.casos) && Object.isFrozen(a.baseHistorica.casos[0]) && Object.isFrozen(a.baseHistorica.avistamientos[0]));
  assert.throws(() => { (a.baseHistorica.casos as unknown as unknown[]).push(1); }, TypeError);
});

test("base histórica · dos siembras dan la misma base (se arma siempre desde los mocks, por nombre, nunca desde un almacén editado)", () => {
  const b = sembrar(almacenVacio(), {});
  assert.deepEqual(b.baseHistorica.casos.map((c) => c.idAlcaldia), a.baseHistorica.casos.map((c) => c.idAlcaldia));
});
