import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp } from "../errores";
import { leerCuerpoAcotado, leerFormularioAcotado } from "./cuerpoAcotado";

const estado = (p: Promise<unknown>) => p.then(() => 200, (e: unknown) => (e instanceof ErrorApp ? e.estado : -1));
const flujo = (trozos: Uint8Array[]) => new ReadableStream<Uint8Array>({ start(c) { trozos.forEach((t) => c.enqueue(t)); c.close(); } });
const peticion = (cuerpo: BodyInit | null, cabeceras: Record<string, string> = {}) => new Request("http://localhost/api/casos", { method: "POST", body: cuerpo, headers: cabeceras, ...(cuerpo instanceof ReadableStream ? { duplex: "half" } : {}) } as RequestInit);

test("cuerpo · dentro del límite se lee completo", async () => {
  const bytes = await leerCuerpoAcotado(peticion(new Uint8Array(1000).fill(5)), 1000);
  assert.equal(bytes.length, 1000);
  assert.equal(bytes[999], 5);
});

test("413 · Content-Length mayor que el límite se rechaza SIN leer el cuerpo", async () => {
  const p = new Request("http://localhost/x", { method: "POST", body: flujo([new Uint8Array(10)]), headers: { "content-length": "5000" }, duplex: "half" } as RequestInit);
  assert.equal(await estado(leerCuerpoAcotado(p, 1000)), 413);
  assert.equal(p.bodyUsed, false); // no se tocó el cuerpo
});

test("413 · sin Content-Length (por trozos) o con uno que miente, se corta en cuanto se excede", async () => {
  const trozos = Array.from({ length: 10 }, () => new Uint8Array(400));
  assert.equal(await estado(leerCuerpoAcotado(peticion(flujo(trozos)), 1000)), 413); // 4000 > 1000, sin cabecera
  const miente = new Request("http://localhost/x", { method: "POST", body: flujo(trozos), headers: { "content-length": "10" }, duplex: "half" } as RequestInit);
  assert.equal(await estado(leerCuerpoAcotado(miente, 1000)), 413); // dice 10 pero llegan 4000
  assert.equal(await estado(leerCuerpoAcotado(peticion(null, { "content-length": "abc" }), 1000)), 413);
});

test("multipart · se lee un formulario válido con sus partes; 400 si no es multipart o está mal formado", async () => {
  const f = new FormData();
  f.set("datos", JSON.stringify({ a: 1 }));
  f.set("fotografia", new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" }), "fotografia.jpg");
  const original = new Request("http://localhost/x", { method: "POST", body: f });
  const crudo = new Uint8Array(await original.arrayBuffer());
  const tipo = original.headers.get("content-type")!;
  const leido = await leerFormularioAcotado(new Request("http://localhost/x", { method: "POST", body: crudo, headers: { "content-type": tipo } }), 100_000);
  assert.equal(leido.get("datos"), '{"a":1}');
  const archivo = leido.get("fotografia") as File;
  assert.equal(archivo.type, "image/jpeg");
  assert.equal(archivo.size, 4);
  assert.equal(await estado(leerFormularioAcotado(new Request("http://localhost/x", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }), 1000)), 400);
  assert.equal(await estado(leerFormularioAcotado(new Request("http://localhost/x", { method: "POST", body: "basura", headers: { "content-type": "multipart/form-data; boundary=xx" } }), 1000)), 400);
  assert.equal(await estado(leerFormularioAcotado(new Request("http://localhost/x", { method: "POST", body: crudo, headers: { "content-type": tipo } }), 10)), 413);
});
