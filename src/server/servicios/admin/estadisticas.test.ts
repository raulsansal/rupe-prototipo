import assert from "node:assert/strict";
import { test } from "node:test";
import { generarReporte as reporteOraculo } from "../../../lib/reportes";
import { AVISTAMIENTOS_TABLERO, calcularTablero as tableroOraculo, CASOS_TABLERO } from "../../../mocks/tablero";
import { ALCALDIAS } from "../../../mocks/tipos";
import { ErrorApp } from "../../errores";
import { almacenVacio } from "../../memoria/almacen";
import { crearRepositorios } from "../../memoria/repos";
import { AHORA, nuevoContexto } from "../../pruebas/auxiliares";
import { jpeg } from "../../pruebas/imagenes";
import { sembrar } from "../../seed/seed";
import type { ReporteAdmin, TableroAdmin } from "../../serializadores/admin";
import type { SesionActual } from "../../sesion/guardas";
import { registrarAvistamiento } from "../avistamientos";
import { cancelarCaso, cerrarCaso, marcarLocalizado, reactivarCaso } from "../cambioDeEstado";
import { registrarExtravio } from "../extravio";
import { editarCatalogo, desactivarCatalogo, altaCatalogo } from "./catalogosAdmin";
import { deshabilitarCaso, restaurarCaso } from "./moderacionRegistros";
import { ocultarAvistamiento, restaurarAvistamiento } from "./moderacionAvistamientos";
import { generarReporteAdmin, opcionesDeReporte } from "./reportesAdmin";
import { consultarTablero } from "./tableroAdmin";

type Ctx = ReturnType<typeof nuevoContexto>["ctx"];
const ROSA: SesionActual = { idUsuario: 2, rol: "Tutor", nombre: "Rosa Hernández Ficticia" };
const ADMIN: SesionActual = { idUsuario: 1, rol: "Administrador", nombre: "Ricardo Vega Ficticio" };
const MAX = "RUPE-K7M4XQ9T"; // sembrado, Rosa, En búsqueda
const FOTO = { bytes: jpeg(), tipoDeclarado: "image/jpeg" };
const datosCaso = (extra: Record<string, unknown> = {}) => ({
  nombre: "Nuevo", sexo: "Hembra", idRaza: 1, edad: { valor: 3, unidad: "años" }, tamano: "pequeño", color: "Blanco", caracteristicas: "Mancha", fechaExtravio: "2026-10-18", momento: "tarde",
  alcaldia: "Coyoacán", colonia: "Del Carmen", calle: "Calle 1", referencias: "ref", idMotivo: 1, descripcion: "d", ...extra,
});
const datosAv = (extra: Record<string, unknown> = {}) => ({ fecha: "2026-10-18", hora: "05:00", direccion: "Avenida 1", idAlcaldia: 6, coloniaZona: "Del Valle", referencias: "r", estadosAnimal: [1, 7], comentario: "c", ...extra });
const nuevoCaso = async (ctx: Ctx, extra: Record<string, unknown> = {}) => (await registrarExtravio(ROSA, { datos: datosCaso(extra), foto: FOTO }, ctx)).folio;
const avistar = async (ctx: Ctx, folio: string, extra: Record<string, unknown> = {}) => {
  await registrarAvistamiento({ canal: "folio", folio }, { datos: datosAv(extra), foto: FOTO }, ctx);
  return (await ctx.repos.avistamientos.todos()).at(-1)!.idAvistamiento;
};
const tablero = (ctx: Ctx, p: { desde?: string; hasta?: string } = {}) => consultarTablero(ADMIN, p, ctx);
const reporte = (ctx: Ctx, f: Record<string, unknown> = {}) => generarReporteAdmin(ADMIN, { desde: "2026-10-01", hasta: "2026-10-18", ...f }, ctx);
const conDatos = (r: ReporteAdmin) => {
  assert.equal(r.sinDatos, false);
  return r as Extract<ReporteAdmin, { sinDatos: false }>;
};
const valores = (b: { valor: number }[]) => b.map((x) => x.valor);
/** Las cifras que el tablero muestra, sin rótulos: así se compara «antes → después». */
const cifras = (t: TableroAdmin) => ({
  total: t.totalCasos, activos: t.casosActivos, localizados: t.casosLocalizados, avistamientos: t.totalAvistamientos, ocultos: t.avistamientosOcultos, promedio: t.promedioLocalizacion,
  motivo: valores(t.porMotivo), estado: valores(t.porEstadoCaso), cierres: valores(t.cierres), animal: t.porEstadoAnimal.flatMap((g) => valores(g.barras)), alcaldia: t.porAlcaldia.map((b) => [b.id, b.valor]),
});
const INICIAL = { total: 163, activos: 141, localizados: 19, avistamientos: 199, ocultos: 6, motivo: [46, 40, 29, 38, 10], estado: [20, 58, 32, 31, 16, 6], cierres: [9, 6, 2] };
const parcial = (t: TableroAdmin) => { const c = cifras(t); return { total: c.total, activos: c.activos, localizados: c.localizados, avistamientos: c.avistamientos, ocultos: c.ocultos, motivo: c.motivo, estado: c.estado, cierres: c.cierres }; };
const falla = (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => (e instanceof ErrorApp ? e : undefined));
const tasa = (num: number, den: number) => Math.round((num / den) * 1000) / 10;
const registrosEnBitacora = (a: ReturnType<typeof nuevoContexto>["almacen"]) => a.bitacora.length;
/** Suma de días a localizar de la base en 1–18 oct (para el promedio mezclado de base y capa real). */
const sumaDiasBase = () => CASOS_TABLERO.filter((c) => c.fecha >= "2026-10-01" && (c.estado === "Localizado" || c.cierre === "Cierre confirmado")).reduce((s, c) => s + (c.diasALocalizar ?? 0), 0);

