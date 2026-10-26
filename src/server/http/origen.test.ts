import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp, SIN_CACHE, cuerpoDeError, jsonApi, redireccionApi, respuestaDeError, noEncontrado } from "../errores";
import { exigirMismoOrigen, origenDelSitio } from "./origen";

const peticion = (url: string, cabeceras: Record<string, string> = {}) => new Request(url, { method: "POST", headers: cabeceras });
const estado = (p: Request) => { try { exigirMismoOrigen(p); return 200; } catch (e) { return e instanceof ErrorApp ? e.estado : -1; } };

test("Origin · coincide con el origen del sitio → se acepta; sin cabecera → se acepta", () => {
  assert.equal(estado(peticion("http://localhost:3000/api/acceso/iniciar", { host: "localhost:3000", origin: "http://localhost:3000" })), 200);
  assert.equal(estado(peticion("http://192.168.1.20:3000/api/x", { host: "192.168.1.20:3000", origin: "http://192.168.1.20:3000" })), 200);
  assert.equal(estado(peticion("https://rupe.example/api/x", { host: "rupe.example", origin: "https://rupe.example" })), 200);
  assert.equal(estado(peticion("http://localhost:3000/api/x", { host: "localhost:3000" })), 200);
});

test("Origin · rechazo con 403: otro sitio, otro puerto, otro esquema, «null» y subdominios engañosos", () => {
  for (const origin of ["http://evil.example", "http://localhost:3001", "https://localhost:3000", "null", "http://localhost:3000.evil.example", "http://evil.example/http://localhost:3000"]) {
    const e = (() => { try { exigirMismoOrigen(peticion("http://localhost:3000/api/x", { host: "localhost:3000", origin })); return undefined; } catch (x) { return x as ErrorApp; } })();
    assert.equal(e?.estado, 403, origin);
    assert.equal(e?.codigo, "ORIGEN_NO_PERMITIDO");
  }
});

test("Origin · detrás de un proxy se usan x-forwarded-host y x-forwarded-proto", () => {
  const h = { host: "interno:3000", "x-forwarded-host": "rupe.example", "x-forwarded-proto": "https" };
  assert.equal(origenDelSitio("http://interno:3000/api/x", new Headers(h)), "https://rupe.example");
  assert.equal(estado(peticion("http://interno:3000/api/x", { ...h, origin: "https://rupe.example" })), 200);
  assert.equal(estado(peticion("http://interno:3000/api/x", { ...h, origin: "http://interno:3000" })), 403);
});

test("no-store · TODA respuesta de la API lleva Cache-Control: no-store, incluidas las de error y las redirecciones", async () => {
  assert.equal(SIN_CACHE["Cache-Control"], "no-store");
  const respuestas = [jsonApi({ ok: true }), jsonApi({ x: 1 }, 201, { "X-Otra": "1" }), redireccionApi("/"), respuestaDeError(noEncontrado()), respuestaDeError(new ErrorApp(422, "X", "x", "R1", { a: "b" })), respuestaDeError(new Error("interno"))];
  for (const r of respuestas) assert.equal(r.headers.get("cache-control"), "no-store");
  assert.deepEqual(respuestas.map((r) => r.status), [200, 201, 303, 404, 422, 500]);
  assert.equal(respuestas[2].headers.get("location"), "/");
  assert.deepEqual(cuerpoDeError(new ErrorApp(422, "X", "x", "R1", { a: "b" })), { error: { codigo: "X", mensaje: "x", regla: "R1", campos: { a: "b" } } });
});
