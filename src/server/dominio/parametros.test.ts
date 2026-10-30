import assert from "node:assert/strict";
import { test } from "node:test";
import { LIMITE_TECNICO_MB } from "../../config/parametros";
import { ErrorApp } from "../errores";
import type { ParametroSistema } from "../tipos";
import { detalleDeParametro, planearCambioDeParametros, planearRestablecimiento } from "./parametros";

const actuales = (): ParametroSistema[] => [
  { clave: "version_aviso_privacidad", descripcion: "", valor: "1.0", valorPorDefecto: "1.0" },
  { clave: "expiracion_token_minutos", descripcion: "", valor: "60", valorPorDefecto: "60" },
  { clave: "tamano_maximo_archivo_mb", descripcion: "", valor: "4", valorPorDefecto: "4" },
];
const falla = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    assert.ok(e instanceof ErrorApp);
    assert.equal(e.estado, 422);
    return e;
  }
  assert.fail("debía fallar");
};

test("HU 054 · el límite técnico es único (4.5): 4.5 sí y 4.51 no", () => {
  assert.equal(LIMITE_TECNICO_MB, 4.5);
  assert.equal(planearCambioDeParametros({ tamano_maximo_archivo_mb: 4.5 }, actuales())[0].nuevo, "4.5");
  assert.equal(planearCambioDeParametros({ tamano_maximo_archivo_mb: "4,5" }, actuales())[0].nuevo, "4.5");
  assert.ok(falla(() => planearCambioDeParametros({ tamano_maximo_archivo_mb: 4.51 }, actuales())).campos?.tamano_maximo_archivo_mb, "4.51: falta el campo del parámetro en el 422");
  for (const v of [0, -1, "", "abc"]) assert.ok(falla(() => planearCambioDeParametros({ tamano_maximo_archivo_mb: v }, actuales())).campos?.tamano_maximo_archivo_mb, String(v));
});

test("HU 054 · token entero > 0; versión ^\\d+(\\.\\d+)*$ de hasta 20 caracteres", () => {
  for (const v of [0, -5, 1.5, "", "x"]) assert.ok(falla(() => planearCambioDeParametros({ expiracion_token_minutos: v }, actuales())).campos?.expiracion_token_minutos, String(v));
  for (const v of ["", "abc", "1.", ".5", "2,1", "1.0 beta", "1".repeat(21)]) assert.ok(falla(() => planearCambioDeParametros({ version_aviso_privacidad: v }, actuales())).campos?.version_aviso_privacidad, v);
  assert.equal(planearCambioDeParametros({ version_aviso_privacidad: " 2.1 " }, actuales())[0].nuevo, "2.1");
  assert.equal(planearCambioDeParametros({ version_aviso_privacidad: "1".repeat(20) }, actuales()).length, 1);
});

test("HU 054 · una entrada por parámetro que CAMBIÓ con «anterior → nuevo»; sin cambios no hay nada; «4.0» es el mismo 4; un valor malo no cambia ninguno", () => {
  const cambios = planearCambioDeParametros({ version_aviso_privacidad: "2.0", expiracion_token_minutos: 60, tamano_maximo_archivo_mb: "4.0" }, actuales());
  assert.deepEqual(cambios, [{ clave: "version_aviso_privacidad", anterior: "1.0", nuevo: "2.0" }]);
  assert.equal(detalleDeParametro(cambios[0]), "1.0 → 2.0");
  assert.deepEqual(planearCambioDeParametros({ tamano_maximo_archivo_mb: 4, expiracion_token_minutos: "60" }, actuales()), []);
  assert.ok(falla(() => planearCambioDeParametros({ version_aviso_privacidad: "2.0", tamano_maximo_archivo_mb: 9 }, actuales())).campos?.tamano_maximo_archivo_mb, "un valor malo: falta el campo del parámetro en el 422");
  assert.ok(falla(() => planearCambioDeParametros({ inventado: 1 }, actuales())).campos?.inventado, "parámetro inventado: falta el campo en el 422");
  falla(() => planearCambioDeParametros({}, actuales()));
  falla(() => planearCambioDeParametros(null, actuales()));
});

test("«Restablecer» copia el valor por defecto solo donde difiere", () => {
  const a = actuales();
  assert.deepEqual(planearRestablecimiento(a), []);
  a[0].valor = "3.0";
  a[2].valor = "2";
  assert.deepEqual(planearRestablecimiento(a), [{ clave: "version_aviso_privacidad", anterior: "3.0", nuevo: "1.0" }, { clave: "tamano_maximo_archivo_mb", anterior: "2", nuevo: "4" }]);
});
