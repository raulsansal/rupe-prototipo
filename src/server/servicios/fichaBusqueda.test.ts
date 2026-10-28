import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp, respuestaDeError } from "../errores";
import { qrVigentePorToken } from "../dominio/qr";
import { exigirBasePublica, resolverBasePublica } from "../config/urlPublica";
import { nuevoContexto } from "../pruebas/auxiliares";
import { decodificarQr, leerPdf, rasterizarMatriz } from "../pruebas/pdf";
import { urlDelQr } from "../qr/matrizQr";
import type { SesionActual } from "../sesion/guardas";
import { ConflictoDeUnicidad } from "../repos/errores";
import { enlaceParaCompartir, fichaDeBusquedaDelTutor, generarPdfDeFicha, regenerarQrDelTutor } from "./fichaBusqueda";
import { registrarExtravio } from "./extravio";
import { jpeg } from "../pruebas/imagenes";

const ROSA: SesionActual = { idUsuario: 2, rol: "Tutor", nombre: "Rosa Hernández Ficticia" };
const LUIS: SesionActual = { idUsuario: 5, rol: "Tutor", nombre: "Luis Navarro Ficticio" };
const ADMIN: SesionActual = { idUsuario: 1, rol: "Administrador", nombre: "Ricardo Vega Ficticio" };
const BASE = resolverBasePublica({ entorno: { RUPE_URL_PUBLICA: "https://nombre-largo.vercel.app" } });
const SIN_BASE = resolverBasePublica({ entorno: {}, origenPeticion: "https://otro.example", produccion: true });
const MAX = "RUPE-K7M4XQ9T"; // Rosa, En búsqueda
/** Reloj posterior a toda la siembra: la fecha de invalidación nunca puede ser anterior a la de generación del QR sembrado. */
const DESPUES = () => new Date("2026-12-01T00:00:00Z");
const ACTIVOS_ROSA = ["RUPE-K7M4XQ9T", "RUPE-P3H8WD5N", "RUPE-Y9F4LK2E", "RUPE-H4TQ7V2M", "RUPE-N8D5GX3W"];
const NO_ACTIVOS = [
  [ROSA, "RUPE-B6R2TZ7C", "Localizado (Toby)"], [ROSA, "RUPE-C2J9RK6Z", "Localizado (Lola)"], [ROSA, "RUPE-3HN8WD2B", "Cerrado (Rocky)"],
  [LUIS, "RUPE-D5W2QK8X", "Cerrado por deshabilitación (Kira)"], [LUIS, "RUPE-F7L3MN6Y", "Cerrado por cancelación (Simba)"],
] as const;

const huella = async (e: ErrorApp) => {
  const r = respuestaDeError(e);
  return JSON.stringify({ estado: r.status, cuerpo: await r.clone().text(), cabeceras: [...r.headers.entries()].sort() });
};
const falla = (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => (e instanceof ErrorApp ? e : undefined));
const acciones = (sesion: SesionActual | undefined, folio: string, ctx: ReturnType<typeof nuevoContexto>["ctx"]) => ({
  vista: () => fichaDeBusquedaDelTutor(sesion, folio, BASE, ctx),
  pdf: () => generarPdfDeFicha(sesion, folio, "carta", BASE, ctx),
  regenerar: () => regenerarQrDelTutor(sesion, folio, ctx),
  compartir: () => enlaceParaCompartir(sesion, folio, BASE, ctx),
});

test("Ficha de búsqueda · guardas: sin sesión 401 y Administrador 403 en las cuatro acciones", async () => {
  const { ctx } = nuevoContexto();
  for (const [nombre, accion] of Object.entries(acciones(undefined, MAX, ctx))) assert.equal((await falla(accion()))?.estado, 401, nombre);
  for (const [nombre, accion] of Object.entries(acciones(ADMIN, MAX, ctx))) assert.equal((await falla(accion()))?.estado, 403, nombre);
});

