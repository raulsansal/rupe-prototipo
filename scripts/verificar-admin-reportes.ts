// Verifica POR HTTP (next build + next start, sesiones REALES de las cuentas de prueba) el tablero, los reportes y la exportación del Administrador (P6c, Etapa 1, sin pantallas):
//  A) roles y origen en las 3 rutas (Administrador ok · Tutor 403 · sin sesión 401), método y claves EXACTAS de cada respuesta;
//  B) cifras iniciales EXACTAS (163 · 141 · 19 · 199 · 6…) con el periodo predeterminado (1 oct → HOY), contra el oráculo del maquetado, y con la base completa;
//  C) un delta por cada tipo de evento (caso nuevo, avistamiento nuevo, localizar, cierre confirmado, cancelación, deshabilitar y restaurar, ocultar y restaurar un avistamiento NUEVO), con los valores antes → después;
//  D) acciones sobre los sembrados que NO mueven cifras y avistamiento nuevo sobre un sembrado (sí cuenta); tasa de recuperación por tipo de cierre;
//  E) catálogos: renombrar, desactivar y crear no cambian cifras, solo rótulos; filtros por id y errores 422;
//  F) exportación: PDF (texto decodificado de TODAS las páginas) y Excel (releído celda por celda) con las cifras de la pantalla, huella (200/409/422), cifras falsas ignoradas, SIN_DATOS, sin bitácora,
//     cabeceras de descarga, fórmulas neutralizadas y funcionamiento en el runtime de Node de `next start`;
//  G) «reiniciar» recalcula la marca de siembra; ningún dato de la persona tutora en ninguna respuesta.
// Imprime la respuesta REAL de cada paso (una línea por comprobación; nunca cookies ni credenciales). Opciones: --sin-build · --base=URL (servidor con RUPE_PERMITIR_REINICIO=1).
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { chromium, type Browser } from "playwright";
import { formatearFechaCorta } from "../src/lib/formato";
import { CASOS_ORIGEN } from "../src/mocks/casos";
import { USUARIOS_INICIALES } from "../src/mocks/usuarios";
import { JPEG_REAL } from "../src/server/pruebas/imagenes";
import { CAMPOS_BARRA, CAMPOS_FILTROS_REPORTE, CAMPOS_GRUPO_ESTADO_ANIMAL, CAMPOS_PERIODO, CAMPOS_REPORTE, CAMPOS_TABLERO } from "../src/server/serializadores/admin";
import { leerXlsx, filasDeHoja, type Celda } from "./lib/leerXlsx";
import { textoDePdf } from "./lib/textoPdf";
import { reporteOraculo, tableroOraculo } from "./mocks-de-prueba";
import { fetchComo, NOMBRE_COOKIE, reiniciarDatos, valorDeSesion, type RolPrueba } from "./sesion-pruebas";

