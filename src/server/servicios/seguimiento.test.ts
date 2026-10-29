import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { resolverBasePublica } from "../config/urlPublica";
import { ErrorApp, respuestaDeError } from "../errores";
import { AHORA, nuevoContexto } from "../pruebas/auxiliares";
import { jpeg } from "../pruebas/imagenes";
import { CAMPOS_CONFIRMACION_AVISTAMIENTO, CAMPOS_CONFIRMACION_REPORTE, CAMPOS_CONSULTA_ESTATUS, CAMPOS_FICHA_PUBLICA } from "../serializadores/publico";
import type { SesionActual } from "../sesion/guardas";
import { registrarAvistamiento } from "./avistamientos";
import { cerrarCaso, marcarLocalizado } from "./cambioDeEstado";
import { consultarEstatusPorFolio, consultarFichaPorFolio, consultarFichaPorToken } from "./fichas";
import { avistamientoDelCaso, casoDelTutor, listadoDeAvistamientos } from "./misRegistros";
import { abrirAvistamiento, contarAvistamientosNuevos, enlaceDeEstatus, marcarRelevante, MENSAJE_ESTATUS_NO_COMPARTIBLE } from "./seguimiento";

const MAX = "RUPE-K7M4XQ9T"; // Rosa, En búsqueda
const LUNA = "RUPE-P3H8WD5N"; // Rosa, Avistamiento reportado; avistamiento NUEVO 201
const BRUNO = "RUPE-N8D5GX3W"; // Rosa, Avistamiento reportado; avistamiento NUEVO 302 (el 303, más reciente, está oculto)
const NALA = "RUPE-Y9F4LK2E"; // Rosa, En seguimiento; 101 a 104 visibles (102 «Fallecido»), 105 oculto
const TOBY = "RUPE-B6R2TZ7C"; // Rosa, Localizado
const ROCKY = "RUPE-3HN8WD2B"; // Rosa, Cerrado
const ROSA: SesionActual = { idUsuario: 2, rol: "Tutor", nombre: "Rosa Hernández Ficticia" };
const LUIS: SesionActual = { idUsuario: 5, rol: "Tutor", nombre: "Luis Navarro Ficticio" };
const ADMIN: SesionActual = { idUsuario: 1, rol: "Administrador", nombre: "Ricardo Vega Ficticio" };
const FOTO = { bytes: jpeg(), tipoDeclarado: "image/jpeg" };
const datos = (extra: Record<string, unknown> = {}) => ({ fecha: "2026-10-17", hora: "10:00", direccion: "Avenida Reservada 123, entre A y B", idAlcaldia: 6, coloniaZona: "Del Valle", referencias: "junto a la panadería", estadosAnimal: [1, 7], comentario: "Se ve bien", ...extra });
const huella = async (e: ErrorApp) => {
  const r = respuestaDeError(e);
  return JSON.stringify({ estado: r.status, cuerpo: await r.clone().text(), cabeceras: [...r.headers.entries()].sort() });
};
const falla = (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => (e instanceof ErrorApp ? e : undefined));
const movs = (almacen: ReturnType<typeof nuevoContexto>["almacen"], folio: string) => {
  const id = almacen.casos.find((c) => c.folio === folio)!.idCasoExtravio;
  return almacen.historial.filter((m) => m.idCasoExtravio === id);
};

// ---------------------------------------------------------------------------------------------------------------------- seed
test("Seed P5 · solo el avistamiento VISIBLE más reciente de Luna (201) y de Bruno (302) es nuevo; los demás cuentan como vistos", () => {
  const { almacen } = nuevoContexto();
  const nuevos = almacen.avistamientos.filter((a) => a.vistoPorTutora === false).map((a) => a.idAvistamiento).sort();
  assert.deepEqual(nuevos, [201, 302]);
  assert.equal(almacen.avistamientos.find((a) => a.idAvistamiento === 303)?.visible, false, "el 303 es más reciente que el 302 pero está oculto: no cuenta");
  assert.ok(almacen.avistamientos.filter((a) => a.vistoPorTutora === true).length === 0 && almacen.avistamientos.every((a) => a.relevante === undefined), "el resto no lleva marca y ninguno nace relevante");
});

