import assert from "node:assert/strict";
import { test } from "node:test";
import type { EstadoCaso, MovimientoHistorial, TipoMovimiento } from "../../mocks/tipos";
import { ErrorApp } from "../errores";
import { MATRIZ, estadoActual, registrarMovimiento, type Actor } from "./transiciones";

const T = "2026-10-18T12:00:00Z";
/** Historial mínimo que deja al caso en un estado (sin pasar por todos los movimientos). */
const hasta = (...tipos: [TipoMovimiento, EstadoCaso, string?][]): MovimientoHistorial[] => tipos.map(([tipo, estado, motivo], i) => ({ consecutivo: i + 1, fechaHora: T, tipo, estado, ...(motivo ? { motivo } : {}) }));
const registro = hasta(["registro", "Extraviado"], ["ficha generada", "En búsqueda"]);
const conAvistamiento = [...registro, ...hasta(["avistamiento recibido", "Avistamiento reportado"]).map((m) => ({ ...m, consecutivo: 3 }))];
const seguimiento = [...conAvistamiento, { consecutivo: 4, fechaHora: T, tipo: "avistamiento revisado" as const, estado: "En seguimiento" as const }];
const localizado = [...seguimiento, { consecutivo: 5, fechaHora: T, tipo: "localización" as const, estado: "Localizado" as const }];
const cerradoConfirmado = [...localizado, { consecutivo: 6, fechaHora: T, tipo: "cierre confirmado" as const, estado: "Cerrado" as const }];
const cancelado = [...registro, { consecutivo: 3, fechaHora: T, tipo: "cancelación" as const, estado: "Cerrado" as const, motivo: "Regresó solo" }];
const deshabilitado = [...registro, { consecutivo: 3, fechaHora: T, tipo: "deshabilitación" as const, estado: "Cerrado" as const, motivo: "Foto ajena" }];

const rechaza = (f: () => unknown, estado = 409) => assert.throws(f, (e) => e instanceof ErrorApp && e.estado === estado);
const llega = (h: MovimientoHistorial[], tipo: TipoMovimiento, actor: Actor, motivo?: string) => estadoActual(registrarMovimiento(h, tipo, actor, T, motivo));

test("R12 · caso feliz: el ciclo completo registro → … → cierre confirmado", () => {
  assert.equal(llega([], "registro", "automático"), "Extraviado");
  assert.equal(llega(hasta(["registro", "Extraviado"]), "ficha generada", "automático"), "En búsqueda");
  assert.equal(llega(registro, "avistamiento recibido", "automático"), "Avistamiento reportado");
  assert.equal(llega(conAvistamiento, "avistamiento revisado", "automático"), "En seguimiento");
  assert.equal(llega(seguimiento, "avistamiento recibido", "automático"), "Avistamiento reportado");
  assert.equal(llega(seguimiento, "localización", "Tutor"), "Localizado");
  assert.equal(llega(localizado, "cierre confirmado", "Tutor"), "Cerrado");
  assert.equal(llega(localizado, "reactivación", "Tutor", "Sigue extraviado"), "En seguimiento");
  assert.equal(llega(registro, "cancelación", "Tutor", "Regresó solo"), "Cerrado");
  assert.equal(llega(seguimiento, "deshabilitación", "Administrador", "Foto ajena"), "Cerrado");
});

test("R12 · rechazo: cada movimiento solo desde sus estados de origen (409)", () => {
  rechaza(() => llega(localizado, "avistamiento recibido", "automático")); // Localizado no acepta avistamientos
  rechaza(() => llega(registro, "avistamiento revisado", "automático")); // solo desde Avistamiento reportado
  rechaza(() => llega(registro, "cierre confirmado", "Tutor")); // solo desde Localizado
  rechaza(() => llega(registro, "reactivación", "Tutor", "x")); // solo desde Localizado
  rechaza(() => llega(localizado, "cancelación", "Tutor", "x")); // no se cancela un Localizado
  rechaza(() => llega(localizado, "localización", "Tutor")); // ya está localizado
  rechaza(() => llega(cerradoConfirmado, "reactivación", "Tutor", "x")); // el cierre es definitivo para el Tutor
  rechaza(() => llega(cerradoConfirmado, "deshabilitación", "Administrador", "x")); // no se deshabilita un Cerrado
  rechaza(() => llega(registro, "registro", "automático")); // el registro inicial solo existe una vez
  rechaza(() => llega([], "ficha generada", "automático")); // sin caso
});

test("R12 · rechazo: el actor debe corresponder (el Tutor no deshabilita; el Administrador no cancela)", () => {
  rechaza(() => llega(registro, "deshabilitación", "Tutor", "x"));
  rechaza(() => llega(registro, "cancelación", "Administrador", "x"));
  rechaza(() => llega(registro, "localización", "automático"));
});

test("R12 · rechazo: cancelación, deshabilitación y reactivación exigen motivo (422); el motivo no pasa de 300", () => {
  rechaza(() => llega(registro, "cancelación", "Tutor"), 422);
  rechaza(() => llega(registro, "deshabilitación", "Administrador", "   "), 422);
  rechaza(() => llega(localizado, "reactivación", "Tutor"), 422);
  rechaza(() => llega(registro, "cancelación", "Tutor", "x".repeat(301)), 422);
});

test("R12 · la restauración vuelve al estado previo a la deshabilitación; solo si el último movimiento es una deshabilitación", () => {
  const dehab = registrarMovimiento(seguimiento, "deshabilitación", "Administrador", T, "Foto ajena");
  assert.equal(estadoActual(dehab), "Cerrado");
  assert.equal(estadoActual(registrarMovimiento(dehab, "restauración", "Administrador", T)), "En seguimiento");
  rechaza(() => llega(cancelado, "restauración", "Administrador")); // cancelado: no se restaura
  rechaza(() => llega(cerradoConfirmado, "restauración", "Administrador")); // cerrado tras localización: no se restaura
  rechaza(() => llega(seguimiento, "restauración", "Administrador")); // no está cerrado
  assert.equal(estadoActual(deshabilitado), "Cerrado");
});

test("E1 y R4 · el estado actual es el del último movimiento y el consecutivo es máximo + 1; el historial original no cambia", () => {
  const antes = JSON.stringify(registro);
  const nuevo = registrarMovimiento(registro, "avistamiento recibido", "automático", T);
  assert.equal(nuevo.at(-1)!.consecutivo, 3);
  assert.equal(estadoActual(nuevo), nuevo.at(-1)!.estado);
  assert.equal(JSON.stringify(registro), antes);
  assert.equal(estadoActual([]), undefined);
});

test("R12 · la matriz cubre los 10 tipos de movimiento del diccionario", () => {
  assert.deepEqual(Object.keys(MATRIZ).sort(), ["avistamiento recibido", "avistamiento revisado", "cancelación", "cierre confirmado", "deshabilitación", "ficha generada", "localización", "reactivación", "registro", "restauración"]);
});