// ---------------------------------------------------------------------------------------------------------------------------------- cifras iniciales
test("cifras iniciales · sin eventos posteriores a la siembra, el tablero da EXACTAMENTE las cifras de siempre (163 · 141 · 19 · 199 · 6, motivo, estado y cierres)", async () => {
  const { ctx } = nuevoContexto();
  const t = await tablero(ctx);
  assert.deepEqual(t.periodo, { desde: "2026-10-01", hasta: "2026-10-18" });
  assert.deepEqual(parcial(t), INICIAL);
  assert.equal(t.promedioLocalizacion, 4.9);
});

test("cifras iniciales · el periodo predeterminado va de 1 de octubre a HOY (30 oct): mismas cifras que 1–18 oct, porque la base termina el 18 (y hoy anterior al 1 oct acota el inicio)", async () => {
  const { ctx } = nuevoContexto({}, () => new Date("2026-10-30T18:00:00Z"));
  const t = await tablero(ctx);
  assert.deepEqual(t.periodo, { desde: "2026-10-01", hasta: "2026-10-30" });
  assert.deepEqual(parcial(t), INICIAL);
  assert.deepEqual(cifras(t), cifras(await tablero(nuevoContexto().ctx)));
  const enSeptiembre = await tablero(nuevoContexto({}, () => new Date("2026-09-20T18:00:00Z")).ctx);
  assert.deepEqual(enSeptiembre.periodo, { desde: "2026-09-20", hasta: "2026-09-20" });
});

test("cifras iniciales · todos los periodos que cubren la base dan lo mismo que el oráculo del maquetado (por nombre), rótulo por rótulo", async () => {
  const { ctx } = nuevoContexto();
  for (const p of [{ desde: "2026-10-01", hasta: "2026-10-18" }, { desde: "2026-06-01", hasta: "2026-10-18" }, { desde: "2026-09-01", hasta: "2026-09-30" }, { desde: "2026-08-10", hasta: "2026-08-16" }, { desde: "2026-10-18", hasta: "2026-10-18" }]) {
    const o = tableroOraculo(p);
    const t = await tablero(ctx, p);
    const et = `${p.desde}..${p.hasta}`;
    assert.deepEqual([t.totalCasos, t.casosActivos, t.casosLocalizados, t.totalAvistamientos, t.avistamientosOcultos, t.promedioLocalizacion], [o.totalCasos, o.casosActivos, o.casosLocalizados, o.totalAvistamientos, o.avistamientosOcultos, o.promedioLocalizacion], et);
    const nv = (b: { nombre: string; valor: number }[]) => b.map((x) => [x.nombre, x.valor]);
    assert.deepEqual(nv(t.porMotivo), nv(o.porMotivo), et);
    assert.deepEqual(nv(t.porEstadoCaso), nv(o.porEstadoCaso), et);
    assert.deepEqual(nv(t.cierres), nv(o.cierres), et);
    assert.deepEqual(nv(t.porAlcaldia), nv(o.porAlcaldia), et);
    assert.deepEqual(t.porEstadoAnimal.map((g) => [g.categoria, nv(g.barras)]), o.porEstadoAnimal.map((g) => [g.categoria, nv(g.barras)]), et);
  }
});

