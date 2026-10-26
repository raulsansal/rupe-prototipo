import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ErrorApp, respuestaDeError } from "../errores";
import { nuevoContexto } from "../pruebas/auxiliares";
import { jpeg } from "../pruebas/imagenes";
import type { SesionActual } from "../sesion/guardas";
import { registrarExtravio } from "./extravio";
import { avistamientoDelCaso, avistamientosDelCaso, casoDelTutor, exigirCasoPropio, fichaDelTutor, listarCasosDelTutor, puntosDelMapa } from "./misRegistros";

const ROSA: SesionActual = { idUsuario: 2, rol: "Tutor", nombre: "Rosa Hernández Ficticia" };
const LUIS: SesionActual = { idUsuario: 5, rol: "Tutor", nombre: "Luis Navarro Ficticio" };
const ADMIN: SesionActual = { idUsuario: 1, rol: "Administrador", nombre: "Ricardo Vega Ficticio" };
const MAX = "RUPE-K7M4XQ9T";
const NALA = "RUPE-Y9F4LK2E";
const KIRA = "RUPE-D5W2QK8X";
const falla = async (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => (e instanceof ErrorApp ? e : undefined));
const huella = async (e: ErrorApp) => {
  const r = respuestaDeError(e);
  return JSON.stringify({ estado: r.status, cuerpo: await r.clone().text(), cabeceras: [...r.headers.entries()].sort() });
};

test("Mis registros · cada persona ve solo sus casos (Rosa 8, Luis 4) y nunca los de la otra", async () => {
  const { ctx } = nuevoContexto();
  const rosa = await listarCasosDelTutor(ROSA, ctx);
  const luis = await listarCasosDelTutor(LUIS, ctx);
  assert.equal(rosa.length, 8);
  assert.equal(luis.length, 4);
  assert.deepEqual(luis.map((c) => c.nombre).sort(), ["Duque", "Kira", "Mia", "Simba"]);
  assert.equal(rosa.some((c) => luis.some((l) => l.folio === c.folio)), false);
});

test("Mis registros · el caso recién registrado aparece primero y solo para su dueña", async () => {
  const { ctx } = nuevoContexto({}, () => new Date("2026-10-20T12:00:00Z")); // posterior a los casos sembrados
  const r = await registrarExtravio(ROSA, {
    datos: { nombre: "Canela", sexo: "Hembra", idRaza: 1, edad: { valor: 2, unidad: "años" }, tamano: "mediano", color: "Canela", fechaExtravio: "2026-10-18", momento: "tarde", alcaldia: "Coyoacán", colonia: "Del Carmen", calle: "Calle 1", idMotivo: 1 },
    foto: { bytes: jpeg(), tipoDeclarado: "image/jpeg" },
  }, ctx);
  assert.equal((await listarCasosDelTutor(ROSA, ctx))[0].folio, r.folio);
  assert.equal((await listarCasosDelTutor(LUIS, ctx)).some((c) => c.folio === r.folio), false);
});

test("Guarda · sin sesión 401 y Administrador 403 en todos los servicios de la persona tutora", async () => {
  const { ctx } = nuevoContexto();
  const llamadas: ((s: SesionActual | undefined) => Promise<unknown>)[] = [
    (s) => listarCasosDelTutor(s, ctx), (s) => casoDelTutor(s, MAX, {}, ctx), (s) => fichaDelTutor(s, MAX, ctx), (s) => exigirCasoPropio(s, MAX, ctx),
    (s) => avistamientosDelCaso(s, NALA, ctx), (s) => avistamientoDelCaso(s, NALA, "101", ctx), (s) => puntosDelMapa(s, NALA, ctx),
  ];
  for (const f of llamadas) {
    assert.equal((await falla(f(undefined)))?.estado, 401);
    assert.equal((await falla(f(ADMIN)))?.estado, 403);
  }
});

test("Aislamiento · Luis con folios de Rosa y Rosa con folios de Luis dan el MISMO 404 que un folio inexistente o mal formado, byte por byte y en cabeceras", async () => {
  const { ctx } = nuevoContexto();
  const servicios: [string, (s: SesionActual, f: string) => Promise<unknown>][] = [
    ["caso", (s, f) => casoDelTutor(s, f, {}, ctx)], ["ficha", (s, f) => fichaDelTutor(s, f, ctx)], ["propio", (s, f) => exigirCasoPropio(s, f, ctx)],
    ["avistamientos", (s, f) => avistamientosDelCaso(s, f, ctx)], ["avistamiento", (s, f) => avistamientoDelCaso(s, f, "101", ctx)], ["mapa", (s, f) => puntosDelMapa(s, f, ctx)],
  ];
  for (const [nombre, f] of servicios) {
    const base = await falla(f(LUIS, "RUPE-ZZZZZZZZ"));
    assert.equal(base?.estado, 404, nombre);
    const esperado = await huella(base!);
    for (const [s, folio] of [[LUIS, MAX], [LUIS, NALA], [ROSA, KIRA], [LUIS, "no-es-folio"], [LUIS, ""]] as [SesionActual, string][]) {
      const e = await falla(f(s, folio));
      assert.equal(await huella(e!), esperado, `${nombre} · ${folio}`);
    }
  }
});

