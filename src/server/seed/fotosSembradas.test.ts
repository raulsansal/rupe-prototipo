import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { almacenVacio } from "../memoria/almacen";
import { ErrorApp, respuestaDeError } from "../errores";
import { nuevoContexto } from "../pruebas/auxiliares";
import { jpeg } from "../pruebas/imagenes";
import type { SesionActual } from "../sesion/guardas";
import { fotografiaDelCaso } from "../servicios/extravio";
import { listarCasosDelTutor } from "../servicios/misRegistros";
import { CARPETA_FOTOS_SEMBRADAS, leerFotoSembrada } from "./fotosSembradas";
import { sembrar } from "./seed";
import { CASOS_MODERACION } from "../../mocks/moderacion";
import { altDeFoto } from "../../lib/altDeFoto";

// Imágenes GENERADAS en una carpeta temporal: nada de esto depende de que existan las fotos reales de src/server/seed/fotos/.
const MAX = "RUPE-K7M4XQ9T"; // Rosa
const KIRA = "RUPE-D5W2QK8X"; // Luis
const ROSA: SesionActual = { idUsuario: 2, rol: "Tutor", nombre: "Rosa Hernández Ficticia" };
const LUIS: SesionActual = { idUsuario: 5, rol: "Tutor", nombre: "Luis Navarro Ficticio" };
const ADMIN: SesionActual = { idUsuario: 1, rol: "Administrador", nombre: "Ricardo Vega Ficticio" };
const MARCADOR = "/mocks/perro-ejemplo.svg";
const carpeta = () => mkdtempSync(join(tmpdir(), "rupe-fotos-"));
const falla = (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => (e instanceof ErrorApp ? e : undefined));

test("fotos sembradas · con carpeta inyectada el caso usa su foto, servida por la ruta con guarda y con tipo y tamaño reales", async () => {
  const dir = carpeta();
  try {
    const foto = jpeg(900);
    writeFileSync(join(dir, `${MAX}.jpg`), foto);
    const { ctx, almacen } = nuevoContexto({}, undefined, { carpetaFotos: dir });
    const caso = almacen.casos.find((c) => c.folio === MAX)!;
    const f = almacen.fotografias.find((x) => x.idFotografia === almacen.perros.find((p) => p.idPerro === caso.idPerro)!.idFotografia)!;
    assert.equal(f.referenciaArchivo, `/api/fotografias/${f.idFotografia}`);
    assert.deepEqual([f.formato, f.tamanoBytes], ["JPG", 900]);
    assert.deepEqual(almacen.contenidosFoto[f.idFotografia], { tipo: "image/jpeg", bytes: foto });
    // Guardas de GET /api/fotografias/[id]: la dueña y el Administrador la ven; otra tutora, no (404); sin sesión, 401.
    assert.deepEqual((await fotografiaDelCaso(ROSA, f.idFotografia, ctx)).bytes, foto);
    assert.equal((await fotografiaDelCaso(ADMIN, f.idFotografia, ctx)).tipo, "image/jpeg");
    assert.equal((await falla(fotografiaDelCaso(LUIS, f.idFotografia, ctx)))?.estado, 404);
    assert.equal((await falla(fotografiaDelCaso(undefined, f.idFotografia, ctx)))?.estado, 401);
    // El 404 de otra tutora es idéntico al de un id inexistente.
    const a = respuestaDeError((await falla(fotografiaDelCaso(LUIS, f.idFotografia, ctx)))!);
    const b = respuestaDeError((await falla(fotografiaDelCaso(LUIS, 987654, ctx)))!);
    assert.equal(await a.text(), await b.text());
    // «Mis registros» de Rosa trae la URL de esa foto y los demás casos conservan el marcador.
    const lista = await listarCasosDelTutor(ROSA, ctx);
    assert.equal(lista.find((c) => c.folio === MAX)!.fotografiaUrl, `/api/fotografias/${f.idFotografia}`);
    assert.ok(lista.filter((c) => c.folio !== MAX).every((c) => c.fotografiaUrl === MARCADOR));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fotos sembradas · sin carpeta, con archivos ausentes o corruptos conservan el marcador y no lanzan error", () => {
  const dir = carpeta();
  try {
    writeFileSync(join(dir, `${MAX}.jpg`), Buffer.from("esto no es una imagen")); // texto
    writeFileSync(join(dir, `${KIRA}.jpg`), jpeg(600).slice(0, 300)); // JPEG truncado (sin marcador final)
    writeFileSync(join(dir, "RUPE-F7L3MN6Y.jpg"), Buffer.alloc(0)); // vacío
    writeFileSync(join(dir, "RUPE-G8R4TV3K.jpg"), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')); // SVG con extensión .jpg
    for (const carpetaFotos of [undefined, dir, join(dir, "no-existe")]) {
      const a = sembrar(almacenVacio(), {}, { carpetaFotos });
      assert.deepEqual(Object.keys(a.contenidosFoto), []);
      assert.ok(a.fotografias.filter((f) => f.referenciaArchivo.startsWith("/api/")).length === 0);
      assert.equal(a.casos.length, CASOS_MODERACION.length);
    }
    assert.equal(leerFotoSembrada(dir, MAX), undefined);
    assert.equal(leerFotoSembrada(dir, KIRA), undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fotos sembradas · cada siembra (inicio y reinicio de datos) las carga de nuevo", () => {
  const dir = carpeta();
  try {
    for (const c of CASOS_MODERACION) writeFileSync(join(dir, `${c.folio}.jpg`), jpeg(700));
    const a1 = sembrar(almacenVacio(), {}, { carpetaFotos: dir });
    const a2 = sembrar(almacenVacio(), {}, { carpetaFotos: dir }); // lo que hace reiniciarAlmacen()
    for (const a of [a1, a2]) {
      assert.equal(Object.keys(a.contenidosFoto).length, CASOS_MODERACION.length);
      assert.ok(a.perros.every((p) => a.fotografias.find((f) => f.idFotografia === p.idFotografia)!.referenciaArchivo.startsWith("/api/fotografias/")));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fotos sembradas · las fotos finales (si existen) son JPEG válidos y el seed no depende de ellas", () => {
  const archivos = (() => { try { return readdirSync(CARPETA_FOTOS_SEMBRADAS).filter((a) => /^RUPE-.*\.jpg$/.test(a)); } catch { return []; } })();
  for (const a of archivos) assert.ok(leerFotoSembrada(CARPETA_FOTOS_SEMBRADAS, a.replace(/\.jpg$/, "")), `${a} no es una foto válida`);
  assert.ok(archivos.every((a) => readFileSync(join(CARPETA_FOTOS_SEMBRADAS, a)).length < 4.5 * 1024 * 1024));
});

test("colores · Duque y Mia son «Caramelo» en el seed y en su texto alternativo, y no queda el color anterior", () => {
  const a = sembrar(almacenVacio(), {});
  for (const nombre of ["Duque", "Mia"]) {
    const perro = a.perros.find((p) => p.nombre === nombre)!;
    assert.equal(perro.color, "Caramelo");
    assert.match(altDeFoto({ nombre: perro.nombre, sexo: perro.sexo, raza: "Poodle (Caniche)", tamano: perro.tamano, color: perro.color }), /caramelo/i);
  }
  assert.ok(!CASOS_MODERACION.some((c) => ["Duque", "Mia"].includes(c.nombre) && /blanco|negro/i.test(c.color)));
});
