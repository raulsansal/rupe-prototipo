import assert from "node:assert/strict";
import { BITACORA } from "../../mocks/bitacora";
import { test } from "node:test";
import { PATRON_FOLIO } from "../../mocks/tipos";
import { ALFABETO_FOLIO } from "../dominio/folio";
import { ErrorApp, cuerpoDeError, jsonApi, respuestaDeError } from "../errores";
import { CAMPOS_FICHA_PUBLICA } from "../serializadores/publico";
import { AHORA, nuevoContexto } from "../pruebas/auxiliares";
import { jpeg, PNG_1X1 } from "../pruebas/imagenes";
import type { SesionActual } from "../sesion/guardas";
import { verificarResultado } from "../imagenes/prepararImagen";
import { casoRecienCreado, fotografiaDelCaso, registrarExtravio } from "./extravio";
import { consultarFichaPorFolio } from "./fichas";

const ROSA: SesionActual = { idUsuario: 2, rol: "Tutor", nombre: "Rosa Hernández Ficticia" };
const LUIS: SesionActual = { idUsuario: 5, rol: "Tutor", nombre: "Luis Navarro Ficticio" };
const ADMIN: SesionActual = { idUsuario: 1, rol: "Administrador", nombre: "Ricardo Vega Ficticio" };
const datos = (extra: Record<string, unknown> = {}) => ({
  nombre: "Pelusa", sexo: "Hembra", idRaza: 1, edad: { valor: 3, unidad: "años" }, tamano: "pequeño", color: "Blanco", caracteristicas: "Mancha café en la oreja", fechaExtravio: "2026-10-18", momento: "tarde",
  alcaldia: "Coyoacán", colonia: "Del Carmen", calle: "Calle Reservada 99", referencias: "Referencia reservada: junto a la panadería", idMotivo: 1, descripcion: "Descripción reservada: salió por el portón", ...extra,
});
const foto = { bytes: jpeg(), tipoDeclarado: "image/jpeg" };
const falla = async (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => (e instanceof ErrorApp ? e : undefined));
const instantanea = (a: ReturnType<typeof nuevoContexto>["almacen"]) =>
  JSON.stringify({ ids: a.ids, n: [a.fotografias.length, a.perros.length, a.casos.length, a.historial.length, a.qr.length, a.bitacora.length, a.notificaciones.length], fotos: Object.keys(a.contenidosFoto), folios: a.casos.map((c) => c.folio) });

test("HU 011, 012 y 013 · caso feliz: caso, perro, foto, historial (2 movimientos) y QR quedan juntos; estado final «En búsqueda» (R6, E1)", async () => {
  const { ctx, almacen } = nuevoContexto();
  const r = await registrarExtravio(ROSA, { datos: datos(), foto }, ctx);
  assert.match(r.folio, PATRON_FOLIO);
  assert.equal(r.estado, "En búsqueda");
  const caso = (await ctx.repos.casos.porFolio(r.folio))!;
  const perro = (await ctx.repos.casos.perro(caso.idPerro))!;
  assert.equal(perro.idUsuario, 2); // el dueño es la sesión
  assert.deepEqual([perro.nombre, perro.sexo, perro.edadValor, perro.edadUnidad, perro.tamano, perro.color, perro.idRaza], ["Pelusa", "Hembra", 3, "años", "pequeño", "Blanco", 1]);
  assert.deepEqual([caso.fechaExtravio, caso.momentoDelDia, caso.coloniaZona, caso.direccionAproximada, caso.idAlcaldia, caso.idMotivo], ["2026-10-18", "tarde", "Del Carmen", "Calle Reservada 99", 4, 1]);
  assert.equal(caso.fechaRegistro, AHORA.toISOString());
  assert.equal(caso.fechaUltimaModificacion, caso.fechaRegistro);
  const h = await ctx.repos.historial.deCaso(caso.idCasoExtravio);
  assert.deepEqual(h.map((m) => [m.consecutivo, m.tipoMovimiento, m.idUsuario]), [[1, "registro", null], [2, "ficha generada", null]]); // E4
  assert.equal(caso.idEstadoCaso, 2); // E1: el estado actual repite el último movimiento
  const qr = (await ctx.repos.qr.activoDe(caso.idCasoExtravio))!;
  assert.equal(qr.tokenPublico.length, 32);
  const f = (await ctx.repos.casos.fotografia(perro.idFotografia))!;
  assert.equal(f.referenciaArchivo, `/api/fotografias/${f.idFotografia}`);
  assert.equal(f.formato, "JPG");
  // HU 011 regla 6: se guarda la foto RE-CODIFICADA en el servidor (JPEG sin metadatos), no los bytes originales.
  const guardada = (await ctx.repos.casos.contenidoDeFotografia(f.idFotografia))!;
  assert.equal(f.tamanoBytes, guardada.bytes.length);
  assert.equal(guardada.tipo, "image/jpeg");
  assert.equal((await verificarResultado(guardada.bytes)).esJpeg, true);
  assert.equal(almacen.bitacora.length, BITACORA.length + 5); // R24: la bitácora es solo de acciones administrativas; el registro no escribe en ella
});

