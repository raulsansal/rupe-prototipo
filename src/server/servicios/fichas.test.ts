import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp, cuerpoDeError } from "../errores";
import { nuevoContexto } from "../pruebas/auxiliares";
import { abrirReporteAvistamiento, consultarEstatusPorFolio, consultarFichaPorFolio, consultarFichaPorToken, regenerarQr } from "./fichas";

const BUSQUEDA = "RUPE-K7M4XQ9T"; // Max, En búsqueda
const LOCALIZADO = "RUPE-C2J9RK6Z"; // Lola, Localizado (estuvo deshabilitada y se restauró)
const DESHABILITADO = "RUPE-D5W2QK8X"; // Kira
const CANCELADO = "RUPE-F7L3MN6Y"; // Simba
const DUENA = { idUsuario: 2, rol: "Tutor" as const, nombre: "Rosa" }; // dueña de los casos de CASOS_ORIGEN (R32)
const rechaza = (p: Promise<unknown>, estado: number, codigo?: string) => assert.rejects(p, (e) => e instanceof ErrorApp && e.estado === estado && (!codigo || e.codigo === codigo));


test("R26 · la ficha por folio no distingue mayúsculas y trae el estado actual", async () => {
  const { ctx } = nuevoContexto();
  const ficha = await consultarFichaPorFolio(BUSQUEDA.toLowerCase(), ctx);
  assert.equal(ficha.folio, BUSQUEDA);
  assert.equal(ficha.estado, "En búsqueda");
  assert.equal((await consultarFichaPorFolio(LOCALIZADO, ctx)).estado, "Localizado"); // Localizado sí tiene ficha (HU 024)
});

test("R33 · inexistente, cancelado y deshabilitado responden 404 idénticos (mismo código y mismo cuerpo)", async () => {
  const { ctx } = nuevoContexto();
  const cuerpos: string[] = [];
  for (const folio of ["RUPE-ZZZZZZZZ", CANCELADO, DESHABILITADO]) {
    await assert.rejects(consultarFichaPorFolio(folio, ctx), (e) => {
      assert.ok(e instanceof ErrorApp && e.estado === 404);
      cuerpos.push(JSON.stringify(cuerpoDeError(e)));
      return true;
    });
    await rechaza(consultarEstatusPorFolio(folio, ctx), 404);
  }
  assert.equal(new Set(cuerpos).size, 1);
});

test("R33/HU 038 · un caso cerrado por cierre confirmado: sin ficha (404) pero con consulta de estatus «Cerrado»", async () => {
  const { ctx } = nuevoContexto();
  const caso = (await ctx.repos.casos.porFolio(LOCALIZADO))!;
  await ctx.repos.historial.agregar({ idCasoExtravio: caso.idCasoExtravio, fechaHora: "2026-10-01T12:00:00Z", tipoMovimiento: "cierre confirmado", idEstadoCaso: 6, idUsuario: 2 });
  await rechaza(consultarFichaPorFolio(LOCALIZADO, ctx), 404);
  const estatus = await consultarEstatusPorFolio(LOCALIZADO, ctx);
  assert.equal(estatus.estado, "Cerrado");
  assert.equal(estatus.fechaCambioEstado, "2026-10-01T12:00:00Z");
});

test("R27 · la ficha por token exige un token vigente y sensible a mayúsculas", async () => {
  const { ctx } = nuevoContexto();
  const caso = (await ctx.repos.casos.porFolio(BUSQUEDA))!;
  const token = (await ctx.repos.qr.activoDe(caso.idCasoExtravio))!.tokenPublico;
  assert.equal((await consultarFichaPorToken(token, ctx)).folio, BUSQUEDA);
  await rechaza(consultarFichaPorToken(token.toLowerCase(), ctx), 404);
});