test("Detalle · nombres del catálogo, historial real y nada de la persona tutora ni del token", async () => {
  const { ctx } = nuevoContexto();
  const caso = await casoDelTutor(ROSA, MAX, {}, ctx);
  assert.equal(caso.raza, "Mestizo/No identificada");
  assert.ok(caso.historial.length >= 2);
  const json = JSON.stringify(caso);
  assert.equal(json.includes("Rosa Hernández"), false);
  assert.equal(json.toLowerCase().includes("token"), false);
});

test("Variante ?estado= · sintetiza el historial sobre el caso real", async () => {
  const { ctx } = nuevoContexto();
  const real = await casoDelTutor(ROSA, MAX, {}, ctx);
  const cerrado = await casoDelTutor(ROSA, MAX, { estadoForzado: "Cerrado" }, ctx);
  assert.equal(cerrado.estado, "Cerrado");
  assert.equal(cerrado.folio, real.folio);
});

test("Avistamientos · solo los visibles, por fecha descendente, y «Fallecido» sin foto ni estados", async () => {
  const { ctx } = nuevoContexto();
  const lista = await avistamientosDelCaso(ROSA, NALA, ctx);
  assert.equal(lista.items.some((i) => [105, 303].includes(i.id)), false);
  const fechas = lista.items.map((i) => i.fechaHora);
  assert.deepEqual(fechas, [...fechas].sort().reverse());
  const fallecido = lista.items.find((i) => i.fallecido);
  if (fallecido) assert.deepEqual([fallecido.estados, fallecido.fotografiaUrl], [[], undefined]);
  const mapa = await puntosDelMapa(ROSA, NALA, ctx);
  assert.equal(mapa.puntos.length, lista.items.length);
  assert.equal((await falla(avistamientoDelCaso(ROSA, NALA, "105", ctx)))?.estado, 404);
});

// ---------------------------------------------------------------------------------------------------------------------------------- ampliación
const DE_ROSA = ["RUPE-K7M4XQ9T", "RUPE-P3H8WD5N", "RUPE-B6R2TZ7C", "RUPE-Y9F4LK2E", "RUPE-3HN8WD2B", "RUPE-H4TQ7V2M", "RUPE-N8D5GX3W", "RUPE-C2J9RK6Z"];
const DE_LUIS = ["RUPE-D5W2QK8X", "RUPE-F7L3MN6Y", "RUPE-G8R4TV3K", "RUPE-J2C6PZ9H"];
const NUEVO = {
  datos: { nombre: "Canela", sexo: "Hembra", idRaza: 1, edad: { valor: 2, unidad: "años" }, tamano: "mediano", color: "Canela", fechaExtravio: "2026-10-18", momento: "tarde", alcaldia: "Coyoacán", colonia: "Del Carmen", calle: "Calle 1", idMotivo: 1 },
  foto: { bytes: jpeg(), tipoDeclarado: "image/jpeg" },
};

test("Aislamiento completo · las 7 pantallas (6 servicios) con TODOS los folios de la otra persona, uno inexistente y uno mal formado: mismo 404, byte por byte y en cabeceras", async () => {
  const { ctx } = nuevoContexto();
  const servicios: [string, (s: SesionActual, f: string) => Promise<unknown>][] = [
    ["detalle", (s, f) => casoDelTutor(s, f, {}, ctx)], ["ficha", (s, f) => fichaDelTutor(s, f, ctx)], ["mapa", (s, f) => puntosDelMapa(s, f, ctx)],
    ["editar y notificaciones", (s, f) => exigirCasoPropio(s, f, ctx)], ["avistamientos", (s, f) => avistamientosDelCaso(s, f, ctx)], ["avistamiento", (s, f) => avistamientoDelCaso(s, f, "101", ctx)],
  ];
  const pares: [SesionActual, string[]][] = [[LUIS, DE_ROSA], [ROSA, DE_LUIS]];
  let comparados = 0;
  for (const [nombre, f] of servicios) {
    for (const [persona, ajenos] of pares) {
      const esperado = await huella((await falla(f(persona, "RUPE-ZZZZZZZZ")))!);
      for (const folio of [...ajenos, "rupe-zzzzzzzz", "RUPE-12", "' OR 1=1 --", "RUPE-K7M4XQ9T/../x"]) {
        const e = await falla(f(persona, folio));
        assert.equal(await huella(e!), esperado, `${nombre} · ${folio}`);
        comparados++;
      }
    }
  }
  assert.equal(comparados, 6 * 20, "se compararon todos los pares");
});

