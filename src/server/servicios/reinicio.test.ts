import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp } from "../errores";
import type { SesionActual } from "../sesion/guardas";
import { autorizarReinicio, reinicioRequiereSesion } from "./reinicio";

const admin: SesionActual = { idUsuario: 1, rol: "Administrador", nombre: "A" };
const tutor: SesionActual = { idUsuario: 2, rol: "Tutor", nombre: "T" };
const estado = (f: () => void) => { try { f(); return 200; } catch (e) { return e instanceof ErrorApp ? e.estado : -1; } };

test("reinicio · producción sin RUPE_PERMITIR_REINICIO=1 → 404 siempre (con o sin sesión de Administrador)", () => {
  for (const permitir of [undefined, "", "0", "true", "yes"]) for (const sesion of [undefined, tutor, admin]) assert.equal(estado(() => autorizarReinicio({ entorno: "production", permitir, sesion })), 404);
});

test("reinicio · producción con RUPE_PERMITIR_REINICIO=1 → 401 sin sesión, 403 con otro rol, permitido al Administrador", () => {
  assert.equal(estado(() => autorizarReinicio({ entorno: "production", permitir: "1", sesion: undefined })), 401);
  assert.equal(estado(() => autorizarReinicio({ entorno: "production", permitir: "1", sesion: tutor })), 403);
  assert.equal(estado(() => autorizarReinicio({ entorno: "production", permitir: "1", sesion: admin })), 200);
});

test("reinicio · fuera de producción (desarrollo y pruebas) está permitido sin sesión", () => {
  for (const entorno of ["development", "test", undefined]) assert.equal(estado(() => autorizarReinicio({ entorno, permitir: undefined, sesion: undefined })), 200);
  assert.equal(reinicioRequiereSesion("production", "1"), true);
  assert.equal(reinicioRequiereSesion("production", undefined), false);
  assert.equal(reinicioRequiereSesion("development", "1"), false);
});
