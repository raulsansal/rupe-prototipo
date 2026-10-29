import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp } from "../../errores";
import { AHORA, nuevoContexto } from "../../pruebas/auxiliares";
import type { SesionActual } from "../../sesion/guardas";
import { consultarFichaPorFolio, consultarEstatusPorFolio } from "../fichas";
import { cancelarCaso } from "../cambioDeEstado";
import { estadoActual } from "../../dominio/transiciones";
import { historialDe } from "../contexto";
import { consultarBitacora } from "./bitacoraAdmin";
import { detalleAvistamiento, listarAvistamientos, ocultarAvistamiento, restaurarAvistamiento } from "./moderacionAvistamientos";
import { deshabilitarCaso, detalleRegistro, fotografiaDelPerroAdmin, listarRegistros, restaurarCaso } from "./moderacionRegistros";
import { cambiarRol, deshabilitarUsuario, habilitarUsuario, listarUsuarios } from "./usuariosAdmin";

const MAX = "RUPE-K7M4XQ9T"; // id 12, Rosa, En búsqueda
const TOBY = "RUPE-B6R2TZ7C"; // id 4, Rosa, Localizado
const ROCKY = "RUPE-3HN8WD2B"; // id 1, Cerrado por cierre confirmado
const SIMBA = "RUPE-F7L3MN6Y"; // id 5, Cerrado por cancelación
const KIRA = "RUPE-D5W2QK8X"; // id 7, Cerrado por deshabilitación
const ROSA: SesionActual = { idUsuario: 2, rol: "Tutor", nombre: "Rosa Hernández Ficticia" };
const ADMIN: SesionActual = { idUsuario: 1, rol: "Administrador", nombre: "Ricardo Vega Ficticio" };
const falla = (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => (e instanceof ErrorApp ? e : undefined));
const rechaza = async (p: Promise<unknown>, estado: number, codigo?: string) => {
  const e = await falla(p);
  assert.ok(e, "debía rechazar");
  assert.equal(e.estado, estado);
  if (codigo) assert.equal(e.codigo, codigo);
};
const MOTIVO = "Contenido inapropiado en la descripción.";
const ultimo = (almacen: ReturnType<typeof nuevoContexto>["almacen"]) => almacen.bitacora[almacen.bitacora.length - 1];
const movs = (almacen: ReturnType<typeof nuevoContexto>["almacen"], id: number) => almacen.historial.filter((h) => h.idCasoExtravio === id);

// --- Roles ---------------------------------------------------------------------------------------------------------------------------------
test("roles · cada servicio de Administrador: sin sesión 401, Tutor 403, Administrador pasa", async () => {
  const { ctx } = nuevoContexto();
  const llamadas: Array<(s: SesionActual | undefined) => Promise<unknown>> = [
    (s) => listarRegistros(s, {}, ctx), (s) => detalleRegistro(s, MAX, ctx), (s) => deshabilitarCaso(s, "RUPE-NO0000XX", MOTIVO, ctx), (s) => restaurarCaso(s, "RUPE-NO0000XX", ctx),
    (s) => fotografiaDelPerroAdmin(s, "RUPE-NO0000XX", ctx), (s) => listarAvistamientos(s, {}, ctx), (s) => detalleAvistamiento(s, "101", {}, ctx), (s) => ocultarAvistamiento(s, "999", MOTIVO, ctx),
    (s) => restaurarAvistamiento(s, "999", ctx), (s) => consultarBitacora(s, {}, ctx), (s) => listarUsuarios(s, {}, ctx), (s) => deshabilitarUsuario(s, "999", {}, ctx),
    (s) => habilitarUsuario(s, "999", ctx), (s) => cambiarRol(s, "999", "Tutor", {}, ctx),
  ];
  for (const [i, l] of llamadas.entries()) {
    const sin = await falla(l(undefined));
    const tutora = await falla(l(ROSA));
    assert.equal(sin?.estado, 401, `llamada ${i} sin sesión`);
    assert.equal(tutora?.estado, 403, `llamada ${i} con Tutor`);
  }
  await listarRegistros(ADMIN, {}, ctx);
});

