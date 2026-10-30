import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { filasDeHoja, leerXlsx, type Celda } from "../../../../scripts/lib/leerXlsx";
import { ErrorApp } from "../../errores";
import { AHORA, nuevoContexto } from "../../pruebas/auxiliares";
import { jpeg } from "../../pruebas/imagenes";
import type { ReporteAdmin } from "../../serializadores/admin";
import type { SesionActual } from "../../sesion/guardas";
import { registrarAvistamiento } from "../avistamientos";
import { registrarExtravio } from "../extravio";
import { altaCatalogo } from "./catalogosAdmin";
import { exportarReporte } from "./exportacionAdmin";
import { generarReporteAdmin } from "./reportesAdmin";

type Ctx = ReturnType<typeof nuevoContexto>["ctx"];
const ROSA: SesionActual = { idUsuario: 2, rol: "Tutor", nombre: "Rosa Hernández Ficticia" };
const ADMIN: SesionActual = { idUsuario: 1, rol: "Administrador", nombre: "Ricardo Vega Ficticio" };
const FOTO = { bytes: jpeg(), tipoDeclarado: "image/jpeg" };
const F = { desde: "2026-10-01", hasta: "2026-10-18" };
const datosCaso = (extra: Record<string, unknown> = {}) => ({ nombre: "Nuevo", sexo: "Hembra", idRaza: 1, edad: { valor: 3, unidad: "años" }, tamano: "pequeño", color: "Blanco", caracteristicas: "Mancha", fechaExtravio: "2026-10-18", momento: "tarde", alcaldia: "Coyoacán", colonia: "Del Carmen", calle: "Calle 1", referencias: "ref", idMotivo: 1, descripcion: "d", ...extra });
const falla = (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => (e instanceof ErrorApp ? e : undefined));
const reporte = async (ctx: Ctx, filtros: Record<string, unknown> = F) => {
  const r = (await generarReporteAdmin(ADMIN, filtros, ctx)) as Extract<ReporteAdmin, { sinDatos: false }>;
  assert.equal(r.sinDatos, false);
  return r;
};
const cuerpo = (r: { huella: string }, extra: Record<string, unknown> = {}) => ({ formato: "xlsx", filtros: F, huella: r.huella, ...extra });
const hojas = (bytes: Uint8Array) => Object.fromEntries(leerXlsx(bytes).map((h) => [h.nombre, filasDeHoja(h)]));
const celdas = (filas: (Celda | undefined)[][]) => Object.fromEntries(filas.filter((f) => f.length >= 2 && typeof f[0] === "string").map((f) => [f[0] as string, f[1]]));

test("exportar · Excel: las hojas dicen lo mismo que el reporte de la pantalla, celda por celda (filtros, indicadores y los 5 desgloses)", async () => {
  const { ctx } = nuevoContexto();
  const r = await reporte(ctx, { ...F, alcaldia: "4" });
  const { bytes, nombreArchivo, tipoContenido } = await exportarReporte(ADMIN, { formato: "xlsx", filtros: { ...F, alcaldia: "4" }, huella: r.huella }, ctx);
  assert.equal(nombreArchivo, "reporte-rupe-2026-10-01_2026-10-18.xlsx");
  assert.equal(tipoContenido, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const h = hojas(bytes);
  assert.deepEqual(Object.keys(h), ["Resumen", "Casos por motivo", "Casos por estado", "Cierres por tipo", "Estado del animal", "Alcaldía del avistamiento"]);
  const resumen = celdas(h.Resumen);
  assert.deepEqual([resumen.Periodo, resumen["Alcaldía"], resumen["Categoría de motivo"], resumen["Estado del caso"]], ["1 oct 2026 – 18 oct 2026", "Coyoacán", "todas", "todos"]);
  assert.deepEqual([resumen["Número de casos"], resumen["Casos localizados"], resumen["Tasa de recuperación (%)"], resumen["Avistamientos ocultos (aparte)"]], [r.totalCasos, r.casosLocalizados, r.tasaRecuperacion, r.avistamientosOcultos]);
  const tabla = (hoja: string) => h[hoja].slice(1).map((f) => [f[0], f[1]]);
  const nv = (b: { nombre: string; valor: number }[]) => b.map((x) => [x.nombre, x.valor]);
  assert.deepEqual(tabla("Casos por motivo"), nv(r.porMotivo));
  assert.deepEqual(tabla("Casos por estado"), nv(r.porEstadoCaso));
  assert.deepEqual(tabla("Cierres por tipo"), nv(r.cierres));
  assert.deepEqual(tabla("Estado del animal"), r.porEstadoAnimal.flatMap((g) => g.barras.map((b) => [`${g.categoria}: ${b.nombre}`, b.valor])));
  assert.deepEqual(tabla("Alcaldía del avistamiento"), nv(r.porAlcaldiaAvistamiento));
  assert.deepEqual(h["Casos por motivo"][0], ["Categoría de motivo", "Casos"]);
  assert.ok(h["Estado del animal"].slice(1).every((f) => typeof f[1] === "number") && typeof resumen["Número de casos"] === "number");
});

test("exportar · PDF: un PDF válido con el nombre pedido; el servidor lo genera sin guardarlo ni escribir en la bitácora", async () => {
  const { ctx, almacen } = nuevoContexto();
  const r = await reporte(ctx);
  const antes = [almacen.bitacora.length, JSON.stringify(almacen.ids)];
  const { bytes, nombreArchivo, tipoContenido } = await exportarReporte(ADMIN, cuerpo(r, { formato: "pdf" }), ctx);
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
  assert.equal(tipoContenido, "application/pdf");
  assert.equal(nombreArchivo, "reporte-rupe-2026-10-01_2026-10-18.pdf");
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 1);
  assert.deepEqual([doc.getAuthor(), doc.getTitle()], ["RUPE", "Reporte estadístico de casos"]);
  assert.deepEqual([almacen.bitacora.length, JSON.stringify(almacen.ids)], antes);
});