test("Ficha de búsqueda · un caso ajeno, uno inexistente y un folio mal formado dan el MISMO 404, byte por byte y en cabeceras, en las cuatro acciones", async () => {
  const { ctx } = nuevoContexto();
  for (const nombre of ["vista", "pdf", "regenerar", "compartir"] as const) {
    const huellas = await Promise.all([MAX /* ajeno para Luis */, "RUPE-ZZZZZZZZ", "no-es-un-folio", "' OR 1=1 --", ""].map(async (f) => huella((await falla(acciones(LUIS, f, ctx)[nombre]()))!)));
    assert.equal(JSON.parse(huellas[0]).estado, 404, nombre);
    assert.ok(huellas.every((h) => h === huellas[0]), `${nombre}: los 404 deben ser idénticos`);
  }
  // Y la guarda va antes que la validación de la hoja: un caso ajeno no se entera de si la hoja era válida.
  assert.equal((await falla(generarPdfDeFicha(LUIS, MAX, "hoja-rara", BASE, ctx)))?.estado, 404);
});

test("Ficha de búsqueda · Localizado y Cerrado (también cancelado y deshabilitado): 409 CASO_NO_ACTIVO en cada acción y el último QR no cambia", async () => {
  const { ctx, almacen } = nuevoContexto();
  const antes = JSON.stringify(almacen.qr);
  const mensajes = new Set<string>();
  for (const [sesion, folio, etiqueta] of NO_ACTIVOS) for (const [nombre, accion] of Object.entries(acciones(sesion, folio, ctx))) {
    const e = await falla(accion());
    assert.ok(e && e.estado === 409 && e.codigo === "CASO_NO_ACTIVO", `${etiqueta} · ${nombre}`);
    mensajes.add(e.message);
  }
  assert.equal(mensajes.size, 1, "mismo mensaje claro en todas");
  assert.match([...mensajes][0], /solo está disponible mientras el caso sigue en curso/);
  assert.equal(JSON.stringify(almacen.qr), antes, "los casos no activos conservan su último QR");
});

test("Ficha de búsqueda · los casos en curso sí pueden previsualizar, generar el PDF, compartir y regenerar", async () => {
  const { ctx } = nuevoContexto();
  for (const folio of ACTIVOS_ROSA) {
    const a = acciones(ROSA, folio, ctx);
    assert.equal((await a.vista()).ficha.folio, folio);
    assert.equal((await a.pdf()).nombreArchivo, `ficha-${folio}-carta.pdf`);
    assert.equal(await a.compartir(), `https://nombre-largo.vercel.app/ficha/${folio}`);
  }
  assert.ok((await regenerarQrDelTutor(ROSA, MAX, ctx)).fechaRegeneracion);
});

test("Ficha de búsqueda · el orden de las validaciones es guarda y propiedad, hoja (400), estado (409) y URL pública (503)", async () => {
  const { ctx } = nuevoContexto();
  assert.equal((await falla(generarPdfDeFicha(ROSA, MAX, "otra", BASE, ctx)))?.estado, 400);
  assert.equal((await falla(generarPdfDeFicha(ROSA, "RUPE-B6R2TZ7C", "otra", BASE, ctx)))?.codigo, "HOJA_INVALIDA", "hoja inválida antes que el estado");
  assert.equal((await falla(generarPdfDeFicha(ROSA, "RUPE-B6R2TZ7C", "carta", SIN_BASE, ctx)))?.estado, 409, "el estado antes que la configuración");
  const sinUrl = await falla(generarPdfDeFicha(ROSA, MAX, "media-carta", SIN_BASE, ctx));
  assert.deepEqual([sinUrl?.estado, sinUrl?.codigo], [503, "CONFIGURACION_FALTANTE"]);
  assert.throws(() => exigirBasePublica(SIN_BASE));
  for (const hoja of [undefined, null, "", "carta", "media-carta"]) assert.ok((await generarPdfDeFicha(ROSA, MAX, hoja, BASE, ctx)).bytes.length > 1000);
  for (const hoja of ["CARTA", "Media carta", "a4", "../x", 5, {}]) assert.equal((await falla(generarPdfDeFicha(ROSA, MAX, hoja, BASE, ctx)))?.estado, 400);
});

