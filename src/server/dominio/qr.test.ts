import assert from "node:assert/strict";
import { test } from "node:test";
import { ALFABETO_TOKEN, LONGITUD_TOKEN, esTokenValido, generarTokenQr, igualesEnTiempoConstante, planRegeneracion, qrActivo, qrPorToken, qrVigentePorToken, type RegistroQr } from "./qr";

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

test("R27 · mapeo exacto sin sesgo: los 248 bytes aceptados (0 a 247) dan cada uno de los 62 símbolos exactamente 4 veces (prueba determinista)", () => {
  const cuentas = new Map<string, number>();
  for (let b = 0; b < 248; b++) cuentas.set(ALFABETO_TOKEN[b % 62], (cuentas.get(ALFABETO_TOKEN[b % 62]) ?? 0) + 1);
  assert.equal(cuentas.size, 62);
  assert.ok([...cuentas.values()].every((n) => n === 4));
  // El generador con una fuente inyectada: bytes 0..247 en orden → los primeros 32 símbolos del alfabeto; los bytes ≥ 248 nunca producen símbolo.
  let siguiente = 0;
  const token = generarTokenQr((n) => Uint8Array.from({ length: n }, () => siguiente++ % 256));
  assert.equal(token, [...ALFABETO_TOKEN].slice(0, 32).join(""));
  assert.equal(generarTokenQr(() => Uint8Array.from([255, 254, 253, 252, 251, 250, 249, 248, ...new Array(24).fill(61), ...new Array(32).fill(0)])), "A".repeat(0) + ALFABETO_TOKEN[61].repeat(24) + ALFABETO_TOKEN[0].repeat(8));
});

test("R27 · vigencia: solo el token del QR activo es vigente; el invalidado y el de otra capitalización no", () => {
  const qrs = [
    { idCodigoQr: 1, idCasoExtravio: 7, tokenPublico: "aB3".padEnd(32, "x"), fechaGeneracion: "2026-10-01T10:00:00Z", fechaInvalidacion: "2026-10-05T10:00:00Z" },
    { idCodigoQr: 2, idCasoExtravio: 7, tokenPublico: "Zq9".padEnd(32, "y"), fechaGeneracion: "2026-10-05T10:00:00Z", fechaInvalidacion: null },
  ];
  assert.equal(qrVigentePorToken(qrs, "Zq9".padEnd(32, "y"))?.idCodigoQr, 2);
  assert.equal(qrVigentePorToken(qrs, "aB3".padEnd(32, "x")), undefined, "el invalidado ya no es vigente");
  assert.equal(qrVigentePorToken(qrs, "zq9".padEnd(32, "y")), undefined, "E6: distingue mayúsculas");
  assert.equal(qrVigentePorToken(qrs, "no-existe"), undefined);
  assert.ok(qrs[0].fechaInvalidacion! >= qrs[0].fechaGeneracion, "invalidación ≥ generación");
});

test("R27 · la búsqueda por token recorre TODOS los códigos (tiempo constante: sin cortar en la primera coincidencia) y distingue mayúsculas", () => {
  let lecturas = 0;
  const tokens = ["A".repeat(32), "B".repeat(32), "C".repeat(32), "D".repeat(32)];
  const qrs = tokens.map((t, i) => ({ idCodigoQr: i, idCasoExtravio: 1, fechaGeneracion: "x", fechaInvalidacion: i === 3 ? null : "y", get tokenPublico() { lecturas++; return t; } }));
  for (const [buscado, esperado] of [[tokens[0], 0], [tokens[3], 3], ["a".repeat(32), undefined], ["Z".repeat(32), undefined]] as const) {
    lecturas = 0;
    assert.equal(qrPorToken(qrs, buscado)?.idCodigoQr, esperado);
    assert.equal(lecturas, qrs.length, `se comparó con ${lecturas} de ${qrs.length} códigos`);
  }
  lecturas = 0;
  for (const malo of ["", "corto", "A".repeat(31), "A".repeat(33), `${"A".repeat(31)}-`, `${"A".repeat(31)} `, `${"A".repeat(30)}ñ1`, undefined as unknown as string, 5 as unknown as string]) assert.equal(qrPorToken(qrs, malo), undefined);
  assert.equal(lecturas, 0, "un formato inválido ni siquiera se compara");
  assert.equal(igualesEnTiempoConstante("abc", "abc"), true);
  assert.equal(igualesEnTiempoConstante("abc", "abd"), false);
  assert.equal(igualesEnTiempoConstante("abc", "abcd"), false);
});
