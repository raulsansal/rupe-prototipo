import assert from "node:assert/strict";
import { test } from "node:test";
import { aplicarFiltros, diaCDMX, validarFiltros } from "./filtrosAvistamientos";

const ALCALDIAS = Array.from({ length: 17 }, (_, i) => ({ idAlcaldia: i + 1 })); // 17 = «Fuera de la Ciudad de México»
const REGISTRO = "2026-10-04T13:30:00Z"; // 4 de octubre en la Ciudad de México
const v = (entrada: Record<string, unknown>) => validarFiltros(entrada, { fechaRegistro: REGISTRO, alcaldias: ALCALDIAS });

test("HU 041 · el día se cuenta en la Ciudad de México (UTC−6)", () => {
  assert.equal(diaCDMX("2026-10-07T01:10:00Z"), "2026-10-06");
  assert.equal(diaCDMX("2026-10-07T06:00:00Z"), "2026-10-07");
  assert.equal(diaCDMX("2026-10-07T05:59:59Z"), "2026-10-06");
});

test("HU 041 · filtros opcionales y combinables: sin nada, solo fechas, solo alcaldía y todo junto, incluida «Fuera de la Ciudad de México» (17)", () => {
  assert.deepEqual(v({}), { filtros: {}, errores: {} });
  assert.deepEqual(v({ desde: "2026-10-05" }).filtros, { desde: "2026-10-05" });
  assert.deepEqual(v({ hasta: "2026-10-08" }).filtros, { hasta: "2026-10-08" });
  assert.deepEqual(v({ alcaldia: "9" }).filtros, { alcaldia: 9 });
  assert.deepEqual(v({ alcaldia: "17" }).filtros, { alcaldia: 17 });
  assert.deepEqual(v({ desde: "2026-10-04", hasta: "2026-10-04", alcaldia: "6" }), { filtros: { desde: "2026-10-04", hasta: "2026-10-04", alcaldia: 6 }, errores: {} });
  assert.deepEqual(v({ desde: "", hasta: "  ", alcaldia: "" }), { filtros: {}, errores: {} }, "los campos vacíos no filtran");
});

test("HU 041 · el rango no puede ser anterior a la fecha de registro del caso (el día del registro SÍ vale)", () => {
  assert.equal(v({ desde: "2026-10-03" }).errores.desde, "El rango de fechas no puede ser anterior a la fecha de registro del caso.");
  assert.equal(v({ hasta: "2026-10-03" }).errores.hasta, "El rango de fechas no puede ser anterior a la fecha de registro del caso.");
  assert.deepEqual(v({ desde: "2026-10-04" }).errores, {});
  assert.deepEqual(v({ desde: "2026-10-03", hasta: "2026-10-06" }).filtros, { hasta: "2026-10-06" }, "el campo inválido no se aplica");
});

test("HU 041 · «hasta» no puede ser anterior a «desde»; fechas imposibles, mal formadas o de otro tipo se rechazan", () => {
  assert.equal(v({ desde: "2026-10-08", hasta: "2026-10-06" }).errores.hasta, "La fecha final no puede ser anterior a la inicial.");
  for (const mala of ["2026-02-30", "2026-13-01", "10/10/2026", "2026-1-1", "hoy", "2026-10-05T10:00", "<b>", "2026-10-05'"]) {
    assert.equal(v({ desde: mala }).errores.desde, "Elige una fecha válida.", mala);
    assert.equal(v({ hasta: mala }).errores.hasta, "Elige una fecha válida.", mala);
  }
  for (const rara of [5, true, {}, ["2026-10-05"]]) assert.ok(v({ desde: rara }).errores.desde, `tipo ${typeof rara}`);
});

test("HU 041 · la alcaldía debe ser del catálogo (id numérico entero, existente); lo demás da error", () => {
  for (const mala of ["0", "18", "-1", "1.5", "abc", "1;2", "99999", " 6x", "٣"]) assert.equal(v({ alcaldia: mala }).errores.alcaldia, "Elige una alcaldía de la lista.", mala);
  assert.ok(v({ alcaldia: 6 }).errores.alcaldia, "un número (no texto) tampoco es lo que manda la URL");
});

test("HU 041 · aplicarFiltros: fecha del AVISTAMIENTO en día CDMX (ambos extremos incluidos), alcaldía y combinaciones", () => {
  const items = [
    { id: 1, fechaHora: "2026-10-05T16:20:00Z", idAlcaldia: 9 }, { id: 2, fechaHora: "2026-10-07T01:10:00Z", idAlcaldia: 9 }, // este día CDMX es el 6
    { id: 3, fechaHora: "2026-10-08T13:35:00Z", idAlcaldia: 6 }, { id: 4, fechaHora: "2026-10-09T10:00:00Z", idAlcaldia: 17 },
  ];
  const ids = (f: Parameters<typeof aplicarFiltros>[1]) => aplicarFiltros(items, f).map((x) => x.id);
  assert.deepEqual(ids({}), [1, 2, 3, 4]);
  assert.deepEqual(ids({ desde: "2026-10-06" }), [2, 3, 4]);
  assert.deepEqual(ids({ hasta: "2026-10-06" }), [1, 2]);
  assert.deepEqual(ids({ desde: "2026-10-06", hasta: "2026-10-06" }), [2], "el avistamiento de las 01:10Z cae el día 6 de la Ciudad de México");
  assert.deepEqual(ids({ alcaldia: 9 }), [1, 2]);
  assert.deepEqual(ids({ alcaldia: 17 }), [4], "Fuera de la Ciudad de México");
  assert.deepEqual(ids({ desde: "2026-10-05", hasta: "2026-10-08", alcaldia: 6 }), [3]);
  assert.deepEqual(ids({ desde: "2026-11-01" }), []);
});
