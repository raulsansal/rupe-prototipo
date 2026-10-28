import assert from "node:assert/strict";
import { test } from "node:test";
import { PAGINA_PT, QR_SIMBOLO_CM, PT_POR_CM, TOPES_DE_LINEA, fotoVisible, geometriaDeHoja } from "./composicion";

test("composición · páginas Carta 612×792 y Media carta horizontal 612×396 pt", () => {
  assert.deepEqual(PAGINA_PT.carta, { ancho: 612, alto: 792 });
  assert.deepEqual(PAGINA_PT["media-carta"], { ancho: 612, alto: 396 });
});

test("composición · la zona de la fotografía es ≥ 40 % de la hoja por construcción (Carta y Media carta)", () => {
  assert.ok(geometriaDeHoja("carta").fraccionFoto >= 0.4);
  assert.ok(geometriaDeHoja("media-carta").fraccionFoto >= 0.4);
});

test("composición · topes de línea y símbolo del QR (módulo ≥ 0,65 mm con 37 módulos)", () => {
  assert.deepEqual(TOPES_DE_LINEA.carta, { nombre: 1, datos: 2, caracteristicas: 3, lugar: 2 });
  assert.equal(TOPES_DE_LINEA["media-carta"].caracteristicas, 2);
  for (const t of ["carta", "media-carta"] as const) assert.ok((QR_SIMBOLO_CM[t] * 10) / 37 >= 0.65, `módulo de ${t}`);
  assert.ok(QR_SIMBOLO_CM.carta * PT_POR_CM < PAGINA_PT.carta.ancho / 4);
});

test("composición · fotoVisible: contenido sin recorte y cubrir con recorte", () => {
  const caja = { ancho: 527, alto: 405 };
  const c = fotoVisible(caja, 0.8, "contenido");
  assert.deepEqual([Math.round(c.ancho), c.alto, c.recortado], [324, 405, 0]);
  assert.ok(Math.abs(fotoVisible(caja, 0.8, "cubrir").recortado - 0.385) < 0.001);
  assert.equal(fotoVisible(caja, 527 / 405, "cubrir").recortado, 0);
});

import { ajustarSegmentos, contenidoDeFicha, esCaracterDeLaHoja, limpiarTextoParaHoja, type FichaParaHoja } from "./composicion";

const FICHA: FichaParaHoja = { nombre: "Max", sexo: "Macho", raza: "Mestizo/No identificada", edad: "11 años", tamano: "Mediano", color: "Café con blanco", caracteristicasDistintivas: "Mancha blanca", fechaExtravio: "2026-10-26", coloniaZona: "Del Valle Centro", alcaldia: "Benito Juárez", folio: "RUPE-K7M4XQ9T" };

test("composición · limpiarTextoParaHoja: acentos, ñ, ¿ y ¡ se conservan; emoji, no latinos, controles y ceros de ancho no rompen nada", () => {
  assert.equal(limpiarTextoParaHoja("¿Qué ñandú? ¡Árbol! Ü"), "¿Qué ñandú? ¡Árbol! Ü");
  assert.equal(limpiarTextoParaHoja("Max 🐶🐶 el bueno"), "Max ? el bueno");
  assert.equal(limpiarTextoParaHoja("Макс 犬 كلب"), "? ? ?");
  assert.equal(limpiarTextoParaHoja("a\u0000b\u0007c​d‮e⁠f﻿"), "abcdef");
  assert.equal(limpiarTextoParaHoja("uno\n\n  dos\t tres cuatro"), "uno dos tres cuatro");
  assert.equal(limpiarTextoParaHoja("é"), "é", "normaliza a NFC");
  assert.equal(limpiarTextoParaHoja(undefined as unknown as string), "");
  assert.equal(limpiarTextoParaHoja("x".repeat(10_000)).length, 10_000);
  assert.ok(esCaracterDeLaHoja("ñ".codePointAt(0)!) && !esCaracterDeLaHoja("🐶".codePointAt(0)!) && !esCaracterDeLaHoja(0x200b));
});

test("composición · contenidoDeFicha: orden fijo, solo datos públicos y topes por tamaño de hoja", () => {
  const carta = contenidoDeFicha(FICHA, "26 de octubre de 2026", "rupe.example", "carta");
  const media = contenidoDeFicha(FICHA, "26 de octubre de 2026", "rupe.example", "media-carta");
  assert.deepEqual(carta.map((b) => b.id), ["encabezado", "titulo", "nombre", "datos", "caracteristicas", "fecha", "lugar", "indicacion", "folio", "pie"]);
  assert.deepEqual(media.map((b) => b.id), ["encabezado", "titulo", "nombre", "datos", "caracteristicas", "fecha", "lugar", "folio", "indicacion", "pie"]);
  assert.equal(carta.find((b) => b.id === "caracteristicas")!.maxLineas, 3);
  assert.equal(media.find((b) => b.id === "caracteristicas")!.maxLineas, 2);
  assert.match(carta.find((b) => b.id === "pie")!.texto, /rupe\.example y escribe el folio/);
  assert.match(media.find((b) => b.id === "pie")!.texto, /Consulta en rupe\.example con tu folio/, "Media carta conserva la línea de consulta con el dominio");
  assert.equal(carta.find((b) => b.id === "lugar")!.texto, "col. Del Valle Centro, alcaldía Benito Juárez");
  assert.equal(contenidoDeFicha({ ...FICHA, caracteristicasDistintivas: undefined }, "x", "d", "carta").some((b) => b.id === "caracteristicas"), false);
});

test("composición · ajustarSegmentos: respeta el tope de líneas y el ancho, parte las palabras largas y cierra con elipsis dentro del ancho", () => {
  const medir = (t: string) => t.length * 6; // 6 pt por carácter
  const L = (s: string, max: number, ancho = 120) => ajustarSegmentos([{ t: s }], max, ancho, medir).map((l) => l.map((x) => x.t).join(" "));
  assert.deepEqual(L("uno dos tres", 3), ["uno dos tres"]);
  const largo = L("palabra ".repeat(60), 3);
  assert.equal(largo.length, 3);
  assert.ok(largo[2].endsWith("…") && largo.every((l) => medir(l) <= 120));
  const sinEspacios = L("W".repeat(300), 2);
  assert.equal(sinEspacios.length, 2);
  assert.ok(sinEspacios.every((l) => medir(l) <= 120) && sinEspacios[1].endsWith("…"));
  assert.deepEqual(L("", 2), []);
  assert.doesNotThrow(() => L("x".repeat(5000), 1, 1)); // ancho absurdo: no lanza
  const rotulado = ajustarSegmentos([{ t: "Lugar:", negrita: true }, { t: "col. " + "a ".repeat(100) }], 2, 120, (t) => t.length * 6);
  assert.equal(rotulado[0][0].negrita, true);
});
