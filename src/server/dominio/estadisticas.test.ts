import assert from "node:assert/strict";
import { test } from "node:test";
import { calcularTablero, erroresDePeriodo, generarReporte, periodoPredeterminado, validarFiltrosDeReporte, type HechoAvistamiento, type HechoCaso, type Hechos } from "./estadisticas";

const caso = (clave: string, extra: Partial<HechoCaso> = {}): HechoCaso => ({ clave, cuenta: true, dia: "2026-10-10", idAlcaldia: 4, idCategoriaMotivo: 1, estado: "En búsqueda", ...extra });
const av = (claveCaso: string, extra: Partial<HechoAvistamiento> = {}): HechoAvistamiento => ({ dia: "2026-10-10", idAlcaldia: 6, idsEstadoAnimal: [1, 7], visible: true, claveCaso, ...extra });
const P = { desde: "2026-10-01", hasta: "2026-10-31" };
const F = { desde: "2026-10-01", hasta: "2026-10-31" };

test("periodo predeterminado · 1 de octubre de 2026 hasta hoy; si hoy es anterior, desde = hoy", () => {
  assert.deepEqual(periodoPredeterminado("2026-10-30"), { desde: "2026-10-01", hasta: "2026-10-30" });
  assert.deepEqual(periodoPredeterminado("2026-12-31"), { desde: "2026-10-01", hasta: "2026-12-31" });
  assert.deepEqual(periodoPredeterminado("2026-09-20"), { desde: "2026-09-20", hasta: "2026-09-20" });
});

test("periodo del tablero · fechas reales, Desde ≤ Hasta, sin pasar de hoy ni antes del 1 de junio de 2026", () => {
  const hoy = "2026-10-30";
  assert.deepEqual(erroresDePeriodo({ desde: "2026-10-01", hasta: "2026-10-30" }, hoy), {});
  assert.ok(erroresDePeriodo({ desde: "2026-02-30", hasta: "2026-10-30" }, hoy).desde);
  assert.ok(erroresDePeriodo({ desde: "2026-10-01", hasta: "ayer" }, hoy).hasta);
  assert.match(erroresDePeriodo({ desde: "2026-10-10", hasta: "2026-10-01" }, hoy).hasta!, /posterior/);
  assert.match(erroresDePeriodo({ desde: "2026-10-01", hasta: "2026-10-31" }, hoy).hasta!, /después de hoy/);
  assert.match(erroresDePeriodo({ desde: "2026-05-31", hasta: "2026-10-01" }, hoy).desde!, /1 de junio/);
});

test("filtros del reporte · rango obligatorio; alcaldía, categoría y estado opcionales y validados contra el catálogo", () => {
  const validas = { alcaldias: new Set([1, 2, 4]), categorias: new Set([1, 2]) };
  const vacio = { alcaldia: "", categoria: "", estadoCaso: "" };
  assert.deepEqual(validarFiltrosDeReporte({ desde: "", hasta: "", ...vacio }, validas).errores, { desde: "El rango de fechas es obligatorio: indica «Desde».", hasta: "El rango de fechas es obligatorio: indica «Hasta»." });
  assert.deepEqual(validarFiltrosDeReporte({ ...F, alcaldia: "4", categoria: "2", estadoCaso: "Localizado" }, validas).filtros, { ...F, idAlcaldia: 4, idCategoria: 2, estadoCaso: "Localizado" });
  const malos = validarFiltrosDeReporte({ ...F, alcaldia: "17", categoria: "x", estadoCaso: "Otro" }, validas);
  assert.equal(malos.filtros, undefined);
  assert.deepEqual(Object.keys(malos.errores), ["alcaldia", "categoria", "estadoCaso"]);
  assert.ok(validarFiltrosDeReporte({ desde: "2026-10-10", hasta: "2026-10-01", ...vacio }, validas).errores.hasta);
});

test("tablero · un caso sembrado (cuenta: false) no suma como caso, pero un avistamiento de él sí cuenta; los ocultos van aparte", () => {
  const h: Hechos = { casos: [caso("a"), caso("s1", { cuenta: false })], avistamientos: [av("a"), av("s1"), av("s1", { visible: false })] };
  const t = calcularTablero(h, P);
  assert.deepEqual([t.totalCasos, t.casosActivos, t.totalAvistamientos, t.avistamientosOcultos], [1, 1, 2, 1]);
  assert.deepEqual(t.porEstadoAnimal, { 1: 2, 7: 2 });
});

test("tablero · los cierres cuentan por la fecha del movimiento aunque el caso sea de otro periodo; localizados = Localizado o cierre confirmado", () => {
  const h: Hechos = {
    casos: [caso("a", { dia: "2026-09-20", estado: "Cerrado", cierre: { tipo: "Cancelación", dia: "2026-10-05" } }), caso("b", { estado: "Cerrado", cierre: { tipo: "Cierre confirmado", dia: "2026-10-12" }, diasALocalizar: 4 }), caso("c", { estado: "Localizado", diasALocalizar: 2 })],
    avistamientos: [],
  };
  const t = calcularTablero(h, P);
  assert.deepEqual(t.cierres, { "Cierre confirmado": 1, Cancelación: 1, Deshabilitación: 0 });
  assert.deepEqual([t.totalCasos, t.casosLocalizados, t.promedioLocalizacion, t.casosActivos], [2, 2, 3, 0]);
  assert.equal(calcularTablero(h, { desde: "2026-10-06", hasta: "2026-10-31" }).cierres.Cancelación, 0);
  assert.equal(calcularTablero({ casos: [], avistamientos: [] }, P).promedioLocalizacion, null);
});

test("reporte · tasa = localizados / total sin cancelados ni deshabilitados; null si todos son cancelados; null sin casos que cuenten", () => {
  const c = (clave: string, extra: Partial<HechoCaso>) => caso(clave, extra);
  const h: Hechos = {
    casos: [c("a", { estado: "Localizado" }), c("b", { estado: "Cerrado", cierre: { tipo: "Cierre confirmado", dia: "2026-10-12" } }), c("d", {}), c("e", { estado: "Cerrado", cierre: { tipo: "Cancelación", dia: "2026-10-12" } }), c("f", { estado: "Cerrado", cierre: { tipo: "Deshabilitación", dia: "2026-10-12" } })],
    avistamientos: [],
  };
  const r = generarReporte(h, F)!;
  assert.deepEqual([r.totalCasos, r.casosLocalizados, r.tasaRecuperacion], [5, 2, 66.7]); // 2 / 3
  assert.equal(generarReporte({ casos: [h.casos[3]], avistamientos: [] }, F)!.tasaRecuperacion, null);
  assert.equal(generarReporte({ casos: [caso("s", { cuenta: false })], avistamientos: [av("s")] }, F), null);
  assert.equal(generarReporte(h, { ...F, idAlcaldia: 99 }), null);
});