const PUERTO = 3143;
const baseExterna = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1];
const base = baseExterna ?? `http://localhost:${PUERTO}`;
const ORIGEN = new URL(base).origin;
let fallos = 0;
let total = 0;
const ver = (ok: boolean, bien: string, mal: string) => {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${ok ? bien : mal}`);
};
const huellaDe = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 10);
const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

type Datos = { [k: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
type Resp = { estado: number; texto: string; tipo: string; json?: Datos; bytes: Uint8Array; cabeceras: Headers };
async function leer(r: Response): Promise<Resp> {
  const bytes = new Uint8Array(await r.arrayBuffer());
  const tipo = r.headers.get("content-type") ?? "";
  const texto = /json|text/.test(tipo) ? Buffer.from(bytes).toString("utf8") : `[${tipo} ${bytes.length} bytes]`;
  let json: Resp["json"];
  try {
    json = JSON.parse(texto);
  } catch {
    json = undefined;
  }
  return { estado: r.status, texto, tipo, json, bytes, cabeceras: r.headers };
}
const como = async (rol: RolPrueba | null, ruta: string, init: RequestInit = {}) => leer(await fetchComo(base, rol, ruta, { redirect: "manual", ...init }));
const enviar = (rol: RolPrueba | null, ruta: string, cuerpo: unknown, metodo = "POST", origen: string | null = ORIGEN) =>
  como(rol, ruta, { method: metodo, headers: { "Content-Type": "application/json", ...(origen ? { Origin: origen } : {}) }, body: JSON.stringify(cuerpo) });
const codigo = (r: Resp) => r.json?.error?.codigo as string | undefined;

/** Hoy en la Ciudad de México (UTC−6), del reloj de ESTA máquina (el servidor corre aquí). */
const hoyCDMX = () => new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);
const ayerCDMX = () => new Date(Date.now() - 30 * 3600_000).toISOString().slice(0, 10);
const HOY = hoyCDMX();
const MAX = "RUPE-K7M4XQ9T"; // sembrado, Rosa, En búsqueda
const datosDeCaso = (extra: Record<string, unknown> = {}) => ({ nombre: "Nuevo", sexo: "Hembra", idRaza: 1, edad: { valor: 3, unidad: "años" }, tamano: "pequeño", color: "Blanco", fechaExtravio: HOY, momento: "tarde", alcaldia: "Coyoacán", colonia: "Del Carmen", calle: "Calle Reservada 99", idMotivo: 1, ...extra });
async function postCaso(extra: Record<string, unknown> = {}): Promise<string> {
  const f = new FormData();
  f.set("datos", JSON.stringify(datosDeCaso(extra)));
  f.set("fotografia", new Blob([JPEG_REAL as BlobPart], { type: "image/jpeg" }), "fotografia.jpg");
  const r = await leer(await fetch(`${base}/api/casos`, { method: "POST", headers: { Origin: ORIGEN, Cookie: `${NOMBRE_COOKIE}=${await valorDeSesion(base, "tutor1")}` }, body: f, redirect: "manual" }));
  if (r.estado !== 201 || !r.json?.folio) throw new Error(`No se pudo registrar el caso de prueba: HTTP ${r.estado} ${r.texto.slice(0, 200)}`);
  return r.json.folio as string;
}
async function postAvistamiento(folio: string, extra: Record<string, unknown> = {}): Promise<number> {
  const f = new FormData();
  f.set("datos", JSON.stringify({ acceso: { canal: "folio", folio }, fecha: ayerCDMX(), hora: "10:00", direccion: "Calle Reservada de avistamiento 1", idAlcaldia: 6, estadosAnimal: [1, 7], ...extra }));
  f.set("fotografia", new Blob([JPEG_REAL as BlobPart], { type: "image/jpeg" }), "fotografia.jpg");
  const r = await leer(await fetch(`${base}/api/avistamientos`, { method: "POST", headers: { Origin: ORIGEN }, body: f, redirect: "manual" }));
  if (r.estado !== 201) throw new Error(`No se pudo registrar el avistamiento de prueba: HTTP ${r.estado} ${r.texto.slice(0, 200)}`);
  return r.json!.id as number;
}
const estadoDe = (folio: string, accion: string, motivo?: string) => enviar("tutor1", `/api/casos/${folio}/estado`, { accion, ...(motivo ? { motivo } : {}) });
const moderarCaso = (folio: string, accion: "deshabilitar" | "restaurar") => enviar("admin", `/api/admin/registros/${folio}/moderacion`, accion === "deshabilitar" ? { accion, motivo: "Contenido inapropiado." } : { accion });
const moderarAvistamiento = (id: number, accion: "ocultar" | "restaurar") => enviar("admin", `/api/admin/avistamientos/${id}/moderacion`, accion === "ocultar" ? { accion, motivo: "Foto inapropiada." } : { accion });

const tablero = async (q = "") => {
  const r = await como("admin", `/api/admin/tablero${q}`);
  if (r.estado !== 200) throw new Error(`GET /api/admin/tablero${q} → ${r.estado} ${r.texto.slice(0, 200)}`);
  return r.json!;
};
const reporte = async (f: Record<string, string> = {}) => {
  const q = new URLSearchParams({ desde: "2026-10-01", hasta: HOY, ...f }).toString();
  const r = await como("admin", `/api/admin/reportes?${q}`);
  if (r.estado !== 200) throw new Error(`GET /api/admin/reportes?${q} → ${r.estado} ${r.texto.slice(0, 200)}`);
  return r.json!;
};
const valores = (b: { valor: number }[]) => b.map((x) => x.valor);
/** Las cifras que importan de un tablero, sin rótulos ni hora. */
const cifras = (t: Datos) => ({
  total: t.totalCasos, activos: t.casosActivos, localizados: t.casosLocalizados, avistamientos: t.totalAvistamientos, ocultos: t.avistamientosOcultos, promedio: t.promedioLocalizacion,
  motivo: valores(t.porMotivo), estado: valores(t.porEstadoCaso), cierres: valores(t.cierres), animal: t.porEstadoAnimal.flatMap((g: Datos) => valores(g.barras)), alcaldia: t.porAlcaldia.map((b: Datos) => [b.id, b.valor]),
});
const resumen = (t: Datos) => { const c = cifras(t); return `${c.total} casos · ${c.activos} activos · ${c.localizados} localizados · ${c.avistamientos} avist. · ${c.ocultos} ocultos · cierres [${c.cierres}] · estado [${c.estado}]`; };
const sinHora = (t: Datos) => JSON.stringify({ ...t, generadoEn: 0 });
const INICIAL = { total: 163, activos: 141, localizados: 19, avistamientos: 199, ocultos: 6, motivo: [46, 40, 29, 38, 10], estado: [20, 58, 32, 31, 16, 6], cierres: [9, 6, 2] };
const parcial = (t: Datos) => { const c = cifras(t); return { total: c.total, activos: c.activos, localizados: c.localizados, avistamientos: c.avistamientos, ocultos: c.ocultos, motivo: c.motivo, estado: c.estado, cierres: c.cierres }; };
const tasa = (num: number, den: number) => Math.round((num / den) * 1000) / 10;
const delta = (nombre: string, antes: Datos, despues: Datos, ok: boolean, detalle = "") => ver(ok, `Δ ${nombre}: ${resumen(antes)} → ${resumen(despues)}${detalle ? ` · ${detalle}` : ""}`, `Δ ${nombre} NO dio lo esperado: ${resumen(antes)} → ${resumen(despues)}${detalle ? ` · ${detalle}` : ""}`);
const bitacoraTotal = async () => (await como("admin", "/api/admin/bitacora")).json!.total as number;

const SECRETOS = [...USUARIOS_INICIALES.filter((u) => u.rol === "Tutor").flatMap((u) => [u.nombreCompleto, u.correo]), CASOS_ORIGEN[0].tutor.nombreCompleto, CASOS_ORIGEN[0].tutor.correo, CASOS_ORIGEN[0].tutor.telefono, ...CASOS_ORIGEN.map((c) => c.tokenPublico), "Calle Reservada"];

async function pruebas(navegador: Browser) {
  const reinicio = await reiniciarDatos(base);
  ver(reinicio === 200, "el servidor permite reiniciar los datos (RUPE_PERMITIR_REINICIO=1)", `no se pudo reiniciar los datos: HTTP ${reinicio}`);
  if (reinicio !== 200) throw new Error("Sin reinicio no hay pruebas confiables");
  ver(HOY >= "2026-10-19", `precondición: hoy (CDMX) es ${HOY}, posterior al 18 de octubre (fin de la base): el periodo 1 oct → hoy cubre toda la base y 19 oct → hoy no tiene datos reales`, `hoy es ${HOY}: estas pruebas suponen un reloj del 19 de octubre de 2026 en adelante`);

  console.log("\n— A) Roles, origen, método y claves exactas —");
  const rutas: Array<[string, string, unknown?]> = [["GET", "/api/admin/tablero"], ["GET", `/api/admin/reportes?desde=2026-10-01&hasta=${HOY}`], ["POST", "/api/admin/reportes/exportar", { formato: "pdf", filtros: { desde: "2026-10-01", hasta: HOY }, huella: "a".repeat(32) }]];
  for (const [m, ruta, cuerpo] of rutas) {
    const llamar = (rol: RolPrueba | null) => (m === "GET" ? como(rol, ruta) : enviar(rol, ruta, cuerpo, m));
    const [s, t, a] = [await llamar(null), await llamar("tutor1"), await llamar("admin")];
    ver(s.estado === 401 && t.estado === 403 && a.estado !== 401 && a.estado !== 403, `${m} ${ruta.split("?")[0]}: sin sesión 401 · Tutor 403 · Administrador ${a.estado}`, `${m} ${ruta}: sin sesión ${s.estado} · Tutor ${t.estado} · Administrador ${a.estado}`);
  }
  const ajeno = await enviar("admin", "/api/admin/reportes/exportar", { formato: "pdf" }, "POST", "https://otro.example");
  const get405 = await como("admin", "/api/admin/reportes/exportar");
  const post405 = await enviar("admin", "/api/admin/tablero", {});
  ver(ajeno.estado === 403 && codigo(ajeno) === "ORIGEN_NO_PERMITIDO" && get405.estado === 405 && post405.estado === 405, `exportar con Origin ajeno → ${ajeno.estado} ${codigo(ajeno)}; GET exportar → ${get405.estado}; POST tablero → ${post405.estado}`, `origen/método: ${ajeno.estado} ${get405.estado} ${post405.estado}`);
  const t0 = await como("admin", "/api/admin/tablero");
  const r0 = await como("admin", `/api/admin/reportes?desde=2026-10-01&hasta=${HOY}`);
  ver(igual(Object.keys(t0.json!), CAMPOS_TABLERO) && igual(Object.keys(t0.json!.periodo), CAMPOS_PERIODO) && igual(Object.keys(t0.json!.limites), CAMPOS_PERIODO) && igual(Object.keys(t0.json!.porMotivo[0]), CAMPOS_BARRA) && igual(Object.keys(t0.json!.cierres[0]), ["nombre", "valor"]) && igual(Object.keys(t0.json!.porEstadoAnimal[0]), CAMPOS_GRUPO_ESTADO_ANIMAL), "claves EXACTAS del tablero (y de sus periodos, barras y grupos)", `claves del tablero: ${Object.keys(t0.json!)}`);
  ver(igual(Object.keys(r0.json!), CAMPOS_REPORTE) && igual(Object.keys(r0.json!.filtros), CAMPOS_FILTROS_REPORTE), "claves EXACTAS del reporte y de sus filtros", `claves del reporte: ${Object.keys(r0.json!)}`);
  ver(t0.cabeceras.get("cache-control") === "no-store" && r0.cabeceras.get("cache-control") === "no-store", "tablero y reporte con Cache-Control: no-store", "falta no-store");
  const sinDatos = await como("admin", `/api/admin/reportes?desde=2026-10-19&hasta=${HOY}`);
  ver(sinDatos.estado === 200 && sinDatos.json?.sinDatos === true && igual(Object.keys(sinDatos.json!), ["sinDatos", "filtros", "generadoEn"]), `periodo 19 oct → hoy sin casos: 200 ${JSON.stringify({ sinDatos: sinDatos.json?.sinDatos })} (claves ${Object.keys(sinDatos.json ?? {})})`, `sin datos: ${sinDatos.estado} ${sinDatos.texto.slice(0, 120)}`);

  console.log("\n— B) Cifras iniciales EXACTAS —");
  const t = await tablero();
  ver(t.periodo.desde === "2026-10-01" && t.periodo.hasta === HOY, `periodo predeterminado: ${t.periodo.desde} → ${t.periodo.hasta} (1 oct → hoy)`, `periodo predeterminado: ${JSON.stringify(t.periodo)}`);
  ver(igual(parcial(t), INICIAL) && t.promedioLocalizacion === 4.9, `cifras iniciales con el periodo predeterminado: ${resumen(t)} · promedio ${t.promedioLocalizacion} días`, `cifras iniciales distintas: ${JSON.stringify(parcial(t))}`);
  const huellaInicial = sinHora(t);
  for (const p of [{ desde: "2026-10-01", hasta: "2026-10-18" }, { desde: "2026-10-01", hasta: HOY }, { desde: "2026-06-01", hasta: HOY }, { desde: "2026-09-01", hasta: "2026-09-30" }, { desde: "2026-08-10", hasta: "2026-08-16" }]) {
    const o = tableroOraculo(p);
    const x = await tablero(`?desde=${p.desde}&hasta=${p.hasta}`);
    const nv = (b: { nombre: string; valor: number }[]) => b.map((y) => [y.nombre, y.valor]);
    const ok = igual([x.totalCasos, x.casosActivos, x.casosLocalizados, x.totalAvistamientos, x.avistamientosOcultos, x.promedioLocalizacion], [o.totalCasos, o.casosActivos, o.casosLocalizados, o.totalAvistamientos, o.avistamientosOcultos, o.promedioLocalizacion]) &&
      igual([nv(x.porMotivo), nv(x.porEstadoCaso), nv(x.cierres), nv(x.porAlcaldia)], [nv(o.porMotivo), nv(o.porEstadoCaso), nv(o.cierres), nv(o.porAlcaldia)]) &&
      igual(x.porEstadoAnimal.map((g: Datos) => [g.categoria, nv(g.barras)]), o.porEstadoAnimal.map((g) => [g.categoria, nv(g.barras)]));
    ver(ok, `periodo ${p.desde} → ${p.hasta}: ${x.totalCasos} casos, ${x.casosLocalizados} localizados, ${x.totalAvistamientos} avistamientos, ${x.avistamientosOcultos} ocultos = oráculo (motivo, estado, cierres, alcaldía y estado del animal incluidos)`, `periodo ${p.desde} → ${p.hasta} difiere del oráculo`);
  }
  const rep0 = await reporte();
  const orac = reporteOraculo({ desde: "2026-10-01", hasta: HOY, alcaldia: "", categoria: "", estadoCaso: "" })!;
  ver(rep0.totalCasos === orac.totalCasos && rep0.casosLocalizados === orac.casosLocalizados && rep0.tasaRecuperacion === orac.tasaRecuperacion && rep0.tasaRecuperacion === 11.9, `reporte inicial: ${rep0.totalCasos} casos · ${rep0.casosLocalizados} localizados · tasa ${rep0.tasaRecuperacion} % (19/160) · ocultos ${rep0.avistamientosOcultos} · huella #${rep0.huella.slice(0, 8)}`, `reporte inicial: ${JSON.stringify([rep0.totalCasos, rep0.casosLocalizados, rep0.tasaRecuperacion])}`);
  const huellaReporte = rep0.huella;
  const ms: number[] = [];
  for (let i = 0; i < 20; i++) {
    const t1 = performance.now();
    await como("admin", "/api/admin/tablero?desde=2026-06-01&hasta=" + HOY);
    ms.push(performance.now() - t1);
  }
  const media = ms.reduce((s, x) => s + x, 0) / ms.length;
  ver(media < 500, `desempeño: 20 tableros del periodo completo en ${media.toFixed(1)} ms de media (se calcula en cada petición)`, `el tablero tarda ${media.toFixed(0)} ms de media`);

  console.log("\n— C) Un delta por cada tipo de evento (valores antes → después) —");
  let antes = await tablero();
  const folioA = await postCaso({ idMotivo: 1 });
  let ahora = await tablero();
  delta("caso nuevo", antes, ahora, ahora.totalCasos === 164 && ahora.casosActivos === 142 && valores(ahora.porEstadoCaso)[1] === 59 && valores(ahora.porMotivo)[0] === 47 && ahora.totalAvistamientos === 199);
  antes = ahora;
  const idAv = await postAvistamiento(folioA, { idAlcaldia: 6, estadosAnimal: [2, 3, 8] });
  ahora = await tablero();
  const animal = (x: Datos, id: number) => x.porEstadoAnimal.flatMap((g: Datos) => g.barras).find((b: Datos) => b.id === id).valor as number;
  const alc = (x: Datos, id: number) => x.porAlcaldia.find((b: Datos) => b.id === id).valor as number;
  delta("avistamiento nuevo (Cuauhtémoc; estados 2, 3 y 8)", antes, ahora, ahora.totalAvistamientos === 200 && alc(ahora, 6) === alc(antes, 6) + 1 && [2, 3, 8].every((i) => animal(ahora, i) === animal(antes, i) + 1) && animal(ahora, 1) === animal(antes, 1) && valores(ahora.porEstadoCaso)[2] === valores(antes.porEstadoCaso)[2] + 1, `alcaldía 6: ${alc(antes, 6)} → ${alc(ahora, 6)}`);
  antes = ahora;
  ver((await estadoDe(folioA, "localizar")).estado === 200, "la tutora marca el caso nuevo como localizado (POST /api/casos/…/estado)", "no se pudo localizar");
  ahora = await tablero();
  delta("localizar", antes, ahora, ahora.casosLocalizados === 20 && ahora.casosActivos === antes.casosActivos - 1 && valores(ahora.porEstadoCaso)[4] === 17 && typeof ahora.promedioLocalizacion === "number", `promedio ${antes.promedioLocalizacion} → ${ahora.promedioLocalizacion} días`);
  antes = ahora;
  await estadoDe(folioA, "cerrar");
  ahora = await tablero();
  delta("cierre confirmado", antes, ahora, ahora.casosLocalizados === 20 && valores(ahora.cierres).join() === "10,6,2" && valores(ahora.porEstadoCaso)[4] === 16 && valores(ahora.porEstadoCaso)[5] === 7);
  const folioB = await postCaso();
  antes = await tablero();
  await estadoDe(folioB, "cancelar", "Ya no lo busco");
  ahora = await tablero();
  delta("cancelación", antes, ahora, valores(ahora.cierres).join() === "10,7,2" && ahora.casosActivos === antes.casosActivos - 1 && ahora.totalCasos === antes.totalCasos);
  const folioC = await postCaso();
  const sinC = await tablero();
  const repSinC = await reporte();
  ver((await moderarCaso(folioC, "deshabilitar")).estado === 200, "el Administrador deshabilita el caso nuevo (POST /api/admin/registros/…/moderacion)", "no se pudo deshabilitar");
  ahora = await tablero();
  delta("deshabilitación", sinC, ahora, valores(ahora.cierres).join() === "10,7,3" && ahora.casosActivos === sinC.casosActivos - 1);
  ver((await reporte()).huella !== repSinC.huella, "…y el reporte cambia (huella distinta)", "el reporte no cambió al deshabilitar");
  ver((await moderarCaso(folioC, "restaurar")).estado === 200, "el Administrador lo restaura", "no se pudo restaurar");
  ahora = await tablero();
  ver(sinHora(ahora) === sinHora(sinC) && (await reporte()).huella === repSinC.huella, `Δ restaurar: el tablero (#${huellaDe(sinHora(ahora))}) y el reporte (#${repSinC.huella.slice(0, 8)}) son IDÉNTICOS en contenido a antes de deshabilitar`, `tras restaurar difiere: #${huellaDe(sinHora(sinC))} → #${huellaDe(sinHora(ahora))}`);
  antes = ahora;
  ver((await moderarAvistamiento(idAv, "ocultar")).estado === 200, "el Administrador oculta el avistamiento NUEVO", "no se pudo ocultar");
  ahora = await tablero();
  delta("ocultar avistamiento nuevo", antes, ahora, ahora.totalAvistamientos === antes.totalAvistamientos - 1 && ahora.avistamientosOcultos === 7);
  await moderarAvistamiento(idAv, "restaurar");
  ahora = await tablero();
  ver(sinHora(ahora) === sinHora(antes), `Δ restaurar avistamiento: contenido idéntico a antes (#${huellaDe(sinHora(ahora))})`, "restaurar el avistamiento no devolvió el tablero a lo de antes");

  console.log("\n— D) Sembrados y tasa de recuperación —");
  await reiniciarDatos(base);
  const base0 = await tablero();
  const rep1 = await reporte();
  await moderarCaso(MAX, "deshabilitar");
  await moderarCaso(MAX, "restaurar");
  await estadoDe(MAX, "localizar");
  await estadoDe("RUPE-H4TQ7V2M", "cancelar", "Ya no");
  const ocultar = await moderarAvistamiento(201, "ocultar");
  const t1 = await tablero();
  ver(ocultar.estado === 200 && sinHora(t1) === sinHora(base0) && (await reporte()).huella === rep1.huella, `acciones sobre los sembrados (deshabilitar/restaurar, localizar, cancelar, ocultar un avistamiento sembrado): tablero #${huellaDe(sinHora(base0))} → #${huellaDe(sinHora(t1))} y reporte sin cambios`, `una acción sobre un sembrado movió las cifras: ${resumen(base0)} → ${resumen(t1)}`);
  await reiniciarDatos(base);
  const antesMax = await tablero();
  await postAvistamiento(MAX, { idAlcaldia: 6, estadosAnimal: [1, 7] });
  const trasMax = await tablero();
  ver(trasMax.totalCasos === antesMax.totalCasos && trasMax.totalAvistamientos === 200 && igual(valores(trasMax.porEstadoCaso), valores(antesMax.porEstadoCaso)), `avistamiento NUEVO sobre un caso SEMBRADO: cuenta (avistamientos ${antesMax.totalAvistamientos} → ${trasMax.totalAvistamientos}); el caso no suma ni cambia los estados (${valores(trasMax.porEstadoCaso)})`, `avistamiento sobre sembrado: ${resumen(antesMax)} → ${resumen(trasMax)}`);
  await reiniciarDatos(base);
  const tasaDe = async () => { const r = await reporte(); return [r.totalCasos, r.casosLocalizados, r.tasaRecuperacion]; };
  const f1 = await postCaso();
  const a1 = await tasaDe();
  await estadoDe(f1, "localizar");
  const a2 = await tasaDe();
  await estadoDe(f1, "cerrar");
  const a3 = await tasaDe();
  ver(igual(a1, [164, 19, tasa(19, 161)]) && igual(a2, [164, 20, tasa(20, 161)]) && igual(a3, [164, 20, tasa(20, 161)]), `tasa · cierre confirmado: casos, localizados, tasa ${JSON.stringify(a1)} → ${JSON.stringify(a2)} → ${JSON.stringify(a3)} (denominador 161 sin cambio; numerador +1)`, `tasa con cierre confirmado: ${JSON.stringify([a1, a2, a3])}`);
  const f2 = await postCaso();
  const b1 = await tasaDe();
  await estadoDe(f2, "cancelar", "Ya no lo busco");
  const b2 = await tasaDe();
  ver(igual(b1, [165, 20, tasa(20, 162)]) && igual(b2, [165, 20, tasa(20, 161)]), `tasa · cancelación: ${JSON.stringify(b1)} → ${JSON.stringify(b2)} (denominador 162 → 161)`, `tasa con cancelación: ${JSON.stringify([b1, b2])}`);
  const f3 = await postCaso();
  const c1 = await tasaDe();
  await moderarCaso(f3, "deshabilitar");
  const c2 = await tasaDe();
  await moderarCaso(f3, "restaurar");
  const c3 = await tasaDe();
  ver(igual(c1, [166, 20, tasa(20, 162)]) && igual(c2, [166, 20, tasa(20, 161)]) && igual(c3, c1), `tasa · deshabilitación y restauración: ${JSON.stringify(c1)} → ${JSON.stringify(c2)} → ${JSON.stringify(c3)} (denominador 162 → 161 → 162)`, `tasa con deshabilitación: ${JSON.stringify([c1, c2, c3])}`);

  console.log("\n— E) Catálogos por id, filtros y errores —");
  await reiniciarDatos(base);
  const folioE = await postCaso({ alcaldia: "Coyoacán" });
  await postAvistamiento(folioE, { idAlcaldia: 4, estadosAnimal: [2, 8] });
  const e0 = await tablero();
  const re0 = await reporte();
  const put = (ruta: string, cuerpo: unknown) => enviar("admin", ruta, cuerpo, "PUT");
  await put("/api/admin/catalogos/alcaldias/4", { nombre: "Coyoacán renombrada", clave: "09003" });
  await put("/api/admin/catalogos/estados-animal/2", { nombre: "Herido renombrado", idCategoria: 1, descripcion: "d" });
  await enviar("admin", "/api/admin/catalogos/alcaldias/4/desactivar", {});
  await enviar("admin", "/api/admin/catalogos/estados-animal/16/desactivar", {});
  for (const [tp, c] of [["razas", { nombre: "Raza nueva" }], ["motivos", { nombre: "Motivo nuevo", idCategoria: 1, descripcion: "d" }], ["estados-animal", { nombre: "Estado nuevo", idCategoria: 1, descripcion: "d" }]] as const) await enviar("admin", `/api/admin/catalogos/${tp}`, c);
  const e1 = await tablero();
  const re1 = await reporte();
  const nombreAlc = (x: Datos) => x.porAlcaldia.find((b: Datos) => b.id === 4);
  ver(igual(cifras(e0).alcaldia, cifras(e1).alcaldia) && igual(cifras(e0).motivo, cifras(e1).motivo) && nombreAlc(e1).nombre === "Coyoacán renombrada" && nombreAlc(e1).valor === nombreAlc(e0).valor && e1.porAlcaldia.filter((b: Datos) => /^Coyoac/.test(b.nombre)).length === 1,
    `renombrar la alcaldía 4: el rótulo pasa de «${nombreAlc(e0).nombre}» a «${nombreAlc(e1).nombre}», el conteo sigue en ${nombreAlc(e1).valor} y sigue UNA sola fila`, "renombrar movió cifras o partió la fila");
  ver(animal(e1, 16) === animal(e0, 16) && e1.porEstadoAnimal.flatMap((g: Datos) => g.barras).length === 18 && animal(e1, 2) === animal(e0, 2), `desactivar el estado 16 y crear otro: la fila del 16 sigue con su conteo (${animal(e1, 16)}), hay 18 filas, «Herido» renombrado conserva ${animal(e1, 2)}`, "desactivar o crear movió cifras del estado del animal");
  ver(re1.huella === re0.huella && re1.totalCasos === re0.totalCasos, `la huella del reporte (#${re1.huella.slice(0, 8)}) no cambia con renombrar, desactivar ni crear`, "renombrar cambió la huella del reporte");
  const filtrado = await reporte({ alcaldia: "4" });
  ver(filtrado.filtros.alcaldia?.nombre === "Coyoacán renombrada" && filtrado.totalCasos > 0, `una alcaldía INACTIVA sigue filtrando: alcaldia=4 → ${filtrado.totalCasos} casos, rótulo «${filtrado.filtros.alcaldia?.nombre}»`, "la alcaldía inactiva no filtra");
  const malos: Array<[string, string]> = [["alcaldia=999", "alcaldia"], ["alcaldia=17", "alcaldia"], ["alcaldia=Coyoac%C3%A1n", "alcaldia"], ["categoria=9", "categoria"], ["estadoCaso=Otro", "estadoCaso"], ["desde=", "desde"], ["hasta=2026-02-30", "hasta"]];
  for (const [q, campo] of malos) {
    const base0 = q.startsWith("desde=") ? `hasta=${HOY}` : q.startsWith("hasta=") ? "desde=2026-10-01" : `desde=2026-10-01&hasta=${HOY}`;
    const r = await como("admin", `/api/admin/reportes?${base0}&${q}`);
    ver(r.estado === 422 && !!r.json?.error?.campos?.[campo], `GET reportes?…${q} → 422 con error en «${campo}»: ${r.json?.error?.campos?.[campo]}`, `GET reportes?…${q} → ${r.estado} ${r.texto.slice(0, 120)}`);
  }
  const futuro = await como("admin", "/api/admin/tablero?desde=2026-10-01&hasta=2099-01-01");
  const invertido = await como("admin", "/api/admin/tablero?desde=2026-10-10&hasta=2026-10-01");
  ver(futuro.estado === 422 && !!futuro.json?.error?.campos?.hasta && invertido.estado === 422, `tablero con hasta futuro → ${futuro.estado} («${futuro.json?.error?.campos?.hasta}»); con rango invertido → ${invertido.estado}`, `tablero con periodo inválido: ${futuro.estado} ${invertido.estado}`);

  console.log("\n— F) Exportación —");
  await reiniciarDatos(base);
  const filtros = { desde: "2026-10-01", hasta: HOY };
  const repX = await reporte();
  const exportar = (cuerpo: unknown, rol: RolPrueba | null = "admin") => enviar(rol, "/api/admin/reportes/exportar", cuerpo);
  const bitAntes = await bitacoraTotal();
  const pdf = await exportar({ formato: "pdf", filtros, huella: repX.huella });
  const nombrePdf = `reporte-rupe-${filtros.desde}_${filtros.hasta}.pdf`;
  ver(pdf.estado === 200 && pdf.tipo === "application/pdf" && pdf.cabeceras.get("content-disposition") === `attachment; filename="${nombrePdf}"` && pdf.cabeceras.get("cache-control") === "no-store" && pdf.cabeceras.get("x-content-type-options") === "nosniff" && Buffer.from(pdf.bytes.subarray(0, 5)).toString() === "%PDF-",
    `PDF: 200 · ${pdf.tipo} · attachment «${nombrePdf}» · no-store · nosniff · ${pdf.bytes.length} bytes`, `PDF: ${pdf.estado} ${pdf.tipo} ${pdf.cabeceras.get("content-disposition")} ${pdf.cabeceras.get("cache-control")} ${pdf.cabeceras.get("x-content-type-options")}`);
  const texto = await textoDePdf(navegador, pdf.bytes, true);
  const hay = (re: RegExp) => re.test(texto);
  ver(hay(/Reporte estadístico de casos/) && hay(/Filtros aplicados/) && hay(new RegExp(`Periodo\\s+1 oct 2026 – ${formatearFechaCorta(HOY)}`)) && hay(/Alcaldía\s+todas/) && hay(/Categoría de motivo\s+todas/) && hay(/Estado del caso\s+todos/), "PDF decodificado: título, «Filtros aplicados» con periodo, alcaldía, categoría y estado", `PDF sin encabezado o filtros: ${texto.slice(0, 300)}`);
  ver(hay(new RegExp(`Número de casos\\s+${repX.totalCasos}\\b`)) && hay(new RegExp(`Casos localizados\\s+${repX.casosLocalizados}\\b`)) && hay(new RegExp(`Tasa de recuperación \\(%\\)\\s+${repX.tasaRecuperacion.toFixed(1)} %`)) && hay(new RegExp(`Avistamientos ocultos \\(aparte\\)\\s+${repX.avistamientosOcultos}\\b`)), `PDF decodificado: indicadores = pantalla (${repX.totalCasos} casos · ${repX.casosLocalizados} localizados · ${repX.tasaRecuperacion.toFixed(1)} % · ${repX.avistamientosOcultos} ocultos)`, "los indicadores del PDF no coinciden con el reporte");
  const nombres = [...repX.porMotivo, ...repX.porEstadoCaso, ...repX.cierres, ...repX.porAlcaldiaAvistamiento].map((b: Datos) => b.nombre as string);
  ver(nombres.every((n) => texto.includes(n)) && /Página 1 de \d+/.test(texto) && /Avistamientos por alcaldía del avistamiento/.test(texto), `PDF decodificado: los ${nombres.length} rótulos de los desgloses y el pie «Página 1 de N» (varias páginas)`, "faltan rótulos de los desgloses en el PDF");
  ver(SECRETOS.every((s) => !texto.includes(s)), "PDF: ningún dato de la persona tutora", "el PDF contiene datos de la persona tutora");

  const xlsx = await exportar({ formato: "xlsx", filtros, huella: repX.huella });
  const nombreXlsx = `reporte-rupe-${filtros.desde}_${filtros.hasta}.xlsx`;
  ver(xlsx.estado === 200 && xlsx.tipo === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" && xlsx.cabeceras.get("content-disposition") === `attachment; filename="${nombreXlsx}"` && xlsx.cabeceras.get("cache-control") === "no-store" && xlsx.cabeceras.get("x-content-type-options") === "nosniff" && Buffer.from(xlsx.bytes.subarray(0, 2)).toString() === "PK",
    `Excel: 200 · ${xlsx.tipo.split(".").pop()} · attachment «${nombreXlsx}» · no-store · nosniff · firma PK · ${xlsx.bytes.length} bytes (runtime de Node de «next start»: la librería funciona)`, `Excel: ${xlsx.estado} ${xlsx.tipo} ${xlsx.texto.slice(0, 160)}`);
  const hojas = Object.fromEntries(leerXlsx(xlsx.bytes).map((h) => [h.nombre, filasDeHoja(h)]));
  const celdas = (f: (Celda | undefined)[][]) => Object.fromEntries(f.filter((x) => x.length >= 2 && typeof x[0] === "string").map((x) => [x[0] as string, x[1]]));
  const res = celdas(hojas.Resumen);
  ver(igual(Object.keys(hojas), ["Resumen", "Casos por motivo", "Casos por estado", "Cierres por tipo", "Estado del animal", "Alcaldía del avistamiento"]) && res["Número de casos"] === repX.totalCasos && res["Casos localizados"] === repX.casosLocalizados && res["Tasa de recuperación (%)"] === repX.tasaRecuperacion && res["Avistamientos ocultos (aparte)"] === repX.avistamientosOcultos && res.Alcaldía === "todas" && String(res.Periodo).startsWith("1 oct 2026 – "),
    `Excel releído: 6 hojas; Resumen con ${res["Número de casos"]} casos · ${res["Casos localizados"]} localizados · ${res["Tasa de recuperación (%)"]} % · ${res["Avistamientos ocultos (aparte)"]} ocultos = pantalla`, `Excel: Resumen ${JSON.stringify(res)}`);
  const tabla = (h: string) => hojas[h].slice(1).map((f) => [f[0], f[1]]);
  const nv = (b: Datos[]) => b.map((x) => [x.nombre, x.valor]);
  ver(igual(tabla("Casos por motivo"), nv(repX.porMotivo)) && igual(tabla("Casos por estado"), nv(repX.porEstadoCaso)) && igual(tabla("Cierres por tipo"), nv(repX.cierres)) && igual(tabla("Estado del animal"), repX.porEstadoAnimal.flatMap((g: Datos) => g.barras.map((b: Datos) => [`${g.categoria}: ${b.nombre}`, b.valor]))) && igual(tabla("Alcaldía del avistamiento"), nv(repX.porAlcaldiaAvistamiento)),
    `Excel releído celda por celda: los 5 desgloses (${tabla("Casos por motivo").length + tabla("Casos por estado").length + tabla("Cierres por tipo").length + tabla("Estado del animal").length + tabla("Alcaldía del avistamiento").length} filas) = pantalla`, "algún desglose del Excel no coincide con la pantalla");
  ver(SECRETOS.every((s) => ![...leerXlsx(xlsx.bytes)].some((h) => [...h.celdas.values()].some((v) => String(v).includes(s)))), "Excel: ningún dato de la persona tutora", "el Excel contiene datos de la persona tutora");

  const falsa = await exportar({ formato: "pdf", filtros, huella: "0".repeat(32) });
  const sinH = await exportar({ formato: "pdf", filtros });
  const malaH = await exportar({ formato: "pdf", filtros, huella: "no-es-una-huella" });
  ver(falsa.estado === 409 && codigo(falsa) === "DATOS_CAMBIARON" && falsa.json?.error?.mensaje === "Los datos cambiaron; genera el reporte de nuevo." && sinH.estado === 422 && !!sinH.json?.error?.campos?.huella && malaH.estado === 422, `huella falsa → ${falsa.estado} ${codigo(falsa)} («${falsa.json?.error?.mensaje}»); sin huella → ${sinH.estado}; huella mal formada → ${malaH.estado}`, `huellas: falsa ${falsa.estado} ${codigo(falsa)} · ausente ${sinH.estado} · mal formada ${malaH.estado}`);
  const falsos = await exportar({ formato: "xlsx", filtros: { ...filtros, totalCasos: 9999 }, huella: repX.huella, totalCasos: 9999, casosLocalizados: 1, tasaRecuperacion: 99.9, porMotivo: [{ nombre: "Falso", valor: 7 }] });
  const resF = celdas(filasDeHoja(leerXlsx(falsos.bytes)[0]));
  ver(falsos.estado === 200 && resF["Número de casos"] === repX.totalCasos && resF["Tasa de recuperación (%)"] === repX.tasaRecuperacion, `cifras falsas en el cuerpo (totalCasos 9999, tasa 99,9, «Falso») → 200 y el archivo trae las REALES (${resF["Número de casos"]} casos, ${resF["Tasa de recuperación (%)"]} %)`, `el servidor usó cifras del cliente: ${JSON.stringify(resF)}`);
  const vacio = await exportar({ formato: "pdf", filtros: { desde: "2026-10-19", hasta: HOY }, huella: "a".repeat(32) });
  ver(vacio.estado === 422 && codigo(vacio) === "SIN_DATOS", `periodo sin datos → ${vacio.estado} ${codigo(vacio)}`, `exportar sin datos → ${vacio.estado} ${vacio.texto.slice(0, 120)}`);
  const formatoMalo = await exportar({ formato: "docx", filtros, huella: repX.huella });
  const filtrosMalos = await exportar({ formato: "pdf", filtros: { desde: "", hasta: "" }, huella: repX.huella });
  ver(formatoMalo.estado === 422 && !!formatoMalo.json?.error?.campos?.formato && filtrosMalos.estado === 422 && !!filtrosMalos.json?.error?.campos?.desde, `formato inválido → ${formatoMalo.estado}; filtros sin rango → ${filtrosMalos.estado} (campo «desde»)`, `validación de exportar: ${formatoMalo.estado} ${filtrosMalos.estado}`);
  ver((await exportar({ formato: "pdf", filtros, huella: repX.huella }, "tutor1")).estado === 403 && (await exportar({ formato: "pdf", filtros, huella: repX.huella }, null)).estado === 401, "exportar: Tutor 403 · sin sesión 401", "los roles de exportar fallaron");
  ver((await bitacoraTotal()) === bitAntes, `exportar (7 exportaciones y rechazos) NO escribe en la bitácora: ${bitAntes} → ${await bitacoraTotal()} entradas`, "la exportación escribió en la bitácora");
  // Los datos cambian entre «generar» y «exportar»: 409; al regenerar, 200.
  await postCaso();
  const cambio = await exportar({ formato: "pdf", filtros, huella: repX.huella });
  const repNuevo = await reporte();
  const otra = await exportar({ formato: "xlsx", filtros, huella: repNuevo.huella });
  ver(cambio.estado === 409 && codigo(cambio) === "DATOS_CAMBIARON" && repNuevo.huella !== repX.huella && otra.estado === 200 && celdas(filasDeHoja(leerXlsx(otra.bytes)[0]))["Número de casos"] === 164, `un caso nuevo entra entre generar y exportar: huella #${repX.huella.slice(0, 8)} → 409; regenerada #${repNuevo.huella.slice(0, 8)} → 200 con 164 casos`, `cambio de datos: ${cambio.estado} ${codigo(cambio)} / ${otra.estado}`);
  // Fórmulas.
  const nuevaAlcaldia = await enviar("admin", "/api/admin/catalogos/alcaldias", { nombre: "=1+1", clave: "09777" });
  const otraAlcaldia = await enviar("admin", "/api/admin/catalogos/alcaldias", { nombre: "@HIPERVINCULO(\"x\")", clave: "09778" });
  const idsAlc = [nuevaAlcaldia.json?.item?.id, otraAlcaldia.json?.item?.id] as number[];
  for (const [i, nombre] of ["=1+1", '@HIPERVINCULO("x")'].entries()) {
    const f = await postCaso({ alcaldia: nombre });
    await postAvistamiento(f, { idAlcaldia: idsAlc[i], estadosAnimal: [1, 7] });
  }
  const repF = await reporte({ alcaldia: String(idsAlc[0]) });
  const repT = await reporte();
  const xf = await exportar({ formato: "xlsx", filtros: { ...filtros, alcaldia: String(idsAlc[0]) }, huella: repF.huella });
  const xt = await exportar({ formato: "xlsx", filtros, huella: repT.huella });
  const celdasTodas = leerXlsx(xt.bytes).flatMap((h) => [...h.celdas.values()]);
  const tablaAlc = filasDeHoja(leerXlsx(xt.bytes).find((h) => h.nombre === "Alcaldía del avistamiento")!).slice(1).map((f) => f[0] as string);
  ver(xf.estado === 200 && celdas(filasDeHoja(leerXlsx(xf.bytes)[0])).Alcaldía === "'=1+1" && tablaAlc.includes("'=1+1") && tablaAlc.includes("'@HIPERVINCULO(\"x\")") && celdasTodas.filter((v): v is string => typeof v === "string").every((v) => !/^\s*[=+\-@\t\r]/.test(v)),
    `fórmulas neutralizadas: la alcaldía «=1+1» sale como «'=1+1» (filtro y desglose) y «@HIPERVINCULO…» también; ninguna celda de texto de ${celdasTodas.length} empieza con = + - @`, `inyección de fórmulas: ${JSON.stringify(tablaAlc)}`);

  console.log("\n— G) Reiniciar recalcula la marca; nada de la persona tutora —");
  const conCapa = await tablero();
  ver(conCapa.totalCasos > 163, `con casos nuevos el tablero tiene ${conCapa.totalCasos} casos`, "no había capa real antes del reinicio");
  await reiniciarDatos(base);
  const trasReinicio = await tablero();
  ver(sinHora(trasReinicio) === huellaInicial && igual(parcial(trasReinicio), INICIAL) && (await reporte()).huella === huellaReporte, `tras «reiniciar»: vuelve a las cifras iniciales EXACTAS (${resumen(trasReinicio)}), con la misma huella de contenido (#${huellaDe(sinHora(trasReinicio))}) y los 12 sembrados fuera de la capa real`, `tras reiniciar: ${resumen(trasReinicio)}`);
  const cuerpos = [t0.texto, r0.texto, (await como("admin", `/api/admin/reportes?desde=2026-10-01&hasta=${HOY}&alcaldia=4`)).texto];
  ver(SECRETOS.every((s) => cuerpos.every((c) => !c.includes(s))), "tablero y reportes: ningún dato de la persona tutora (nombre, correo, teléfono, token, dirección reservada)", "una respuesta contiene datos de la persona tutora");
}

