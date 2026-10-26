import assert from "node:assert/strict";
import { test } from "node:test";
import { vistaPreviaDeCorreo } from "./correo";
import { edadValida, textoDeEdad } from "./edad";

test("edad · rangos del diccionario: meses 0–11 y años 1–50, enteros", () => {
  for (const [v, u] of [[0, "meses"], [11, "meses"], [1, "años"], [50, "años"]] as const) assert.equal(edadValida(v, u), true, `${v} ${u}`);
  for (const [v, u] of [[12, "meses"], [-1, "meses"], [0, "años"], [51, "años"], [1.5, "años"], ["3", "años"], [3, "dias"], [NaN, "meses"], [undefined, "años"]] as const) assert.equal(edadValida(v, u), false, `${v} ${u}`);
});

test("edad · 0 meses se muestra como «menos de 1 mes», nunca «0 meses»", () => {
  assert.equal(textoDeEdad(0, "meses"), "menos de 1 mes");
  assert.equal(textoDeEdad(1, "meses"), "1 mes");
  assert.equal(textoDeEdad(7, "meses"), "7 meses");
  assert.equal(textoDeEdad(1, "años"), "1 año");
  assert.equal(textoDeEdad(4, "años"), "4 años");
});

test("HU 013 · la vista previa del correo lleva el folio y la edad legible, solo el nombre de pila, y nada más", () => {
  const c = vistaPreviaDeCorreo({ nombreDeLaPersona: "Nube Prueba Ficticia", folio: "RUPE-K7M4XQ9T", nombreDelPerro: "Pelusa", edadValor: 0, edadUnidad: "meses" });
  const todo = [c.asunto, ...c.cuerpo].join("\n");
  assert.equal(c.asunto, "Tu folio de RUPE: RUPE-K7M4XQ9T");
  assert.match(todo, /Hola, Nube\./);
  assert.match(todo, /Pelusa \(menos de 1 mes\)/);
  assert.ok(!/0 meses/.test(todo));
  assert.ok(!/Prueba Ficticia|@|token|tel[eé]fono/i.test(todo));
});