test("Seguridad · la guarda va DENTRO del servicio: 401 sin sesión, 403 con el Administrador; no se guarda nada", async () => {
  const { ctx, almacen } = nuevoContexto();
  const antes = instantanea(almacen);
  assert.equal((await falla(registrarExtravio(undefined, { datos: datos(), foto }, ctx)))?.estado, 401);
  assert.equal((await falla(registrarExtravio(ADMIN, { datos: datos(), foto }, ctx)))?.estado, 403);
  assert.equal(instantanea(almacen), antes);
});

test("Asignación masiva · se ignoran idCaso, folio, estado, idUsuario, idPerro, fechas, rol y cualquier campo de más", async () => {
  const { ctx } = nuevoContexto();
  const r = await registrarExtravio(LUIS, { datos: datos({ idCaso: 1, idCasoExtravio: 1, folio: "RUPE-AAAAAAAA", estado: "Cerrado", idEstadoCaso: 6, idUsuario: 2, idPerro: 1, idFotografia: 1, fechaRegistro: "2000-01-01T00:00:00Z", fechaUltimaModificacion: "2000-01-01T00:00:00Z", rol: "Administrador", visible: false, consecutivo: 99, tokenPublico: "A".repeat(32) }), foto }, ctx);
  const caso = (await ctx.repos.casos.porFolio(r.folio))!;
  const perro = (await ctx.repos.casos.perro(caso.idPerro))!;
  assert.notEqual(r.folio, "RUPE-AAAAAAAA");
  assert.equal(perro.idUsuario, 5); // el dueño es quien tiene la sesión (Luis), no el idUsuario enviado
  assert.equal(caso.idEstadoCaso, 2);
  assert.equal(caso.fechaRegistro, AHORA.toISOString());
  assert.notEqual(caso.idCasoExtravio, 1);
  assert.notEqual(perro.idFotografia, 1);
  assert.deepEqual((await ctx.repos.historial.deCaso(caso.idCasoExtravio)).map((m) => m.consecutivo), [1, 2]);
  assert.notEqual((await ctx.repos.qr.activoDe(caso.idCasoExtravio))!.tokenPublico, "A".repeat(32));
});

test("HU 011 y 012 · rechazo: 422 con errores por campo y sin guardar nada (ni foto, ni perro, ni ids consumidos)", async () => {
  const { ctx, almacen } = nuevoContexto();
  const antes = instantanea(almacen);
  const e = await falla(registrarExtravio(ROSA, { datos: datos({ nombre: "", alcaldia: "Fuera de la Ciudad de México", fechaExtravio: "2026-10-19" }), foto: { bytes: new Uint8Array([1, 2, 3]), tipoDeclarado: "image/png" } }, ctx));
  assert.equal(e?.estado, 422);
  assert.deepEqual(Object.keys(e!.campos!).sort(), ["alcaldia", "fecha", "foto", "nombre"]);
  assert.equal(instantanea(almacen), antes);
});

