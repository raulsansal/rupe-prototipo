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
  assert.ok(alInicio.indexOf(AMABLE) < alInicio.indexOf('data-categoria="1"') && alInicio.includes('id="error-estados"') && alInicio.includes('tabindex="-1"'), "el aviso va al inicio del paso, con id y foco");
});

test("Paso 4 (D5) · los estados que el Administrador agregó (ids que no existen en el maquetado) se dibujan en su categoría y no truenan; los excluyentes 1, 5 y 6 siguen marcados", () => {
  const nuevas: OpcionEstadoAnimal[] = [
    { id: 18, idCategoria: 1, nombre: "Cojea levemente", descripcion: "Camina con dificultad.", excluyente: false },
    { id: 19, idCategoria: 3, nombre: "Juguetón", descripcion: "Quiere jugar.", excluyente: false },
    { id: 20, idCategoria: 4, nombre: "Con microchip visible", descripcion: "Se ve el chip.", excluyente: false },
  ];
  const salida = html([...ESTADOS_ANIMAL.map(opcion), ...nuevas], {}, { ...SELECCION_VACIA, 1: [18] });
  for (const o of nuevas) assert.ok(salida.includes(o.nombre), `falta «${o.nombre}»`);
  assert.equal((salida.match(/type="checkbox"/g) ?? []).length, 7, "7 casillas: 6 + la nueva");
  assert.equal((salida.match(/Solo puede elegirse sola/g) ?? []).length, 3, "solo 1, 5 y 6");
  // Con el combinable nuevo elegido, los tres excluyentes quedan deshabilitados y el resto no.
  const cat1 = salida.slice(salida.indexOf('data-categoria="1"'), salida.indexOf('data-categoria="2"'));
  assert.equal((cat1.match(/disabled=""/g) ?? []).length, 3);
});
