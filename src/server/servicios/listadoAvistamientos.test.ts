import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp } from "../errores";
import { nuevoContexto } from "../pruebas/auxiliares";
import { jpeg } from "../pruebas/imagenes";
import type { SesionActual } from "../sesion/guardas";
import { registrarAvistamiento } from "./avistamientos";
import { listadoDeAvistamientos } from "./misRegistros";

const NALA = "RUPE-Y9F4LK2E"; // 101, 103, 104, 102 (Fallecido) visibles; 105 oculto; registro 4 de octubre
const BRUNO = "RUPE-N8D5GX3W";
const ROSA: SesionActual = { idUsuario: 2, rol: "Tutor", nombre: "Rosa Hernández Ficticia" };
const LUIS: SesionActual = { idUsuario: 5, rol: "Tutor", nombre: "Luis Navarro Ficticio" };
const falla = (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => (e instanceof ErrorApp ? e : undefined));
const ids = (l: { items: { id: number }[] }) => l.items.map((i) => i.id);

test("HU 039 · el listado trae solo los avistamientos VISIBLES por fecha de recepción descendente, con «nuevo» y «relevante», y el «Fallecido» sin foto ni estados", async () => {
  const { ctx } = nuevoContexto();
  const l = await listadoDeAvistamientos(ROSA, NALA, {}, ctx);
  assert.deepEqual(ids(l), [102, 104, 103, 101], "el 105 está oculto por moderación");
  assert.equal(l.total, 4);
  const fallecido = l.items.find((i) => i.id === 102)!;
  assert.deepEqual([fallecido.fallecido, fallecido.estados, fallecido.fotografiaUrl], [true, [], undefined]);
  assert.ok(l.items.every((i) => i.nuevo === false && i.relevante === false), "los sembrados de Nala cuentan como vistos y ninguno es relevante");
  assert.deepEqual(ids(await listadoDeAvistamientos(ROSA, BRUNO, {}, ctx)), [302, 301]);
  assert.equal((await listadoDeAvistamientos(ROSA, BRUNO, {}, ctx)).items[0].nuevo, true, "el 302 es el nuevo de Bruno");
});

test("HU 039 · se ordena por fecha de RECEPCIÓN (envío), no por la fecha en que se vio al perro", async () => {
  const { ctx } = nuevoContexto();
  // Se reporta ahora (envío 18 de octubre) un avistamiento que ocurrió el 6 de octubre: aparece primero por su recepción.
  const r = await registrarAvistamiento({ canal: "folio", folio: NALA }, { datos: { fecha: "2026-10-06", hora: "08:00", direccion: "Calle 1", idAlcaldia: 9, estadosAnimal: [1, 7] }, foto: { bytes: jpeg(), tipoDeclarado: "image/jpeg" } }, ctx);
  assert.deepEqual(ids(await listadoDeAvistamientos(ROSA, NALA, {}, ctx)), [r.id, 102, 104, 103, 101]);
});

test("HU 041 · filtros por fecha del avistamiento (día CDMX), por alcaldía y combinados; los sembrados de Nala son de Iztapalapa (9)", async () => {
  const { ctx } = nuevoContexto();
  assert.deepEqual(ids(await listadoDeAvistamientos(ROSA, NALA, { desde: "2026-10-06" }, ctx)), [102, 104, 103]);
  assert.deepEqual(ids(await listadoDeAvistamientos(ROSA, NALA, { hasta: "2026-10-06" }, ctx)), [103, 101]);
  assert.deepEqual(ids(await listadoDeAvistamientos(ROSA, NALA, { desde: "2026-10-07", hasta: "2026-10-07" }, ctx)), [104]);
  assert.deepEqual(ids(await listadoDeAvistamientos(ROSA, NALA, { alcaldia: "9" }, ctx)), [102, 104, 103, 101]);
  assert.deepEqual(ids(await listadoDeAvistamientos(ROSA, NALA, { alcaldia: "6" }, ctx)), []);
  assert.deepEqual(ids(await listadoDeAvistamientos(ROSA, NALA, { desde: "2026-10-06", hasta: "2026-10-07", alcaldia: "9" }, ctx)), [104, 103]);
  const vacio = await listadoDeAvistamientos(ROSA, NALA, { alcaldia: "6" }, ctx);
  assert.equal(vacio.total, 4, "el total sin filtrar permite distinguir «sin avistamientos» de «sin resultados»");
});

test("HU 041 · «Fuera de la Ciudad de México» (id 17) es una opción del filtro y las alcaldías salen del catálogo del almacén", async () => {
  const { ctx } = nuevoContexto();
  const l = await listadoDeAvistamientos(ROSA, NALA, { alcaldia: "17" }, ctx);
  assert.equal(l.items.length, 0);
  assert.deepEqual(l.errores, {});
  assert.equal(l.alcaldias.length, 17);
  assert.ok(l.alcaldias.some((a) => a.id === 17 && /Fuera de la Ciudad de México/.test(a.nombre)));
});

test("HU 041 · los filtros inválidos se validan en el SERVIDOR: el campo malo no se aplica y se informa su error", async () => {
  const { ctx } = nuevoContexto();
  const l = await listadoDeAvistamientos(ROSA, NALA, { desde: "2026-10-03", hasta: "2026-02-30", alcaldia: "99" }, ctx);
  assert.deepEqual(Object.keys(l.errores).sort(), ["alcaldia", "desde", "hasta"]);
  assert.deepEqual(l.filtros, {});
  assert.equal(l.items.length, 4, "sin filtros válidos se muestra todo");
  assert.match((await listadoDeAvistamientos(ROSA, NALA, { desde: "2026-10-08", hasta: "2026-10-06" }, ctx)).errores.hasta ?? "", /inicial/);
  const raro = await listadoDeAvistamientos(ROSA, NALA, { desde: ["2026-10-06"], alcaldia: { a: 1 } }, ctx);
  assert.ok(raro.errores.desde && raro.errores.alcaldia);
});

test("R32 · el listado con filtros usa la misma guarda: ajeno/inexistente = 404, sin sesión 401, Administrador 403", async () => {
  const { ctx } = nuevoContexto();
  assert.equal((await falla(listadoDeAvistamientos(LUIS, NALA, { alcaldia: "9" }, ctx)))?.estado, 404);
  assert.equal((await falla(listadoDeAvistamientos(ROSA, "RUPE-ZZZZZZZZ", {}, ctx)))?.estado, 404);
  assert.equal((await falla(listadoDeAvistamientos(undefined, NALA, {}, ctx)))?.estado, 401);
  assert.equal((await falla(listadoDeAvistamientos({ idUsuario: 1, rol: "Administrador", nombre: "A" }, NALA, {}, ctx)))?.estado, 403);
});