// --- Moderación de registros ---------------------------------------------------------------------------------------------------------------
test("HU 018 · deshabilitar: un solo movimiento y UNA entrada de bitácora (tipo, entidad, motivo, administrador) en la misma operación", async () => {
  const { ctx, almacen } = nuevoContexto();
  const antes = almacen.bitacora.length;
  const r = await deshabilitarCaso(ADMIN, MAX, `  ${MOTIVO}  `, ctx);
  assert.equal(r.estado, "Cerrado");
  assert.equal(almacen.bitacora.length, antes + 1);
  const e = ultimo(almacen);
  assert.deepEqual([e.tipoAccion, e.idAfectada, e.motivo, e.idUsuario], ["deshabilitar caso", "12", MOTIVO, 1]);
  const h = movs(almacen, 12).at(-1)!;
  assert.deepEqual([h.tipoMovimiento, h.idUsuario], ["deshabilitación", 1]);
});

test("HU 018 · deshabilitar desde cada estado menos Cerrado; repetir da 409 sin duplicar movimiento ni bitácora", async () => {
  const { ctx, almacen } = nuevoContexto();
  for (const folio of almacen.casos.map((c) => c.folio)) {
    const e = await consultarEstatus(ctx, folio);
    const antesH = almacen.historial.length, antesB = almacen.bitacora.length;
    if (e === "Cerrado") {
      await rechaza(deshabilitarCaso(ADMIN, folio, MOTIVO, ctx), 409);
      assert.equal(almacen.historial.length, antesH);
      assert.equal(almacen.bitacora.length, antesB);
    } else {
      await deshabilitarCaso(ADMIN, folio, MOTIVO, ctx);
      assert.equal(almacen.historial.length, antesH + 1);
      assert.equal(almacen.bitacora.length, antesB + 1);
      await rechaza(deshabilitarCaso(ADMIN, folio, MOTIVO, ctx), 409, "TRANSICION_INVALIDA");
      assert.equal(almacen.historial.length, antesH + 1);
      assert.equal(almacen.bitacora.length, antesB + 1);
    }
  }
});
async function consultarEstatus(ctx: ReturnType<typeof nuevoContexto>["ctx"], folio: string): Promise<"Cerrado" | "otro"> {
  const caso = (await ctx.repos.casos.porFolio(folio))!;
  return estadoActual(await historialDe(ctx.repos, caso.idCasoExtravio)) === "Cerrado" ? "Cerrado" : "otro";
}

test("HU 018 · motivo: obligatorio (422), ≤ 300 (422) y saneado; un fallo no deja movimiento ni bitácora", async () => {
  const { ctx, almacen } = nuevoContexto();
  const [h0, b0] = [almacen.historial.length, almacen.bitacora.length];
  await rechaza(deshabilitarCaso(ADMIN, MAX, "   ", ctx), 422);
  await rechaza(deshabilitarCaso(ADMIN, MAX, undefined, ctx), 422);
  await rechaza(deshabilitarCaso(ADMIN, MAX, "x".repeat(301), ctx), 422);
  assert.deepEqual([almacen.historial.length, almacen.bitacora.length], [h0, b0]);
  await deshabilitarCaso(ADMIN, MAX, "Texto <b>con</b> etiquetas", ctx);
  assert.ok(!/[<>]/.test(ultimo(almacen).motivo ?? ""));
});

test("HU 018 · restaurar: vuelve al estado previo (también un Localizado); cancelado y cierre confirmado dan 409; repetir da 409", async () => {
  const { ctx, almacen } = nuevoContexto();
  await deshabilitarCaso(ADMIN, TOBY, MOTIVO, ctx);
  const r = await restaurarCaso(ADMIN, TOBY, ctx);
  assert.equal(r.estado, "Localizado");
  assert.equal(ultimo(almacen).tipoAccion, "restaurar caso");
  await rechaza(restaurarCaso(ADMIN, TOBY, ctx), 409);
  await deshabilitarCaso(ADMIN, MAX, MOTIVO, ctx);
  assert.equal((await restaurarCaso(ADMIN, MAX, ctx)).estado, "En búsqueda");
  const b = almacen.bitacora.length;
  await rechaza(restaurarCaso(ADMIN, SIMBA, ctx), 409);
  await rechaza(restaurarCaso(ADMIN, ROCKY, ctx), 409);
  assert.equal(almacen.bitacora.length, b);
  assert.equal((await restaurarCaso(ADMIN, KIRA, ctx)).folio, KIRA); // sembrado como deshabilitado: sí se restaura
});

