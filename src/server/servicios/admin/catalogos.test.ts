import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { REGLAS_CATALOGO, TIPOS_CATALOGO, type TipoCatalogo } from "../../../config/catalogos";
import { LIMITE_TECNICO_MB } from "../../../config/parametros";
import { validarEstadosAnimal } from "../../dominio/estadosAnimal";
import { PERIODO_PREDETERMINADO_ORACULO as PERIODO_PREDETERMINADO, reporteOraculo as generarReporte, tableroOraculo as calcularTablero } from "../../../../scripts/mocks-de-prueba";
import { ErrorApp } from "../../errores";
import { AHORA, nuevoContexto, secretoAleatorio } from "../../pruebas/auxiliares";
import { jpeg } from "../../pruebas/imagenes";
import { CAMPOS_CATALOGO_ADMIN, CAMPOS_ESTADO_CASO_ADMIN, CAMPOS_PARAMETRO_ADMIN } from "../../serializadores/admin";
import { iniciarSesion } from "../../sesion/autenticacion";
import type { SesionActual } from "../../sesion/guardas";
import { iniciarReporte, registrarAvistamiento } from "../avistamientos";
import { limiteDeCuerpo, registrarExtravio } from "../extravio";
import { consultarEstatusPorFolio, consultarFichaPorFolio } from "../fichas";
import { alcaldiasParaFiltrar, opcionesDeRegistro } from "../catalogosRegistro";
import { consultarBitacora } from "./bitacoraAdmin";
import { altaCatalogo, desactivarCatalogo, editarCatalogo, listarCatalogo } from "./catalogosAdmin";
import { listarEstadosCaso } from "./estadosCasoAdmin";
import { listarParametros, modificarParametros, restablecerParametros } from "./parametrosAdmin";
import { detalleRegistro } from "./moderacionRegistros";

type Ctx = ReturnType<typeof nuevoContexto>;
const ADMIN: SesionActual = { idUsuario: 1, rol: "Administrador", nombre: "Ricardo Vega Ficticio" };
const ROSA: SesionActual = { idUsuario: 2, rol: "Tutor", nombre: "Rosa Hernández Ficticia" };
const MAX = "RUPE-K7M4XQ9T";
const falla = (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => (e instanceof ErrorApp ? e : undefined));
const rechaza = async (p: Promise<unknown>, estado: number, codigo?: string) => {
  const e = await falla(p);
  assert.ok(e, "debía rechazar");
  assert.equal(e.estado, estado, `${e.codigo}: ${e.message}`);
  if (codigo) assert.equal(e.codigo, codigo);
  return e;
};
/** Huella del CONTENIDO de lo que estas acciones pueden tocar: catálogos, parámetros, bitácora y contadores de id (no solo el largo ni el texto). */
const huella = (a: Ctx["almacen"]) => createHash("sha256").update(JSON.stringify({ al: a.alcaldias, ra: a.razas, mo: a.motivos, es: a.estadosAnimal, pa: a.parametros, bi: a.bitacora, ids: a.ids })).digest("hex");
const ultimo = (a: Ctx["almacen"]) => a.bitacora[a.bitacora.length - 1];
const NUEVO: Record<TipoCatalogo, Record<string, unknown>> = {
  alcaldias: { nombre: "Nueva Alcaldía", clave: "09018" },
  razas: { nombre: "Raza Nueva" },
  motivos: { nombre: "Motivo Nuevo", idCategoria: 3, descripcion: "Descripción del motivo nuevo." },
  "estados-animal": { nombre: "Estado Nuevo", idCategoria: 1, descripcion: "Descripción del estado nuevo." },
};
const SIGUIENTE_ID: Record<TipoCatalogo, number> = { alcaldias: 18, razas: 15, motivos: 16, "estados-animal": 18 };
const ETIQUETA: Record<TipoCatalogo, string> = { alcaldias: "alcaldia", razas: "raza", motivos: "motivo", "estados-animal": "estado_animal" };

// --- Roles ---------------------------------------------------------------------------------------------------------------------------------
test("roles · TODOS los servicios nuevos: sin sesión 401, Tutor 403 (los de la persona tutora al revés); el Administrador pasa", async () => {
  const { ctx } = nuevoContexto();
  const deAdmin: Array<(s: SesionActual | undefined) => Promise<unknown>> = [
    ...TIPOS_CATALOGO.flatMap((t) => [(s: SesionActual | undefined) => listarCatalogo(s, t, {}, ctx), (s: SesionActual | undefined) => altaCatalogo(s, t, NUEVO[t], ctx), (s: SesionActual | undefined) => editarCatalogo(s, t, "2", NUEVO[t], ctx), (s: SesionActual | undefined) => desactivarCatalogo(s, t, "2", ctx)]),
    (s) => listarParametros(s, ctx), (s) => modificarParametros(s, { version_aviso_privacidad: "2.0" }, ctx), (s) => restablecerParametros(s, ctx), (s) => listarEstadosCaso(s, ctx),
  ];
  for (const [i, l] of deAdmin.entries()) {
    assert.equal((await falla(l(undefined)))?.estado, 401, `servicio ${i} sin sesión`);
    assert.equal((await falla(l(ROSA)))?.estado, 403, `servicio ${i} con Tutor`);
  }
  await listarCatalogo(ADMIN, "razas", {}, ctx);
  for (const l of [(s: SesionActual | undefined) => opcionesDeRegistro(s, ctx), (s: SesionActual | undefined) => alcaldiasParaFiltrar(s, ctx)]) {
    assert.equal((await falla(l(undefined)))?.estado, 401);
    assert.equal((await falla(l(ADMIN)))?.estado, 403);
    await l(ROSA);
  }
  // Un catálogo desconocido da 404 uniforme (pero solo después de la guarda: sin sesión sigue siendo 401).
  await rechaza(listarCatalogo(ADMIN, "usuarios", {}, ctx), 404);
  await rechaza(altaCatalogo(undefined, "usuarios", {}, ctx), 401);
  await rechaza(editarCatalogo(ADMIN, "razas", "abc", {}, ctx), 404);
  await rechaza(editarCatalogo(ADMIN, "razas", "9999", NUEVO.razas, ctx), 404);
  await rechaza(desactivarCatalogo(ADMIN, "razas", "9999", ctx), 404);
});

