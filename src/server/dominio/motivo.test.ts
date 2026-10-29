import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp } from "../errores";
import { sanearMotivo } from "./motivo";

test("R34 · el motivo se sanea: sin etiquetas ni caracteres de control, recortado; vacío o solo etiquetas = undefined", () => {
  assert.equal(sanearMotivo("  Lo encontré en casa  "), "Lo encontré en casa");
  assert.equal(sanearMotivo("<script>alert(1)</script>Lo vi"), "alert(1)Lo vi");
  assert.equal(sanearMotivo("a\u0000b\u0007c\u001fd\u007f"), "abcd");
  assert.equal(sanearMotivo("línea 1\nlínea 2\tcon tab"), "línea 1\nlínea 2\tcon tab", "el salto de línea y el tabulador se conservan");
  for (const vacio of ["", "   ", "<b></b>", "<img src=x onerror=alert(1)>", undefined, null]) assert.equal(sanearMotivo(vacio), undefined);
});

test("R34 · un motivo que no es texto se rechaza con 422 MOTIVO_INVALIDO", () => {
  for (const malo of [1, true, {}, [], ["a"]]) assert.throws(() => sanearMotivo(malo), (e) => e instanceof ErrorApp && e.estado === 422 && e.codigo === "MOTIVO_INVALIDO");
});