test("HU 018 · folio mal formado o inexistente = mismo 404; detalle y lista sin datos de la tutora ni token", async () => {
  const { ctx } = nuevoContexto();
  const a = await falla(detalleRegistro(ADMIN, "no-es-folio", ctx));
  const b = await falla(deshabilitarCaso(ADMIN, "RUPE-ZZZZZZZZ", MOTIVO, ctx));
  assert.deepEqual([a?.estado, b?.estado, a?.message], [404, 404, b?.message]);
  const txt = JSON.stringify([await detalleRegistro(ADMIN, MAX, ctx), await listarRegistros(ADMIN, {}, ctx)]);
  for (const prohibido of ["telefono", "contrasena", "token", "correo", "idUsuario", "vistoPorTutora", "relevante"]) assert.ok(!txt.toLowerCase().includes(prohibido.toLowerCase()), prohibido);
});

test("HU 018 · lista: páginas de 5, filtros validados (el inválido se informa y no se aplica)", async () => {
  const { ctx } = nuevoContexto();
  const l = await listarRegistros(ADMIN, { pagina: "2" }, ctx);
  assert.equal(l.total, 12);
  assert.equal(l.items.length, 5);
  assert.equal(l.totalPaginas, 3);
  const mala = await listarRegistros(ADMIN, { estado: "Inventado", alcaldia: "9999" }, ctx);
  assert.equal(mala.total, 12);
  assert.ok(mala.errores.estado && mala.errores.alcaldia);
  const ult = await listarRegistros(ADMIN, { pagina: "99" }, ctx);
  assert.equal(ult.pagina, 3);
});

// --- Visibilidad pública al moderar -------------------------------------------------------------------------------------------------------
test("R33 · deshabilitar oculta ficha y estatus públicos (404) y restaurar los devuelve; el Administrador conserva la foto por su vía", async () => {
  const { ctx } = nuevoContexto();
  await consultarFichaPorFolio(MAX, ctx);
  await deshabilitarCaso(ADMIN, MAX, MOTIVO, ctx);
  await rechaza(consultarFichaPorFolio(MAX, ctx), 404);
  await rechaza(consultarEstatusPorFolio(MAX, ctx), 404);
  await restaurarCaso(ADMIN, MAX, ctx);
  await consultarFichaPorFolio(MAX, ctx);
  await consultarEstatusPorFolio(MAX, ctx);
});

test("carrera · la tutora cancela y el Administrador deshabilita a la vez: gana uno, el otro recibe 409 y el historial no se duplica", async () => {
  const { ctx, almacen } = nuevoContexto();
  const [a, b] = await Promise.allSettled([cancelarCaso(ROSA, MAX, "Ya no aplica", ctx), deshabilitarCaso(ADMIN, MAX, MOTIVO, ctx)]);
  assert.equal([a, b].filter((x) => x.status === "fulfilled").length, 1);
  const rechazado = [a, b].find((x) => x.status === "rejected") as PromiseRejectedResult;
  assert.equal((rechazado.reason as ErrorApp).estado, 409);
  assert.equal(movs(almacen, 12).filter((h) => h.tipoMovimiento === "cancelación" || h.tipoMovimiento === "deshabilitación").length, 1);
});

test("concurrencia · 25 deshabilitaciones simultáneas del mismo caso = 1 éxito, 24 × 409 y una sola entrada de bitácora", async () => {
  const { ctx, almacen } = nuevoContexto();
  const b0 = almacen.bitacora.length;
  const r = await Promise.allSettled(Array.from({ length: 25 }, () => deshabilitarCaso(ADMIN, MAX, MOTIVO, ctx)));
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(r.filter((x) => x.status === "rejected" && (x.reason as ErrorApp).estado === 409).length, 24);
  assert.equal(almacen.bitacora.length, b0 + 1);
});