// ---------------------------------------------------------------------------------------------------------------------- abrir el detalle (HU 040 regla 3)
test("HU 040 · abrir el avistamiento NUEVO de Luna: queda visto y el caso pasa de «Avistamiento reportado» a «En seguimiento» con «avistamiento revisado» (automático, sin usuario)", async () => {
  const { ctx, almacen } = nuevoContexto();
  const antes = movs(almacen, LUNA).length;
  const r = await abrirAvistamiento(ROSA, LUNA, "201", ctx);
  assert.deepEqual(r, { id: 201, marcado: true, estado: "En seguimiento", cambioDeEstado: true });
  const ult = movs(almacen, LUNA).at(-1)!;
  assert.deepEqual([ult.tipoMovimiento, ult.idUsuario, ult.fechaHora, ult.consecutivo], ["avistamiento revisado", null, AHORA.toISOString(), antes + 1]);
  assert.equal((await casoDelTutor(ROSA, LUNA, {}, ctx)).estado, "En seguimiento");
  assert.equal(almacen.avistamientos.find((a) => a.idAvistamiento === 201)!.vistoPorTutora, true);
});

test("HU 040 · repetir la apertura (o abrirla en paralelo) NO duplica movimientos: 25 aperturas simultáneas dejan UN movimiento y un solo «marcado»", async () => {
  const { ctx, almacen } = nuevoContexto();
  const antes = movs(almacen, BRUNO).length;
  const rs = await Promise.all(Array.from({ length: 25 }, () => abrirAvistamiento(ROSA, BRUNO, "302", ctx)));
  assert.equal(rs.filter((r) => r.marcado).length, 1);
  assert.equal(rs.filter((r) => r.cambioDeEstado).length, 1);
  assert.equal(movs(almacen, BRUNO).length, antes + 1);
  const otra = await abrirAvistamiento(ROSA, BRUNO, "302", ctx);
  assert.deepEqual(otra, { id: 302, marcado: false, estado: "En seguimiento", cambioDeEstado: false });
});

test("HU 040 · abrir un avistamiento YA visto no mueve el caso; en «En seguimiento» o «En búsqueda» no cambia nada", async () => {
  const { ctx, almacen } = nuevoContexto();
  const n = movs(almacen, NALA).length;
  const r = await abrirAvistamiento(ROSA, NALA, "101", ctx);
  assert.deepEqual([r.marcado, r.cambioDeEstado, r.estado], [false, false, "En seguimiento"]);
  assert.equal(movs(almacen, NALA).length, n);
});

test("HU 040 · con dos avistamientos nuevos, el primero que se abre mueve el caso y el segundo solo se marca como visto", async () => {
  const { ctx, almacen } = nuevoContexto();
  const nuevo = await registrarAvistamiento({ canal: "folio", folio: LUNA }, { datos: datos(), foto: FOTO }, ctx); // ya está «Avistamiento reportado»: no duplica movimiento
  const n = movs(almacen, LUNA).length;
  assert.deepEqual([(await abrirAvistamiento(ROSA, LUNA, "201", ctx)).cambioDeEstado, movs(almacen, LUNA).length], [true, n + 1]);
  const r = await abrirAvistamiento(ROSA, LUNA, String(nuevo.id), ctx);
  assert.deepEqual([r.marcado, r.cambioDeEstado, movs(almacen, LUNA).length], [true, false, n + 1]);
});

