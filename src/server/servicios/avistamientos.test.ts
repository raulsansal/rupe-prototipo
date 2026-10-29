import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { ErrorApp, respuestaDeError } from "../errores";
import { verificarResultado } from "../imagenes/prepararImagen";
import { AHORA, nuevoContexto } from "../pruebas/auxiliares";
import { jpeg } from "../pruebas/imagenes";
import { CAMPOS_CONFIRMACION_REPORTE } from "../serializadores/publico";
import type { SesionActual } from "../sesion/guardas";
import { consultarFichaPorFolio, consultarFichaPorToken, fotografiaPublicaDelCaso } from "./fichas";
import { abrirReporteAvistamiento, regenerarQr } from "./fichas";
import { fotografiaDelCaso, registrarExtravio } from "./extravio";
import { iniciarReporte, registrarAvistamiento } from "./avistamientos";

const MAX = "RUPE-K7M4XQ9T"; // Rosa, En búsqueda
const LUNA = "RUPE-P3H8WD5N"; // Rosa, Avistamiento reportado
const DUQUE = "RUPE-G8R4TV3K"; // Luis, En seguimiento
const TOBY = "RUPE-B6R2TZ7C"; // Localizado
const ROCKY = "RUPE-3HN8WD2B"; // Cerrado por cierre confirmado
const KIRA = "RUPE-D5W2QK8X"; // Cerrado por deshabilitación
const SIMBA = "RUPE-F7L3MN6Y"; // Cerrado por cancelación
const ROSA: SesionActual = { idUsuario: 2, rol: "Tutor", nombre: "Rosa Hernández Ficticia" };
const ADMIN: SesionActual = { idUsuario: 1, rol: "Administrador", nombre: "Ricardo Vega Ficticio" };
const FOTO = { bytes: jpeg(), tipoDeclarado: "image/jpeg" };
const datos = (extra: Record<string, unknown> = {}) => ({ fecha: "2026-10-17", hora: "10:00", direccion: "Avenida Reservada 123, entre A y B", idAlcaldia: 6, coloniaZona: "Del Valle", referencias: "junto a la panadería", estadosAnimal: [1, 7], comentario: "Se ve bien", ...extra });
const huella = async (e: ErrorApp) => {
  const r = respuestaDeError(e);
  return JSON.stringify({ estado: r.status, cuerpo: await r.clone().text(), cabeceras: [...r.headers.entries()].sort() });
};
const falla = (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => (e instanceof ErrorApp ? e : undefined));
const folio = (f: string) => ({ canal: "folio", folio: f }) as const;
async function tokenDe(ctx: ReturnType<typeof nuevoContexto>["ctx"], f: string) {
  const caso = (await ctx.repos.casos.porFolio(f))!;
  return (await ctx.repos.qr.activoDe(caso.idCasoExtravio))!.tokenPublico;
}

