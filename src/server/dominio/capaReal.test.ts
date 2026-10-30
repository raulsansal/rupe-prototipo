import assert from "node:assert/strict";
import { test } from "node:test";
import type { EstadoCaso, TipoMovimiento } from "../../mocks/tipos";
import { diasEntre, hechoDeCaso, type CasoParaEstadisticas } from "./capaReal";

const ESTADOS: Record<number, EstadoCaso> = { 1: "Extraviado", 2: "En búsqueda", 3: "Avistamiento reportado", 4: "En seguimiento", 5: "Localizado", 6: "Cerrado" };
const nombre = (id: number) => ESTADOS[id];
const mov = (tipoMovimiento: TipoMovimiento, fechaHora: string) => ({ tipoMovimiento, fechaHora });
const caso = (idEstadoCaso: number, movimientos: CasoParaEstadisticas["movimientos"], extra: Partial<CasoParaEstadisticas> = {}): CasoParaEstadisticas => ({
  idCasoExtravio: 20, esNuevo: true, fechaRegistro: "2026-10-10T18:00:00Z", idAlcaldia: 4, idCategoriaMotivo: 1, idEstadoCaso, movimientos, ...extra,
});
const REG = [mov("registro", "2026-10-10T18:00:00Z"), mov("ficha generada", "2026-10-10T18:00:00Z")];

test("capa real · un caso en búsqueda: sin cierre ni días; su día es el de la Ciudad de México", () => {
  const h = hechoDeCaso(caso(2, REG, { fechaRegistro: "2026-10-11T03:00:00Z" }), nombre);
  assert.deepEqual(h, { clave: "r20", cuenta: true, dia: "2026-10-10", idAlcaldia: 4, idCategoriaMotivo: 1, estado: "En búsqueda" });
});

test("capa real · cierre confirmado: cierre vigente con la fecha del movimiento y días hasta la última localización", () => {
  const h = hechoDeCaso(caso(6, [...REG, mov("localización", "2026-10-13T20:00:00Z"), mov("cierre confirmado", "2026-10-15T03:30:00Z")]), nombre);
  assert.deepEqual([h.estado, h.cierre, h.diasALocalizar], ["Cerrado", { tipo: "Cierre confirmado", dia: "2026-10-14" }, 3]); // 03:30Z del 15 = 21:30 del 14 en la Ciudad de México
});

test("capa real · cancelación y deshabilitación son cierres vigentes sin días a localizar", () => {
  assert.deepEqual(hechoDeCaso(caso(6, [...REG, mov("cancelación", "2026-10-12T15:00:00Z")]), nombre).cierre, { tipo: "Cancelación", dia: "2026-10-12" });
  const d = hechoDeCaso(caso(6, [...REG, mov("deshabilitación", "2026-10-12T15:00:00Z")]), nombre);
  assert.deepEqual([d.cierre, d.diasALocalizar], [{ tipo: "Deshabilitación", dia: "2026-10-12" }, undefined]);
});

test("capa real · restaurar quita el cierre y regresa al estado previo; un caso Localizado restaurado conserva sus días", () => {
  const h = hechoDeCaso(caso(5, [...REG, mov("localización", "2026-10-12T15:00:00Z"), mov("deshabilitación", "2026-10-13T15:00:00Z"), mov("restauración", "2026-10-14T15:00:00Z")]), nombre);
  assert.deepEqual([h.estado, h.cierre, h.diasALocalizar], ["Localizado", undefined, 2]);
});

test("capa real · reactivar saca el caso de los localizados; localizarlo otra vez usa la ÚLTIMA localización", () => {
  const reactivado = hechoDeCaso(caso(4, [...REG, mov("localización", "2026-10-11T15:00:00Z"), mov("reactivación", "2026-10-12T15:00:00Z")]), nombre);
  assert.deepEqual([reactivado.estado, reactivado.diasALocalizar], ["En seguimiento", undefined]);
  const otra = hechoDeCaso(caso(5, [...REG, mov("localización", "2026-10-11T15:00:00Z"), mov("reactivación", "2026-10-12T15:00:00Z"), mov("localización", "2026-10-16T15:00:00Z")]), nombre);
  assert.equal(otra.diasALocalizar, 6);
});

test("capa real · un caso sembrado (esNuevo false) no cuenta como caso: solo sirve para atribuir avistamientos", () => {
  const h = hechoDeCaso(caso(2, REG, { esNuevo: false, idCasoExtravio: 12 }), nombre);
  assert.deepEqual([h.clave, h.cuenta], ["s12", false]);
});

test("días entre dos días calendario", () => {
  assert.deepEqual([diasEntre("2026-10-10", "2026-10-10"), diasEntre("2026-10-31", "2026-11-02"), diasEntre("2026-02-27", "2026-03-01")], [0, 2, 2]);
});
