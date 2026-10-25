import assert from "node:assert/strict";
import { test } from "node:test";
import { obtenerAlmacen, reiniciarAlmacen } from "./almacen";
import { crearRepositorios } from "./repos";
import { AHORA, nuevoContexto } from "../pruebas/auxiliares";

test("repos · R4: el consecutivo es máximo + 1 por caso y el historial solo crece", async () => {
  const { ctx } = nuevoContexto();
  const caso = (await ctx.repos.casos.porFolio("RUPE-K7M4XQ9T"))!;
  const antes = await ctx.repos.historial.deCaso(caso.idCasoExtravio);
  const nuevo = await ctx.repos.historial.agregar({ idCasoExtravio: caso.idCasoExtravio, fechaHora: AHORA.toISOString(), tipoMovimiento: "avistamiento recibido", idEstadoCaso: 3, idUsuario: null });
  assert.equal(nuevo.consecutivo, antes.length + 1);
  assert.equal((await ctx.repos.historial.deCaso(caso.idCasoExtravio)).length, antes.length + 1);
  assert.equal((ctx.repos.historial as unknown as Record<string, unknown>).actualizar, undefined); // solo SELECT e INSERT
  assert.equal((ctx.repos.bitacora as unknown as Record<string, unknown>).eliminar, undefined); // R15
});

test("repos · R6: crearConPerro deja caso, perro, fotografía, QR inicial y movimientos juntos; el folio es único y se guarda en mayúsculas", async () => {
  const { ctx } = nuevoContexto();
  const datos = {
    fotografia: { referenciaArchivo: "/mocks/p.svg", formato: "JPG" as const, tamanoBytes: 1000, fechaCarga: "t" },
    perro: { nombre: "Nube", sexo: "Hembra" as const, edadValor: 2, edadUnidad: "años" as const, tamano: "pequeño" as const, color: "Blanco", idRaza: 1, idUsuario: 2 },
    caso: { folio: "rupe-aaaaaaaa", fechaExtravio: "2026-10-18", momentoDelDia: "tarde" as const, coloniaZona: "Centro", fechaRegistro: "t", fechaUltimaModificacion: "t", idAlcaldia: 6, idMotivo: 14 },
    qr: { tokenPublico: "Q".repeat(32), fechaGeneracion: "t", fechaInvalidacion: null },
    movimientos: [{ fechaHora: "t", tipoMovimiento: "registro" as const, idEstadoCaso: 1, idUsuario: null }, { fechaHora: "t", tipoMovimiento: "ficha generada" as const, idEstadoCaso: 2, idUsuario: null }],
  };
  const caso = await ctx.repos.casos.crearConPerro(datos);
  assert.equal(caso.folio, "RUPE-AAAAAAAA");
  assert.equal(caso.idEstadoCaso, 2); // E1
  assert.equal((await ctx.repos.historial.deCaso(caso.idCasoExtravio)).length, 2);
  assert.equal((await ctx.repos.qr.activoDe(caso.idCasoExtravio))!.tokenPublico, "Q".repeat(32));
  await assert.rejects(ctx.repos.casos.crearConPerro({ ...datos, qr: { ...datos.qr, tokenPublico: "Z".repeat(32) } }), /duplicado/);
});

test("repos · R7: regenerar deja un solo QR activo y no admite un token repetido; la búsqueda por token es sensible a mayúsculas", async () => {
  const { ctx } = nuevoContexto();
  const caso = (await ctx.repos.casos.porFolio("RUPE-K7M4XQ9T"))!;
  const viejo = (await ctx.repos.qr.activoDe(caso.idCasoExtravio))!;
  const nuevo = await ctx.repos.qr.regenerar(caso.idCasoExtravio, "N".repeat(32), "t1");
  assert.equal((await ctx.repos.qr.porToken(viejo.tokenPublico))!.fechaInvalidacion, "t1");
  assert.equal((await ctx.repos.qr.activoDe(caso.idCasoExtravio))!.idCodigoQr, nuevo.idCodigoQr);
  assert.equal(await ctx.repos.qr.porToken("n".repeat(32)), undefined);
  await assert.rejects(ctx.repos.qr.regenerar(caso.idCasoExtravio, "N".repeat(32), "t2"));
});

test("repos · restaurar un avistamiento limpia el motivo de moderación", async () => {
  const { ctx } = nuevoContexto();
  assert.equal((await ctx.repos.avistamientos.porId(105))!.motivoModeracion?.length ? true : false, true);
  await ctx.repos.avistamientos.moderar(105, true);
  const a = (await ctx.repos.avistamientos.porId(105))!;
  assert.equal(a.visible, true);
  assert.equal(a.motivoModeracion, undefined);
});

test("repos · devuelven copias: mutar lo recibido no cambia el almacén", async () => {
  const { ctx } = nuevoContexto();
  const u = (await ctx.repos.usuarios.porId(1))!;
  u.nombreCompleto = "Otro";
  assert.notEqual((await ctx.repos.usuarios.porId(1))!.nombreCompleto, "Otro");
});

test("singleton · el almacén sobrevive entre llamadas (globalThis) y reiniciarAlmacen vuelve a los datos ficticios iniciales", async () => {
  const repos = crearRepositorios();
  const a1 = obtenerAlmacen();
  assert.equal(obtenerAlmacen(), a1);
  const folios = a1.casos.length;
  await repos.usuarios.guardar({ ...(await repos.usuarios.porId(3))!, estatus: 1, nombreCompleto: "Cambiado" });
  a1.casos.pop();
  assert.equal(obtenerAlmacen().casos.length, folios - 1);
  const a2 = reiniciarAlmacen();
  assert.notEqual(a2, a1);
  assert.equal(obtenerAlmacen(), a2);
  assert.equal(a2.casos.length, folios);
  assert.notEqual((await repos.usuarios.porId(3))!.nombreCompleto, "Cambiado");
  assert.ok(await repos.casos.porFolio("RUPE-K7M4XQ9T")); // los casos de ejemplo siempre vuelven
});