test("HU 035 · un reporte válido guarda todo junto: avistamiento anónimo con ubicación simulada, foto re-codificada, estados, movimiento y notificación; devuelve solo ID, folio y fecha", async () => {
  const { ctx, almacen } = nuevoContexto();
  const caso = (await ctx.repos.casos.porFolio(MAX))!;
  const [historialAntes, bitacoraAntes, ultimoId] = [almacen.historial.filter((h) => h.idCasoExtravio === caso.idCasoExtravio).length, almacen.bitacora.length, Math.max(...almacen.avistamientos.map((a) => a.idAvistamiento))];
  const r = await registrarAvistamiento(folio(MAX), { datos: datos({ comentario: "  <b>Se ve bien</b>\u0007 " }), foto: FOTO }, ctx);
  assert.deepEqual(Object.keys(r), [...CAMPOS_CONFIRMACION_REPORTE]);
  assert.deepEqual([r.id, r.folio, r.fechaHoraEnvio], [ultimoId + 1, MAX, AHORA.toISOString()]);
  const av = almacen.avistamientos.find((a) => a.idAvistamiento === r.id)!;
  assert.equal(av.fechaHoraAvistamiento, "2026-10-17T16:00:00Z"); // 10:00 de la Ciudad de México
  assert.equal(av.comentario, "Se ve bien"); // R34
  assert.deepEqual([av.visible, av.ubicacionSimulada, av.idAlcaldia, av.idCasoExtravio], [true, true, 6, caso.idCasoExtravio]);
  assert.ok(Number.isFinite(av.latitud) && Number.isFinite(av.longitud));
  assert.deepEqual(almacen.avistamientoEstados.filter((e) => e.idAvistamiento === r.id).map((e) => e.idEstadoAnimal).sort(), [1, 7]);
  // Anonimato: ninguna estructura guarda IP, agente de usuario ni nada de quien reporta.
  assert.ok(Object.keys(av).every((k) => ["idAvistamiento", "fechaHoraAvistamiento", "direccionAproximada", "coloniaZona", "referenciasDelLugar", "latitud", "longitud", "comentario", "fechaHoraEnvio", "visible", "idAlcaldia", "idCasoExtravio", "idFotografia", "ubicacionSimulada"].includes(k)), Object.keys(av).join());
  // La foto queda vinculada al avistamiento, re-codificada y servida por la ruta con guarda.
  const foto = almacen.fotografias.find((f) => f.idFotografia === av.idFotografia)!;
  assert.equal(foto.referenciaArchivo, `/api/fotografias/${foto.idFotografia}`);
  assert.equal(almacen.contenidosFoto[foto.idFotografia].tipo, "image/jpeg");
  // Estado: «avistamiento recibido» automático (sin usuario) y el caso pasa a Avistamiento reportado (E1); R24: sin bitácora.
  const h = almacen.historial.filter((x) => x.idCasoExtravio === caso.idCasoExtravio);
  assert.equal(h.length, historialAntes + 1);
  assert.deepEqual([h.at(-1)!.tipoMovimiento, h.at(-1)!.idUsuario, h.at(-1)!.idEstadoCaso], ["avistamiento recibido", null, 3]);
  assert.equal((await ctx.repos.casos.porId(caso.idCasoExtravio))!.idEstadoCaso, 3);
  assert.equal(almacen.bitacora.length, bitacoraAntes);
  const n = almacen.notificaciones.find((x) => x.idAvistamiento === r.id)!;
  assert.deepEqual([n.estadoEnvio, n.fechaEnvio, n.canal], ["enviada", AHORA.toISOString(), "correo"]);
});

test("Estado · desde En seguimiento pasa a Avistamiento reportado; si YA está en Avistamiento reportado no se duplica el movimiento (el avistamiento y la notificación sí se guardan)", async () => {
  const { ctx, almacen } = nuevoContexto();
  const movimientos = (f: string) => almacen.historial.filter((h) => h.idCasoExtravio === almacen.casos.find((c) => c.folio === f)!.idCasoExtravio).length;
  const [d0, l0] = [movimientos(DUQUE), movimientos(LUNA)];
  const r1 = await registrarAvistamiento(folio(DUQUE), { datos: datos(), foto: FOTO }, ctx);
  assert.equal(movimientos(DUQUE), d0 + 1);
  assert.equal((await consultarFichaPorFolio(DUQUE, ctx)).estado, "Avistamiento reportado");
  const r2 = await registrarAvistamiento(folio(LUNA), { datos: datos(), foto: FOTO }, ctx);
  assert.equal(movimientos(LUNA), l0, "sin movimiento nuevo");
  assert.ok(almacen.avistamientos.some((a) => a.idAvistamiento === r2.id) && almacen.notificaciones.some((n) => n.idAvistamiento === r2.id));
  assert.ok(r1.id !== r2.id);
  await registrarAvistamiento(folio(DUQUE), { datos: datos(), foto: FOTO }, ctx); // un segundo reporte al mismo caso tampoco duplica
  assert.equal(movimientos(DUQUE), d0 + 1);
});