// --- Altas, ediciones, desactivaciones y bitácora -----------------------------------------------------------------------------------------------
test("HU 049-052 · alta en los 4 catálogos: queda ACTIVA con el siguiente id y UNA entrada «alta de catálogo» con el nombre", async () => {
  for (const t of TIPOS_CATALOGO) {
    const { ctx, almacen } = nuevoContexto();
    const b0 = almacen.bitacora.length;
    const r = await altaCatalogo(ADMIN, t, NUEVO[t], ctx);
    assert.equal(r.item.id, SIGUIENTE_ID[t], t);
    assert.equal(r.item.activo, true);
    assert.equal(r.item.protegido, false);
    assert.equal(almacen.bitacora.length, b0 + 1, `${t}: una entrada por acción`);
    assert.deepEqual({ ...ultimo(almacen) }, { idBitacoraAdmin: 31, tipoAccion: "alta de catálogo", idAfectada: `${ETIQUETA[t]}:${SIGUIENTE_ID[t]}`, detalle: NUEVO[t].nombre, fechaHora: AHORA.toISOString(), idUsuario: 1 });
    const l = await listarCatalogo(ADMIN, t, { pagina: "99" }, ctx);
    assert.ok(l.items.some((x) => x.id === SIGUIENTE_ID[t] && x.nombre === NUEVO[t].nombre));
  }
});

test("R34 · el nombre y la descripción se sanean antes de guardar: «<b>x</b>» queda «x»", async () => {
  const { ctx, almacen } = nuevoContexto();
  const r = await altaCatalogo(ADMIN, "motivos", { nombre: " <b>x</b> ", idCategoria: 1, descripcion: "<i>d</i>\u0007esc" }, ctx);
  assert.deepEqual([r.item.nombre, r.item.descripcion], ["x", "desc"]);
  assert.equal(almacen.motivos.at(-1)!.nombre, "x");
  assert.equal(ultimo(almacen).detalle, "x");
  await rechaza(altaCatalogo(ADMIN, "razas", { nombre: "<b></b>" }, ctx), 422, "VALIDACION");
});

test("unicidad (servicio) · sin acentos ni mayúsculas, en alta y en edición; el rechazo no escribe NADA (huella igual)", async () => {
  const { ctx, almacen } = nuevoContexto();
  const antes = huella(almacen);
  const e = await rechaza(altaCatalogo(ADMIN, "razas", { nombre: "  PUG   (carlino) " }, ctx), 409, "NOMBRE_DUPLICADO");
  assert.ok(e.campos?.nombre);
  await rechaza(altaCatalogo(ADMIN, "alcaldias", { nombre: "coyoacan", clave: "09018" }, ctx), 409, "NOMBRE_DUPLICADO");
  await rechaza(altaCatalogo(ADMIN, "alcaldias", { nombre: "Otra", clave: "09003" }, ctx), 409, "CLAVE_DUPLICADA");
  await rechaza(altaCatalogo(ADMIN, "motivos", { nombre: "PANICO por ruidos fuertes", idCategoria: 1, descripcion: "d" }, ctx), 409, "NOMBRE_DUPLICADO");
  await rechaza(altaCatalogo(ADMIN, "estados-animal", { nombre: "fallecido", idCategoria: 1, descripcion: "d" }, ctx), 409, "NOMBRE_DUPLICADO");
  await rechaza(editarCatalogo(ADMIN, "razas", "3", { nombre: "pug (CARLINO)" }, ctx), 409, "NOMBRE_DUPLICADO");
  await rechaza(editarCatalogo(ADMIN, "alcaldias", "4", { nombre: "Coyoacán", clave: "09002" }, ctx), 409, "CLAVE_DUPLICADA"); // 4 = Coyoacán; 09002 es la clave de Azcapotzalco
  assert.equal(huella(almacen), antes);
  // Editarse a sí misma, con otro tamaño de letra, sí se puede.
  const ok = await editarCatalogo(ADMIN, "razas", "6", { nombre: "PUG (CARLINO)" }, ctx);
  assert.equal(ok.sinCambios, false);
});

test("edición · bitácora «anterior → nuevo» (incluida la reactivación); sin cambios = 200 sinCambios y NADA escrito; reactivar = editar con activo:true", async () => {
  const { ctx, almacen } = nuevoContexto();
  const e1 = await editarCatalogo(ADMIN, "motivos", "3", { nombre: "Cambios en el entorno", idCategoria: 2, descripcion: "Otra descripción" }, ctx);
  assert.deepEqual([e1.sinCambios, e1.reactivado, e1.item.nombre, e1.item.idCategoria], [false, false, "Cambios en el entorno", 2]);
  assert.deepEqual([ultimo(almacen).tipoAccion, ultimo(almacen).idAfectada, ultimo(almacen).detalle], ["edición de catálogo", "motivo:3", "nombre: «Cambios drásticos en el entorno» → «Cambios en el entorno»; categoría: «Detonantes Emocionales y Ambientales» → «Impulsos Biológicos y Conductuales»; descripción modificada"]);
  assert.ok(!ultimo(almacen).detalle!.includes("Otra descripción"), "D4: la descripción no se copia a la bitácora");
  const antes = huella(almacen);
  const sin = await editarCatalogo(ADMIN, "motivos", "3", { nombre: "Cambios en el entorno", idCategoria: 2, descripcion: "Otra descripción" }, ctx);
  assert.deepEqual([sin.sinCambios, sin.reactivado], [true, false]);
  assert.equal(huella(almacen), antes, "sin cambios no se escribe nada");
  // Desactivar y reactivar.
  await desactivarCatalogo(ADMIN, "alcaldias", "12", ctx);
  assert.deepEqual([ultimo(almacen).tipoAccion, ultimo(almacen).idAfectada, ultimo(almacen).detalle], ["desactivación de catálogo", "alcaldia:12", "Activa → Inactiva"]);
  const b = almacen.bitacora.length;
  const a12 = almacen.alcaldias.find((a) => a.idAlcaldia === 12)!;
  const re = await editarCatalogo(ADMIN, "alcaldias", "12", { nombre: a12.nombre, clave: a12.claveGeoestadistica, activo: true }, ctx);
  assert.deepEqual([re.reactivado, re.item.activo, almacen.bitacora.length], [true, true, b + 1]);
  assert.deepEqual([ultimo(almacen).tipoAccion, ultimo(almacen).detalle], ["edición de catálogo", "Inactiva → Activa"]);
  // Reactivar y renombrar a la vez: un solo registro con ambos cambios.
  await desactivarCatalogo(ADMIN, "razas", "6", ctx);
  await editarCatalogo(ADMIN, "razas", "6", { nombre: "Pug", activo: true }, ctx);
  assert.equal(ultimo(almacen).detalle, "nombre: «Pug (Carlino)» → «Pug»; estatus: Inactiva → Activa");
  // Editar no desactiva: para eso es «desactivar» (422 con campo).
  const e = await rechaza(editarCatalogo(ADMIN, "razas", "7", { nombre: "Golden Retriever", activo: false }, ctx), 422);
  assert.ok(e.campos?.activo);
});

