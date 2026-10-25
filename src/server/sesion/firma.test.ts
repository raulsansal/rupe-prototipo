import assert from "node:assert/strict";
import { test } from "node:test";
import { secretoAleatorio } from "../pruebas/auxiliares";
import { firmar, leerSecreto, verificar, type PayloadSesion } from "./firma";

const payload = (exp: number): PayloadSesion => ({ sid: "abc", idUsuario: 2, rol: "Tutor", exp });
const secreto = secretoAleatorio();

test("sesión · una cookie firmada se verifica y devuelve su payload", () => {
  assert.deepEqual(verificar(firmar(payload(2000), secreto), secreto, 1000), payload(2000));
});

test("sesión · rechazos: firma alterada, cuerpo alterado, otro secreto, expirada y basura", () => {
  const v = firmar(payload(2000), secreto);
  const [cuerpo, firma] = v.split(".");
  const otro = Buffer.from(JSON.stringify({ ...payload(2000), rol: "Administrador" })).toString("base64url");
  assert.equal(verificar(`${cuerpo}.${firma.slice(0, -2)}AA`, secreto, 1000), undefined); // firma alterada
  assert.equal(verificar(`${otro}.${firma}`, secreto, 1000), undefined); // rol alterado con la firma vieja
  assert.equal(verificar(v, secretoAleatorio(), 1000), undefined); // otro secreto
  assert.equal(verificar(v, secreto, 2000), undefined); // expirada
  for (const basura of [undefined, "", "x", "a.b.c", "....", "%%%.%%%"]) assert.equal(verificar(basura, secreto, 1000), undefined);
});

test("sesión · el secreto sale de la variable de entorno RUPE_SESION_SECRETO y su ausencia es un error", () => {
  assert.throws(() => leerSecreto({}), /RUPE_SESION_SECRETO/);
  assert.throws(() => leerSecreto({ RUPE_SESION_SECRETO: "corto" }), /RUPE_SESION_SECRETO/);
  assert.equal(leerSecreto({ RUPE_SESION_SECRETO: secreto }), secreto);
});