test("cifras iniciales · el reporte sin capa real da lo mismo que el oráculo con y sin filtros (alcaldía por id), y sin casos = sinDatos", async () => {
  const { ctx } = nuevoContexto();
  const base = { desde: "2026-10-01", hasta: "2026-10-18" };
  const combos = [{}, { alcaldia: "Coyoacán" }, { estadoCaso: "Localizado" }, { categoria: "2" }, { alcaldia: "Coyoacán", estadoCaso: "Localizado" }, { alcaldia: "Iztapalapa", categoria: "1", estadoCaso: "En búsqueda" }];
  for (const c of combos) {
    const idAlcaldia = "alcaldia" in c ? String(ALCALDIAS.indexOf(c.alcaldia as never) + 1) : "";
    const o = reporteOraculo({ ...base, alcaldia: (c as { alcaldia?: string }).alcaldia ?? "", categoria: (c as { categoria?: string }).categoria ?? "", estadoCaso: (c as { estadoCaso?: string }).estadoCaso ?? "" });
    const r = await reporte(ctx, { ...c, ...("alcaldia" in c ? { alcaldia: idAlcaldia } : {}) });
    const et = JSON.stringify(c);
    if (!o) {
      assert.equal(r.sinDatos, true, et);
      continue;
    }
    const d = conDatos(r);
    const nv = (b: { nombre: string; valor: number }[]) => b.map((x) => [x.nombre, x.valor]);
    assert.deepEqual([d.totalCasos, d.casosLocalizados, d.tasaRecuperacion, d.avistamientosOcultos], [o.totalCasos, o.casosLocalizados, o.tasaRecuperacion, o.avistamientosOcultos], et);
    assert.deepEqual([nv(d.porMotivo), nv(d.porEstadoCaso), nv(d.cierres), nv(d.porAlcaldiaAvistamiento)], [nv(o.porMotivo), nv(o.porEstadoCaso), nv(o.cierres), nv(o.porAlcaldiaAvistamiento)], et);
    assert.deepEqual(d.porEstadoAnimal.map((g) => [g.categoria, nv(g.barras)]), o.porEstadoAnimal.map((g) => [g.categoria, nv(g.barras)]), et);
  }
  assert.equal((await reporte(ctx, { desde: "2026-10-19", hasta: "2026-10-31" })).sinDatos, true);
  assert.equal(conDatos(await reporte(ctx)).tasaRecuperacion, 11.9);
});

test("marca de siembra · la capa real está vacía al sembrar: los 12 casos y los avistamientos sembrados NO están en ella, y la base suma 1204 casos y 1714 avistamientos por id", async () => {
  const { ctx, almacen } = nuevoContexto();
  const d = await ctx.repos.estadisticas.leer();
  assert.deepEqual([d.casos.length, d.avistamientos.length], [0, 0]);
  assert.equal(d.marca.idCasoMax, 12);
  assert.equal(d.marca.idCasoMax, Math.max(...almacen.casos.map((c) => c.idCasoExtravio)));
  assert.equal(d.marca.idAvistamientoMax, Math.max(...almacen.avistamientos.map((v) => v.idAvistamiento)));
  assert.deepEqual([d.base.casos.length, d.base.avistamientos.length], [CASOS_TABLERO.length, AVISTAMIENTOS_TABLERO.length]);
  // Otra siembra (lo que hace «reiniciar») vuelve a empezar: la marca se recalcula y lo creado antes ya no existe.
  await nuevoCaso(ctx);
  assert.equal((await ctx.repos.estadisticas.leer()).casos.length, 1);
  const otra = sembrar(almacenVacio(), {});
  assert.deepEqual(otra.marcaDeSiembra, d.marca);
  assert.equal((await crearRepositorios(() => otra).estadisticas.leer()).casos.length, 0);
});

// ---------------------------------------------------------------------------------------------------------------------------------- un delta por evento
test("delta · caso nuevo: 163 → 164 casos, +1 activo, +1 «En búsqueda» y +1 en su categoría de motivo; nada más se mueve", async () => {
  const { ctx } = nuevoContexto();
  const antes = cifras(await tablero(ctx));
  await nuevoCaso(ctx);
  const despues = cifras(await tablero(ctx));
  assert.deepEqual([antes.total, despues.total, antes.activos, despues.activos], [163, 164, 141, 142]);
  assert.deepEqual(despues.estado, [20, 59, 32, 31, 16, 6]);
  assert.deepEqual(despues.motivo, [47, 40, 29, 38, 10]);
  assert.deepEqual({ ...despues, total: 0, activos: 0, estado: [], motivo: [] }, { ...antes, total: 0, activos: 0, estado: [], motivo: [] });
});

test("delta · localizar un caso nuevo: +1 localizado, −1 activo, el promedio mezcla base y capa real (0 días), y el caso cuenta una sola vez", async () => {
  const { ctx } = nuevoContexto();
  const folio = await nuevoCaso(ctx);
  const antes = await tablero(ctx);
  await marcarLocalizado(ROSA, folio, ctx);
  const t = await tablero(ctx);
  assert.deepEqual([antes.casosLocalizados, t.casosLocalizados, antes.casosActivos, t.casosActivos, t.totalCasos], [19, 20, 142, 141, 164]);
  assert.deepEqual(valores(t.porEstadoCaso), [20, 58, 32, 31, 17, 6]);
  assert.equal(t.promedioLocalizacion, Math.round((sumaDiasBase() / 20) * 10) / 10);
});

