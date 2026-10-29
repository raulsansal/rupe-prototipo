import assert from "node:assert/strict";
import { test } from "node:test";
import { CASOS_ORIGEN } from "../../mocks/casos";
import { BITACORA } from "../../mocks/bitacora";
import { CASOS_MODERACION, AVISTAMIENTOS_MODERACION } from "../../mocks/moderacion";
import { calcularTablero, PERIODO_PREDETERMINADO } from "../../mocks/tablero";
import { generarReporte } from "../../lib/reportes";
import { PATRON_FOLIO } from "../../mocks/tipos";
import { almacenVacio } from "../memoria/almacen";
import { crearRepositorios } from "../memoria/repos";
import { nuevoContexto } from "../pruebas/auxiliares";
import { sembrar } from "./seed";
import { estadoActual } from "../dominio/transiciones";
import { historialDe } from "../servicios/contexto";

test("seed · los casos, folios, QR, avistamientos y bitácora del maquetado existen y son coherentes", async () => {
  const { ctx, almacen } = nuevoContexto();
  assert.equal(almacen.casos.length, CASOS_MODERACION.length);
  assert.ok(almacen.casos.every((c) => PATRON_FOLIO.test(c.folio)));
  assert.equal(new Set(almacen.casos.map((c) => c.folio)).size, almacen.casos.length);
  // Todo caso tiene QR vigente (uno solo) con token único; los de CASOS_ORIGEN conservan el token del maquetado.
  for (const c of almacen.casos) assert.equal(almacen.qr.filter((q) => q.idCasoExtravio === c.idCasoExtravio && q.fechaInvalidacion === null).length, 1);
  assert.equal(new Set(almacen.qr.map((q) => q.tokenPublico)).size, almacen.qr.length);
  for (const o of CASOS_ORIGEN) assert.equal((await ctx.repos.qr.activoDe((await ctx.repos.casos.porFolio(o.folio))!.idCasoExtravio))!.tokenPublico, o.tokenPublico);
  // E1: el estado del caso repite el último movimiento; el historial tiene consecutivos 1..n.
  for (const c of almacen.casos) {
    const h = await historialDe(ctx.repos, c.idCasoExtravio);
    assert.deepEqual(h.map((m) => m.consecutivo), h.map((_, i) => i + 1));
    assert.equal(almacen.estadosCaso.find((e) => e.idEstadoCaso === c.idEstadoCaso)!.nombre, estadoActual(h));
    assert.equal(estadoActual(h), CASOS_MODERACION.find((m) => m.folio === c.folio)!.estado);
  }
  assert.equal(almacen.avistamientos.length, AVISTAMIENTOS_MODERACION.length);
  assert.equal(almacen.avistamientos.filter((a) => !a.visible).length, AVISTAMIENTOS_MODERACION.filter((a) => !a.visible).length);
  assert.ok(almacen.avistamientos.filter((a) => !a.visible).every((a) => a.motivoModeracion)); // CHECK del diccionario
  assert.ok(almacen.avistamientos.every((a) => almacen.avistamientoEstados.some((e) => e.idAvistamiento === a.idAvistamiento)));
  assert.equal(almacen.bitacora.length, BITACORA.length + 5, "las del maqueta más las 5 reactivaciones de catálogo sembradas en P6a");
  assert.deepEqual([almacen.alcaldias.length, almacen.razas.length, almacen.motivos.length, almacen.estadosAnimal.length, almacen.estadosCaso.length, almacen.usuarios.length], [17, 14, 15, 17, 6, 12]);
  assert.deepEqual(almacen.parametros.map((p) => [p.clave, p.valor]), [["version_aviso_privacidad", "1.0"], ["expiracion_token_minutos", "60"], ["tamano_maximo_archivo_mb", "4"]]);
  // Cada perro tiene dueña o dueño con rol Tutor y una fotografía única (R1).
  assert.ok(almacen.perros.every((p) => almacen.usuarios.find((u) => u.idUsuario === p.idUsuario)!.rol === "Tutor"));
  assert.equal(new Set(almacen.perros.map((p) => p.idFotografia)).size, almacen.perros.length);
});

test("seed · las cifras del tablero y de Reportes (que salen de src/mocks) no cambian por sembrar el almacén", () => {
  nuevoContexto();
  const t = calcularTablero(PERIODO_PREDETERMINADO);
  assert.deepEqual([t.totalCasos, t.casosActivos, t.casosLocalizados, t.totalAvistamientos, t.avistamientosOcultos], [163, 141, 19, 199, 6]);
  const r = generarReporte({ desde: PERIODO_PREDETERMINADO.desde, hasta: PERIODO_PREDETERMINADO.hasta, alcaldia: "", categoria: "", estadoCaso: "" })!;
  assert.deepEqual([r.totalCasos, r.casosLocalizados], [163, 19]);
});

test("seed · sembrar dos veces da lo mismo (reiniciar deja los datos ficticios iniciales, incluidos los casos con QR vigente)", async () => {
  const a = crearRepositorios(() => sembrar(almacenVacio(), {}));
  const b = crearRepositorios(() => sembrar(almacenVacio(), {}));
  assert.deepEqual((await a.casos.todos()).map((c) => c.folio), (await b.casos.todos()).map((c) => c.folio));
  const f = (await a.casos.porFolio("rupe-k7m4xq9t"))!; // R26: sin distinguir mayúsculas
  assert.equal((await a.qr.activoDe(f.idCasoExtravio))!.tokenPublico, (await b.qr.activoDe(f.idCasoExtravio))!.tokenPublico);
});
