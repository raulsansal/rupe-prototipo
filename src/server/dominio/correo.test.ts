import assert from "node:assert/strict";
import { test } from "node:test";
import { correoDeAvistamiento } from "./correo";

const base = { nombreDeLaPersona: "Rosa Hernández Ficticia", folio: "RUPE-K7M4XQ9T", nombreDelPerro: "Max" };

test("correo de avistamiento · lleva el folio, el perro y el resumen del estado, sin contacto de quien reportó", () => {
  const c = correoDeAvistamiento({ ...base, estadosAnimal: ["Herido / lesionado", "Resguardado / En custodia temporal"], fallecido: false });
  const todo = `${c.asunto}\n${c.cuerpo.join("\n")}`;
  assert.match(c.asunto, /RUPE-K7M4XQ9T/);
  assert.match(todo, /Herido \/ lesionado, Resguardado \/ En custodia temporal/);
  assert.match(todo, /Hola, Rosa\./);
  assert.ok(!/Hernández|@|teléfono|tel\./i.test(todo), "solo el nombre de pila y nada del visitante");
});

test("correo de avistamiento · con «Fallecido» NI el asunto NI el cuerpo mencionan el estado: solo avisan del avistamiento e invitan a iniciar sesión", () => {
  const c = correoDeAvistamiento({ ...base, estadosAnimal: ["Fallecido", "Libre en vía pública (suelto o en movimiento)"], fallecido: true });
  const todo = `${c.asunto}\n${c.cuerpo.join("\n")}`;
  assert.ok(!/fallecid|libre|estado del animal|vía pública/i.test(todo), todo);
  assert.match(todo, /nuevo avistamiento/i);
  assert.match(todo, /Inicia sesión/);
  assert.match(todo, /RUPE-K7M4XQ9T/);
});