test("R12 · un avistamiento nuevo recibido con el caso «En seguimiento» lo devuelve a «Avistamiento reportado» y queda NUEVO; al abrirlo vuelve a «En seguimiento»", async () => {
  const { ctx } = nuevoContexto();
  const r = await registrarAvistamiento({ canal: "folio", folio: NALA }, { datos: datos(), foto: FOTO }, ctx);
  assert.equal((await casoDelTutor(ROSA, NALA, {}, ctx)).estado, "Avistamiento reportado");
  assert.equal((await avistamientoDelCaso(ROSA, NALA, String(r.id), ctx)).nuevo, true);
  assert.equal((await abrirAvistamiento(ROSA, NALA, String(r.id), ctx)).estado, "En seguimiento");
  assert.equal((await avistamientoDelCaso(ROSA, NALA, String(r.id), ctx)).nuevo, false);
});

test("HU 040 · con el caso Localizado o Cerrado, abrir un avistamiento nuevo solo lo marca como visto (la matriz no mueve el estado)", async () => {
  const { ctx, almacen } = nuevoContexto();
  await marcarLocalizado(ROSA, LUNA, ctx);
  const n = movs(almacen, LUNA).length;
  const r = await abrirAvistamiento(ROSA, LUNA, "201", ctx);
  assert.deepEqual([r.marcado, r.cambioDeEstado, r.estado, movs(almacen, LUNA).length], [true, false, "Localizado", n]);
  await cerrarCaso(ROSA, LUNA, ctx);
  assert.equal((await casoDelTutor(ROSA, LUNA, {}, ctx)).estado, "Cerrado");
});

test("Atomicidad · si falla el movimiento al abrir, el avistamiento NO queda marcado como visto (se restaura la fila completa)", async () => {
  const { ctx, almacen } = nuevoContexto();
  const fila = almacen.avistamientos.find((a) => a.idAvistamiento === 201)!;
  const n = movs(almacen, LUNA).length;
  const catalogo = almacen.estadosCaso.slice();
  almacen.estadosCaso.splice(almacen.estadosCaso.findIndex((e) => e.nombre === "En seguimiento"), 1); // el estado de llegada «desaparece»: el movimiento falla DESPUÉS de marcar
  await assert.rejects(ctx.repos.avistamientos.marcarVisto(201, AHORA.toISOString()));
  almacen.estadosCaso.splice(0, almacen.estadosCaso.length, ...catalogo);
  assert.equal(fila.vistoPorTutora, false, "la marca se deshizo");
  assert.equal(movs(almacen, LUNA).length, n);
  assert.equal((await casoDelTutor(ROSA, LUNA, {}, ctx)).estado, "Avistamiento reportado");
  assert.equal((await abrirAvistamiento(ROSA, LUNA, "201", ctx)).cambioDeEstado, true, "y luego funciona normal");
});

test("R32 · abrir o marcar: avistamiento de otro caso, oculto, inexistente o con id mal formado = el MISMO 404; caso ajeno igual; Administrador 403; sin sesión 401", async () => {
  const { ctx } = nuevoContexto();
  const ajeno = [await falla(abrirAvistamiento(LUIS, LUNA, "201", ctx)), await falla(abrirAvistamiento(ROSA, "RUPE-ZZZZZZZZ", "201", ctx)), await falla(abrirAvistamiento(ROSA, "mal", "201", ctx)),
    await falla(abrirAvistamiento(ROSA, NALA, "201", ctx)) /* es de Luna */, await falla(abrirAvistamiento(ROSA, NALA, "105", ctx)) /* oculto */, await falla(abrirAvistamiento(ROSA, NALA, "999999", ctx)),
    await falla(abrirAvistamiento(ROSA, NALA, "abc", ctx)), await falla(abrirAvistamiento(ROSA, NALA, "", ctx)), await falla(abrirAvistamiento(ROSA, NALA, "1e3", ctx)), await falla(abrirAvistamiento(ROSA, NALA, "-101", ctx))];
  assert.ok(ajeno.every((e) => e?.estado === 404));
  assert.equal(new Set(await Promise.all(ajeno.map((e) => huella(e!)))).size, 1);
  const rel = [await falla(marcarRelevante(LUIS, LUNA, "201", true, ctx)), await falla(marcarRelevante(ROSA, NALA, "105", true, ctx)), await falla(marcarRelevante(ROSA, NALA, "x", true, ctx))];
  assert.equal(new Set(await Promise.all(rel.map((e) => huella(e!)))).size, 1);
  assert.equal((await falla(abrirAvistamiento(ADMIN, LUNA, "201", ctx)))?.estado, 403);
  assert.equal((await falla(marcarRelevante(ADMIN, LUNA, "201", true, ctx)))?.estado, 403);
  assert.equal((await falla(abrirAvistamiento(undefined, LUNA, "201", ctx)))?.estado, 401);
  assert.equal((await falla(marcarRelevante(undefined, LUNA, "201", true, ctx)))?.estado, 401);
});