test("Guarda · sin sesión 401 y Administrador 403 en cada servicio, y un rol distinto de Tutor nunca llega a leer datos", async () => {
  const { ctx } = nuevoContexto();
  for (const f of [(s?: SesionActual) => listarCasosDelTutor(s, ctx), (s?: SesionActual) => casoDelTutor(s, DE_ROSA[0], {}, ctx), (s?: SesionActual) => puntosDelMapa(s, DE_ROSA[3], ctx)]) {
    assert.deepEqual([(await falla(f(undefined)))?.estado, (await falla(f(ADMIN)))?.estado], [401, 403]);
  }
});

test("Mis registros · el caso nuevo queda primero SIN alterar el orden relativo de los demás ni su paginación (6 por página)", async () => {
  const { ctx } = nuevoContexto({}, () => new Date("2026-10-20T12:00:00Z"));
  const antes = (await listarCasosDelTutor(ROSA, ctx)).map((c) => c.folio);
  assert.deepEqual([...antes].sort(), [...DE_ROSA].sort());
  const r = await registrarExtravio(ROSA, NUEVO, ctx);
  const despues = (await listarCasosDelTutor(ROSA, ctx)).map((c) => c.folio);
  assert.deepEqual(despues, [r.folio, ...antes]);
  const pagina = (l: string[], n: number) => l.slice((n - 1) * 6, n * 6);
  assert.equal(despues.length, 9);
  assert.deepEqual(pagina(despues, 1), [r.folio, ...antes.slice(0, 5)]);
  assert.deepEqual(pagina(despues, 2), antes.slice(5)); // 3 casos en la segunda página
  const luis = (await listarCasosDelTutor(LUIS, ctx)).map((c) => c.folio);
  assert.deepEqual([...luis].sort(), [...DE_LUIS].sort());
});

test("Mis registros · el orden es por fecha de creación descendente", async () => {
  const { ctx } = nuevoContexto();
  const fechas = await Promise.all((await listarCasosDelTutor(ROSA, ctx)).map(async (c) => (await ctx.repos.casos.porFolio(c.folio))!.fechaRegistro));
  assert.deepEqual(fechas, [...fechas].sort().reverse());
});

test("fechaCambioEstado · solo los casos «Localizado» la traen, y es la fecha de su último movimiento", async () => {
  const { ctx } = nuevoContexto();
  const lista = await listarCasosDelTutor(ROSA, ctx);
  const localizados = lista.filter((c) => c.estado === "Localizado");
  assert.ok(localizados.length >= 1);
  for (const c of lista) assert.equal(c.fechaCambioEstado !== undefined, c.estado === "Localizado", c.folio);
  for (const c of localizados) {
    const detalle = await casoDelTutor(ROSA, c.folio, {}, ctx);
    assert.equal(c.fechaCambioEstado, detalle.historial[detalle.historial.length - 1].fechaHora);
  }
  const ficha = await fichaDelTutor(ROSA, localizados[0].folio, ctx);
  assert.equal("fechaCambioEstado" in ficha, false);
});

test("Nombres de catálogo · raza, alcaldía y motivo salen del catálogo (o la raza especificada), no de los mocks", async () => {
  const { ctx } = nuevoContexto();
  const por = Object.fromEntries((await listarCasosDelTutor(ROSA, ctx)).map((c) => [c.folio, c]));
  assert.equal(por["RUPE-K7M4XQ9T"].raza, "Mestizo/No identificada");
  assert.equal(por["RUPE-P3H8WD5N"].raza, "Labrador Retriever");
  assert.equal(por["RUPE-B6R2TZ7C"].raza, "Chihuahua (Chihuahueño)");
  assert.equal(por["RUPE-3HN8WD2B"].raza, "Schnauzer Miniatura");
  const detalle = await casoDelTutor(ROSA, "RUPE-K7M4XQ9T", {}, ctx);
  assert.ok(detalle.alcaldia.length > 0 && detalle.motivo.length > 0);
});

test("Historial · es el real del caso, con el motivo de la cancelación o deshabilitación (Lola) y consecutivos ordenados", async () => {
  const { ctx } = nuevoContexto();
  const lola = await casoDelTutor(ROSA, "RUPE-C2J9RK6Z", {}, ctx);
  assert.ok(lola.historial.length >= 2);
  assert.ok(lola.historial.some((m) => typeof m.motivo === "string" && m.motivo.length > 0), "algún movimiento trae su motivo");
  const fechas = lola.historial.map((m) => m.fechaHora);
  assert.deepEqual(fechas, [...fechas].sort());
  const nuevo = await registrarExtravio(ROSA, NUEVO, ctx);
  assert.deepEqual((await casoDelTutor(ROSA, nuevo.folio, {}, ctx)).historial.map((m) => m.estado), ["Extraviado", "En búsqueda"]);
});

