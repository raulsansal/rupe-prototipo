import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { SELECCION_VACIA } from "@/lib/estadoAnimal";
import { ESTADOS_ANIMAL } from "@/mocks/catalogos";
import { DATOS_VACIOS, type Errores, type OpcionEstadoAnimal } from "./datos";
import { PasoEstadoAnimal } from "./PasoEstadoAnimal";

const opcion = (e: (typeof ESTADOS_ANIMAL)[number]): OpcionEstadoAnimal => ({ id: e.id, idCategoria: e.idCategoria, nombre: e.nombre, descripcion: e.descripcion, excluyente: e.excluyente });
const html = (estadosAnimal: OpcionEstadoAnimal[], errores: Errores = {}, estados = SELECCION_VACIA) =>
  renderToStaticMarkup(createElement(PasoEstadoAnimal, { datos: { ...DATOS_VACIOS, estados }, errores, actualizar: () => {}, estadosAnimal, abrirTodas: true }));

test("Paso 4 · solo se dibujan las opciones que el servidor entrega como activas: con 16 y 17 desactivados (almacén de prueba) no se renderizan", () => {
  const activas = ESTADOS_ANIMAL.filter((e) => e.id !== 16 && e.id !== 17).map(opcion);
  const salida = html(activas);
  for (const e of activas) assert.ok(salida.includes(e.nombre.replace(/&/g, "&amp;")), `falta «${e.nombre}»`);
  assert.ok(!salida.includes("Con collar sin datos") && !salida.includes("Sin accesorios"));
  assert.equal((salida.match(/type="radio"/g) ?? []).length, 9, "radios: 4 + 4 + 1 (la categoría 4 queda con una sola)");
});

test("Paso 4 · con todo el catálogo activo se dibujan las 17 opciones (6 casillas y 11 radios)", () => {
  const salida = html(ESTADOS_ANIMAL.map(opcion));
  assert.equal((salida.match(/type="checkbox"/g) ?? []).length, 6);
  assert.equal((salida.match(/type="radio"/g) ?? []).length, 11);
});

test("Paso 4 · el rechazo de una opción no disponible se muestra en su categoría o, si no se sabe cuál, al inicio del paso", () => {
  const AMABLE = "Una de las opciones elegidas ya no está disponible. Revisa tus selecciones.";
  const todas = ESTADOS_ANIMAL.map(opcion);
  const enCategoria = html(todas, { cat4: AMABLE });
  const dentro = enCategoria.slice(enCategoria.indexOf('data-categoria="4"'));
  assert.ok(dentro.includes(AMABLE) && enCategoria.split(AMABLE).length === 2, "el mensaje aparece una sola vez, dentro de la categoría 4");
  const alInicio = html(todas, { estados: AMABLE });
  assert.ok(alInicio.indexOf(AMABLE) < alInicio.indexOf('data-categoria="1"') && alInicio.includes('id="error-estados"') && alInicio.includes('tabindex="-1"'));
});
