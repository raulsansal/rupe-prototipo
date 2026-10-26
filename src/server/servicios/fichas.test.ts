import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp, cuerpoDeError } from "../errores";
import { AHORA, nuevoContexto } from "../pruebas/auxiliares";
import { abrirReporteAvistamiento, consultarEstatusPorFolio, consultarFichaPorFolio, consultarFichaPorToken, regenerarQr, registrarAvistamiento, type DatosAvistamiento } from "./fichas";

const BUSQUEDA = "RUPE-K7M4XQ9T"; // Max, En búsqueda
const LOCALIZADO = "RUPE-C2J9RK6Z"; // Lola, Localizado (estuvo deshabilitada y se restauró)
const DESHABILITADO = "RUPE-D5W2QK8X"; // Kira
const CANCELADO = "RUPE-F7L3MN6Y"; // Simba
const DUENA = { idUsuario: 2, rol: "Tutor" as const, nombre: "Rosa" }; // dueña de los casos de CASOS_ORIGEN (R32)
const rechaza = (p: Promise<unknown>, estado: number, codigo?: string) => assert.rejects(p, (e) => e instanceof ErrorApp && e.estado === estado && (!codigo || e.codigo === codigo));

const datos = (extra: Partial<DatosAvistamiento> = {}): DatosAvistamiento => ({ fechaHoraAvistamiento: "2026-10-18T10:00:00Z", latitud: 19.43, longitud: -99.13, idAlcaldia: 6, estadosAnimal: [1, 7], fotografia: { formato: "JPG", tamanoBytes: 50_000, referenciaArchivo: "/mocks/x.svg" }, ...extra });

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

test("R27 · si el QR se regenera ENTRE abrir y registrar, el registro por «qr» se rechaza; por «folio» sigue siendo válido", async () => {
  const { ctx } = nuevoContexto();
  const caso = (await ctx.repos.casos.porFolio(BUSQUEDA))!;
  const token = (await ctx.repos.qr.activoDe(caso.idCasoExtravio))!.tokenPublico;
  await abrirReporteAvistamiento({ canal: "qr", token }, ctx); // paso 1: se abre el reporte
  await regenerarQr(DUENA, caso.idCasoExtravio, ctx); // la persona tutora regenera el QR
  await rechaza(registrarAvistamiento({ canal: "qr", token }, datos(), ctx), 404, "QR_NO_VIGENTE"); // paso 2: se rechaza
  assert.equal((await ctx.repos.avistamientos.deCaso(caso.idCasoExtravio)).length, 0);
  assert.equal((await registrarAvistamiento({ canal: "folio", folio: BUSQUEDA }, datos(), ctx)).folio, BUSQUEDA);
});

test("R12/R25/R35 · registrar un avistamiento: queda guardado con sus estados, mueve el caso a «Avistamiento reportado» y notifica", async () => {
  const { ctx } = nuevoContexto();
  const caso = (await ctx.repos.casos.porFolio(BUSQUEDA))!;
  const antes = (await ctx.repos.historial.deCaso(caso.idCasoExtravio)).length;
  const conf = await registrarAvistamiento({ canal: "folio", folio: BUSQUEDA }, datos({ comentario: "  <b>Se ve bien</b>\u0007 " }), ctx);
  assert.equal(conf.fechaHoraEnvio, AHORA.toISOString());
  const [av] = await ctx.repos.avistamientos.deCaso(caso.idCasoExtravio);
  assert.equal(av.comentario, "Se ve bien"); // R34: saneado
  assert.deepEqual((await ctx.repos.avistamientos.estadosDe(av.idAvistamiento)).sort(), [1, 7]);
  const historial = await ctx.repos.historial.deCaso(caso.idCasoExtravio);
  assert.equal(historial.length, antes + 1);
  assert.equal(historial.at(-1)!.consecutivo, antes + 1);
  assert.equal(historial.at(-1)!.idUsuario, null); // movimiento automático (E4)
  assert.equal((await ctx.repos.casos.porId(caso.idCasoExtravio))!.idEstadoCaso, 3);
  assert.equal((await ctx.repos.notificaciones.deAvistamiento(av.idAvistamiento))?.estadoEnvio, "enviada");
});

test("R25 · si la persona tutora desactivó las notificaciones, no se crea la notificación (el avistamiento sí se guarda)", async () => {
  const { ctx } = nuevoContexto();
  const caso = (await ctx.repos.casos.porFolio(BUSQUEDA))!;
  const dueno = (await ctx.repos.usuarios.porId((await ctx.repos.casos.perro(caso.idPerro))!.idUsuario))!;
  await ctx.repos.usuarios.guardar({ ...dueno, notificacionesActivas: false });
  await registrarAvistamiento({ canal: "folio", folio: BUSQUEDA }, datos(), ctx);
  const [av] = await ctx.repos.avistamientos.deCaso(caso.idCasoExtravio);
  assert.ok(av);
  assert.equal(await ctx.repos.notificaciones.deAvistamiento(av.idAvistamiento), undefined);
});

test("R3, R11, R14, R10/HU 033, R13 · el registro rechaza lo inválido con 422 o 409 y no guarda nada", async () => {
  const { ctx } = nuevoContexto();
  const caso = (await ctx.repos.casos.porFolio(BUSQUEDA))!;
  const acc = { canal: "folio", folio: BUSQUEDA } as const;
  await rechaza(registrarAvistamiento(acc, datos({ estadosAnimal: [1, 2, 7] }), ctx), 422); // R3: Ileso no se combina
  await rechaza(registrarAvistamiento(acc, datos({ fotografia: { formato: "GIF", tamanoBytes: 10, referenciaArchivo: "x" } }), ctx), 422); // R11 formato
  await rechaza(registrarAvistamiento(acc, datos({ fotografia: { formato: "PNG", tamanoBytes: 5 * 1024 * 1024, referenciaArchivo: "x" } }), ctx), 422); // R11 tamaño (> 4 MB)
  await rechaza(registrarAvistamiento(acc, datos({ latitud: 123, longitud: -99 }), ctx), 422); // R14
  await rechaza(registrarAvistamiento(acc, datos({ fechaHoraAvistamiento: "2026-10-18T12:00:01Z" }), ctx), 422); // posterior al envío
  await rechaza(registrarAvistamiento(acc, datos({ idAlcaldia: 99 }), ctx), 422);
  await rechaza(registrarAvistamiento({ canal: "folio", folio: LOCALIZADO }, datos(), ctx), 409); // R13
  assert.equal((await ctx.repos.avistamientos.deCaso(caso.idCasoExtravio)).length, 0);
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