test("protegidos · alcaldía 17, razas 1 y 14, motivos 14 y 15, estados 1, 5 y 6: 409 VALOR_PROTEGIDO sin escribir nada; sí se pueden renombrar", async () => {
  const { ctx, almacen } = nuevoContexto();
  const casos: [TipoCatalogo, number][] = [["alcaldias", 17], ["razas", 1], ["razas", 14], ["motivos", 14], ["motivos", 15], ["estados-animal", 1], ["estados-animal", 5], ["estados-animal", 6]];
  const antes = huella(almacen);
  for (const [t, id] of casos) {
    await rechaza(desactivarCatalogo(ADMIN, t, String(id), ctx), 409, "VALOR_PROTEGIDO");
    const item = (await listarCatalogo(ADMIN, t, { pagina: "99" }, ctx)).items.length;
    assert.ok(item > 0);
  }
  assert.equal(huella(almacen), antes);
  const r = await editarCatalogo(ADMIN, "razas", "14", { nombre: "Otra raza" }, ctx);
  assert.deepEqual([r.item.nombre, r.item.activo, r.item.protegido], ["Otra raza", true, true]);
  // Una protegida lo dice en el listado, con su motivo.
  const l = await listarCatalogo(ADMIN, "motivos", { pagina: "3" }, ctx);
  const m15 = l.items.find((x) => x.id === 15)!;
  assert.deepEqual([m15.protegido, typeof m15.motivoNoDesactivable], [true, "string"]);
});

test("última opción activa · estados: con la semilla real las 4 categorías tienen varias activas; en «Identificación visible» el 15 es la última solo tras desactivar 16 y 17 (409); reactivar otra lo libera", async () => {
  const { ctx, almacen } = nuevoContexto();
  const porCategoria = (c: number) => almacen.estadosAnimal.filter((e) => e.idCategoriaEstadoAnimal === c && e.estatus === 1).map((e) => e.idEstadoAnimal);
  assert.deepEqual([1, 2, 3, 4].map((c) => porCategoria(c).length), [6, 4, 4, 3], "semilla: ninguna categoría tiene una sola activa; el 15 NO es la única de la 4 al inicio");
  await desactivarCatalogo(ADMIN, "estados-animal", "16", ctx);
  await desactivarCatalogo(ADMIN, "estados-animal", "17", ctx);
  assert.deepEqual(porCategoria(4), [15]);
  const antes = huella(almacen);
  const e = await rechaza(desactivarCatalogo(ADMIN, "estados-animal", "15", ctx), 409, "ULTIMA_ACTIVA_DE_CATEGORIA");
  assert.ok(e.message.includes("Identificación visible"));
  assert.equal(huella(almacen), antes);
  // Tampoco se puede mover a otra categoría la última activa.
  await rechaza(editarCatalogo(ADMIN, "estados-animal", "15", { nombre: "Con placa y collar", idCategoria: 3, descripcion: "d" }, ctx), 409, "ULTIMA_ACTIVA_DE_CATEGORIA");
  // Reactivar otra libera la regla.
  await editarCatalogo(ADMIN, "estados-animal", "16", { nombre: "Con collar sin datos", idCategoria: 4, descripcion: "Lleva collar o arnés, pero sin placa o con una placa que no se puede leer.", activo: true }, ctx);
  await desactivarCatalogo(ADMIN, "estados-animal", "15", ctx);
  assert.deepEqual(porCategoria(4), [16]);
  // Razas y motivos NO tienen esta regla: se pueden dejar solo con los protegidos.
  for (const id of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) await desactivarCatalogo(ADMIN, "razas", String(id), ctx);
  assert.deepEqual(almacen.razas.filter((r) => r.estatus === 1).map((r) => r.idRaza), [1, 14]);
});

test("EXTENSIÓN (no pedida por las HU 049-052) · cada catálogo conserva al menos una alcaldía OFICIAL activa: la última da 409 ULTIMA_ALCALDIA_ACTIVA", async () => {
  const { ctx, almacen } = nuevoContexto();
  for (let id = 1; id <= 15; id++) await desactivarCatalogo(ADMIN, "alcaldias", String(id), ctx);
  const antes = huella(almacen);
  await rechaza(desactivarCatalogo(ADMIN, "alcaldias", "16", ctx), 409, "ULTIMA_ALCALDIA_ACTIVA");
  assert.equal(huella(almacen), antes);
  assert.deepEqual((await opcionesDeRegistro(ROSA, ctx)).alcaldias.map((a) => a.id), [16], "el formulario nunca se queda sin alcaldías");
  await editarCatalogo(ADMIN, "alcaldias", "1", { nombre: "Álvaro Obregón", clave: "09010", activo: true }, ctx);
  await desactivarCatalogo(ADMIN, "alcaldias", "16", ctx);
});

test("desactivar dos veces: 409 YA_DESACTIVADO sin segunda entrada de bitácora", async () => {
  const { ctx, almacen } = nuevoContexto();
  await desactivarCatalogo(ADMIN, "razas", "6", ctx);
  const b = almacen.bitacora.length;
  await rechaza(desactivarCatalogo(ADMIN, "razas", "6", ctx), 409, "YA_DESACTIVADO");
  assert.equal(almacen.bitacora.length, b);
});

test("R15 · la bitácora de catálogos y parámetros solo se agrega y se lee: lo que devuelve son copias y el repositorio no expone cómo editarla", async () => {
  const { ctx, almacen } = nuevoContexto();
  await altaCatalogo(ADMIN, "razas", NUEVO.razas, ctx);
  const copia = await ctx.repos.bitacora.todas();
  copia[0].detalle = "alterado";
  copia.pop();
  assert.equal(ultimo(almacen).detalle, "Raza Nueva");
  assert.deepEqual(Object.keys(ctx.repos.bitacora).sort(), ["agregar", "todas"]);
  const lista = await consultarBitacora(ADMIN, { tipo: "alta de catálogo" }, ctx);
  assert.equal(lista.items[0].entidadAfectada, "Razas · Raza Nueva (15)");
});