test("exportar · el servidor recalcula e IGNORA cualquier cifra del cliente (cifras falsas en el cuerpo y dentro de los filtros)", async () => {
  const { ctx } = nuevoContexto();
  const r = await reporte(ctx);
  const falsos = { totalCasos: 9999, casosLocalizados: 1, tasaRecuperacion: 99.9, porMotivo: [{ nombre: "Falso", valor: 7 }], reporte: { totalCasos: 5 } };
  const { bytes } = await exportarReporte(ADMIN, { formato: "xlsx", filtros: { ...F, ...falsos }, huella: r.huella, ...falsos }, ctx);
  const resumen = celdas(hojas(bytes).Resumen);
  assert.deepEqual([resumen["Número de casos"], resumen["Casos localizados"], resumen["Tasa de recuperación (%)"]], [163, 19, 11.9]);
  assert.ok(!JSON.stringify([...leerXlsx(bytes)].map((x) => [...x.celdas.values()])).includes("Falso"));
});

test("huella (HU 057, regla 1) · válida = 200; falsa = 409 DATOS_CAMBIARON; ausente o mal formada = 422; datos que cambian entre generar y exportar = 409 y regenerar lo resuelve", async () => {
  const { ctx } = nuevoContexto();
  const r = await reporte(ctx);
  await exportarReporte(ADMIN, cuerpo(r), ctx);
  const falsa = await falla(exportarReporte(ADMIN, cuerpo({ huella: "0".repeat(32) }), ctx));
  assert.deepEqual([falsa?.estado, falsa?.codigo, falsa?.message], [409, "DATOS_CAMBIARON", "Los datos cambiaron; genera el reporte de nuevo."]);
  for (const huella of [undefined, "", "abc", "Z".repeat(32), 12345]) assert.equal((await falla(exportarReporte(ADMIN, { formato: "xlsx", filtros: F, huella }, ctx)))?.campos?.huella, "Genera el reporte antes de exportarlo.");
  await registrarExtravio(ROSA, { datos: datosCaso(), foto: FOTO }, ctx); // entre «Generar» y «Exportar» entra un caso nuevo
  const cambio = await falla(exportarReporte(ADMIN, cuerpo(r), ctx));
  assert.deepEqual([cambio?.estado, cambio?.codigo], [409, "DATOS_CAMBIARON"]);
  const nueva = await reporte(ctx);
  assert.notEqual(nueva.huella, r.huella);
  const { bytes } = await exportarReporte(ADMIN, cuerpo(nueva), ctx);
  assert.equal(celdas(hojas(bytes).Resumen)["Número de casos"], 164);
});

test("huella · depende de las cifras y los filtros, no de la hora ni de los rótulos", async () => {
  const { ctx } = nuevoContexto();
  const a = await reporte(ctx);
  const ctx2 = { ...ctx, reloj: () => new Date(AHORA.getTime() + 3_600_000) };
  assert.equal((await reporte(ctx2)).huella, a.huella);
  assert.notEqual((await reporte(ctx, { ...F, alcaldia: "4" })).huella, a.huella);
  assert.notEqual((await reporte(ctx, { ...F, hasta: "2026-10-17" })).huella, a.huella);
  assert.match(a.huella, /^[0-9a-f]{32}$/);
});