test("R10 · «hoy» es el de la Ciudad de México: a las 05:30 UTC del día 19 todavía es el 18", async () => {
  const { ctx } = nuevoContexto({}, () => new Date("2026-10-19T05:30:00Z"));
  assert.equal((await falla(registrarExtravio(ROSA, { datos: datos({ fechaExtravio: "2026-10-19" }), foto }, ctx)))?.campos?.fecha, "La fecha del extravío no puede ser posterior a hoy.");
  assert.ok(await registrarExtravio(ROSA, { datos: datos({ fechaExtravio: "2026-10-18" }), foto }, ctx));
  const { ctx: ctx2 } = nuevoContexto({}, () => new Date("2026-10-19T06:00:00Z"));
  assert.ok(await registrarExtravio(ROSA, { datos: datos({ fechaExtravio: "2026-10-19" }), foto }, ctx2));
});

test("R8 · con otra raza la raza especificada no se guarda; con «Otra» sí", async () => {
  const { ctx } = nuevoContexto();
  const a = await registrarExtravio(ROSA, { datos: datos({ idRaza: 4, razaEspecificada: "Criollo" }), foto }, ctx);
  const b = await registrarExtravio(ROSA, { datos: datos({ idRaza: 14, razaEspecificada: "Criollo" }), foto }, ctx);
  const perroDe = async (folio: string) => (await ctx.repos.casos.perro((await ctx.repos.casos.porFolio(folio))!.idPerro))!;
  assert.equal((await perroDe(a.folio)).razaEspecificada, undefined);
  assert.equal((await perroDe(b.folio)).razaEspecificada, "Criollo");
});

test("HU 013 · dos registros seguidos del mismo dueño dan folios, ids, fotos y QR distintos", async () => {
  const { ctx } = nuevoContexto();
  const a = await registrarExtravio(ROSA, { datos: datos(), foto }, ctx);
  const b = await registrarExtravio(ROSA, { datos: datos(), foto: { bytes: PNG_1X1, tipoDeclarado: "image/png" } }, ctx);
  assert.notEqual(a.folio, b.folio);
  const [ca, cb] = [(await ctx.repos.casos.porFolio(a.folio))!, (await ctx.repos.casos.porFolio(b.folio))!];
  const [pa, pb] = [(await ctx.repos.casos.perro(ca.idPerro))!, (await ctx.repos.casos.perro(cb.idPerro))!];
  assert.notEqual(ca.idCasoExtravio, cb.idCasoExtravio);
  assert.notEqual(pa.idPerro, pb.idPerro);
  assert.notEqual(pa.idFotografia, pb.idFotografia);
  assert.equal(pb.idFotografia, pa.idFotografia + 1);
  assert.notEqual((await ctx.repos.qr.activoDe(ca.idCasoExtravio))!.tokenPublico, (await ctx.repos.qr.activoDe(cb.idCasoExtravio))!.tokenPublico);
  assert.equal((await ctx.repos.casos.contenidoDeFotografia(pb.idFotografia))?.tipo, "image/jpeg"); // un PNG subido se guarda como JPEG
  assert.equal((await ctx.repos.casos.contenidoDeFotografia(pa.idFotografia))?.tipo, "image/jpeg"); // la primera no se pisó
});

test("R26 · folio único: si el generado ya existe se reintenta con otro (el existente no se pisa)", async () => {
  const { ctx } = nuevoContexto();
  const existente = "RUPE-K7M4XQ9T";
  const indices = [...existente.slice(5)].map((c) => ALFABETO_FOLIO.indexOf(c));
  let n = 0;
  const intentos: string[] = [];
  const aleatorio = (max: number) => {
    const i = n++;
    void max;
    const valor = i < 8 ? indices[i] : 0; // 1.er folio: el que ya existe; 2.º: RUPE-AAAAAAAA
    if (i % 8 === 7) intentos.push("x");
    return valor;
  };
  const r = await registrarExtravio(ROSA, { datos: datos(), foto }, { ...ctx, aleatorio });
  assert.equal(r.folio, "RUPE-AAAAAAAA");
  assert.equal(intentos.length, 2);
  assert.equal((await ctx.repos.casos.porFolio(existente))!.fechaRegistro, "2026-10-18T22:10:00Z"); // el caso de Max sigue igual
});

