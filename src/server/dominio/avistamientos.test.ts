import assert from "node:assert/strict";
import { test } from "node:test";
import { alcaldiaDeCoordenadas } from "../../mocks/geografia";
import { ALCALDIAS } from "../../mocks/tipos";
import { DESPLAZAMIENTO_MAXIMO, fechaHoraDeCDMX, ubicacionSimulada } from "./avistamientos";

test("ubicación simulada · las 16 alcaldías con 250 direcciones cada una: el punto SIEMPRE cae dentro de la alcaldía elegida y cerca de su centro", () => {
  let total = 0;
  for (const alcaldia of ALCALDIAS) {
    for (let i = 0; i < 250; i++) {
      const direccion = i % 5 === 0 ? `Calle ${i} esq. Eje ${i * 7}` : `${["Avenida", "Calle", "Cerrada", "Privada", "Calzada"][i % 5]} ${["Reservada", "Del Sol", "Norte", "Oriente", "Los Pinos"][(i * 3) % 5]} ${i * 13 + 1}, ${"x".repeat(i % 9)}`;
      const p = ubicacionSimulada(alcaldia, direccion);
      assert.equal(alcaldiaDeCoordenadas(p), alcaldia, `${alcaldia} · «${direccion}» cayó en ${alcaldiaDeCoordenadas(p)}`);
      assert.ok(Number.isFinite(p.latitud) && Number.isFinite(p.longitud) && p.latitud >= 19 && p.latitud <= 19.6 && p.longitud >= -99.4 && p.longitud <= -98.9);
      total++;
    }
  }
  assert.equal(total, 16 * 250);
});

test("ubicación simulada · es determinista (misma alcaldía y dirección, mismo punto, sin importar mayúsculas, acentos ni espacios) y el desplazamiento está acotado", () => {
  const a = ubicacionSimulada("Coyoacán", "Avenida Universidad 1000");
  assert.deepEqual(ubicacionSimulada("Coyoacán", "  avenida   UNIVERSIDAD 1000 "), a);
  assert.deepEqual(ubicacionSimulada("Coyoacán", "Avenida Universidad 1000"), a);
  assert.notDeepEqual(ubicacionSimulada("Coyoacán", "Avenida Universidad 1001"), a);
  assert.notDeepEqual(ubicacionSimulada("Tlalpan", "Avenida Universidad 1000"), a);
  const [m, n] = [ubicacionSimulada("Iztapalapa", "uno"), ubicacionSimulada("Iztapalapa", "dos")];
  assert.ok(Math.abs(m.latitud - n.latitud) <= 2 * DESPLAZAMIENTO_MAXIMO + 1e-9 && Math.abs(m.longitud - n.longitud) <= 2 * DESPLAZAMIENTO_MAXIMO + 1e-9);
});

test("fecha y hora de la Ciudad de México (UTC−6) a UTC; fechas imposibles se rechazan", () => {
  assert.equal(fechaHoraDeCDMX("2026-10-17", "10:00"), "2026-10-17T16:00:00Z");
  assert.equal(fechaHoraDeCDMX("2026-10-17", "20:30"), "2026-10-18T02:30:00Z");
  for (const [f, h] of [["2026-02-30", "10:00"], ["2026-13-01", "10:00"], ["2026-10-17", "24:00"], ["2026-10-17", "10:60"], ["17/10/2026", "10:00"], ["2026-10-17", "9:00"], ["", ""]]) assert.equal(fechaHoraDeCDMX(f, h), undefined, `${f} ${h}`);
});