// --- Avistamientos -------------------------------------------------------------------------------------------------------------------------
test("HU 037 · ocultar/restaurar: motivo obligatorio, bitácora, repetir 409, restaurar limpia el motivo", async () => {
  const { ctx, almacen } = nuevoContexto();
  const b0 = almacen.bitacora.length;
  await rechaza(ocultarAvistamiento(ADMIN, "101", "  ", ctx), 422, "MOTIVO_OBLIGATORIO");
  await rechaza(ocultarAvistamiento(ADMIN, "101", "x".repeat(301), ctx), 422);
  assert.equal(almacen.bitacora.length, b0);
  await ocultarAvistamiento(ADMIN, "101", MOTIVO, ctx);
  const e = ultimo(almacen);
  assert.deepEqual([e.tipoAccion, e.idAfectada, e.motivo], ["ocultar avistamiento", "101", MOTIVO]);
  assert.equal(almacen.avistamientos.find((a) => a.idAvistamiento === 101)!.visible, false);
  await rechaza(ocultarAvistamiento(ADMIN, "101", MOTIVO, ctx), 409, "AVISTAMIENTO_YA_OCULTO");
  await restaurarAvistamiento(ADMIN, "101", ctx);
  const av = almacen.avistamientos.find((a) => a.idAvistamiento === 101)!;
  assert.equal(av.visible, true);
  assert.ok(!av.motivoModeracion);
  await rechaza(restaurarAvistamiento(ADMIN, "101", ctx), 409, "AVISTAMIENTO_YA_VISIBLE");
  await rechaza(ocultarAvistamiento(ADMIN, "abc", MOTIVO, ctx), 404);
  assert.equal(almacen.bitacora.length, b0 + 2);
});

test("HU 037 · concurrencia: 25 ocultaciones simultáneas = 1 éxito y 24 × 409", async () => {
  const { ctx } = nuevoContexto();
  const r = await Promise.allSettled(Array.from({ length: 25 }, () => ocultarAvistamiento(ADMIN, "102", MOTIVO, ctx)));
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(r.filter((x) => x.status === "rejected" && (x.reason as ErrorApp).estado === 409).length, 24);
});

test("HU 037 · privacidad: sin dirección/colonia/referencias/coordenadas ni marcas internas; comentario visible; «Fallecido» sin foto salvo verFoto", async () => {
  const { ctx, almacen } = nuevoContexto();
  const lista = await listarAvistamientos(ADMIN, {}, ctx);
  const todo = JSON.stringify([lista, await detalleAvistamiento(ADMIN, "102", {}, ctx)]);
  for (const k of ["direccionAproximada", "coloniaZona", "referenciasDelLugar", "latitud", "longitud", "precisionGps", "vistoPorTutora", "relevante", "ubicacionSimulada"]) assert.ok(!todo.includes(k), k);
  const conComentario = almacen.avistamientos.find((a) => a.comentario)!;
  assert.equal((await detalleAvistamiento(ADMIN, String(conComentario.idAvistamiento), {}, ctx)).comentario, conComentario.comentario);
  const fallecido = lista.items.concat((await listarAvistamientos(ADMIN, { pagina: "2" }, ctx)).items, (await listarAvistamientos(ADMIN, { pagina: "3" }, ctx)).items).find((a) => a.id === 102)!;
  assert.equal(fallecido.fallecido, true);
  assert.ok(!fallecido.fotografiaUrl);
  const sin = await detalleAvistamiento(ADMIN, "102", {}, ctx);
  const con = await detalleAvistamiento(ADMIN, "102", { verFoto: true }, ctx);
  assert.ok(!sin.fotografiaUrl);
  assert.ok(con.fotografiaUrl);
  for (const p of [1, 2, 3]) for (const a of (await listarAvistamientos(ADMIN, { pagina: String(p) }, ctx)).items) if (a.fallecido) assert.ok(!a.fotografiaUrl);
});

test("HU 037 · rango de días: se aplica el válido; «hasta» anterior a «desde» o fecha irreal se informa y no filtra", async () => {
  const { ctx } = nuevoContexto();
  const todos = (await listarAvistamientos(ADMIN, {}, ctx)).total;
  const mal = await listarAvistamientos(ADMIN, { desde: "2026-02-31", hasta: "x" }, ctx);
  assert.equal(mal.total, todos);
  assert.ok(mal.errores.desde && mal.errores.hasta);
  const inv = await listarAvistamientos(ADMIN, { desde: "2026-10-10", hasta: "2026-10-01" }, ctx);
  assert.ok(inv.errores.hasta);
  const solo = await listarAvistamientos(ADMIN, { desde: "2026-10-18", hasta: "2026-10-18" }, ctx);
  assert.ok(solo.total <= todos);
});

