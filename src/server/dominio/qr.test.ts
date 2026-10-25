import assert from "node:assert/strict";
import { test } from "node:test";
import { ALFABETO_TOKEN, LONGITUD_TOKEN, esTokenValido, generarTokenQr, planRegeneracion, qrActivo, qrVigentePorToken, type RegistroQr } from "./qr";

test("R27 · el token tiene 32 caracteres base62 y no se repite en 5000 generaciones", () => {
  const vistos = new Set<string>();
  for (let i = 0; i < 5000; i++) {
    const t = generarTokenQr();
    assert.equal(t.length, LONGITUD_TOKEN);
    assert.ok([...t].every((c) => ALFABETO_TOKEN.includes(c)));
    vistos.add(t);
  }
  assert.equal(vistos.size, 5000);
});

test("R27 · muestreo sin sesgo: se descartan los bytes ≥ 248 y se vuelve a pedir", () => {
  let llamadas = 0;
  const t = generarTokenQr(() => (llamadas++ === 0 ? new Uint8Array(32).fill(255) : new Uint8Array(32).fill(0)));
  assert.equal(llamadas, 2);
  assert.equal(t, "A".repeat(32));
});

test("R27 · el token es sensible a mayúsculas (E6): «abc» y «ABC» son distintos", () => {
  const qrs: RegistroQr[] = [{ idCodigoQr: 1, idCasoExtravio: 1, tokenPublico: "A".repeat(31) + "b", fechaGeneracion: "x", fechaInvalidacion: null }];
  assert.ok(qrVigentePorToken(qrs, "A".repeat(31) + "b"));
  assert.equal(qrVigentePorToken(qrs, "A".repeat(31) + "B"), undefined);
  assert.equal(esTokenValido("corto"), false);
});

test("R7 · la regeneración invalida el anterior y deja un solo QR activo por caso", () => {
  const qrs: RegistroQr[] = [{ idCodigoQr: 1, idCasoExtravio: 7, tokenPublico: "A".repeat(32), fechaGeneracion: "t0", fechaInvalidacion: null }];
  const plan = planRegeneracion(qrs, 7, "t1");
  assert.deepEqual(plan.invalidar, [1]);
  assert.notEqual(plan.nuevo.tokenPublico, "A".repeat(32));
  assert.equal(plan.nuevo.fechaInvalidacion, null);
  // Aplicado el plan, solo el nuevo está activo y el viejo ya no es vigente.
  const despues: RegistroQr[] = [{ ...qrs[0], fechaInvalidacion: "t1" }, { ...plan.nuevo, idCodigoQr: 2 }];
  assert.equal(qrActivo(despues, 7)?.idCodigoQr, 2);
  assert.equal(qrVigentePorToken(despues, "A".repeat(32)), undefined);
});

test("R7 · rechazo de coincidencia: si el token generado ya existe, se genera otro", () => {
  const qrs: RegistroQr[] = [{ idCodigoQr: 1, idCasoExtravio: 1, tokenPublico: "A".repeat(32), fechaGeneracion: "t0", fechaInvalidacion: "t0" }];
  const tokens = ["A".repeat(32), "B".repeat(32)];
  assert.equal(planRegeneracion(qrs, 1, "t1", () => tokens.shift()!).nuevo.tokenPublico, "B".repeat(32));
});