test("exportar · 422 SIN_DATOS si el periodo no tiene casos, 422 por campo si el cuerpo o los filtros son inválidos", async () => {
  const { ctx } = nuevoContexto();
  const vacio = await falla(exportarReporte(ADMIN, { formato: "pdf", filtros: { desde: "2026-10-19", hasta: "2026-10-31" }, huella: "a".repeat(32) }, ctx));
  assert.deepEqual([vacio?.estado, vacio?.codigo], [422, "SIN_DATOS"]);
  const r = await reporte(ctx);
  assert.ok((await falla(exportarReporte(ADMIN, { ...cuerpo(r), formato: "docx" }, ctx)))?.campos?.formato);
  assert.ok((await falla(exportarReporte(ADMIN, { formato: "pdf", huella: r.huella }, ctx)))?.campos?.filtros);
  assert.ok((await falla(exportarReporte(ADMIN, { ...cuerpo(r), filtros: { desde: "", hasta: "" } }, ctx)))?.campos?.desde);
  assert.ok((await falla(exportarReporte(ADMIN, { ...cuerpo(r), filtros: { ...F, alcaldia: "17" } }, ctx)))?.campos?.alcaldia);
  for (const malo of [null, [], "x", 5]) assert.equal((await falla(exportarReporte(ADMIN, malo, ctx)))?.estado, 422);
});

test("exportar · sin sesión 401 y Tutor 403 (antes de mirar el cuerpo)", async () => {
  const { ctx } = nuevoContexto();
  const r = await reporte(ctx);
  assert.equal((await falla(exportarReporte(undefined, cuerpo(r), ctx)))?.estado, 401);
  assert.equal((await falla(exportarReporte(ROSA, cuerpo(r), ctx)))?.estado, 403);
  assert.equal((await falla(exportarReporte(ROSA, null, ctx)))?.estado, 403);
});

test("inyección de fórmulas · un nombre de catálogo que empieza con = + - @ sale como TEXTO con apóstrofo en todas las celdas, y las cifras siguen siendo números", async () => {
  const { ctx } = nuevoContexto();
  const nombres = ["=1+1", "+SUMA(1;1)", "-2+3", "@HIPERVINCULO"];
  const ids: number[] = [];
  for (const [i, nombre] of nombres.entries()) {
    const { item } = await altaCatalogo(ADMIN, "alcaldias", { nombre, clave: `0909${i}` }, ctx);
    ids.push(item.id);
    await registrarExtravio(ROSA, { datos: datosCaso({ alcaldia: nombre }), foto: FOTO }, ctx);
    const folio = (await ctx.repos.casos.todos()).at(-1)!.folio;
    await registrarAvistamiento({ canal: "folio", folio }, { datos: { fecha: "2026-10-18", hora: "05:00", direccion: "Av 1", idAlcaldia: item.id, estadosAnimal: [1, 7] }, foto: FOTO }, ctx);
  }
  const f = { ...F, alcaldia: String(ids[0]) };
  const r = await reporte(ctx, f);
  const { bytes } = await exportarReporte(ADMIN, { formato: "xlsx", filtros: f, huella: r.huella }, ctx);
  const h = hojas(bytes);
  assert.equal(celdas(h.Resumen)["Alcaldía"], "'=1+1");
  const completo = await reporte(ctx);
  const todo = hojas((await exportarReporte(ADMIN, cuerpo(completo), ctx)).bytes);
  const alcaldias = todo["Alcaldía del avistamiento"].slice(1).map((fila) => fila[0] as string);
  for (const nombre of nombres) assert.ok(alcaldias.includes(`'${nombre}`), `${nombre} neutralizado`);
  assert.ok(!alcaldias.some((n) => /^[=+\-@]/.test(n)), "ninguna celda de texto empieza con = + - @");
  const todas = leerXlsx((await exportarReporte(ADMIN, cuerpo(completo), ctx)).bytes).flatMap((x) => [...x.celdas.values()]);
  assert.ok(todas.filter((v): v is string => typeof v === "string").every((v) => !/^\s*[=+\-@\t\r]/.test(v)));
  assert.ok(todo["Alcaldía del avistamiento"].slice(1).every((fila) => typeof fila[1] === "number"));
});