test("delta · cierre por tipo con la fecha del movimiento: confirmar (+1 en «Cierre confirmado»), cancelar (+1) y deshabilitar (+1); un cierre de otro día cuenta en SU día", async () => {
  let ahora = AHORA;
  const { ctx } = nuevoContexto({}, () => ahora);
  const a = await nuevoCaso(ctx);
  const b = await nuevoCaso(ctx);
  const c = await nuevoCaso(ctx);
  await marcarLocalizado(ROSA, a, ctx);
  const antes = cifras(await tablero(ctx));
  await cerrarCaso(ROSA, a, ctx);
  const t1 = await tablero(ctx);
  assert.deepEqual(valores(t1.cierres), [10, 6, 2]);
  assert.deepEqual([t1.casosLocalizados, valores(t1.porEstadoCaso)[4], valores(t1.porEstadoCaso)[5]], [antes.localizados, 16, 7]); // sigue localizado (cierre confirmado), pasa de Localizado a Cerrado
  await cancelarCaso(ROSA, b, "Ya no lo busco", ctx);
  assert.deepEqual(valores((await tablero(ctx)).cierres), [10, 7, 2]);
  await deshabilitarCaso(ADMIN, c, "Contenido inapropiado", ctx);
  assert.deepEqual(valores((await tablero(ctx)).cierres), [10, 7, 3]);
  // Un cierre posterior se cuenta en el día del movimiento: el periodo anterior a ese día no lo ve.
  const otro = await nuevoCaso(ctx);
  ahora = new Date("2026-10-20T15:00:00Z");
  await cancelarCaso(ROSA, otro, "Otro", ctx);
  assert.deepEqual(valores((await tablero(ctx, { desde: "2026-10-01", hasta: "2026-10-20" })).cierres), [10, 8, 3]);
  assert.deepEqual(valores((await tablero(ctx, { desde: "2026-10-01", hasta: "2026-10-19" })).cierres), [10, 7, 3]);
});

test("delta · cancelar un caso nuevo: −1 activo, +1 «Cerrado», +1 en «Cancelación»; el total no cambia", async () => {
  const { ctx } = nuevoContexto();
  const folio = await nuevoCaso(ctx);
  const antes = cifras(await tablero(ctx));
  await cancelarCaso(ROSA, folio, "Ya no lo busco", ctx);
  const t = await tablero(ctx);
  assert.deepEqual([t.totalCasos, t.casosActivos, t.casosLocalizados], [antes.total, antes.activos - 1, antes.localizados]);
  assert.deepEqual(valores(t.porEstadoCaso), [20, 58, 32, 31, 16, 7]);
  assert.deepEqual(valores(t.cierres), [9, 7, 2]);
});

test("delta · deshabilitar y restaurar un caso nuevo: «Deshabilitación» +1 y vuelve; tras restaurar el tablero y el reporte son IDÉNTICOS (huella de contenido) a antes", async () => {
  const { ctx } = nuevoContexto();
  const folio = await nuevoCaso(ctx);
  const antesT = JSON.stringify({ ...(await tablero(ctx)), generadoEn: 0 });
  const antesR = (conDatos(await reporte(ctx))).huella;
  await deshabilitarCaso(ADMIN, folio, "Contenido inapropiado", ctx);
  const durante = await tablero(ctx);
  assert.deepEqual(valores(durante.cierres), [9, 6, 3]);
  assert.deepEqual([durante.casosActivos, valores(durante.porEstadoCaso)[5]], [141, 7]);
  assert.notEqual(conDatos(await reporte(ctx)).huella, antesR);
  await restaurarCaso(ADMIN, folio, ctx);
  assert.equal(JSON.stringify({ ...(await tablero(ctx)), generadoEn: 0 }), antesT);
  assert.equal(conDatos(await reporte(ctx)).huella, antesR);
});

test("delta · reactivar un caso localizado lo saca de «localizados» (+1 activo) y localizarlo otra vez usa la última localización", async () => {
  const { ctx } = nuevoContexto();
  const folio = await nuevoCaso(ctx);
  await marcarLocalizado(ROSA, folio, ctx);
  await reactivarCaso(ROSA, folio, "Se volvió a perder", ctx);
  const t = await tablero(ctx);
  assert.deepEqual([t.casosLocalizados, t.casosActivos, valores(t.porEstadoCaso)[3]], [19, 142, 32]); // En seguimiento
  await marcarLocalizado(ROSA, folio, ctx);
  assert.equal((await tablero(ctx)).casosLocalizados, 20);
});

test("delta · avistamiento nuevo sobre un caso nuevo: +1 visible, su alcaldía (la del AVISTAMIENTO) y +1 en cada estado del animal elegido; el caso pasa a «Avistamiento reportado»", async () => {
  const { ctx } = nuevoContexto();
  const folio = await nuevoCaso(ctx);
  const antes = cifras(await tablero(ctx));
  await avistar(ctx, folio, { idAlcaldia: 6, estadosAnimal: [2, 3, 8] });
  const t = await tablero(ctx);
  assert.equal(t.totalAvistamientos, 200);
  const alc = (id: number) => t.porAlcaldia.find((b) => b.id === id)!.valor;
  assert.equal(alc(6), antes.alcaldia.find(([id]) => id === 6)![1] as number + 1);
  const estado = (id: number) => t.porEstadoAnimal.flatMap((g) => g.barras).find((b) => b.id === id)!.valor;
  const antesEstado = (await tablero(nuevoContexto().ctx)).porEstadoAnimal.flatMap((g) => g.barras);
  for (const id of [2, 3, 8]) assert.equal(estado(id), antesEstado.find((b) => b.id === id)!.valor + 1);
  assert.equal(estado(1), antesEstado.find((b) => b.id === 1)!.valor);
  assert.deepEqual(valores(t.porEstadoCaso), [20, 58, 33, 31, 16, 6]); // En búsqueda → Avistamiento reportado
});