test("R33 y R13 por FOLIO: activo se acepta; Localizado y Cerrado confirmado dan 409; cancelado, deshabilitado e inexistente dan 404 (idénticos)", async () => {
  const { ctx, almacen } = nuevoContexto();
  const antes = almacen.avistamientos.length;
  assert.ok(await registrarAvistamiento(folio(MAX), { datos: datos(), foto: FOTO }, ctx));
  for (const f of [TOBY, ROCKY]) assert.deepEqual([(await falla(registrarAvistamiento(folio(f), { datos: datos(), foto: FOTO }, ctx)))?.estado, (await falla(registrarAvistamiento(folio(f), { datos: datos(), foto: FOTO }, ctx)))?.codigo], [409, "CASO_NO_ADMITE_AVISTAMIENTOS"]);
  const huellas = await Promise.all([SIMBA, KIRA, "RUPE-ZZZZZZZZ", "no-es-un-folio"].map(async (f) => huella((await falla(registrarAvistamiento(folio(f), { datos: datos(), foto: FOTO }, ctx)))!)));
  assert.equal(JSON.parse(huellas[0]).estado, 404);
  assert.ok(huellas.every((h) => h === huellas[0]), "los 404 deben ser idénticos byte por byte");
  assert.equal(almacen.avistamientos.length, antes + 1, "solo el reporte válido se guardó");
});

test("R27 por QR: vigente se acepta; inexistente, mal formado, REGENERADO y de casos cancelado, deshabilitado o cerrado dan el MISMO QR_NO_VIGENTE; vigente de Localizado da 409", async () => {
  const { ctx } = nuevoContexto();
  const viejo = await tokenDe(ctx, LUNA);
  const caso = (await ctx.repos.casos.porFolio(LUNA))!;
  const nuevo = (await regenerarQr(ROSA, caso.idCasoExtravio, ctx)).tokenPublico;
  const QR = (token: string) => ({ canal: "qr", token }) as const;
  const noVigentes = [viejo, "x".repeat(32), "mal formado", "", await tokenDe(ctx, ROCKY), await tokenDe(ctx, KIRA), await tokenDe(ctx, SIMBA)];
  const huellas = await Promise.all(noVigentes.map(async (t) => huella((await falla(registrarAvistamiento(QR(t), { datos: datos(), foto: FOTO }, ctx)))!)));
  assert.equal(JSON.parse(huellas[0]).estado, 404);
  assert.match(JSON.parse(huellas[0]).cuerpo, /QR_NO_VIGENTE/);
  assert.match(JSON.parse(huellas[0]).cuerpo, /Este código QR ya no está vigente o no es válido/);
  assert.ok(huellas.every((h) => h === huellas[0]), "todos los QR no válidos responden exactamente lo mismo");
  // La consulta de la ficha y la apertura del reporte por QR responden igual.
  for (const t of noVigentes) assert.equal(await huella((await falla(consultarFichaPorToken(t, ctx)))!), huellas[0]);
  for (const t of noVigentes) assert.equal(await huella((await falla(abrirReporteAvistamiento(QR(t), ctx)))!), huellas[0]);
  assert.ok(!huellas[0].includes("No encontramos ese folio"), "el canal QR NO usa el mensaje de folio no encontrado");
  // El QR vigente funciona; el reporte por folio funciona aunque el QR haya cambiado.
  assert.ok(await registrarAvistamiento(QR(nuevo), { datos: datos(), foto: FOTO }, ctx));
  assert.ok(await registrarAvistamiento(folio(LUNA), { datos: datos(), foto: FOTO }, ctx));
  // QR vigente de un caso Localizado: la ficha se muestra y reportar da 409.
  const tToby = await tokenDe(ctx, TOBY);
  assert.equal((await consultarFichaPorToken(tToby, ctx)).estado, "Localizado");
  assert.equal((await falla(registrarAvistamiento(QR(tToby), { datos: datos(), foto: FOTO }, ctx)))?.estado, 409);
});