test("Ficha de búsqueda · la vista previa trae solo campos públicos, el QR del token vigente y el enlace con el FOLIO; sin RUPE_URL_PUBLICA avisa en lugar del QR", async () => {
  const { ctx, almacen } = nuevoContexto();
  const vista = await fichaDeBusquedaDelTutor(ROSA, MAX, BASE, ctx);
  const caso = almacen.casos.find((c) => c.folio === MAX)!;
  const token = almacen.qr.find((q) => q.idCasoExtravio === caso.idCasoExtravio && q.fechaInvalidacion === null)!.tokenPublico;
  assert.equal(vista.enlaceCompartir, `https://nombre-largo.vercel.app/ficha/${MAX}`);
  assert.equal(decodificarQr(rasterizarMatriz(vista.qr!.filas))?.texto, urlDelQr("https://nombre-largo.vercel.app", token));
  const texto = JSON.stringify(vista);
  const dueno = almacen.usuarios.find((u) => u.idUsuario === 2)!;
  for (const v of [dueno.nombreCompleto, dueno.correo, dueno.telefono, token].filter((x): x is string => !!x)) assert.ok(!texto.includes(v), `la vista no debe contener «${v.slice(0, 12)}…»`);
  const sin = await fichaDeBusquedaDelTutor(ROSA, MAX, SIN_BASE, ctx);
  assert.deepEqual([sin.qr, sin.enlaceCompartir, sin.avisoQr], [null, null, "Configura RUPE_URL_PUBLICA para generar el QR."]);
  assert.equal(await enlaceParaCompartir(ROSA, MAX, SIN_BASE, ctx), null);
});

test("Regenerar QR · invalida el anterior y crea el nuevo en una operación; un solo activo, fecha registrada; no cambia folio, datos, estado ni historial; sin bitácora", async () => {
  const { ctx, almacen } = nuevoContexto({}, DESPUES);
  const caso = almacen.casos.find((c) => c.folio === MAX)!;
  const fotoAntes = JSON.stringify([almacen.casos.find((c) => c.folio === MAX), almacen.perros.find((p) => p.idPerro === caso.idPerro)]);
  const historialAntes = almacen.historial.filter((h) => h.idCasoExtravio === caso.idCasoExtravio).length;
  const bitacoraAntes = almacen.bitacora.length;
  const [qrAntes, vistaAntes] = [almacen.qr.filter((q) => q.idCasoExtravio === caso.idCasoExtravio).length, await fichaDeBusquedaDelTutor(ROSA, MAX, BASE, ctx)];
  const tokenViejo = almacen.qr.find((q) => q.idCasoExtravio === caso.idCasoExtravio && q.fechaInvalidacion === null)!.tokenPublico;
  const r = await regenerarQrDelTutor(ROSA, MAX, ctx);
  const delCaso = almacen.qr.filter((q) => q.idCasoExtravio === caso.idCasoExtravio);
  const activos = delCaso.filter((q) => q.fechaInvalidacion === null);
  assert.equal(delCaso.length, qrAntes + 1);
  assert.equal(activos.length, 1);
  assert.equal(activos[0].fechaGeneracion, r.fechaRegeneracion);
  assert.equal(delCaso.find((q) => q.tokenPublico === tokenViejo)!.fechaInvalidacion, r.fechaRegeneracion, "el anterior se invalida en el mismo instante");
  assert.equal(qrVigentePorToken(almacen.qr, tokenViejo), undefined);
  assert.equal(qrVigentePorToken(almacen.qr, activos[0].tokenPublico)?.idCasoExtravio, caso.idCasoExtravio);
  assert.notEqual(activos[0].tokenPublico, tokenViejo);
  assert.equal(JSON.stringify([almacen.casos.find((c) => c.folio === MAX), almacen.perros.find((p) => p.idPerro === caso.idPerro)]), fotoAntes, "no cambia folio ni datos");
  assert.equal(almacen.historial.filter((h) => h.idCasoExtravio === caso.idCasoExtravio).length, historialAntes, "sin movimiento de historial");
  assert.equal(almacen.bitacora.length, bitacoraAntes, "R24: sin bitácora");
  // El QR anterior decodifica a un token que YA NO es vigente; el nuevo, a uno vigente.
  const vistaDespues = await fichaDeBusquedaDelTutor(ROSA, MAX, BASE, ctx);
  const leido = (v: typeof vistaAntes) => decodificarQr(rasterizarMatriz(v.qr!.filas))!.texto.split("/ficha/")[1];
  assert.equal(leido(vistaAntes), tokenViejo);
  assert.equal(qrVigentePorToken(almacen.qr, leido(vistaAntes)), undefined);
  assert.equal(qrVigentePorToken(almacen.qr, leido(vistaDespues))?.idCodigoQr, activos[0].idCodigoQr);
  // El enlace para compartir (con el folio) no cambia.
  assert.equal(vistaDespues.enlaceCompartir, vistaAntes.enlaceCompartir);
});