// ---------------------------------------------------------------------------------------------------------------------- relevante
test("HU 040 · «Marcar como relevante» es reversible e idempotente, solo cambia ese avistamiento y se ve en el listado y en el detalle", async () => {
  const { ctx, almacen } = nuevoContexto();
  assert.deepEqual(await marcarRelevante(ROSA, NALA, "103", true, ctx), { id: 103, relevante: true });
  await marcarRelevante(ROSA, NALA, "103", true, ctx);
  assert.equal(almacen.avistamientos.filter((a) => a.relevante === true).length, 1);
  const lista = await listadoDeAvistamientos(ROSA, NALA, {}, ctx);
  assert.deepEqual(lista.items.filter((i) => i.relevante).map((i) => i.id), [103]);
  assert.equal((await avistamientoDelCaso(ROSA, NALA, "103", ctx)).relevante, true);
  await marcarRelevante(ROSA, NALA, "103", false, ctx);
  assert.equal((await avistamientoDelCaso(ROSA, NALA, "103", ctx)).relevante, false);
  assert.equal(almacen.avistamientos.filter((a) => a.relevante === true).length, 0);
});

test("HU 040 · el valor de «relevante» debe ser booleano (400); no se marca ni se abre nada con un valor inválido", async () => {
  const { ctx, almacen } = nuevoContexto();
  for (const malo of [undefined, "true", 1, null, {}]) assert.equal((await falla(marcarRelevante(ROSA, NALA, "103", malo, ctx)))?.codigo, "RELEVANTE_INVALIDO");
  assert.ok(almacen.avistamientos.every((a) => a.relevante === undefined));
});

test("Privacidad · «visto» y «relevante» no salen en NINGUNA respuesta pública ni en los serializadores: ficha por folio y por QR, estatus, confirmación del reporte, listas de campos", async () => {
  const { ctx, almacen } = nuevoContexto();
  await marcarRelevante(ROSA, NALA, "103", true, ctx);
  const token = (await ctx.repos.qr.activoDe(almacen.casos.find((c) => c.folio === MAX)!.idCasoExtravio))!.tokenPublico;
  const reporte = await registrarAvistamiento({ canal: "folio", folio: MAX }, { datos: datos(), foto: FOTO }, ctx);
  const publicas = JSON.stringify([await consultarFichaPorFolio(MAX, ctx), await consultarFichaPorToken(token, ctx), await consultarEstatusPorFolio(NALA, ctx), await consultarEstatusPorFolio(TOBY, ctx), reporte,
    CAMPOS_FICHA_PUBLICA, CAMPOS_CONSULTA_ESTATUS, CAMPOS_CONFIRMACION_AVISTAMIENTO, CAMPOS_CONFIRMACION_REPORTE]);
  assert.ok(!/visto|relevante|vistoPorTutora|nuevo/i.test(publicas.replace(/nuevo avistamiento/gi, "")), "ninguna clave interna en lo público");
  // Y el código de los serializadores ni siquiera las nombra.
  const fuente = readFileSync(new URL("../serializadores/publico.ts", import.meta.url), "utf8");
  assert.ok(!/vistoPorTutora|relevante/.test(fuente));
});