test("HU 033 y R3 · cada combinación inválida de estados del animal da 422 por campo y no guarda nada; las válidas se aceptan", async () => {
  const { ctx, almacen } = nuevoContexto();
  const antes = [almacen.avistamientos.length, almacen.fotografias.length, almacen.notificaciones.length];
  const invalidas: number[][] = [
    [], [7], [1], [1, 2, 7], [1, 5, 7], [5, 6, 7], [2, 5, 7], [1, 6, 7], // categoría 1: obligatoria; excluyentes solas
    [1, 7, 8], [1, 7, 9], // categoría 2: una sola
    [1, 7, 11, 12], [1, 7, 15, 17], // conducta e identificación: una sola
    [5, 7, 11], // Fallecido deshabilita Conducta
    [1, 7, 7], [1, 99], [0], [-1, 7],
  ];
  for (const e of invalidas) {
    const err = await falla(registrarAvistamiento(folio(MAX), { datos: datos({ estadosAnimal: e }), foto: FOTO }, ctx));
    assert.ok(err && err.estado === 422 && err.campos?.estadosAnimal, `[${e}] debía rechazarse con un error en «estadosAnimal»`);
  }
  assert.equal((await falla(registrarAvistamiento(folio(MAX), { datos: datos({ estadosAnimal: "1,7" }), foto: FOTO }, ctx)))?.campos?.estadosAnimal !== undefined, true);
  assert.deepEqual([almacen.avistamientos.length, almacen.fotografias.length, almacen.notificaciones.length], antes);
  for (const e of [[1, 7], [2, 3, 4, 8], [5, 7], [6, 9, 15], [2, 7, 11, 15], [1, 10, 12, 15]]) assert.ok(await registrarAvistamiento(folio(MAX), { datos: datos({ estadosAnimal: e }), foto: FOTO }, ctx), `[${e}] debía aceptarse`);
});

test("HU 029 a 034 · validación por campo: dirección, alcaldía (sin «Fuera de la CDMX»), límites de texto, fecha y hora, comentario y foto", async () => {
  const { ctx, almacen } = nuevoContexto();
  const antes = almacen.avistamientos.length;
  const campos = async (extra: Record<string, unknown>, foto: typeof FOTO | null = FOTO) => (await falla(registrarAvistamiento(folio(MAX), { datos: datos(extra), foto: foto ?? undefined }, ctx)))?.campos ?? {};
  assert.ok((await campos({ direccion: "   " })).direccion);
  assert.ok((await campos({ direccion: "x".repeat(201) })).direccion);
  assert.ok((await campos({ idAlcaldia: 17 })).alcaldia, "id 17 = Fuera de la Ciudad de México");
  for (const mala of [0, 99, -1, "6", null]) assert.ok((await campos({ idAlcaldia: mala })).alcaldia, String(mala));
  assert.ok((await campos({ coloniaZona: "x".repeat(101) })).coloniaZona);
  assert.ok((await campos({ referencias: "x".repeat(501) })).referencias);
  assert.ok((await campos({ comentario: "x".repeat(301) })).comentario);
  assert.ok((await campos({ fecha: "" })).fecha && (await campos({ hora: "" })).hora);
  assert.ok((await campos({ fecha: "2026-02-30" })).fecha);
  assert.ok((await campos({ fecha: "2026-10-18", hora: "06:01" })).hora, "posterior al envío (hoy 06:00 en la Ciudad de México)");
  assert.ok((await campos({ fecha: "2026-12-31", hora: "10:00" })).hora);
  assert.equal(Object.keys(await campos({ fecha: "2026-10-18", hora: "06:00" })).length, 0, "justo ahora se acepta");
  // fotografía: obligatoria, tipo por bytes, tamaño y archivo ilegible
  assert.ok((await campos({}, null)).foto);
  assert.ok((await campos({}, { bytes: new Uint8Array(0), tipoDeclarado: "image/jpeg" })).foto);
  assert.ok((await campos({}, { bytes: Uint8Array.from(Buffer.from("GIF89a....")), tipoDeclarado: "image/gif" })).foto);
  assert.ok((await campos({}, { bytes: jpeg(5 * 1024 * 1024), tipoDeclarado: "image/jpeg" })).foto);
  assert.equal((await campos({}, { bytes: jpeg(600), tipoDeclarado: "image/jpeg" })).foto, "La fotografía debe ser JPG o PNG.", "cabecera válida pero imagen ilegible");
  assert.ok(Object.keys(await campos({ direccion: "", estadosAnimal: [], fecha: "" })).length >= 3, "devuelve TODOS los campos con error");
  assert.equal(almacen.avistamientos.length, antes + 1, "solo el caso límite «justo ahora» se guardó");
});

