import assert from "node:assert/strict";
import { test } from "node:test";
import { generarTokenQr } from "../dominio/qr";
import { decodificarQr, rasterizarMatriz } from "../pruebas/pdf";
import { matrizQr, urlDelQr, urlParaCompartir } from "./matrizQr";

const BASES = ["http://localhost:3109", "https://nombre-largo.vercel.app", "https://nombre-largo-de-proyecto.vercel.app"]; // 61, 70 y 82 caracteres con el token y la ruta (la versión 5 a nivel M admite hasta 84)

test("QR · la URL es exactamente <base>/ficha/<token> y se lee con jsQR en versión ≤ 5 (≤ 37 módulos) incluso con una base larga", () => {
  for (const base of BASES) {
    const token = generarTokenQr();
    const url = urlDelQr(base, token);
    assert.equal(url, `${base}/ficha/${token}`);
    const m = matrizQr(url);
    assert.ok(m.version <= 5 && m.modulos <= 37, `${base}: versión ${m.version}`);
    const leido = decodificarQr(rasterizarMatriz(m.filas, 8));
    assert.equal(leido?.texto, url);
    assert.equal(leido?.version, m.version);
  }
});

test("QR · el enlace para compartir lleva el FOLIO (no el token) y el QR nunca lleva datos de la persona", () => {
  assert.equal(urlParaCompartir("https://x.example", "RUPE-K7M4XQ9T"), "https://x.example/ficha/RUPE-K7M4XQ9T");
  const url = urlDelQr("https://x.example", generarTokenQr());
  assert.match(url, /^https:\/\/x\.example\/ficha\/[A-Za-z0-9]{32}$/);
});

test("QR · dos tokens distintos dan matrices distintas y se leen por separado", () => {
  const [a, b] = [urlDelQr(BASES[1], generarTokenQr()), urlDelQr(BASES[1], generarTokenQr())];
  assert.notEqual(a, b);
  assert.equal(decodificarQr(rasterizarMatriz(matrizQr(a).filas))?.texto, a);
  assert.equal(decodificarQr(rasterizarMatriz(matrizQr(b).filas))?.texto, b);
});

test("QR · con una URL de más de 84 caracteres la versión sube a 6 (41 módulos): sigue leyéndose, pero el módulo impreso mide menos", () => {
  const url = urlDelQr("https://nombre-largo-de-proyecto-con-sufijo.vercel.app", generarTokenQr());
  assert.ok(url.length > 84);
  const m = matrizQr(url);
  assert.equal(m.version, 6);
  assert.equal(decodificarQr(rasterizarMatriz(m.filas, 8))?.texto, url);
});