// --- Bitácora ------------------------------------------------------------------------------------------------------------------------------
test("HU 058 · bitácora: 30 sembradas, más reciente primero, páginas de 8, folio/nombre en la entidad, las nuevas aparecen arriba", async () => {
  const { ctx } = nuevoContexto();
  const p1 = await consultarBitacora(ADMIN, {}, ctx);
  assert.equal(p1.total, 30);
  assert.equal(p1.items.length, 8);
  assert.equal(p1.totalPaginas, 4);
  await deshabilitarCaso(ADMIN, MAX, MOTIVO, ctx);
  const n = await consultarBitacora(ADMIN, {}, ctx);
  assert.equal(n.total, 31);
  assert.equal(n.items[0].tipo, "deshabilitar caso");
  assert.ok(JSON.stringify(n.items[0]).includes(MAX));
  const orden = (await consultarBitacora(ADMIN, { pagina: "1" }, ctx)).items.map((e) => e.fechaHora);
  assert.deepEqual(orden, [...orden].sort().reverse());
});

test("HU 058 · filtros de bitácora: tipo válido, rango en día CDMX, inválidos se informan", async () => {
  const { ctx } = nuevoContexto();
  const t = await consultarBitacora(ADMIN, { tipo: "cambiar rol" }, ctx);
  assert.ok(t.items.every((e) => e.tipo === "cambiar rol"));
  const mal = await consultarBitacora(ADMIN, { tipo: "inventado", desde: "2026-13-01" }, ctx);
  assert.equal(mal.total, 30);
  assert.ok(mal.errores.tipo && mal.errores.desde);
  const dia = await consultarBitacora(ADMIN, { desde: "2026-10-18", hasta: "2026-10-18" }, ctx);
  assert.ok(dia.total >= 5); // las 5 reactivaciones sembradas del día
});

// --- Seed: reactivaciones posteriores a las desactivaciones --------------------------------------------------------------------------------------
test("seed · las 5 reactivaciones de catálogo son 'edición de catálogo', posteriores a la desactivación del mismo elemento y con ids consecutivos", async () => {
  const { almacen } = nuevoContexto();
  assert.equal(almacen.bitacora.length, 30);
  const ids = ["alcaldia:12", "raza:6", "motivo:2", "estado_animal:16", "estado_animal:17"];
  for (const id of ids) {
    const mias = almacen.bitacora.filter((e) => e.idAfectada === id);
    const des = mias.find((e) => e.tipoAccion === "desactivación de catálogo");
    const re = mias.find((e) => e.tipoAccion === "edición de catálogo");
    assert.ok(des && re, id);
    assert.ok(re.fechaHora > des.fechaHora, id);
    assert.ok(re.idBitacoraAdmin > des.idBitacoraAdmin, id);
  }
  const idsBit = almacen.bitacora.map((e) => e.idBitacoraAdmin);
  assert.deepEqual(idsBit, idsBit.map((_, i) => i + 1));
});

// --- Usuarios ------------------------------------------------------------------------------------------------------------------------------
test("HU 008/009 · lista: sin teléfono, hash ni intentos; búsqueda sin acentos; filtro de estatus; páginas de 5", async () => {
  const { ctx } = nuevoContexto();
  const l = await listarUsuarios(ADMIN, {}, ctx);
  assert.equal(l.total, 12);
  assert.equal(l.items.length, 5);
  const t = JSON.stringify(l);
  for (const k of ["telefono", "contrasenaHash", "intentos", "hash"]) assert.ok(!t.toLowerCase().includes(k.toLowerCase()), k);
  assert.ok((await listarUsuarios(ADMIN, { texto: "hernandez" }, ctx)).items.some((u) => u.nombreCompleto.includes("Hernández")));
  const inactivos = await listarUsuarios(ADMIN, { estatus: "inactivo" }, ctx);
  assert.equal(inactivos.total, 3);
  assert.ok((await listarUsuarios(ADMIN, { estatus: "raro" }, ctx)).errores.estatus);
});

test("R19 · deshabilitar a una tutora cierra sus sesiones en la misma operación, deja bitácora; habilitar vuelve a activarla", async () => {
  const { ctx, almacen } = nuevoContexto();
  almacen.sesiones.push({ idSesion: 1, idUsuario: 5, tokenHash: "h1", fechaInicio: AHORA.toISOString(), fechaCierre: null } as never, { idSesion: 2, idUsuario: 5, tokenHash: "h2", fechaInicio: AHORA.toISOString(), fechaCierre: null } as never);
  const r = await deshabilitarUsuario(ADMIN, "5", {}, ctx);
  assert.deepEqual([r.activo, r.sesionesCerradas, r.cerroSuPropiaSesion], [false, 2, false]);
  assert.ok(almacen.sesiones.filter((s) => s.idUsuario === 5).every((s) => s.fechaCierre));
  assert.deepEqual([ultimo(almacen).tipoAccion, ultimo(almacen).idAfectada], ["deshabilitar usuario", "5"]);
  await rechaza(deshabilitarUsuario(ADMIN, "5", {}, ctx), 409, "SIN_CAMBIO");
  const h = await habilitarUsuario(ADMIN, "5", ctx);
  assert.equal(h.activo, true);
  assert.equal(ultimo(almacen).tipoAccion, "habilitar usuario");
  await rechaza(habilitarUsuario(ADMIN, "5", ctx), 409, "SIN_CAMBIO");
});