test("delta · ocultar y restaurar un avistamiento nuevo: −1 visible / +1 oculto (aparte, R29) y vuelve idéntico", async () => {
  const { ctx } = nuevoContexto();
  const folio = await nuevoCaso(ctx);
  const id = await avistar(ctx, folio);
  const antes = JSON.stringify({ ...(await tablero(ctx)), generadoEn: 0 });
  await ocultarAvistamiento(ADMIN, String(id), "Foto inapropiada", ctx);
  const t = await tablero(ctx);
  assert.deepEqual([t.totalAvistamientos, t.avistamientosOcultos], [199, 7]);
  assert.equal(conDatos(await reporte(ctx)).avistamientosOcultos, 7);
  await restaurarAvistamiento(ADMIN, String(id), ctx);
  assert.equal(JSON.stringify({ ...(await tablero(ctx)), generadoEn: 0 }), antes);
});

test("avistamiento nuevo sobre un caso SEMBRADO: cuenta en el tablero y en el reporte (atribuido por los atributos del caso), pero el caso sembrado no suma como caso", async () => {
  const { ctx } = nuevoContexto();
  const maxCaso = (await ctx.repos.casos.porFolio(MAX))!;
  const otra = maxCaso.idAlcaldia === 1 ? 2 : 1;
  const enAvistamientos = (r: ReporteAdmin) => conDatos(r).porAlcaldiaAvistamiento.reduce((s, b) => s + b.valor, 0);
  const antes = await tablero(ctx);
  const [rTodo, rMax, rOtra] = [await reporte(ctx), await reporte(ctx, { alcaldia: String(maxCaso.idAlcaldia) }), await reporte(ctx, { alcaldia: String(otra) })];
  await avistar(ctx, MAX, { idAlcaldia: 6, estadosAnimal: [1, 7] });
  const t = await tablero(ctx);
  assert.deepEqual([t.totalCasos, t.casosActivos, t.casosLocalizados], [antes.totalCasos, antes.casosActivos, antes.casosLocalizados]);
  assert.equal(t.totalAvistamientos, 200);
  assert.deepEqual(valores(t.porEstadoCaso), valores(antes.porEstadoCaso)); // pasar de «En búsqueda» a «Avistamiento reportado» NO mueve los estados: el caso es sembrado
  const [r2Todo, r2Max, r2Otra] = [await reporte(ctx), await reporte(ctx, { alcaldia: String(maxCaso.idAlcaldia) }), await reporte(ctx, { alcaldia: String(otra) })];
  assert.equal(conDatos(r2Todo).totalCasos, conDatos(rTodo).totalCasos);
  assert.deepEqual([enAvistamientos(r2Todo), enAvistamientos(r2Max), enAvistamientos(r2Otra)], [enAvistamientos(rTodo) + 1, enAvistamientos(rMax) + 1, enAvistamientos(rOtra)]); // entra por el filtro de la alcaldía de SU caso
});

test("acciones sobre los sembrados NO mueven cifras: deshabilitar y restaurar, localizar, cancelar, ocultar y restaurar un avistamiento sembrado dejan tablero y reporte idénticos", async () => {
  const { ctx, almacen } = nuevoContexto();
  const antes = JSON.stringify({ ...(await tablero(ctx)), generadoEn: 0 });
  const huella = conDatos(await reporte(ctx)).huella;
  await deshabilitarCaso(ADMIN, MAX, "Contenido inapropiado", ctx);
  await restaurarCaso(ADMIN, MAX, ctx);
  await marcarLocalizado(ROSA, MAX, ctx);
  await cerrarCaso(ROSA, MAX, ctx);
  await cancelarCaso(ROSA, "RUPE-H4TQ7V2M", "Ya no", ctx);
  const visible = almacen.avistamientos.find((v) => v.visible)!.idAvistamiento;
  await ocultarAvistamiento(ADMIN, String(visible), "Motivo", ctx);
  assert.equal(JSON.stringify({ ...(await tablero(ctx)), generadoEn: 0 }), antes);
  assert.equal(conDatos(await reporte(ctx)).huella, huella);
  await restaurarAvistamiento(ADMIN, String(visible), ctx);
});