test("R7/R27 · regenerar el QR invalida el anterior: deja de abrir la ficha y el reporte", async () => {
  const { ctx } = nuevoContexto();
  const caso = (await ctx.repos.casos.porFolio(BUSQUEDA))!;
  const viejo = (await ctx.repos.qr.activoDe(caso.idCasoExtravio))!.tokenPublico;
  const nuevo = await regenerarQr(DUENA, caso.idCasoExtravio, ctx);
  assert.notEqual(nuevo.tokenPublico, viejo);
  assert.equal((await ctx.repos.qr.deCaso(caso.idCasoExtravio)).filter((q) => q.fechaInvalidacion === null).length, 1);
  await rechaza(consultarFichaPorToken(viejo, ctx), 404);
  await rechaza(abrirReporteAvistamiento({ canal: "qr", token: viejo }, ctx), 404, "QR_NO_VIGENTE");
  assert.equal((await abrirReporteAvistamiento({ canal: "qr", token: nuevo.tokenPublico }, ctx)).folio, BUSQUEDA);
  assert.equal((await consultarFichaPorFolio(BUSQUEDA, ctx)).folio, BUSQUEDA); // el folio no cambia
});

test("HU 028/R13 · canal «folio»: se acepta un caso activo; Localizado (409) y deshabilitado o cancelado (404) se rechazan", async () => {
  const { ctx } = nuevoContexto();
  assert.equal((await abrirReporteAvistamiento({ canal: "folio", folio: BUSQUEDA.toLowerCase() }, ctx)).folio, BUSQUEDA);
  await rechaza(abrirReporteAvistamiento({ canal: "folio", folio: LOCALIZADO }, ctx), 409, "CASO_NO_ADMITE_AVISTAMIENTOS");
  await rechaza(abrirReporteAvistamiento({ canal: "folio", folio: DESHABILITADO }, ctx), 404);
  await rechaza(abrirReporteAvistamiento({ canal: "folio", folio: CANCELADO }, ctx), 404);
  await rechaza(abrirReporteAvistamiento({ canal: "folio", folio: "RUPE-ZZZZZZZZ" }, ctx), 404);
});

test("HU 028/R27 · canal «qr»: con token vigente se acepta; con un token que no existe se rechaza", async () => {
  const { ctx } = nuevoContexto();
  const caso = (await ctx.repos.casos.porFolio(BUSQUEDA))!;
  const token = (await ctx.repos.qr.activoDe(caso.idCasoExtravio))!.tokenPublico;
  assert.equal((await abrirReporteAvistamiento({ canal: "qr", token }, ctx)).folio, BUSQUEDA);
  await rechaza(abrirReporteAvistamiento({ canal: "qr", token: "x".repeat(32) }, ctx), 404, "QR_NO_VIGENTE");
  const lola = (await ctx.repos.casos.porFolio(LOCALIZADO))!;
  await rechaza(abrirReporteAvistamiento({ canal: "qr", token: (await ctx.repos.qr.activoDe(lola.idCasoExtravio))!.tokenPublico }, ctx), 409); // QR vigente de un caso Localizado: R13
});

test("R32 · regenerar el QR aplica su propia guarda: 401 sin sesión, 404 a otra tutora, 403 al Administrador, y funciona para la dueña", async () => {
  const { ctx } = nuevoContexto();
  const caso = (await ctx.repos.casos.porFolio(BUSQUEDA))!; // dueña: Rosa (id 2)
  const antes = (await ctx.repos.qr.activoDe(caso.idCasoExtravio))!.tokenPublico;
  await rechaza(regenerarQr(undefined, caso.idCasoExtravio, ctx), 401);
  await rechaza(regenerarQr({ idUsuario: 5, rol: "Tutor", nombre: "Luis" }, caso.idCasoExtravio, ctx), 404);
  await rechaza(regenerarQr({ idUsuario: 1, rol: "Administrador", nombre: "Ricardo" }, caso.idCasoExtravio, ctx), 403);
  await rechaza(regenerarQr(DUENA, 9999, ctx), 404);
  assert.equal((await ctx.repos.qr.activoDe(caso.idCasoExtravio))!.tokenPublico, antes); // nada cambió con los rechazos
  assert.notEqual((await regenerarQr(DUENA, caso.idCasoExtravio, ctx)).tokenPublico, antes);
});
