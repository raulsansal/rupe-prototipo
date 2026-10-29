import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp } from "../errores";
import { validarEstadosAnimal } from "./estadosAnimal";

const rechaza = (ids: number[]) => assert.throws(() => validarEstadosAnimal(ids), (e) => e instanceof ErrorApp && e.estado === 422 && e.regla === "R3");

test("R3 · caso feliz: combinaciones válidas", () => {
  validarEstadosAnimal([1, 7]); // Ileso + libre
  validarEstadosAnimal([2, 3, 4, 8, 11, 15]); // combinables + una por categoría
  validarEstadosAnimal([5, 9]); // Fallecido solo, sin conducta
  validarEstadosAnimal([6, 10, 17]);
});

test("R3 · rechazo: categorías 1 y 2 obligatorias", () => {
  rechaza([7]); // falta integridad
  rechaza([1]); // falta contención
  rechaza([]);
});

test("R3 · rechazo: «Ileso», «Fallecido» y «No se puede determinar» solo se eligen solos", () => {
  rechaza([1, 2, 7]);
  rechaza([5, 3, 7]);
  rechaza([6, 4, 7]);
  rechaza([1, 5, 7]);
});

test("R3 · rechazo: una sola opción en contención, conducta e identificación", () => {
  rechaza([1, 7, 8]);
  rechaza([1, 7, 11, 12]);
  rechaza([1, 7, 15, 16]);
});

test("R3 · rechazo: «Fallecido» deshabilita la categoría Conducta", () => {
  rechaza([5, 7, 11]);
});

test("R3 · rechazo: estado inexistente, repetido o desactivado", () => {
  rechaza([1, 7, 99]);
  rechaza([1, 1, 7]);
  assert.throws(() => validarEstadosAnimal([2, 7], [{ id: 2, idCategoria: 1, excluyente: false, activo: false }, { id: 7, idCategoria: 2, excluyente: false }]), (e) => e instanceof ErrorApp && e.regla === "R3");
});

test("R3 · un estado desactivado o inexistente da el mensaje amable, sin identificadores internos (ESTADO_NO_DISPONIBLE)", () => {
  const catalogo = [{ id: 1, idCategoria: 1, excluyente: true }, { id: 7, idCategoria: 2, excluyente: false }, { id: 16, idCategoria: 4, excluyente: false, activo: false }];
  for (const ids of [[1, 7, 16], [1, 7, 99]]) {
    assert.throws(
      () => validarEstadosAnimal(ids, catalogo),
      (e) => e instanceof ErrorApp && e.codigo === "ESTADO_NO_DISPONIBLE" && e.message === "Una de las opciones elegidas ya no está disponible. Revisa tus selecciones." && !/\b(16|99)\b/.test(e.message),
    );
  }
});