// ---------------------------------------------------------------------------------------------------------------------------------- periodos y filtros
test("periodos · el día es de la Ciudad de México (UTC−6): un caso registrado a las 21:00 del 18 es del 18 aunque en UTC ya sea 19", async () => {
  const { ctx } = nuevoContexto({}, () => new Date("2026-10-19T03:00:00Z")); // 21:00 del 18 en la Ciudad de México
  const solo18 = await tablero(ctx, { desde: "2026-10-18", hasta: "2026-10-18" });
  await nuevoCaso(ctx);
  const con = await tablero(ctx, { desde: "2026-10-18", hasta: "2026-10-18" });
  assert.equal(con.totalCasos, solo18.totalCasos + 1);
  assert.equal(conDatos(await reporte(ctx, { desde: "2026-10-18", hasta: "2026-10-18" })).totalCasos, con.totalCasos);
});

test("periodos y filtros · alcaldía (por id), categoría y estado se aplican a la base y a la capa real; el caso nuevo aparece solo donde corresponde", async () => {
  const { ctx } = nuevoContexto();
  const sinCapa = nuevoContexto().ctx;
  const total = async (c: Ctx, f: Record<string, unknown>) => conDatos(await reporte(c, f)).totalCasos;
  const filtros = [{ alcaldia: "4" }, { alcaldia: "4", categoria: "2" }, { alcaldia: "4", categoria: "1" }, { alcaldia: "7" }, { categoria: "2" }, { estadoCaso: "En búsqueda" }, { estadoCaso: "Localizado" }];
  const antes = await Promise.all(filtros.map((f) => total(ctx, f)));
  await nuevoCaso(ctx, { alcaldia: "Coyoacán", idMotivo: 4 }); // Coyoacán = 4; motivo 4 → categoría 2; queda «En búsqueda»
  const despues = await Promise.all(filtros.map((f) => total(ctx, f)));
  assert.deepEqual(antes, await Promise.all(filtros.map((f) => total(sinCapa, f))));
  assert.deepEqual(despues.map((n, i) => n - antes[i]), [1, 1, 0, 0, 1, 1, 0]);
});

test("validación · rango obligatorio y real (422 por campo), alcaldía y categoría por id existente, «Fuera de la CDMX» no es alcaldía de un caso, y el tablero no pasa de hoy", async () => {
  const { ctx } = nuevoContexto();
  const campos = async (p: Promise<unknown>) => (await falla(p))?.campos;
  assert.deepEqual(Object.keys((await campos(generarReporteAdmin(ADMIN, {}, ctx)))!), ["desde", "hasta"]);
  assert.match((await campos(generarReporteAdmin(ADMIN, { desde: "2026-10-18", hasta: "2026-10-01" }, ctx)))!.hasta, /no puede ser anterior/);
  assert.match((await campos(generarReporteAdmin(ADMIN, { desde: "2026-13-45", hasta: "2026-10-01" }, ctx)))!.desde, /fecha válida/);
  assert.ok((await campos(reporte(ctx, { alcaldia: "999" })))!.alcaldia);
  assert.ok((await campos(reporte(ctx, { alcaldia: "17" })))!.alcaldia);
  assert.ok((await campos(reporte(ctx, { alcaldia: "Coyoacán" })))!.alcaldia);
  assert.ok((await campos(reporte(ctx, { categoria: "9" })))!.categoria);
  assert.ok((await campos(reporte(ctx, { estadoCaso: "Inventado" })))!.estadoCaso);
  assert.ok((await campos(tablero(ctx, { desde: "2026-10-10", hasta: "2026-10-25" })))!.hasta);
  assert.ok((await campos(tablero(ctx, { desde: "2026-05-01", hasta: "2026-10-01" })))!.desde);
  assert.ok((await campos(tablero(ctx, { desde: "2026-10-10", hasta: "2026-10-01" })))!.hasta);
  assert.equal(conDatos(await reporte(ctx, { desde: "2026-10-01", hasta: "2027-01-01" })).totalCasos, 163); // el reporte no limita «Hasta»: un periodo futuro solo no tiene datos
});

test("opciones del reporte · todas las alcaldías del almacén (activas, inactivas y nuevas) menos «Fuera de la CDMX», 5 categorías y 6 estados", async () => {
  const { ctx } = nuevoContexto();
  await desactivarCatalogo(ADMIN, "alcaldias", "5", ctx);
  await altaCatalogo(ADMIN, "alcaldias", { nombre: "Alcaldía nueva", clave: "09099" }, ctx);
  const o = await opcionesDeReporte(ADMIN, ctx);
  assert.equal(o.alcaldias.length, 17);
  assert.ok(o.alcaldias.some((a) => a.id === 5 && a.activo === false) && o.alcaldias.some((a) => a.nombre === "Alcaldía nueva") && !o.alcaldias.some((a) => a.id === 17));
  assert.deepEqual([o.categorias.length, o.estadosCaso.length], [5, 6]);
  assert.deepEqual(o.limites, { desde: "2026-06-01", hasta: "2026-10-18" });
});

