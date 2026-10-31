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

const PUBLICO = "https://rupe-demo.example.test";
const ENTORNO = { RUPE_URL_PUBLICA: PUBLICO };
const estadoCon = (p: Request, entorno: Record<string, string | undefined>) => { try { exigirMismoOrigen(p, entorno); return 200; } catch (e) { return e instanceof ErrorApp ? e.estado : -1; } };

test("Origin · con RUPE_URL_PUBLICA se acepta su origen aunque Host sea localhost (túnel sin x-forwarded-host); sin la variable sigue siendo 403", () => {
  const tras = peticion("http://localhost:3000/api/x", { host: "localhost:3000", origin: PUBLICO });
  assert.equal(estadoCon(tras, {}), 403);
  assert.equal(estadoCon(tras, ENTORNO), 200);
  assert.equal(estadoCon(peticion("http://localhost:3000/api/x", { host: "localhost:3000", origin: "https://rupe-demo.example.test/" }), { RUPE_URL_PUBLICA: `${PUBLICO}/` }), 403, "el Origin siempre va sin barra final");
});

test("Origin · con RUPE_URL_PUBLICA siguen rechazados otros sitios, puerto, esquema, «null» y subdominios engañosos; el propio Host sigue valiendo", () => {
  for (const origin of ["http://evil.example", "http://rupe-demo.example.test", "https://rupe-demo.example.test:8443", "https://rupe-demo.example.test.evil.example", "https://evil.rupe-demo.example.test", "null"]) {
    assert.equal(estadoCon(peticion("http://localhost:3000/api/x", { host: "localhost:3000", origin }), ENTORNO), 403, origin);
  }
  assert.equal(estadoCon(peticion("http://localhost:3000/api/x", { host: "localhost:3000", origin: "http://localhost:3000" }), ENTORNO), 200);
  assert.equal(estadoCon(peticion("http://localhost:3000/api/x", { host: "localhost:3000" }), ENTORNO), 200, "sin Origin se acepta");
  assert.equal(estadoCon(peticion("http://localhost:3000/api/x", { host: "localhost:3000", origin: "http://evil.example" }), { RUPE_URL_PUBLICA: "no es una url" }), 403, "variable inválida = como si no existiera");
});

// Lo que mide el túnel real (Dev Tunnels): Host localhost:3000, Origin REESCRITO a http://localhost:3000, x-forwarded-host público y x-forwarded-proto https.
const TUNEL = { host: "localhost:3000", origin: "http://localhost:3000", "x-forwarded-host": "rupe-demo.example.test", "x-forwarded-proto": "https", "x-forwarded-port": "443" };
const conTunel = (cambios: Record<string, string | undefined> = {}, entorno: Record<string, string | undefined> = ENTORNO) => {
  const h: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...TUNEL, ...cambios })) if (v !== undefined) h[k] = v;
  return estadoCon(peticion("http://localhost:3000/api/acceso/iniciar", h), entorno);
};

test("Origin · túnel: el Origin reescrito a http://localhost:<puerto> se acepta con las cuatro condiciones (Sec-Fetch-Site ausente o same-origin)", () => {
  assert.equal(conTunel(), 200);
  assert.equal(conTunel({ "sec-fetch-site": "same-origin" }), 200);
  assert.equal(conTunel({ host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }), 200);
  assert.equal(conTunel({ "x-forwarded-host": "rupe-demo.example.test, otro.example" }), 200, "se usa el primer valor");
});

test("Origin · túnel: cada condición que falla mantiene el 403", () => {
  const casos: Array<[string, number]> = [
    ["Sec-Fetch-Site cross-site", conTunel({ "sec-fetch-site": "cross-site" })],
    ["Sec-Fetch-Site same-site", conTunel({ "sec-fetch-site": "same-site" })],
    ["x-forwarded-host de OTRO host (túnel válido de otra persona)", conTunel({ "x-forwarded-host": "otra-persona-3000.usw3.devtunnels.ms" })],
    ["x-forwarded-host ausente", conTunel({ "x-forwarded-host": undefined })],
    ["x-forwarded-proto http", conTunel({ "x-forwarded-proto": "http" })],
    ["x-forwarded-proto ausente", conTunel({ "x-forwarded-proto": undefined })],
    ["Origin con otro puerto (3999)", conTunel({ origin: "http://localhost:3999" })],
    ["Origin https://localhost:3000", conTunel({ origin: "https://localhost:3000" })],
    ["Host que no es loopback", conTunel({ host: "192.168.1.20:3000", origin: "http://localhost:3000" })],
    ["Host no loopback e igual al Origin", conTunel({ host: "mi-equipo.local:3000", origin: "http://mi-equipo.local:3000" })],
    ["Host ausente", conTunel({ host: undefined })],
    ["sin RUPE_URL_PUBLICA", conTunel({}, {})],
    ["RUPE_URL_PUBLICA no https (red privada)", conTunel({ "x-forwarded-host": "192.168.1.20:3000" }, { RUPE_URL_PUBLICA: "http://192.168.1.20:3000" })],
    ["Origin «null»", conTunel({ origin: "null" })],
    ["Origin ajeno", conTunel({ origin: "http://sitio-ajeno.example" })],
    ["Origin https del túnel de otra persona", conTunel({ origin: "https://otra-persona-3000.usw3.devtunnels.ms" })],
  ];
  assert.deepEqual(casos.filter(([, estado]) => estado !== 403).map(([nombre, estado]) => `${nombre} → ${estado}`), [], "casos que debían dar 403");
});

test("no-store · TODA respuesta de la API lleva Cache-Control: no-store, incluidas las de error y las redirecciones", async () => {
  assert.equal(SIN_CACHE["Cache-Control"], "no-store");
  const respuestas = [jsonApi({ ok: true }), jsonApi({ x: 1 }, 201, { "X-Otra": "1" }), redireccionApi("/"), respuestaDeError(noEncontrado()), respuestaDeError(new ErrorApp(422, "X", "x", "R1", { a: "b" })), respuestaDeError(new Error("interno"))];
  for (const r of respuestas) assert.equal(r.headers.get("cache-control"), "no-store");
  assert.deepEqual(respuestas.map((r) => r.status), [200, 201, 303, 404, 422, 500]);
  assert.equal(respuestas[2].headers.get("location"), "/");
  assert.deepEqual(cuerpoDeError(new ErrorApp(422, "X", "x", "R1", { a: "b" })), { error: { codigo: "X", mensaje: "x", regla: "R1", campos: { a: "b" } } });
});
