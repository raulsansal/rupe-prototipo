import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp } from "../errores";
import { basePublicaDeCabeceras, esHostLocalOPrivado, exigirBasePublica, origenDeCabeceras, resolverBasePublica, validarBase } from "./urlPublica";

test("URL pública · hosts locales y de red privada (RFC 1918 y .local) admiten http; cualquier otro no", () => {
  for (const h of ["localhost", "127.0.0.1", "[::1]", "10.0.0.5", "172.16.0.1", "172.31.255.254", "192.168.1.20", "mi-compu.local"]) assert.equal(esHostLocalOPrivado(h), true, h);
  for (const h of ["example.com", "172.15.0.1", "172.32.0.1", "11.0.0.1", "192.169.1.1", "8.8.8.8", "localhost.example.com", "999.1.1.1"]) assert.equal(esHostLocalOPrivado(h), false, h);
});

test("URL pública · RUPE_URL_PUBLICA se valida: https obligatorio fuera de redes locales; sin credenciales, ruta, parámetros ni ancla", () => {
  assert.equal(validarBase("https://nombre-largo.vercel.app"), "https://nombre-largo.vercel.app");
  assert.equal(validarBase("https://nombre-largo.vercel.app/"), "https://nombre-largo.vercel.app");
  assert.equal(validarBase("http://192.168.1.20:3000"), "http://192.168.1.20:3000");
  assert.equal(validarBase("http://localhost:3000"), "http://localhost:3000");
  for (const malo of ["http://example.com", "ftp://example.com", "https://u:p@example.com", "https://example.com/ruta", "https://example.com?x=1", "https://example.com#a", "javascript:alert(1)", "no es una url", ""]) assert.equal(validarBase(malo), undefined, malo);
});

test("URL pública · orden de resolución: variable primero; sin ella solo el origen de un host local o privado; otro host no da base", () => {
  const conVariable = resolverBasePublica({ entorno: { RUPE_URL_PUBLICA: "https://nombre-largo.vercel.app" }, origenPeticion: "https://atacante.example", produccion: true });
  assert.deepEqual(conVariable, { ok: true, base: "https://nombre-largo.vercel.app", dominio: "nombre-largo.vercel.app" }); // la cabecera Host NO manda si hay variable
  assert.equal(resolverBasePublica({ entorno: {}, origenPeticion: "http://localhost:3109", produccion: true }).ok, true);
  assert.equal(resolverBasePublica({ entorno: {}, origenPeticion: "http://192.168.1.20:3000", produccion: true }).ok, true);
  const ajeno = resolverBasePublica({ entorno: {}, origenPeticion: "https://atacante.example", produccion: true });
  assert.equal(ajeno.ok, false); // un Host falso no puede decidir a dónde apunta un QR impreso
  assert.equal(resolverBasePublica({ entorno: { RUPE_URL_PUBLICA: "http://example.com" }, origenPeticion: "http://localhost:3000" }).ok, false, "variable inválida: no se cae al respaldo");
  assert.deepEqual(resolverBasePublica({ entorno: {}, produccion: false }), { ok: true, base: "http://localhost:3000", dominio: "localhost:3000" });
  assert.equal(resolverBasePublica({ entorno: {}, produccion: true }).ok, false);
});

test("URL pública · el aviso y el error 503 no revelan datos internos", () => {
  const sin = resolverBasePublica({ entorno: {}, origenPeticion: "https://otro.example", produccion: true });
  assert.ok(!sin.ok && sin.mensaje === "Configura RUPE_URL_PUBLICA para generar el QR.");
  try {
    exigirBasePublica(sin);
    assert.fail("debía lanzar");
  } catch (e) {
    assert.ok(e instanceof ErrorApp && e.estado === 503 && e.codigo === "CONFIGURACION_FALTANTE");
    assert.ok(!/localhost|example|RUPE_URL|env|process/i.test(e.message), e.message);
  }
});

test("URL pública · el origen se toma de las cabeceras (x-forwarded-* o Host) y se resuelve con las mismas reglas", () => {
  assert.equal(origenDeCabeceras(new Headers({ host: "localhost:3109" })), "http://localhost:3109");
  assert.equal(origenDeCabeceras(new Headers({ host: "192.168.1.20:3000", "x-forwarded-proto": "https" })), "https://192.168.1.20:3000");
  assert.equal(origenDeCabeceras(new Headers({ "x-forwarded-host": "mi.example, otro", host: "interno" })), "https://mi.example");
  assert.equal(basePublicaDeCabeceras(new Headers({ host: "evil.example" })).ok, process.env.RUPE_URL_PUBLICA ? true : false);
});