// ---------------------------------------------------------------------------------------------------------------------------------- rótulos por identificador
test("catálogos · renombrar cambia el rótulo, NO las cifras ni parte las filas; desactivar conserva el conteo; crear no mueve nada", async () => {
  const { ctx } = nuevoContexto();
  const folio = await nuevoCaso(ctx, { alcaldia: "Coyoacán" });
  await avistar(ctx, folio, { idAlcaldia: 4, estadosAnimal: [2, 8] });
  const antes = await tablero(ctx);
  const rAntes = conDatos(await reporte(ctx));
  const motivoDe = (t: TableroAdmin) => t.porMotivo.map((b) => [b.id, b.valor]);
  await editarCatalogo(ADMIN, "alcaldias", "4", { nombre: "Coyoacán renombrada", clave: "09003" }, ctx);
  await editarCatalogo(ADMIN, "estados-animal", "2", { nombre: "Herido renombrado", idCategoria: 1, descripcion: "d" }, ctx);
  await desactivarCatalogo(ADMIN, "alcaldias", "4", ctx);
  await desactivarCatalogo(ADMIN, "estados-animal", "16", ctx);
  for (const [t, e, d] of [["razas", "x", { nombre: "Raza nueva" }], ["motivos", "x", { nombre: "Motivo nuevo", idCategoria: 1, descripcion: "d" }], ["estados-animal", "x", { nombre: "Estado nuevo", idCategoria: 1, descripcion: "d" }]] as const) { void e; await altaCatalogo(ADMIN, t, d, ctx); }
  const despues = await tablero(ctx);
  assert.deepEqual(cifras(despues).alcaldia, cifras(antes).alcaldia); // misma lista de ids y valores
  assert.deepEqual(motivoDe(despues), motivoDe(antes));
  const alc = (t: TableroAdmin) => t.porAlcaldia.find((b) => b.id === 4)!;
  assert.deepEqual([alc(despues).nombre, alc(despues).valor], ["Coyoacán renombrada", alc(antes).valor]);
  assert.equal(despues.porAlcaldia.filter((b) => b.nombre.startsWith("Coyoacán")).length, 1);
  const animal = (t: TableroAdmin, id: number) => t.porEstadoAnimal.flatMap((g) => g.barras).find((b) => b.id === id)!;
  assert.deepEqual([animal(despues, 2).nombre, animal(despues, 2).valor], ["Herido renombrado", animal(antes, 2).valor]);
  assert.equal(animal(despues, 16).valor, animal(antes, 16).valor); // desactivado: la fila sigue, con su conteo
  assert.equal(despues.porEstadoAnimal.flatMap((g) => g.barras).length, 18); // 17 + el nuevo (con 0)
  const r = conDatos(await reporte(ctx));
  assert.deepEqual([r.totalCasos, r.casosLocalizados, r.tasaRecuperacion, r.huella], [rAntes.totalCasos, rAntes.casosLocalizados, rAntes.tasaRecuperacion, rAntes.huella]); // la huella es de cifras por id: no cambia con un rótulo
  assert.equal(r.porAlcaldiaAvistamiento.find((b) => b.id === 4)!.nombre, "Coyoacán renombrada");
  assert.equal(r.filtros.alcaldia, null);
  assert.equal(conDatos(await reporte(ctx, { alcaldia: "4" })).filtros.alcaldia!.nombre, "Coyoacán renombrada"); // una alcaldía inactiva sigue filtrando
});

// ---------------------------------------------------------------------------------------------------------------------------------- tasa de recuperación
const tasaDe = async (ctx: Ctx) => { const r = conDatos(await reporte(ctx)); return [r.totalCasos, r.casosLocalizados, r.tasaRecuperacion]; };

test("tasa · estado inicial: 19 / 160 = 11,9 % (los 3 cierres confirmados y los 3 cancelados o deshabilitados dan el mismo 160: esta cifra NO distingue la regla; las siguientes sí)", async () => {
  assert.deepEqual(await tasaDe(nuevoContexto().ctx), [163, 19, tasa(19, 160)]);
});

test("tasa · cierre confirmado de un caso NUEVO: el denominador NO cambia (sigue contando) y el numerador sí", async () => {
  const { ctx } = nuevoContexto();
  const a = await nuevoCaso(ctx);
  assert.deepEqual(await tasaDe(ctx), [164, 19, tasa(19, 161)]); // el caso nuevo cuenta en el denominador
  await marcarLocalizado(ROSA, a, ctx);
  assert.deepEqual(await tasaDe(ctx), [164, 20, tasa(20, 161)]); // numerador +1, denominador igual
  await cerrarCaso(ROSA, a, ctx);
  assert.deepEqual(await tasaDe(ctx), [164, 20, tasa(20, 161)]); // cierre confirmado: ni uno ni otro cambian
});

test("tasa · cancelación de un caso NUEVO: el denominador baja 1", async () => {
  const { ctx } = nuevoContexto();
  const b = await nuevoCaso(ctx);
  assert.deepEqual(await tasaDe(ctx), [164, 19, tasa(19, 161)]);
  await cancelarCaso(ROSA, b, "Ya no lo busco", ctx);
  assert.deepEqual(await tasaDe(ctx), [164, 19, tasa(19, 160)]);
});