test("Avistamientos · Nala sin el oculto 105, Bruno sin el 303, orden por fecha descendente; «Fallecido» (102) sin estados ni foto; el oculto da 404", async () => {
  const { ctx } = nuevoContexto();
  const nala = await avistamientosDelCaso(ROSA, "RUPE-Y9F4LK2E", ctx);
  const bruno = await avistamientosDelCaso(ROSA, "RUPE-N8D5GX3W", ctx);
  assert.deepEqual(nala.items.map((i) => i.id).sort(), [101, 102, 103, 104]);
  assert.equal(bruno.items.some((i) => i.id === 303), false);
  assert.deepEqual(nala.items.map((i) => i.fechaHora), [...nala.items.map((i) => i.fechaHora)].sort().reverse());
  const f = nala.items.find((i) => i.id === 102)!;
  assert.deepEqual([f.fallecido, f.estados, f.fotografiaUrl], [true, [], undefined]);
  const detalle = await avistamientoDelCaso(ROSA, "RUPE-Y9F4LK2E", "102", ctx);
  assert.equal(detalle.fallecido, true);
  assert.equal((await falla(avistamientoDelCaso(ROSA, "RUPE-Y9F4LK2E", "105", ctx)))?.estado, 404);
  assert.equal((await falla(avistamientoDelCaso(ROSA, "RUPE-Y9F4LK2E", "201", ctx)))?.estado, 404); // el avistamiento de otro caso
  const mapa = await puntosDelMapa(ROSA, "RUPE-Y9F4LK2E", ctx);
  assert.deepEqual(mapa.puntos.map((p) => p.id), [101, 103, 104, 102]); // más antiguo primero
});

test("Variantes ?estado= · cada una se sintetiza sobre el caso real sin tocar el almacén", async () => {
  const { ctx, almacen } = nuevoContexto();
  const antes = JSON.stringify(almacen.historial);
  for (const estado of ["En búsqueda", "Localizado", "Cerrado"] as const) {
    const d = await casoDelTutor(ROSA, "RUPE-K7M4XQ9T", { estadoForzado: estado }, ctx);
    assert.equal(d.estado, estado);
    assert.equal(d.historial[d.historial.length - 1].estado, estado);
    assert.equal(d.raza, "Mestizo/No identificada"); // los datos siguen siendo los reales
  }
  assert.equal(JSON.stringify(almacen.historial), antes);
});

test("Detalle y ficha · nunca llevan datos de la persona tutora, su correo ni el token del QR", async () => {
  const { ctx, almacen } = nuevoContexto();
  const rosa = almacen.usuarios.find((u) => u.idUsuario === 2)!;
  const token = almacen.qr[0].tokenPublico;
  for (const folio of DE_ROSA) {
    const todo = JSON.stringify([await casoDelTutor(ROSA, folio, {}, ctx), await fichaDelTutor(ROSA, folio, ctx), await avistamientosDelCaso(ROSA, folio, ctx)]);
    for (const v of [rosa.nombreCompleto, rosa.correo, rosa.telefono, token].filter(Boolean) as string[]) assert.equal(todo.includes(v), false, `${folio} filtra un dato reservado`);
  }
});

function archivos(dir: string, salida: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) archivos(ruta, salida);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) salida.push(ruta);
  }
  return salida;
}

test("Mocks retirados · ningún código de src/ lee casosDeLaPersonaTutora, avistamientosCronologicos ni los mocks de avistamientos por caso, ni importa scripts/", () => {
  const fuentes = archivos(join(process.cwd(), "src"));
  const prohibidos = [/casosDeLaPersonaTutora/, /avistamientosCronologicos/, /scripts\/mocks-de-prueba/, /from\s+["'](?:\.\.?\/)+scripts\//];
  for (const ruta of fuentes) {
    const texto = readFileSync(ruta, "utf8");
    for (const p of prohibidos) assert.equal(p.test(texto), false, `${ruta} usa ${p}`);
  }
  // `avistamientosDelCaso` del mock ya no existe: solo debe importarse del servicio nuevo.
  for (const ruta of fuentes) {
    for (const m of readFileSync(ruta, "utf8").matchAll(/import[^;]*\bavistamientosDelCaso\b[^;]*from\s+["']([^"']+)["']/g)) assert.match(m[1], /misRegistros$/, `${ruta} importa avistamientosDelCaso de ${m[1]}`);
  }
  assert.ok(fuentes.length > 100);
});
