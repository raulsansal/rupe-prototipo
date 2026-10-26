import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp } from "../errores";
import { exigirAccesoAlCaso, exigirRol, resolverAcceso, type SesionActual } from "./guardas";

const tutora: SesionActual = { idUsuario: 2, rol: "Tutor", nombre: "T" };
const otraTutora: SesionActual = { idUsuario: 5, rol: "Tutor", nombre: "O" };
const admin: SesionActual = { idUsuario: 1, rol: "Administrador", nombre: "A" };
const estado = (f: () => unknown) => { try { f(); return 200; } catch (e) { return e instanceof ErrorApp ? e.estado : -1; } };

test("guardas por rol · 401 sin sesión, 403 con otro rol, y pasa con el rol pedido", () => {
  assert.equal(estado(() => exigirRol(undefined, "Tutor")), 401);
  assert.equal(estado(() => exigirRol(undefined)), 401);
  assert.equal(estado(() => exigirRol(tutora, "Administrador")), 403);
  assert.equal(estado(() => exigirRol(admin, "Tutor")), 403);
  assert.equal(estado(() => exigirRol(tutora, "Tutor")), 200);
  assert.equal(estado(() => exigirRol(admin, "Administrador")), 200);
  assert.equal(estado(() => exigirRol(tutora)), 200);
});

test("R32 · solo la persona tutora dueña consulta, edita y cancela; otra tutora recibe 404; el Administrador solo consulta", () => {
  for (const accion of ["consultar", "editar", "cancelar"] as const) {
    assert.equal(estado(() => exigirAccesoAlCaso(tutora, 2, accion)), 200);
    assert.equal(estado(() => exigirAccesoAlCaso(otraTutora, 2, accion)), 404);
    assert.equal(estado(() => exigirAccesoAlCaso(undefined, 2, accion)), 401);
  }
  assert.equal(estado(() => exigirAccesoAlCaso(admin, 2, "consultar")), 200);
  assert.equal(estado(() => exigirAccesoAlCaso(admin, 2, "editar")), 403);
  assert.equal(estado(() => exigirAccesoAlCaso(admin, 2, "cancelar")), 403);
});

test("layouts · resolverAcceso: sin sesión → redirigir al inicio de sesión; con otro rol → 403; con el rol → pasa (ni el Administrador entra a Tutor ni al revés)", () => {
  assert.equal(resolverAcceso(undefined, "Tutor"), "sin-sesion");
  assert.equal(resolverAcceso(undefined, "Administrador"), "sin-sesion");
  assert.equal(resolverAcceso(tutora, "Tutor"), "ok");
  assert.equal(resolverAcceso(admin, "Administrador"), "ok");
  assert.equal(resolverAcceso(tutora, "Administrador"), "prohibido");
  assert.equal(resolverAcceso(admin, "Tutor"), "prohibido");
});