test("tasa · deshabilitación de un caso NUEVO: el denominador baja 1", async () => {
  const { ctx } = nuevoContexto();
  const c = await nuevoCaso(ctx);
  await deshabilitarCaso(ADMIN, c, "Contenido inapropiado", ctx);
  assert.deepEqual(await tasaDe(ctx), [164, 19, tasa(19, 160)]);
});

test("tasa · restaurar un caso deshabilitado devuelve el denominador", async () => {
  const { ctx } = nuevoContexto();
  const c = await nuevoCaso(ctx);
  await deshabilitarCaso(ADMIN, c, "Contenido inapropiado", ctx);
  await restaurarCaso(ADMIN, c, ctx);
  assert.deepEqual(await tasaDe(ctx), [164, 19, tasa(19, 161)]);
});

// ---------------------------------------------------------------------------------------------------------------------------------- seguridad
test("roles · tablero, reportes y opciones: sin sesión 401, Tutor 403, Administrador pasa", async () => {
  const { ctx } = nuevoContexto();
  const llamadas: Array<(s: SesionActual | undefined) => Promise<unknown>> = [(s) => consultarTablero(s, {}, ctx), (s) => generarReporteAdmin(s, { desde: "2026-10-01", hasta: "2026-10-18" }, ctx), (s) => opcionesDeReporte(s, ctx)];
  for (const [i, l] of llamadas.entries()) {
    assert.equal((await falla(l(undefined)))?.estado, 401, `llamada ${i}`);
    assert.equal((await falla(l(ROSA)))?.estado, 403, `llamada ${i}`);
    await l(ADMIN);
  }
});

test("claves exactas y nada de la persona tutora: ni el tablero ni el reporte ni la capa real llevan nombres, correos, teléfonos, folios, tokens, direcciones ni referencias", async () => {
  const { ctx } = nuevoContexto();
  const folio = await nuevoCaso(ctx, { calle: "Calle Reservada 99", referencias: "Referencia reservada", descripcion: "Descripción reservada" });
  await avistar(ctx, folio, { direccion: "Dirección del avistamiento reservada", referencias: "Referencia de avistamiento", comentario: "Comentario reservado" });
  const t = await tablero(ctx);
  const r = conDatos(await reporte(ctx));
  assert.deepEqual(Object.keys(t), ["periodo", "limites", "generadoEn", "casosActivos", "casosLocalizados", "totalCasos", "totalAvistamientos", "promedioLocalizacion", "avistamientosOcultos", "porMotivo", "porEstadoCaso", "cierres", "porEstadoAnimal", "porAlcaldia"]);
  assert.deepEqual(Object.keys(r), ["sinDatos", "filtros", "generadoEn", "huella", "totalCasos", "casosLocalizados", "tasaRecuperacion", "avistamientosOcultos", "porMotivo", "porEstadoCaso", "cierres", "porEstadoAnimal", "porAlcaldiaAvistamiento"]);
  assert.deepEqual(Object.keys(r.filtros), ["desde", "hasta", "alcaldia", "categoria", "estadoCaso"]);
  assert.deepEqual(Object.keys(t.porMotivo[0]), ["id", "nombre", "valor"]);
  assert.deepEqual(Object.keys(t.cierres[0]), ["nombre", "valor"]);
  const datos = await ctx.repos.estadisticas.leer();
  assert.deepEqual(Object.keys(datos.casos[0]), ["idCasoExtravio", "esNuevo", "fechaRegistro", "idAlcaldia", "idCategoriaMotivo", "idEstadoCaso", "movimientos"]);
  assert.deepEqual(Object.keys(datos.avistamientos[0]), ["fechaHoraAvistamiento", "idAlcaldia", "idsEstadoAnimal", "visible", "idCasoExtravio"]);
  const caso = (await ctx.repos.casos.porFolio(folio))!;
  const token = (await ctx.repos.qr.activoDe(caso.idCasoExtravio))!.tokenPublico;
  const texto = JSON.stringify({ t, r, datos: { ...datos, base: undefined } });
  for (const secreto of ["Rosa", "Hernández", "@", "5500", folio, token, "Reservada", "Reservado", "reservado", "Referencia", "Del Carmen", "Del Valle", "ZXQ"]) assert.ok(!texto.includes(secreto), `aparece «${secreto}»`);
});

test("el tablero y el reporte no escriben nada: ninguna lectura agrega a la bitácora ni cambia el almacén", async () => {
  const { ctx, almacen } = nuevoContexto();
  const antes = [registrosEnBitacora(almacen), JSON.stringify(almacen.ids), almacen.casos.length, almacen.historial.length];
  await tablero(ctx);
  await reporte(ctx);
  await opcionesDeReporte(ADMIN, ctx);
  assert.deepEqual([registrosEnBitacora(almacen), JSON.stringify(almacen.ids), almacen.casos.length, almacen.historial.length], antes);
});