// --- Atomicidad: cada acción en UNA transacción ---------------------------------------------------------------------------------------------------
test("transacción · si la bitácora falla, NO queda nada a medias en ninguna tabla (huella de catálogos, parámetros, bitácora e ids)", async () => {
  const { ctx, almacen } = nuevoContexto();
  const romper = () => Object.defineProperty(almacen.bitacora, "push", { configurable: true, value: () => { throw new Error("falla simulada de la bitácora"); } });
  const arreglar = () => void delete (almacen.bitacora as { push?: unknown }).push;
  const acciones: Array<[string, () => Promise<unknown>]> = [
    ["alta alcaldías", () => altaCatalogo(ADMIN, "alcaldias", NUEVO.alcaldias, ctx)], ["alta razas", () => altaCatalogo(ADMIN, "razas", NUEVO.razas, ctx)],
    ["alta motivos", () => altaCatalogo(ADMIN, "motivos", NUEVO.motivos, ctx)], ["alta estados", () => altaCatalogo(ADMIN, "estados-animal", NUEVO["estados-animal"], ctx)],
    ["edición alcaldías", () => editarCatalogo(ADMIN, "alcaldias", "4", { nombre: "Coyoacán 2", clave: "09003" }, ctx)], ["edición razas", () => editarCatalogo(ADMIN, "razas", "3", { nombre: "Schnauzer" }, ctx)],
    ["edición motivos", () => editarCatalogo(ADMIN, "motivos", "3", { nombre: "Otro", idCategoria: 2, descripcion: "d" }, ctx)], ["edición estados", () => editarCatalogo(ADMIN, "estados-animal", "2", { nombre: "Herido", idCategoria: 1, descripcion: "d" }, ctx)],
    ["desactivar alcaldías", () => desactivarCatalogo(ADMIN, "alcaldias", "3", ctx)], ["desactivar razas", () => desactivarCatalogo(ADMIN, "razas", "3", ctx)],
    ["desactivar motivos", () => desactivarCatalogo(ADMIN, "motivos", "3", ctx)], ["desactivar estados", () => desactivarCatalogo(ADMIN, "estados-animal", "2", ctx)],
    ["modificar parámetros", () => modificarParametros(ADMIN, { version_aviso_privacidad: "9.0", expiracion_token_minutos: 5, tamano_maximo_archivo_mb: 2 }, ctx)],
  ];
  for (const [nombre, accion] of acciones) {
    const antes = huella(almacen);
    romper();
    const e = await accion().then(() => undefined, (x: unknown) => x);
    arreglar();
    assert.ok(e instanceof Error && e.message.includes("falla simulada"), `${nombre}: debía fallar`);
    assert.equal(huella(almacen), antes, `${nombre}: quedó algo a medias`);
    await accion(); // y sin la falla la misma acción SÍ procede (la prueba no se cumple por casualidad)
    assert.notEqual(huella(almacen), antes, `${nombre}: sin falla debía cambiar`);
    Object.assign(almacen, nuevoContexto().almacen); // vuelve a la base para la siguiente acción
  }
});