test("R26 · si no se logra un folio único en 10 intentos, 422 FOLIO_NO_GENERADO y nada queda guardado", async () => {
  const { ctx, almacen } = nuevoContexto();
  const indices = [..."K7M4XQ9T"].map((c) => ALFABETO_FOLIO.indexOf(c));
  let n = 0;
  const antes = instantanea(almacen);
  const e = await falla(registrarExtravio(ROSA, { datos: datos(), foto }, { ...ctx, aleatorio: () => indices[n++ % 8] }));
  assert.equal(e?.estado, 422);
  assert.equal(e?.codigo, "FOLIO_NO_GENERADO");
  assert.equal(instantanea(almacen), antes);
});

test("Ficha pública · el caso nuevo se publica SIN calle, referencias, momento, motivo, descripción ni datos de la persona", async () => {
  const { ctx } = nuevoContexto();
  const r = await registrarExtravio(ROSA, { datos: datos(), foto }, ctx);
  const ficha = await consultarFichaPorFolio(r.folio, ctx);
  assert.deepEqual(Object.keys(ficha).sort(), [...CAMPOS_FICHA_PUBLICA].sort());
  const json = JSON.stringify(ficha);
  for (const reservado of ["Calle Reservada 99", "Referencia reservada", "Descripción reservada", "tarde", "Rosa", "Hernández", "@example", "/api/fotografias/"]) assert.ok(!json.includes(reservado), reservado);
  assert.equal(ficha.fotografiaUrl, `/api/fichas/${r.folio}/fotografia`); // P4: la ficha usa la ruta PÚBLICA de la foto del perro; la ruta privada (/api/fotografias/<id>) nunca sale
  assert.ok(!/momento|motivo|direccion|referencias|descripcion|idUsuario|tokenPublico/i.test(json));
  assert.equal(ficha.estado, "En búsqueda");
});

test("HU 013 · la confirmación trae el aviso en la app y la vista previa del correo SOLO con notificaciones activas; 0 meses se lee «menos de 1 mes»", async () => {
  const { ctx } = nuevoContexto();
  const r = await registrarExtravio(ROSA, { datos: datos({ edad: { valor: 0, unidad: "meses" } }), foto }, ctx);
  const c = await casoRecienCreado(ROSA, r.folio, ctx);
  assert.equal(c.edadTexto, "menos de 1 mes");
  assert.match(c.aviso, new RegExp(r.folio));
  assert.ok(c.correo);
  const texto = [c.correo!.asunto, ...c.correo!.cuerpo].join("\n");
  assert.match(texto, /menos de 1 mes/);
  assert.ok(!/0 meses/.test(texto));
  assert.match(c.correo!.asunto, new RegExp(r.folio));
  assert.ok(!/@|token|Calle Reservada|Referencia reservada|Hernández/i.test(texto));
  // Sin notificaciones activas: aviso en la app, sin correo.
  const rosa = (await ctx.repos.usuarios.porId(2))!;
  await ctx.repos.usuarios.guardar({ ...rosa, notificacionesActivas: false });
  const sin = await casoRecienCreado(ROSA, r.folio, ctx);
  assert.equal(sin.correo, null);
  assert.ok(sin.aviso);
});