test("Regenerar QR · si el almacén falla siempre, no queda nada a medias (un solo QR activo, sin filas nuevas)", async () => {
  const { ctx, almacen } = nuevoContexto();
  const antes = JSON.stringify(almacen.qr);
  const original = ctx.repos.qr.regenerar;
  let llamadas = 0;
  ctx.repos.qr.regenerar = async () => {
    llamadas++;
    throw new ConflictoDeUnicidad("token");
  };
  const e = await regenerarQrDelTutor(ROSA, MAX, ctx).then(() => undefined, (x: unknown) => x);
  assert.ok(e instanceof ConflictoDeUnicidad);
  assert.ok(llamadas > 1, "reintenta con otro token antes de rendirse");
  assert.equal(JSON.stringify(almacen.qr), antes);
  ctx.repos.qr.regenerar = original;
  assert.ok((await regenerarQrDelTutor(ROSA, MAX, ctx)).fechaRegeneracion);
});

test("Regenerar QR · cada regeneración deja a lo más un activo y nunca repite token (20 regeneraciones seguidas)", async () => {
  const { ctx, almacen } = nuevoContexto({}, DESPUES);
  const caso = almacen.casos.find((c) => c.folio === MAX)!;
  for (let i = 0; i < 20; i++) await regenerarQrDelTutor(ROSA, MAX, ctx);
  const delCaso = almacen.qr.filter((q) => q.idCasoExtravio === caso.idCasoExtravio);
  assert.equal(delCaso.filter((q) => q.fechaInvalidacion === null).length, 1);
  assert.equal(new Set(almacen.qr.map((q) => q.tokenPublico)).size, almacen.qr.length);
  assert.ok(delCaso.every((q) => q.fechaInvalidacion === null || q.fechaInvalidacion >= q.fechaGeneracion));
});

test("Ficha de búsqueda · el PDF de un caso NUEVO trae su folio y sus datos públicos, y nunca los reservados del alta (calle, referencias, momento, motivo, descripción)", async () => {
  const { ctx } = nuevoContexto();
  const datos = {
    nombre: "Pelusa", sexo: "Hembra", idRaza: 1, edad: { valor: 3, unidad: "años" }, tamano: "pequeño", color: "Blanco", caracteristicas: "Mancha café en la oreja", fechaExtravio: "2026-10-18", momento: "tarde",
    alcaldia: "Coyoacán", colonia: "Del Carmen", calle: "Calle Reservada 99", referencias: "Referencia reservada: junto a la panadería", idMotivo: 1, descripcion: "Descripción reservada: salió por el portón",
  };
  const r = await registrarExtravio(ROSA, { datos, foto: { bytes: jpeg(), tipoDeclarado: "image/jpeg" } }, ctx);
  for (const hoja of ["carta", "media-carta"]) {
    const texto = (await leerPdf((await generarPdfDeFicha(ROSA, r.folio, hoja, BASE, ctx)).bytes)).texto.toLowerCase();
    for (const dato of [r.folio.toLowerCase(), "pelusa", "hembra", "coyoacán", "del carmen", "mancha café"]) assert.ok(texto.includes(dato), `${hoja}: falta «${dato}»`);
    for (const prohibido of ["calle reservada", "referencia reservada", "descripción reservada", "tarde", "rosa hernández"]) assert.ok(!texto.includes(prohibido), `${hoja}: no debe contener «${prohibido}»`);
  }
});