// --- Concurrencia ------------------------------------------------------------------------------------------------------------------------------------
test("concurrencia · 25 altas simultáneas del mismo nombre = 1 creada + 24 con 409; 25 desactivaciones del mismo id = 1 aplicada + 24 con 409", async () => {
  const { ctx, almacen } = nuevoContexto();
  const [altasBase, desactBase] = [almacen.bitacora.filter((b) => b.tipoAccion === "alta de catálogo").length, almacen.bitacora.filter((b) => b.tipoAccion === "desactivación de catálogo").length]; // la bitácora sembrada ya trae algunas
  const altas = await Promise.allSettled(Array.from({ length: 25 }, () => altaCatalogo(ADMIN, "razas", { nombre: "Raza Concurrente" }, ctx)));
  assert.equal(altas.filter((r) => r.status === "fulfilled").length, 1);
  const rechazadas = altas.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  assert.equal(rechazadas.length, 24);
  assert.ok(rechazadas.every((r) => r.reason instanceof ErrorApp && r.reason.estado === 409 && r.reason.codigo === "NOMBRE_DUPLICADO"), "las 24 rechazadas son 409 NOMBRE_DUPLICADO");
  assert.equal(almacen.razas.filter((r) => r.nombre === "Raza Concurrente").length, 1);
  assert.equal(almacen.bitacora.filter((b) => b.tipoAccion === "alta de catálogo").length, altasBase + 1);
  // Mismo nombre escrito de distintas maneras, a la vez: tampoco se cuela ninguna.
  const variantes = await Promise.allSettled(["Raza Variante", "raza variante", "RAZA  VARIANTE", "Raza Varíante"].flatMap((n) => Array.from({ length: 5 }, () => altaCatalogo(ADMIN, "razas", { nombre: n }, ctx))));
  assert.equal(variantes.filter((r) => r.status === "fulfilled").length, 1);

  const desact = await Promise.allSettled(Array.from({ length: 25 }, () => desactivarCatalogo(ADMIN, "razas", "7", ctx)));
  assert.equal(desact.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(desact.filter((r): r is PromiseRejectedResult => r.status === "rejected").every((r) => r.reason instanceof ErrorApp && r.reason.estado === 409 && r.reason.codigo === "YA_DESACTIVADO"), "las 24 rechazadas son 409 YA_DESACTIVADO");
  assert.equal(almacen.bitacora.filter((b) => b.tipoAccion === "desactivación de catálogo").length, desactBase + 1);

  // La última opción activa también resiste la carrera: de 3 estados de una categoría, desactivados a la vez todos, quedan al menos 1.
  const cat4 = await Promise.allSettled(["15", "16", "17", "15", "16", "17"].map((id) => desactivarCatalogo(ADMIN, "estados-animal", id, ctx)));
  assert.equal(cat4.filter((r) => r.status === "fulfilled").length, 2);
  assert.equal(almacen.estadosAnimal.filter((e) => e.idCategoriaEstadoAnimal === 4 && e.estatus === 1).length, 1);
});

// --- Parámetros ---------------------------------------------------------------------------------------------------------------------------------------
test("HU 054 · modificar: una entrada por parámetro que CAMBIÓ con «anterior → nuevo», todo en una transacción; sin cambios no escribe nada; un valor malo no cambia ninguno", async () => {
  const { ctx, almacen } = nuevoContexto();
  const b0 = almacen.bitacora.length;
  const r = await modificarParametros(ADMIN, { version_aviso_privacidad: "2.0", expiracion_token_minutos: "30", tamano_maximo_archivo_mb: 4 }, ctx);
  assert.deepEqual(r.cambios, [{ clave: "version_aviso_privacidad", anterior: "1.0", nuevo: "2.0" }, { clave: "expiracion_token_minutos", anterior: "60", nuevo: "30" }]);
  assert.deepEqual([r.sinCambios, r.avisoReaceptacion, almacen.bitacora.length], [false, true, b0 + 2]);
  assert.deepEqual(almacen.bitacora.slice(-2).map((b) => [b.tipoAccion, b.idAfectada, b.detalle, b.idUsuario]), [["modificar parámetro", "version_aviso_privacidad", "1.0 → 2.0", 1], ["modificar parámetro", "expiracion_token_minutos", "60 → 30", 1]]);
  const antes = huella(almacen);
  const igual = await modificarParametros(ADMIN, { version_aviso_privacidad: "2.0", tamano_maximo_archivo_mb: "4.0" }, ctx);
  assert.deepEqual([igual.sinCambios, igual.avisoReaceptacion, igual.cambios.length], [true, false, 0]);
  assert.equal(huella(almacen), antes);
  const mal = await rechaza(modificarParametros(ADMIN, { version_aviso_privacidad: "3.0", tamano_maximo_archivo_mb: 4.51 }, ctx), 422);
  assert.ok(mal.campos?.tamano_maximo_archivo_mb);
  assert.equal(huella(almacen), antes, "con un valor malo no se cambia NINGUNO");
  await modificarParametros(ADMIN, { tamano_maximo_archivo_mb: LIMITE_TECNICO_MB }, ctx);
  assert.equal(await ctx.repos.parametros.valor("tamano_maximo_archivo_mb"), "4.5");
});

test("HU 054 · restablecer copia los valores por defecto con una entrada por parámetro que cambió; si ya están, no escribe nada", async () => {
  const { ctx, almacen } = nuevoContexto();
  const antes = huella(almacen);
  assert.equal((await restablecerParametros(ADMIN, ctx)).sinCambios, true);
  assert.equal(huella(almacen), antes);
  await modificarParametros(ADMIN, { version_aviso_privacidad: "5.1", tamano_maximo_archivo_mb: 2 }, ctx);
  const b = almacen.bitacora.length;
  const r = await restablecerParametros(ADMIN, ctx);
  assert.deepEqual(r.cambios.map((c) => [c.clave, c.anterior, c.nuevo]), [["version_aviso_privacidad", "5.1", "1.0"], ["tamano_maximo_archivo_mb", "2", "4"]]);
  assert.equal(almacen.bitacora.length, b + 2);
  assert.deepEqual(almacen.parametros.map((p) => p.valor), ["1.0", "60", "4"]);
});

test("HU 054 · efectos reales: la versión nueva del aviso se pide en el siguiente inicio de sesión (R22) y el tamaño máximo gobierna el límite de cuerpo y la foto", async () => {
  const contrasena = secretoAleatorio();
  const secreto = secretoAleatorio();
  const { ctx } = nuevoContexto({ RUPE_TUTOR1_CONTRASENA: contrasena });
  const tutor = (await ctx.repos.usuarios.porId(2))!;
  const r = await modificarParametros(ADMIN, { version_aviso_privacidad: "2.0" }, ctx);
  assert.equal(r.avisoReaceptacion, true);
  const e = await falla(iniciarSesion({ correo: tutor.correo, contrasena }, ctx, secreto));
  assert.deepEqual([e?.estado, e?.codigo, e?.extra], [409, "AVISO_DESACTUALIZADO", { versionAviso: "2.0" }]);
  assert.ok((await iniciarSesion({ correo: tutor.correo, contrasena, aceptarAviso: true }, ctx, secreto)).valorCookie, "con el aviso aceptado se abre la sesión");
  assert.ok((await iniciarSesion({ correo: tutor.correo, contrasena }, ctx, secreto)).valorCookie, "ya aceptada: no se vuelve a pedir");
  // Tamaño máximo: límite de cuerpo = máximo + margen, y la foto de un registro se valida contra ÉL.
  const datos = { nombre: "Pelusa", sexo: "Hembra", idRaza: 1, edad: { valor: 3, unidad: "años" }, tamano: "pequeño", color: "Blanco", fechaExtravio: "2026-10-18", momento: "tarde", alcaldia: "Coyoacán", colonia: "Del Carmen", idMotivo: 1 };
  const base = await limiteDeCuerpo(ctx);
  await modificarParametros(ADMIN, { tamano_maximo_archivo_mb: 1 }, ctx);
  assert.equal(base - (await limiteDeCuerpo(ctx)), 3 * 1024 * 1024);
  const grande = { bytes: jpeg(1.2 * 1024 * 1024), tipoDeclarado: "image/jpeg" };
  const chica = { bytes: jpeg(), tipoDeclarado: "image/jpeg" };
  const foto = await rechaza(registrarExtravio(ROSA, { datos, foto: grande }, ctx), 422);
  assert.ok(foto.campos?.foto?.includes("1 MB"), foto.campos?.foto);
  await registrarExtravio(ROSA, { datos, foto: chica }, ctx);
  await modificarParametros(ADMIN, { tamano_maximo_archivo_mb: 4.5 }, ctx);
  assert.equal((await opcionesDeRegistro(ROSA, ctx)).maximoMb, 4.5);
  assert.equal((await iniciarReporte({ canal: "folio", folio: MAX }, ctx)).maximoMb, 4.5);
});

// --- Formularios y datos históricos --------------------------------------------------------------------------------------------------------------
test("formulario de registro · solo ACTIVOS: desactivar raza/alcaldía/motivo los quita, el alta por API con ese valor da 422 amable, reactivar lo devuelve y un caso existente lo sigue mostrando", async () => {
  const { ctx, almacen } = nuevoContexto();
  const caso = almacen.casos.find((c) => !REGLAS_CATALOGO.razas.protegidos.includes(almacen.perros.find((p) => p.idPerro === c.idPerro)!.idRaza) && ![4, 17].includes(c.idAlcaldia) && !REGLAS_CATALOGO.motivos.protegidos.includes(c.idMotivo))!;
  const perro = almacen.perros.find((p) => p.idPerro === caso.idPerro)!;
  const nombreRaza = almacen.razas.find((r) => r.idRaza === perro.idRaza)!.nombre;
  const nombreAlcaldia = almacen.alcaldias.find((a) => a.idAlcaldia === caso.idAlcaldia)!.nombre;
  const nombreMotivo = almacen.motivos.find((m) => m.idMotivo === caso.idMotivo)!.nombre;
  const datos = (extra: Record<string, unknown> = {}) => ({ nombre: "Pelusa", sexo: "Hembra", idRaza: 1, edad: { valor: 3, unidad: "años" }, tamano: "pequeño", color: "Blanco", fechaExtravio: "2026-10-18", momento: "tarde", alcaldia: "Coyoacán", colonia: "Del Carmen", idMotivo: 1, ...extra });
  const foto = { bytes: jpeg(), tipoDeclarado: "image/jpeg" };
  const antes = await opcionesDeRegistro(ROSA, ctx);
  assert.ok(antes.razas.some((r) => r.id === perro.idRaza) && antes.alcaldias.some((a) => a.id === caso.idAlcaldia) && antes.motivos.some((m) => m.id === caso.idMotivo), "activos: se ofrecen");
  await desactivarCatalogo(ADMIN, "razas", String(perro.idRaza), ctx);
  await desactivarCatalogo(ADMIN, "alcaldias", String(caso.idAlcaldia), ctx);
  await desactivarCatalogo(ADMIN, "motivos", String(caso.idMotivo), ctx);
  const despues = await opcionesDeRegistro(ROSA, ctx);
  assert.deepEqual([despues.razas.some((r) => r.id === perro.idRaza), despues.alcaldias.some((a) => a.id === caso.idAlcaldia), despues.motivos.some((m) => m.id === caso.idMotivo)], [false, false, false], "desactivados: ya no se ofrecen");
  assert.ok(!despues.alcaldias.some((a) => a.id === 17), "«Fuera de la CDMX» nunca se ofrece al registrar");
  for (const [extra, campo] of [[{ idRaza: perro.idRaza }, "raza"], [{ alcaldia: nombreAlcaldia }, "alcaldia"], [{ idMotivo: caso.idMotivo }, "motivo"]] as const) {
    const e = await rechaza(registrarExtravio(ROSA, { datos: datos(extra), foto }, ctx), 422, "VALIDACION");
    assert.equal(e.campos?.[campo], { raza: "Elige la raza.", alcaldia: "Elige la alcaldía.", motivo: "Elige el motivo del extravío." }[campo], campo); // mensaje amable, el de siempre, sin identificadores internos
    assert.deepEqual(Object.keys(e.campos ?? {}), [campo], "solo ese campo falla");
  }
  // El caso existente SIGUE mostrando los nombres (público, estatus y panel del Administrador).
  const ficha = await consultarFichaPorFolio(caso.folio, ctx);
  assert.equal(ficha.raza === nombreRaza || ficha.raza === "Otra", true, `${ficha.raza} / ${nombreRaza}`);
  assert.equal(ficha.alcaldia, nombreAlcaldia);
  assert.ok(await consultarEstatusPorFolio(caso.folio, ctx), "el estatus público sigue funcionando");
  const detalle = await detalleRegistro(ADMIN, caso.folio, ctx);
  assert.deepEqual([detalle.raza === nombreRaza || detalle.raza === "Otra", detalle.alcaldia, detalle.motivo], [true, nombreAlcaldia, nombreMotivo]);
  // Reactivar: vuelve a ofrecerse y el registro por API procede.
  await editarCatalogo(ADMIN, "razas", String(perro.idRaza), { nombre: nombreRaza, activo: true }, ctx);
  await editarCatalogo(ADMIN, "alcaldias", String(caso.idAlcaldia), { nombre: nombreAlcaldia, clave: almacen.alcaldias.find((a) => a.idAlcaldia === caso.idAlcaldia)!.claveGeoestadistica, activo: true }, ctx);
  await editarCatalogo(ADMIN, "motivos", String(caso.idMotivo), { nombre: nombreMotivo, idCategoria: almacen.motivos.find((m) => m.idMotivo === caso.idMotivo)!.idCategoriaMotivo, descripcion: almacen.motivos.find((m) => m.idMotivo === caso.idMotivo)!.descripcion, activo: true }, ctx);
  const otra = await opcionesDeRegistro(ROSA, ctx);
  assert.ok(otra.razas.some((r) => r.id === perro.idRaza) && otra.alcaldias.some((a) => a.id === caso.idAlcaldia) && otra.motivos.some((m) => m.id === caso.idMotivo), "reactivados: vuelven a ofrecerse");
  await registrarExtravio(ROSA, { datos: datos({ idRaza: perro.idRaza, alcaldia: nombreAlcaldia, idMotivo: caso.idMotivo }), foto }, ctx);
  // D7: renombrar cambia el nombre histórico (el caso guarda el id).
  await editarCatalogo(ADMIN, "alcaldias", String(caso.idAlcaldia), { nombre: "Alcaldía Renombrada", clave: almacen.alcaldias.find((a) => a.idAlcaldia === caso.idAlcaldia)!.claveGeoestadistica }, ctx);
  assert.equal((await consultarFichaPorFolio(caso.folio, ctx)).alcaldia, "Alcaldía Renombrada");
});

test("avistamientos · una alcaldía NUEVA o RENOMBRADA funciona: la ubicación simulada es finita y la 17 sigue sin ofrecerse aunque la rebauticen", async () => {
  const { ctx, almacen } = nuevoContexto();
  const nueva = await altaCatalogo(ADMIN, "alcaldias", NUEVO.alcaldias, ctx);
  await editarCatalogo(ADMIN, "alcaldias", "17", { nombre: "Fuera de la capital" }, ctx);
  const inicio = await iniciarReporte({ canal: "folio", folio: MAX }, ctx);
  assert.ok(inicio.alcaldias.some((a) => a.id === nueva.item.id));
  assert.ok(!inicio.alcaldias.some((a) => a.id === 17), "la 17 se identifica por id, no por nombre");
  const datos = { fecha: "2026-10-17", hora: "10:00", direccion: "Calle 1", idAlcaldia: nueva.item.id, estadosAnimal: [1, 7] };
  const r = await registrarAvistamiento({ canal: "folio", folio: MAX }, { datos, foto: { bytes: jpeg(), tipoDeclarado: "image/jpeg" } }, ctx);
  const av = almacen.avistamientos.find((a) => a.idAvistamiento === r.id)!;
  assert.ok(Number.isFinite(av.latitud) && Number.isFinite(av.longitud), `${av.latitud},${av.longitud}`);
  await rechaza(registrarAvistamiento({ canal: "folio", folio: MAX }, { datos: { ...datos, idAlcaldia: 17 }, foto: { bytes: jpeg(), tipoDeclarado: "image/jpeg" } }, ctx), 422);
});

test("D5 · un estado del animal NUEVO (en «Integridad física y salud» y en otras categorías) se ofrece, valida y respeta R3 sin depender de la lista del maquetado", async () => {
  const { ctx, almacen } = nuevoContexto();
  const integridad = (await altaCatalogo(ADMIN, "estados-animal", { nombre: "Cojea levemente", idCategoria: 1, descripcion: "Camina con dificultad." }, ctx)).item;
  const conducta = (await altaCatalogo(ADMIN, "estados-animal", { nombre: "Juguetón", idCategoria: 3, descripcion: "Quiere jugar." }, ctx)).item;
  const identificacion = (await altaCatalogo(ADMIN, "estados-animal", { nombre: "Con microchip visible", idCategoria: 4, descripcion: "Se ve el chip." }, ctx)).item;
  assert.deepEqual([integridad.id, conducta.id, identificacion.id], [18, 19, 20]);
  const inicio = await iniciarReporte({ canal: "folio", folio: MAX }, ctx);
  const o = (id: number) => inicio.estadosAnimal.find((e) => e.id === id)!;
  assert.deepEqual([o(18).idCategoria, o(19).idCategoria, o(20).idCategoria, o(18).excluyente], [1, 3, 4, false], "la pantalla recibe los nuevos como combinables (solo 1, 5 y 6 son excluyentes)");
  assert.deepEqual(inicio.estadosAnimal.filter((e) => e.excluyente).map((e) => e.id), [1, 5, 6]);
  const rechazaEstados = async (p: Promise<unknown>) => assert.ok((await rechaza(p, 422, "VALIDACION")).campos?.estadosAnimal);
  const reportar = (estadosAnimal: number[]) => registrarAvistamiento({ canal: "folio", folio: MAX }, { datos: { fecha: "2026-10-17", hora: "10:00", direccion: "Calle 1", idAlcaldia: 6, estadosAnimal }, foto: { bytes: jpeg(), tipoDeclarado: "image/jpeg" } }, ctx);
  await reportar([2, 18, 7]); // combinable con los combinables de su categoría
  await reportar([18, 7, 19, 20]); // y las demás categorías aceptan los nuevos
  await rechazaEstados(reportar([1, 18, 7])); // 1 Ileso sigue siendo excluyente
  await rechazaEstados(reportar([5, 18, 7])); // 5 Fallecido
  await rechazaEstados(reportar([6, 18, 7])); // 6 No se puede determinar
  await rechazaEstados(reportar([5, 7, 19])); // «Fallecido» deshabilita Conducta, también con un estado nuevo de Conducta
  await reportar([5, 7, 20]); // pero Identificación sí
  await rechazaEstados(reportar([18, 7, 19, 19])); // repetidos
  // Desactivado deja de ofrecerse y de aceptarse (mensaje amable de siempre).
  await desactivarCatalogo(ADMIN, "estados-animal", "18", ctx);
  assert.ok(!(await iniciarReporte({ canal: "folio", folio: MAX }, ctx)).estadosAnimal.some((e) => e.id === 18), "el estado 18 desactivado ya no se ofrece");
  await rechazaEstados(reportar([18, 7]));
  // La validación pura, con el catálogo del almacén y sin el del maquetado.
  validarEstadosAnimal([2, 20, 7], almacen.estadosAnimal.map((e) => ({ id: e.idEstadoAnimal, idCategoria: e.idCategoriaEstadoAnimal, excluyente: [1, 5, 6].includes(e.idEstadoAnimal), activo: e.estatus === 1 })));
});

// --- Listado, claves de respuesta, estados del caso, cifras ---------------------------------------------------------------------------------------------
test("listado en el SERVIDOR por URL · páginas de 6, búsqueda sin acentos, página inválida corregida; los desactivados se listan", async () => {
  const { ctx } = nuevoContexto();
  const p1 = await listarCatalogo(ADMIN, "alcaldias", {}, ctx);
  assert.deepEqual([p1.items.length, p1.pagina, p1.totalPaginas, p1.total, p1.porPagina], [6, 1, 3, 17, 6]);
  for (const mala of ["abc", "-1", "0", "1.5", "", undefined, null, 3.7]) assert.equal((await listarCatalogo(ADMIN, "alcaldias", { pagina: mala }, ctx)).pagina, 1, String(mala));
  assert.equal((await listarCatalogo(ADMIN, "alcaldias", { pagina: "999" }, ctx)).pagina, 3);
  assert.equal((await listarCatalogo(ADMIN, "alcaldias", { pagina: "3" }, ctx)).items.length, 5);
  assert.deepEqual((await listarCatalogo(ADMIN, "alcaldias", { texto: "COYOACAN" }, ctx)).items.map((x) => x.nombre), ["Coyoacán"]);
  assert.deepEqual((await listarCatalogo(ADMIN, "alcaldias", { texto: "09010" }, ctx)).items.map((x) => x.nombre), ["Álvaro Obregón"]);
  assert.equal((await listarCatalogo(ADMIN, "alcaldias", { texto: "zzzz" }, ctx)).total, 0);
  await desactivarCatalogo(ADMIN, "razas", "6", ctx);
  assert.equal((await listarCatalogo(ADMIN, "razas", { texto: "pug" }, ctx)).items[0].activo, false);
  const est = await listarCatalogo(ADMIN, "estados-animal", { pagina: "3" }, ctx);
  assert.deepEqual(est.categorias.map((c) => c.nombre), ["Integridad física y salud", "Contención y ubicación", "Conducta", "Identificación visible"]);
});

test("claves de respuesta · lista permitida exacta (nada de estatus, ids internos ni filas completas del almacén)", async () => {
  const { ctx } = nuevoContexto();
  const sinExtras = (obj: object, permitidas: readonly string[], donde: string) => assert.deepEqual(Object.keys(obj).filter((k) => !permitidas.includes(k)), [], donde);
  for (const t of TIPOS_CATALOGO) {
    const l = await listarCatalogo(ADMIN, t, { pagina: "99" }, ctx);
    assert.ok(l.items.length > 0);
    for (const x of l.items) sinExtras(x, CAMPOS_CATALOGO_ADMIN, t);
    assert.deepEqual(Object.keys(l).sort(), ["categorias", "filtros", "items", "pagina", "porPagina", "tipo", "total", "totalPaginas"]);
    assert.ok(!JSON.stringify(l).includes("estatus") && !JSON.stringify(l).includes("claveGeoestadistica"), "el listado no trae estatus ni claveGeoestadistica");
  }
  const a = await altaCatalogo(ADMIN, "motivos", NUEVO.motivos, ctx);
  sinExtras(a.item, CAMPOS_CATALOGO_ADMIN, "alta");
  assert.deepEqual(Object.keys(a), ["item"]);
  for (const p of (await listarParametros(ADMIN, ctx)).parametros) assert.deepEqual(Object.keys(p).sort(), [...CAMPOS_PARAMETRO_ADMIN].sort());
  assert.deepEqual(Object.keys(await modificarParametros(ADMIN, { version_aviso_privacidad: "2.0" }, ctx)).sort(), ["avisoReaceptacion", "cambios", "parametros", "sinCambios"]);
  for (const e of (await listarEstadosCaso(ADMIN, ctx)).items) assert.deepEqual(Object.keys(e).sort(), [...CAMPOS_ESTADO_CASO_ADMIN].sort());
  const o = await opcionesDeRegistro(ROSA, ctx);
  assert.deepEqual(Object.keys(o).sort(), ["alcaldias", "categoriasMotivo", "maximoMb", "motivos", "razas"]);
  assert.ok(!JSON.stringify(o).includes("estatus"));
});

test("HU 053 · estados del caso: SOLO consulta, los 6 del sistema en su orden; ni el repositorio ofrece cómo cambiarlos", async () => {
  const { ctx, almacen } = nuevoContexto();
  const l = await listarEstadosCaso(ADMIN, ctx);
  assert.deepEqual(l.items.map((e) => [e.orden, e.nombre]), [[1, "Extraviado"], [2, "En búsqueda"], [3, "Avistamiento reportado"], [4, "En seguimiento"], [5, "Localizado"], [6, "Cerrado"]]);
  const antes = JSON.stringify(almacen.estadosCaso);
  assert.deepEqual(Object.keys(ctx.repos.catalogos).filter((k) => !["alcaldias", "razas", "categoriasMotivo", "motivos", "categoriasEstadoAnimal", "estadosAnimal", "estadosCaso"].includes(k)), []);
  assert.ok(Object.keys(ctx.repos.administracion).every((k) => !/estadoCaso|estadosCaso/i.test(k)), "el repositorio no ofrece cómo cambiar estados del caso");
  l.items.pop();
  assert.equal(JSON.stringify(almacen.estadosCaso), antes);
});

test("D1 · las cifras del tablero y de Reportes NO cambian tras renombrar, desactivar y crear en los 4 catálogos (huella del CONTENIDO)", async () => {
  const { ctx } = nuevoContexto();
  const tomar = () => {
    const t = calcularTablero(PERIODO_PREDETERMINADO);
    const r = generarReporte({ desde: PERIODO_PREDETERMINADO.desde, hasta: PERIODO_PREDETERMINADO.hasta, alcaldia: "", categoria: "", estadoCaso: "" })!;
    return { t, r, huella: createHash("sha256").update(JSON.stringify({ t, r })).digest("hex") };
  };
  const antes = tomar();
  assert.deepEqual([antes.t.totalCasos, antes.t.casosActivos, antes.t.casosLocalizados, antes.t.totalAvistamientos, antes.t.avistamientosOcultos], [163, 141, 19, 199, 6]);
  assert.deepEqual(antes.t.porMotivo.map((b) => b.valor), [46, 40, 29, 38, 10]);
  assert.deepEqual(antes.t.porEstadoCaso.map((b) => b.valor), [20, 58, 32, 31, 16, 6]);
  assert.deepEqual([antes.r.totalCasos, antes.r.casosLocalizados], [163, 19]);
  for (const t of TIPOS_CATALOGO) await altaCatalogo(ADMIN, t, NUEVO[t], ctx);
  await editarCatalogo(ADMIN, "alcaldias", "4", { nombre: "Coyoacán Renombrada", clave: "09003" }, ctx);
  await editarCatalogo(ADMIN, "razas", "4", { nombre: "Labrador" }, ctx);
  await editarCatalogo(ADMIN, "motivos", "1", { nombre: "Pánico", idCategoria: 1, descripcion: "d" }, ctx);
  await editarCatalogo(ADMIN, "estados-animal", "2", { nombre: "Herido", idCategoria: 1, descripcion: "d" }, ctx);
  await desactivarCatalogo(ADMIN, "alcaldias", "12", ctx);
  await desactivarCatalogo(ADMIN, "razas", "6", ctx);
  await desactivarCatalogo(ADMIN, "motivos", "2", ctx);
  await desactivarCatalogo(ADMIN, "estados-animal", "16", ctx);
  const despues = tomar();
  assert.equal(despues.huella, antes.huella);
});

test("seed · los contadores de id parten del máximo sembrado y la bitácora sembrada tiene 30 entradas (25 del maquetado + 5 reactivaciones)", () => {
  const { almacen } = nuevoContexto();
  assert.deepEqual([almacen.ids.alcaldia, almacen.ids.raza, almacen.ids.motivo, almacen.ids.estado_animal], [17, 14, 15, 17]);
  assert.equal(almacen.bitacora.length, 30);
  assert.ok(almacen.alcaldias.every((a) => a.estatus === 1) && almacen.razas.every((a) => a.estatus === 1) && almacen.motivos.every((a) => a.estatus === 1) && almacen.estadosAnimal.every((a) => a.estatus === 1), "TODOS los valores sembrados quedan activos");
});
