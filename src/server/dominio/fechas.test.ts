import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp } from "../errores";
import { hoyCDMX, validarFechaExtravio, validarFechaHoraAvistamiento } from "./fechas";

const reloj = (iso: string) => () => new Date(iso);

test("R10/E12 · «hoy» en la Ciudad de México es UTC−6 (borde de medianoche)", () => {
  assert.equal(hoyCDMX(reloj("2026-10-25T05:59:59Z")), "2026-10-24"); // 23:59 del día anterior en CDMX
  assert.equal(hoyCDMX(reloj("2026-10-25T06:00:00Z")), "2026-10-25");
  assert.equal(hoyCDMX(reloj("2026-01-01T03:00:00Z")), "2025-12-31"); // cruce de año
});

test("R10 · caso feliz: la fecha de hoy y las pasadas se aceptan", () => {
  validarFechaExtravio("2026-10-24", reloj("2026-10-25T05:59:59Z"));
  validarFechaExtravio("2026-01-02", reloj("2026-10-25T12:00:00Z"));
});

test("R10 · rechazo: una fecha futura (con «hoy» en hora local) da 422", () => {
  // En UTC ya es 25, pero en CDMX todavía es 24: el 25 es futuro.
  assert.throws(() => validarFechaExtravio("2026-10-25", reloj("2026-10-25T05:00:00Z")), (e) => e instanceof ErrorApp && e.estado === 422 && e.regla === "R10" && e.codigo === "FECHA_FUTURA");
});

test("R10 · rechazo: una fecha inexistente o mal formada da 422", () => {
  for (const f of ["2026-02-30", "18/10/2026", "", "2026-13-01"]) assert.throws(() => validarFechaExtravio(f, reloj("2026-10-25T12:00:00Z")), (e) => e instanceof ErrorApp && e.codigo === "FECHA_INVALIDA");
});

test("HU 033 · la fecha y hora del avistamiento no es posterior al envío", () => {
  validarFechaHoraAvistamiento("2026-10-18T11:59:00Z", reloj("2026-10-18T12:00:00Z"));
  assert.throws(() => validarFechaHoraAvistamiento("2026-10-18T12:00:01Z", reloj("2026-10-18T12:00:00Z")), (e) => e instanceof ErrorApp && e.codigo === "FECHA_FUTURA");
});
