import assert from "node:assert/strict";
import { test } from "node:test";
import { DURACION_SESION_SEGUNDOS, esSolicitudHttps, opcionesCookie } from "./cookies";

test("cookie · Secure depende de que la PETICIÓN sea HTTPS (URL o x-forwarded-proto), no de NODE_ENV", () => {
  assert.equal(esSolicitudHttps("http://localhost:3000/api/x"), false); // next start por HTTP en localhost
  assert.equal(esSolicitudHttps("http://192.168.1.20:3000/api/x"), false); // red local por HTTP
  assert.equal(esSolicitudHttps("https://rupe.example/api/x"), true);
  assert.equal(esSolicitudHttps("http://interno/api/x", "https"), true); // detrás de un proxy
  assert.equal(esSolicitudHttps("http://interno/api/x", "https, http"), true);
  assert.equal(esSolicitudHttps("https://rupe.example/api/x", "http"), false); // la cabecera del proxy manda
  assert.equal(esSolicitudHttps("no es una url"), false);
});

test("cookie · siempre HttpOnly y SameSite=Lax; dura 8 horas (R18)", () => {
  for (const https of [true, false]) {
    const o = opcionesCookie(https);
    assert.equal(o.httpOnly, true);
    assert.equal(o.sameSite, "lax");
    assert.equal(o.secure, https);
    assert.equal(o.path, "/");
    assert.equal(o.maxAge, DURACION_SESION_SEGUNDOS);
  }
  assert.equal(DURACION_SESION_SEGUNDOS, 28800);
});