async function abrirNavegador(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch {
    return await chromium.launch({ channel: "chrome" });
  }
}

async function esperarServidor(servidor: ChildProcess) {
  for (let i = 0; i < 120; i++) {
    if (servidor.exitCode !== null) throw new Error("El servidor terminó antes de estar listo");
    try {
      if ((await fetch(base)).status < 500) return;
    } catch {
      // aún no responde
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("El servidor no respondió a tiempo");
}

async function main() {
  let servidor: ChildProcess | undefined;
  if (!baseExterna) {
    if (!process.argv.includes("--sin-build") && spawnSync("npx", ["next", "build"], { stdio: "ignore" }).status !== 0) throw new Error("Falló next build");
    const env: NodeJS.ProcessEnv = { ...process.env, RUPE_PERMITIR_REINICIO: "1" };
    delete env.RUPE_URL_PUBLICA;
    servidor = spawn("npx", ["next", "start", "-p", String(PUERTO)], { stdio: "ignore", detached: true, env });
  }
  const apagar = () => {
    try {
      if (servidor?.pid) process.kill(-servidor.pid);
    } catch {
      // ya terminó
    }
  };
  process.on("exit", apagar);
  let navegador: Browser | undefined;
  try {
    if (servidor) await esperarServidor(servidor);
    navegador = await abrirNavegador();
    await pruebas(navegador);
  } finally {
    await navegador?.close();
    apagar();
  }
  console.log(fallos === 0 ? `\nOK: ${total} comprobaciones del tablero, los reportes y la exportación por HTTP` : `\n${fallos} de ${total} verificación(es) fallida(s)`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