// ---------------------------------------------------------------------------------------------------------------------- campana
test("Campana · cuenta los avistamientos NUEVOS y VISIBLES de todos los casos de la tutora y baja al abrir cada detalle; es por persona", async () => {
  const { ctx, almacen } = nuevoContexto();
  assert.equal(await contarAvistamientosNuevos(ROSA, ctx), 2);
  assert.equal(await contarAvistamientosNuevos(LUIS, ctx), 0, "Luis no tiene avistamientos nuevos");
  await abrirAvistamiento(ROSA, LUNA, "201", ctx);
  assert.equal(await contarAvistamientosNuevos(ROSA, ctx), 1);
  await registrarAvistamiento({ canal: "folio", folio: MAX }, { datos: datos(), foto: FOTO }, ctx);
  assert.equal(await contarAvistamientosNuevos(ROSA, ctx), 2);
  assert.equal(await contarAvistamientosNuevos(LUIS, ctx), 0);
  // Un avistamiento nuevo pero OCULTO por moderación no cuenta.
  almacen.avistamientos.find((a) => a.idAvistamiento === 302)!.visible = false;
  assert.equal(await contarAvistamientosNuevos(ROSA, ctx), 1);
  assert.equal((await falla(contarAvistamientosNuevos(ADMIN, ctx)))?.estado, 403);
  assert.equal((await falla(contarAvistamientosNuevos(undefined, ctx)))?.estado, 401);
});

// ---------------------------------------------------------------------------------------------------------------------- enlace de estatus (HU 046)
test("HU 046 · el enlace de estatus lleva el FOLIO (nunca el token) y ningún dato personal; funciona en Localizado; en Cerrado da 409", async () => {
  const { ctx, almacen } = nuevoContexto();
  const base = resolverBasePublica({ entorno: { RUPE_URL_PUBLICA: "https://rupe.example" }, produccion: true });
  assert.equal(await enlaceDeEstatus(ROSA, MAX, base, ctx), `https://rupe.example/estatus/${MAX}`);
  assert.equal(await enlaceDeEstatus(ROSA, MAX.toLowerCase(), base, ctx), `https://rupe.example/estatus/${MAX}`);
  assert.equal(await enlaceDeEstatus(ROSA, TOBY, base, ctx), `https://rupe.example/estatus/${TOBY}`, "también Localizado");
  const token = (await ctx.repos.qr.activoDe(almacen.casos.find((c) => c.folio === MAX)!.idCasoExtravio))!.tokenPublico;
  assert.ok(!(await enlaceDeEstatus(ROSA, MAX, base, ctx))!.includes(token));
  const e = await falla(enlaceDeEstatus(ROSA, ROCKY, base, ctx));
  assert.deepEqual([e?.estado, e?.codigo, e?.message], [409, "CASO_CERRADO", MENSAJE_ESTATUS_NO_COMPARTIBLE]);
  const sinBase = resolverBasePublica({ entorno: {}, produccion: true });
  assert.equal(await enlaceDeEstatus(ROSA, MAX, sinBase, ctx), null, "sin URL pública la pantalla avisa");
  assert.equal(new Set(await Promise.all([LUIS, ROSA].map(async (s) => huella((await falla(enlaceDeEstatus(s, "RUPE-ZZZZZZZZ", base, ctx)))!)))).size, 1);
  assert.equal((await falla(enlaceDeEstatus(LUIS, MAX, base, ctx)))?.estado, 404);
  assert.equal((await falla(enlaceDeEstatus(ADMIN, MAX, base, ctx)))?.estado, 403);
  assert.equal((await falla(enlaceDeEstatus(undefined, MAX, base, ctx)))?.estado, 401);
});