test("R21 · el último administrador activo no se deshabilita ni se degrada (409 ULTIMO_ADMINISTRADOR) y no queda bitácora", async () => {
  const { ctx, almacen } = nuevoContexto();
  const b0 = almacen.bitacora.length;
  await rechaza(deshabilitarUsuario(ADMIN, "1", { confirmarSesionPropia: true }, ctx), 409, "ULTIMO_ADMINISTRADOR");
  await rechaza(cambiarRol(ADMIN, "1", "Tutor", { confirmarSesionPropia: true }, ctx), 409, "ULTIMO_ADMINISTRADOR");
  assert.equal(almacen.bitacora.length, b0);
  assert.equal(almacen.usuarios.find((u) => u.idUsuario === 1)!.estatus, 1);
});

test("auto-acción · con otro administrador activo, la propia cuenta exige confirmación (409 CONFIRMACION_REQUERIDA) y al confirmar cierra su sesión", async () => {
  const { ctx, almacen } = nuevoContexto();
  await habilitarUsuario(ADMIN, "4", ctx); // segunda administradora
  const b0 = almacen.bitacora.length;
  await rechaza(deshabilitarUsuario(ADMIN, "1", {}, ctx), 409, "CONFIRMACION_REQUERIDA");
  await rechaza(cambiarRol(ADMIN, "1", "Tutor", {}, ctx), 409, "CONFIRMACION_REQUERIDA");
  assert.equal(almacen.bitacora.length, b0);
  const r = await cambiarRol(ADMIN, "1", "Tutor", { confirmarSesionPropia: true }, ctx);
  assert.equal(r.cerroSuPropiaSesion, true);
  assert.equal(almacen.usuarios.find((u) => u.idUsuario === 1)!.rol, "Tutor");
});

test("cambiar rol: detalle «anterior → nuevo» en bitácora, rol inválido 422, mismo rol 409, usuario inexistente 404", async () => {
  const { ctx, almacen } = nuevoContexto();
  const r = await cambiarRol(ADMIN, "2", "Administrador", {}, ctx);
  assert.equal(r.rol, "Administrador");
  assert.deepEqual([ultimo(almacen).tipoAccion, ultimo(almacen).detalle], ["cambiar rol", "Tutor → Administrador"]);
  await rechaza(cambiarRol(ADMIN, "2", "Superusuario", {}, ctx), 422, "ROL_INVALIDO");
  await rechaza(cambiarRol(ADMIN, "2", "Administrador", {}, ctx), 409);
  await rechaza(cambiarRol(ADMIN, "9999", "Tutor", {}, ctx), 404);
  await rechaza(deshabilitarUsuario(ADMIN, "abc", {}, ctx), 404);
});

test("rollback · si la bitácora rechaza la entrada, no queda cambio de usuario, sesiones ni casos", async () => {
  const { ctx, almacen } = nuevoContexto();
  almacen.sesiones.push({ idSesion: 1, idUsuario: 5, tokenHash: "h1", fechaInicio: AHORA.toISOString(), fechaCierre: null } as never);
  const orig = almacen.bitacora.push.bind(almacen.bitacora);
  almacen.bitacora.push = () => { throw new Error("fallo simulado"); };
  await assert.rejects(deshabilitarUsuario(ADMIN, "5", {}, ctx));
  await assert.rejects(deshabilitarCaso(ADMIN, MAX, MOTIVO, ctx));
  almacen.bitacora.push = orig;
  assert.equal(almacen.usuarios.find((u) => u.idUsuario === 5)!.estatus, 1);
  assert.equal(almacen.sesiones.find((s) => s.idUsuario === 5)!.fechaCierre, null);
  assert.equal(almacen.bitacora.length, 30);
  assert.equal(movs(almacen, 12).at(-1)!.tipoMovimiento !== "deshabilitación", true);
});