test("R32 · la confirmación es solo de su dueña: otra tutora o un folio que no existe responden lo mismo (404); sin sesión 401", async () => {
  const { ctx } = nuevoContexto();
  const r = await registrarExtravio(ROSA, { datos: datos(), foto }, ctx);
  const ajeno = await falla(casoRecienCreado(LUIS, r.folio, ctx));
  const inexistente = await falla(casoRecienCreado(LUIS, "RUPE-ZZZZZZZZ", ctx));
  assert.deepEqual([ajeno?.estado, inexistente?.estado], [404, 404]);
  assert.equal(JSON.stringify(cuerpoDeError(ajeno!)), JSON.stringify(cuerpoDeError(inexistente!)));
  assert.equal((await falla(casoRecienCreado(undefined, r.folio, ctx)))?.estado, 401);
});

test("Fotografía · solo la ve su dueña (y el Administrador, en consulta); otra tutora, id inexistente y foto sembrada dan el MISMO 404 byte por byte, con las mismas cabeceras", async () => {
  const { ctx } = nuevoContexto();
  const r = await registrarExtravio(ROSA, { datos: datos(), foto }, ctx);
  const caso = (await ctx.repos.casos.porFolio(r.folio))!;
  const idFoto = (await ctx.repos.casos.perro(caso.idPerro))!.idFotografia;
  assert.deepEqual((await fotografiaDelCaso(ROSA, idFoto, ctx)).bytes, (await ctx.repos.casos.contenidoDeFotografia(idFoto))!.bytes);
  assert.equal((await fotografiaDelCaso(ADMIN, idFoto, ctx)).tipo, "image/jpeg"); // consulta
  assert.equal((await falla(fotografiaDelCaso(undefined, idFoto, ctx)))?.estado, 401);
  const sembrada = (await ctx.repos.casos.perro((await ctx.repos.casos.porFolio("RUPE-K7M4XQ9T"))!.idPerro))!.idFotografia;
  const respuestas = await Promise.all([fotografiaDelCaso(LUIS, idFoto, ctx), fotografiaDelCaso(ROSA, 987654, ctx), fotografiaDelCaso(ROSA, sembrada, ctx)].map((p) => p.then(() => { throw new Error("debía fallar"); }, (e) => respuestaDeError(e))));
  const cuerpos = await Promise.all(respuestas.map(async (x) => Buffer.from(await x.arrayBuffer())));
  assert.deepEqual(respuestas.map((x) => x.status), [404, 404, 404]);
  assert.ok(cuerpos[0].equals(cuerpos[1]) && cuerpos[1].equals(cuerpos[2]));
  const cabeceras = respuestas.map((x) => JSON.stringify([...x.headers].sort()));
  assert.equal(new Set(cabeceras).size, 1);
});

test("Errores · un fallo inesperado responde 500 genérico, sin rutas, tablas, trazas ni valores de configuración", async () => {
  const { ctx } = nuevoContexto();
  const original = console.error;
  console.error = () => undefined; // el detalle va solo al registro del servidor
  try {
    ctx.repos.catalogos.razas = async () => {
      throw new Error("ECONNREFUSED /Users/raul/proyecto/src/server/seed/seed.ts tbl_perro RUPE_SESION_SECRETO=abc password=hunter2");
    };
    const e = await registrarExtravio(ROSA, { datos: datos(), foto }, ctx).then(() => undefined, (x: unknown) => x);
    assert.ok(e instanceof Error && !(e instanceof ErrorApp)); // llega como error inesperado...
    const r = respuestaDeError(e); // ...y la API lo convierte en una respuesta genérica
    const cuerpo = await r.text();
    assert.equal(r.status, 500);
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.deepEqual(JSON.parse(cuerpo), { error: { codigo: "ERROR_INTERNO", mensaje: "Ocurrió un error inesperado." } });
    for (const filtrado of ["/Users", "seed.ts", "tbl_", "RUPE_", "password", "hunter2", "ECONNREFUSED", "at ", "stack"]) assert.ok(!cuerpo.includes(filtrado), filtrado);
    assert.equal(jsonApi({ x: 1 }).headers.get("cache-control"), "no-store");
  } finally {
    console.error = original;
  }
});