test("HU 029 · la foto se re-codifica en el servidor: sin EXIF ni ubicación y con la orientación aplicada; PNG se acepta; se reduce a 1600 px", async () => {
  const { ctx, almacen } = nuevoContexto();
  const origen = await sharp({ create: { width: 400, height: 200, channels: 3, background: { r: 10, g: 120, b: 200 } } }).jpeg().withExif({ IFD0: { Make: "camara-ficticia" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "19/1 25/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "99/1 8/1 0/1" } }).withMetadata({ orientation: 6 }).toBuffer();
  assert.ok((await sharp(origen).metadata()).exif);
  const guardada = async (bytes: Uint8Array, tipo: string) => {
    const r = await registrarAvistamiento(folio(MAX), { datos: datos(), foto: { bytes, tipoDeclarado: tipo } }, ctx);
    const av = almacen.avistamientos.find((a) => a.idAvistamiento === r.id)!;
    return almacen.contenidosFoto[av.idFotografia];
  };
  const c = await guardada(Uint8Array.from(origen), "image/jpeg");
  const v = await verificarResultado(c.bytes);
  assert.deepEqual([v.esJpeg, v.sinExif, v.ancho, v.alto], [true, true, 200, 400]);
  assert.equal(Buffer.from(c.bytes).includes(Buffer.from("camara-ficticia")), false);
  const png = await guardada(Uint8Array.from(await sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer()), "image/png");
  assert.deepEqual([png.tipo, (await verificarResultado(png.bytes)).esJpeg], ["image/jpeg", true]);
  const grande = await verificarResultado((await guardada(Uint8Array.from(await sharp({ create: { width: 3200, height: 2400, channels: 3, background: { r: 9, g: 9, b: 9 } } }).jpeg().toBuffer()), "image/jpeg")).bytes);
  assert.deepEqual([grande.ancho, grande.alto], [1600, 1200]);
});

test("HU 036 · notificación simulada: «fallida» si el envío falla (el avistamiento se guarda igual), sin registro si la persona tutora la desactivó (R25), y con «Fallecido» el resumen no aparece", async () => {
  const { ctx, almacen } = nuevoContexto();
  const enviados: { asunto: string; cuerpo: string[] }[] = [];
  ctx.enviarNotificacion = async (m) => void enviados.push(m);
  const ok = await registrarAvistamiento(folio(MAX), { datos: datos({ estadosAnimal: [2, 3, 8] }), foto: FOTO }, ctx);
  assert.equal(almacen.notificaciones.find((n) => n.idAvistamiento === ok.id)!.estadoEnvio, "enviada");
  assert.match(enviados[0].cuerpo.join("\n"), /Herido \/ lesionado, Enfermo \/ débil, Resguardado/);
  // fallo del envío
  ctx.enviarNotificacion = async () => {
    throw new Error("sin conexión al servidor de correo");
  };
  const fallo = await registrarAvistamiento(folio(MAX), { datos: datos(), foto: FOTO }, ctx);
  assert.ok(almacen.avistamientos.some((a) => a.idAvistamiento === fallo.id));
  assert.equal(almacen.notificaciones.find((n) => n.idAvistamiento === fallo.id)!.estadoEnvio, "fallida");
  // «Fallecido»
  ctx.enviarNotificacion = async (m) => void enviados.push(m);
  const f = await registrarAvistamiento(folio(MAX), { datos: datos({ estadosAnimal: [5, 7] }), foto: FOTO }, ctx);
  const msg = almacen.notificaciones.find((n) => n.idAvistamiento === f.id)!.mensajeSimulado!;
  const texto = `${msg.asunto}\n${msg.cuerpo.join("\n")}`;
  assert.ok(!/fallecid|libre en v|estado del animal/i.test(texto) && /Inicia sesión/.test(texto), texto);
  assert.ok(!/fallecid/i.test(`${enviados.at(-1)!.asunto}${enviados.at(-1)!.cuerpo.join("")}`));
  // R25
  const dueno = (await ctx.repos.usuarios.porId(2))!;
  await ctx.repos.usuarios.guardar({ ...dueno, notificacionesActivas: false });
  const sin = await registrarAvistamiento(folio(MAX), { datos: datos(), foto: FOTO }, ctx);
  assert.ok(almacen.avistamientos.some((a) => a.idAvistamiento === sin.id));
  assert.equal(almacen.notificaciones.some((n) => n.idAvistamiento === sin.id), false);
});

test("HU 035 · atomicidad: si algo falla a mitad del alta no queda NADA (ni avistamiento, ni foto con sus bytes, ni movimiento, ni cambio de estado, ni contadores de id)", async () => {
  const { ctx, almacen } = nuevoContexto();
  const caso = (await ctx.repos.casos.porFolio(MAX))!;
  const foto = (await sharp({ create: { width: 20, height: 20, channels: 3, background: { r: 1, g: 1, b: 1 } } }).jpeg().toBuffer()) as Uint8Array;
  const instantanea = () => JSON.stringify({ av: almacen.avistamientos, es: almacen.avistamientoEstados, fo: almacen.fotografias, h: almacen.historial, n: almacen.notificaciones, casos: almacen.casos, ids: almacen.ids, bytes: Object.keys(almacen.contenidosFoto) });
  const antes = instantanea();
  const alta = {
    avistamiento: { fechaHoraAvistamiento: "2026-10-17T16:00:00Z", latitud: 19.4, longitud: -99.1, fechaHoraEnvio: AHORA.toISOString(), visible: true, idAlcaldia: 6, idCasoExtravio: caso.idCasoExtravio, ubicacionSimulada: true },
    fotografia: { referenciaArchivo: "", formato: "JPG" as const, tamanoBytes: foto.length, fechaCarga: AHORA.toISOString() },
    contenidoFotografia: { tipo: "image/jpeg", bytes: foto },
    estados: [1, 7],
    movimiento: { fechaHora: AHORA.toISOString(), tipoMovimiento: "avistamiento recibido" as const, idEstadoCaso: 3 },
    // La notificación es lo ÚLTIMO que se guarda: un fallo aquí deshace todo lo anterior.
    notificacion: { tipo: "nuevo avistamiento" as const, canal: "correo" as const, fechaEnvio: AHORA.toISOString(), get estadoEnvio(): "enviada" { throw new Error("falla a mitad"); } },
  };
  await assert.rejects(ctx.repos.avistamientos.registrarCompleto(alta), /falla a mitad/);
  assert.equal(instantanea(), antes);
});

test("Privacidad con valores señuelo: ni la ficha pública (JSON y canal QR), ni la confirmación del reporte, ni el aviso, contienen calle, referencias, circunstancias, nombre, correo ni teléfono de la persona tutora", async () => {
  const { ctx, almacen } = nuevoContexto();
  const S = { calle: "CALLE-SENUELO-7Q3", ref: "REF-SENUELO-9ZK", desc: "DESC-SENUELO-4MX", mom: "noche" };
  const alta = await registrarExtravio(ROSA, {
    datos: { nombre: "Senuelo", sexo: "Macho", idRaza: 1, edad: { valor: 2, unidad: "años" }, tamano: "mediano", color: "Negro", caracteristicas: "Mancha blanca", fechaExtravio: "2026-10-17", momento: S.mom, alcaldia: "Coyoacán", colonia: "Del Carmen", calle: S.calle, referencias: S.ref, idMotivo: 1, descripcion: S.desc },
    foto: FOTO,
  }, ctx);
  const dueno = almacen.usuarios.find((u) => u.idUsuario === 2)!;
  const token = await tokenDe(ctx, alta.folio);
  const mensajes: string[] = [];
  ctx.enviarNotificacion = async (m) => void mensajes.push(JSON.stringify(m));
  const respuestas = [
    JSON.stringify(await consultarFichaPorFolio(alta.folio, ctx)),
    JSON.stringify(await consultarFichaPorToken(token, ctx)),
    JSON.stringify(await registrarAvistamiento(folio(alta.folio), { datos: datos(), foto: FOTO }, ctx)),
    JSON.stringify(await registrarAvistamiento({ canal: "qr", token }, { datos: datos({ direccion: "Otra dirección 99" }), foto: FOTO }, ctx)),
  ];
  const propios = [S.calle, S.ref, S.desc, dueno.nombreCompleto, "Hernández", dueno.correo, ...(dueno.telefono ? [dueno.telefono] : []), ...(dueno.correo ? [dueno.correo.split("@")[0]] : [])];
  for (const r of respuestas) for (const s of propios) assert.ok(!r.includes(s), `una respuesta pública contiene «${s}»`);
  for (const r of respuestas) assert.ok(!r.includes(token), "ninguna respuesta repite el token del QR");
  for (const m of mensajes) for (const s of [S.calle, S.ref, S.desc, dueno.correo, "Hernández", "Avenida Reservada 123", "Otra dirección 99"]) assert.ok(!m.includes(s), `el aviso contiene «${s}»`);
});

test("Foto pública del caso: solo la del PERRO y solo mientras la ficha se muestra; mismo 404 para folio inexistente, mal formado, cancelado, deshabilitado, cerrado o sin foto subida", async () => {
  const { ctx } = nuevoContexto();
  const nuevo = await registrarExtravio(ROSA, { datos: { nombre: "Fotito", sexo: "Hembra", idRaza: 1, edad: { valor: 1, unidad: "años" }, tamano: "pequeño", color: "Blanco", caracteristicas: "x", fechaExtravio: "2026-10-17", momento: "tarde", alcaldia: "Coyoacán", colonia: "Del Carmen", calle: "Calle 1", referencias: "r", idMotivo: 1, descripcion: "d" }, foto: FOTO }, ctx);
  const f1 = await fotografiaPublicaDelCaso(nuevo.folio, ctx);
  assert.equal(f1.tipo, "image/jpeg");
  const perro = (await ctx.repos.casos.perro((await ctx.repos.casos.porFolio(nuevo.folio))!.idPerro))!;
  assert.deepEqual(f1.bytes, (await ctx.repos.casos.contenidoDeFotografia(perro.idFotografia))!.bytes);
  // Tras un avistamiento la foto pública sigue siendo la del perro, no la del avistamiento.
  await registrarAvistamiento(folio(nuevo.folio), { datos: datos(), foto: { bytes: Uint8Array.from(await sharp({ create: { width: 30, height: 30, channels: 3, background: { r: 200, g: 0, b: 0 } } }).jpeg().toBuffer()), tipoDeclarado: "image/jpeg" } }, ctx);
  assert.deepEqual((await fotografiaPublicaDelCaso(nuevo.folio, ctx)).bytes, f1.bytes);
  const huellas = await Promise.all([SIMBA, KIRA, ROCKY, "RUPE-ZZZZZZZZ", "no-es-un-folio", MAX /* sembrado sin foto subida */, TOBY].map(async (f) => huella((await falla(fotografiaPublicaDelCaso(f, ctx)))!)));
  assert.equal(JSON.parse(huellas[0]).estado, 404);
  assert.ok(huellas.every((h) => h === huellas[0]));
});

test("Fotos de avistamientos sembrados: la dueña ve las de los visibles y NO las de un avistamiento oculto por moderación (mismo 404 que un id inexistente); el Administrador sí en consulta", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rupe-av-"));
  try {
    mkdirSync(join(dir, "avistamientos"));
    for (const n of [101, 102, 105]) writeFileSync(join(dir, "avistamientos", `${n}.jpg`), jpeg(900));
    const { ctx, almacen } = nuevoContexto({}, undefined, { carpetaFotos: dir });
    const fotoDe = (n: number) => almacen.avistamientos.find((a) => a.idAvistamiento === n)!.idFotografia;
    assert.equal(almacen.fotografias.find((f) => f.idFotografia === fotoDe(101))!.referenciaArchivo, `/api/fotografias/${fotoDe(101)}`);
    assert.equal(almacen.fotografias.find((f) => f.idFotografia === fotoDe(104))!.referenciaArchivo, "/mocks/perro-ejemplo.svg", "sin archivo: el marcador");
    assert.ok((await fotografiaDelCaso(ROSA, fotoDe(101), ctx)).bytes.length === 900);
    assert.ok((await fotografiaDelCaso(ROSA, fotoDe(102), ctx)).bytes.length === 900); // «Fallecido»: la dueña la pide por id (la pantalla la oculta tras «Ver fotografía»)
    const [oculta, inexistente] = [await falla(fotografiaDelCaso(ROSA, fotoDe(105), ctx)), await falla(fotografiaDelCaso(ROSA, 987654, ctx))];
    assert.ok(oculta && oculta.estado === 404);
    assert.equal(await huella(oculta!), await huella(inexistente!));
    assert.ok((await fotografiaDelCaso(ADMIN, fotoDe(105), ctx)).bytes.length === 900);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Asignación masiva: los campos de más del cliente (visible, idCasoExtravio, latitud, ubicacionSimulada, fechas, estado) se ignoran", async () => {
  const { ctx, almacen } = nuevoContexto();
  const r = await registrarAvistamiento(folio(MAX), { datos: datos({ visible: false, idCasoExtravio: 1, latitud: 0, longitud: 0, ubicacionSimulada: false, fechaHoraEnvio: "2000-01-01T00:00:00Z", idEstadoCaso: 6, idFotografia: 1, motivoModeracion: "x", acceso: { canal: "folio", folio: ROCKY } }), foto: FOTO }, ctx);
  const av = almacen.avistamientos.find((a) => a.idAvistamiento === r.id)!;
  assert.deepEqual([av.visible, av.ubicacionSimulada, av.fechaHoraEnvio, av.motivoModeracion], [true, true, AHORA.toISOString(), undefined]);
  assert.equal(av.idCasoExtravio, (await ctx.repos.casos.porFolio(MAX))!.idCasoExtravio);
  assert.ok(av.latitud > 19 && av.longitud < -99);
  assert.equal(av.idFotografia > 12, true);
});

/** Almacén de PRUEBA con valores desactivados a propósito (el seed del Prototipo deja todo activo): la alcaldía 12 y los estados del animal 16 y 17 (caso real del defecto «El estado 16 está desactivado»). */
function contextoConCatalogoParcial() {
  const base = nuevoContexto();
  base.almacen.alcaldias.find((a) => a.idAlcaldia === 12)!.estatus = 0;
  for (const id of [16, 17]) base.almacen.estadosAnimal.find((e) => e.idEstadoAnimal === id)!.estatus = 0;
  return base;
}

test("HU 028 · con el seed del Prototipo todo el catálogo está activo: se ofrecen las 17 opciones y las 16 alcaldías", async () => {
  const { ctx } = nuevoContexto();
  const inicio = await iniciarReporte(folio(MAX), ctx);
  assert.deepEqual(inicio.estadosAnimal.map((e) => e.id), Array.from({ length: 17 }, (_, i) => i + 1));
  assert.equal(inicio.alcaldias.length, 16);
  assert.ok(inicio.alcaldias.some((a) => a.nombre === "Milpa Alta"));
  assert.equal(inicio.estadosAnimal.find((e) => e.id === 1)?.excluyente, true);
  assert.equal(inicio.estadosAnimal.find((e) => e.id === 2)?.excluyente, false);
  // Cada opción ofrecida pasa la validación del servidor con su combinación mínima.
  for (const e of inicio.estadosAnimal) {
    const combinacion = e.idCategoria === 1 ? [e.id, 7] : e.idCategoria === 2 ? [1, e.id] : [1, 7, e.id];
    const r = await registrarAvistamiento(folio(MAX), { datos: datos({ estadosAnimal: combinacion }), foto: FOTO }, ctx);
    assert.ok(r.id > 0, `opción ${e.id}`);
  }
});

test("HU 028 · el formulario recibe solo lo ACTIVO del almacén (misma fuente que el POST): con 16 y 17 y Milpa Alta desactivados a propósito, no se ofrecen", async () => {
  const { ctx } = contextoConCatalogoParcial();
  const inicio = await iniciarReporte(folio(MAX), ctx);
  assert.deepEqual(inicio.estadosAnimal.map((e) => e.id), Array.from({ length: 15 }, (_, i) => i + 1));
  assert.equal(inicio.alcaldias.length, 15);
  assert.ok(!inicio.alcaldias.some((a) => a.nombre === "Milpa Alta"));
});

test("HU 033 · un estado desactivado o inexistente llega al POST: 422 en «estadosAnimal» con el mensaje amable, sin su identificador, y no se guarda nada", async () => {
  const { ctx, almacen } = contextoConCatalogoParcial();
  const antes = almacen.avistamientos.length;
  for (const id of [16, 17, 99]) {
    const e = await falla(registrarAvistamiento(folio(MAX), { datos: datos({ estadosAnimal: [1, 7, id] }), foto: FOTO }, ctx));
    assert.equal(e?.estado, 422);
    const cuerpo = await respuestaDeError(e!).clone().text();
    assert.ok(cuerpo.includes("Una de las opciones elegidas ya no está disponible. Revisa tus selecciones."));
    assert.ok(!new RegExp(`\\b${id}\\b`).test(cuerpo), `el cuerpo no menciona el id ${id}`);
  }
  assert.equal(almacen.avistamientos.length, antes);
});
