import assert from "node:assert/strict";
import { test } from "node:test";
import { altDeFoto } from "./altDeFoto";

test("altDeFoto · conserva el prefijo «Fotografía de {nombre}» y suma sexo, raza, tamaño y color", () => {
  assert.equal(altDeFoto({ nombre: "Max", sexo: "Macho", raza: "Mestizo/No identificada", tamano: "mediano", color: "Café con blanco" }), "Fotografía de Max, perro macho, Mestizo/No identificada, tamaño mediano, color café con blanco");
  assert.equal(altDeFoto({ nombre: "Luna", sexo: "Hembra" }), "Fotografía de Luna, perro hembra");
});

test("altDeFoto · sin datos extra queda «Fotografía de {nombre}, perro»", () => {
  assert.equal(altDeFoto({ nombre: "Toby" }), "Fotografía de Toby, perro");
});
