// Verifica POR HTTP (next build + next start, sesiones REALES de las cuentas de prueba) los catálogos y los parámetros del Administrador (P6b, Etapa 1, sin pantallas):
//  A) roles y origen en TODAS las rutas nuevas (Administrador ok · Tutor 403 · sin sesión 401), estados del caso y bitácora sin escritura (405);
//  B) altas, ediciones y desactivaciones de los 4 catálogos: unicidad sin acentos ni mayúsculas, saneado (R34), protegidos, última opción activa y la EXTENSIÓN de alcaldías;
//  C) bitácora (R24): una entrada por acción, «anterior → nuevo», sin cambios no escribe;
//  D) concurrencia: 25 altas del mismo nombre = 1×201 + 24×409; 25 desactivaciones = 1×200 + 24×409;
//  E) el registro de un extravío con valores desactivados (422), el caso existente que sigue mostrando su nombre, y los estados del animal NUEVOS en un reporte;
//  F) parámetros: validaciones (4.5 sí, 4.51 no), re-aceptación del aviso (R22), tope de tamaño con una foto REAL, restablecer;
//  G) las cifras del tablero y de Reportes no cambian (huella del contenido) y las claves de las respuestas son las de la lista permitida.
// Imprime la respuesta REAL de cada paso (una línea por comprobación; nunca cookies ni credenciales). Opciones: --sin-build · --base=URL (servidor con RUPE_PERMITIR_REINICIO=1).
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import sharp from "sharp";
import { CASOS_ORIGEN } from "../src/mocks/casos";
import { JPEG_REAL } from "../src/server/pruebas/imagenes";
import { CAMPOS_CATALOGO_ADMIN, CAMPOS_ESTADO_CASO_ADMIN, CAMPOS_PARAMETRO_ADMIN } from "../src/server/serializadores/admin";
import { credencial, fetchComo, NOMBRE_COOKIE, reiniciarDatos, valorDeSesion, type RolPrueba } from "./sesion-pruebas";

const PUERTO = 3142;
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

type Datos = { [k: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
type Resp = { estado: number; texto: string; cabeceras: Headers; json?: Datos };
async function leer(r: Response): Promise<Resp> {
  const texto = await r.text();
  let json: Resp["json"];
  try {
    json = JSON.parse(texto);
  } catch {
    json = undefined;
  }
  return { estado: r.status, texto, cabeceras: r.headers, json };
}
const como = async (rol: RolPrueba | null, ruta: string, init: RequestInit = {}) => leer(await fetchComo(base, rol, ruta, { redirect: "manual", ...init }));
const enviar = (rol: RolPrueba | null, ruta: string, cuerpo: unknown, metodo = "POST", origen: string | null = ORIGEN) =>
  como(rol, ruta, { method: metodo, headers: { "Content-Type": "application/json", ...(origen ? { Origin: origen } : {}) }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
const linea = (r: Resp) => `${r.estado} ${r.json ? JSON.stringify(r.json).slice(0, 200) : `#${huellaDe(r.texto)}`}`;
const codigo = (r: Resp) => r.json?.error?.codigo as string | undefined;

type Tipo = "alcaldias" | "razas" | "motivos" | "estados-animal";
const TIPOS: Tipo[] = ["alcaldias", "razas", "motivos", "estados-animal"];
const alta = (t: Tipo, cuerpo: unknown, rol: RolPrueba | null = "admin") => enviar(rol, `/api/admin/catalogos/${t}`, cuerpo);
const edita = (t: Tipo, id: number | string, cuerpo: unknown, rol: RolPrueba | null = "admin") => enviar(rol, `/api/admin/catalogos/${t}/${id}`, cuerpo, "PUT");
const desactiva = (t: Tipo, id: number | string, rol: RolPrueba | null = "admin") => enviar(rol, `/api/admin/catalogos/${t}/${id}/desactivar`, undefined);
const params = (cuerpo: unknown, rol: RolPrueba | null = "admin") => enviar(rol, "/api/admin/parametros", cuerpo, "PUT");
const bitacora = async (q = "") => (await como("admin", `/api/admin/bitacora${q}`)).json as { items: Datos[]; total: number };
const totalBitacora = async () => (await bitacora()).total;
async function filas(t: Tipo): Promise<Datos[]> {
  const todas: Datos[] = [];
  for (let p = 1; ; p++) {
    const r = await como("admin", `/api/admin/catalogos/${t}?pagina=${p}`);
    todas.push(...(r.json?.items ?? []));
    if (p >= (r.json?.totalPaginas ?? 1)) return todas;
  }
}
const NUEVO: Record<Tipo, Datos> = {
  alcaldias: { nombre: "Nueva Alcaldía", clave: "09018" }, razas: { nombre: "Raza Nueva" },
  motivos: { nombre: "Motivo Nuevo", idCategoria: 3, descripcion: "Descripción del motivo nuevo." }, "estados-animal": { nombre: "Estado Nuevo", idCategoria: 1, descripcion: "Descripción del estado nuevo." },
};

const MAX = "RUPE-K7M4XQ9T";
const datosDeCaso = (extra: Record<string, unknown> = {}) => ({ nombre: "Pelusa", sexo: "Hembra", idRaza: 1, edad: { valor: 0, unidad: "meses" }, tamano: "pequeño", color: "Blanco", fechaExtravio: new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10), momento: "tarde", alcaldia: "Coyoacán", colonia: "Del Carmen", calle: "Calle Reservada 99", idMotivo: 1, ...extra });
/** POST /api/casos como lo envía el navegador: multipart con «datos» y «fotografia». */
async function postCaso(datos: unknown, bytes: Uint8Array = JPEG_REAL, rol: RolPrueba = "tutor1"): Promise<Resp> {
  const f = new FormData();
  f.set("datos", JSON.stringify(datos));
  f.set("fotografia", new Blob([bytes as BlobPart], { type: "image/jpeg" }), "fotografia.jpg");
  return leer(await fetch(`${base}/api/casos`, { method: "POST", headers: { Origin: ORIGEN, Cookie: `${NOMBRE_COOKIE}=${await valorDeSesion(base, rol)}` }, body: f, redirect: "manual" }));
}
/** Foto REAL (decodificable) con ruido: pesa lo bastante como para pasar de un tope pequeño. */
const fotoConRuido = (lado: number) => sharp(randomBytes(lado * lado * 3), { raw: { width: lado, height: lado, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
/** Foto real cuyo peso cae entre `min` y `max` bytes (búsqueda binaria del lado del cuadro). */
async function fotoEntre(min: number, max: number): Promise<Buffer> {
  let [bajo, alto] = [20, 1200];
  for (let i = 0; i < 14; i++) {
    const lado = Math.floor((bajo + alto) / 2);
    const f = await fotoConRuido(lado);
    if (f.length >= min && f.length <= max) return f;
    if (f.length < min) bajo = lado + 1;
    else alto = lado - 1;
  }
  throw new Error("No se pudo generar una foto del peso pedido");
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

async function pruebas() {
  const reinicio = await reiniciarDatos(base);
  ver(reinicio === 200, "el servidor permite reiniciar los datos (RUPE_PERMITIR_REINICIO=1)", `no se pudo reiniciar los datos: HTTP ${reinicio}`);
  if (reinicio !== 200) throw new Error("Sin reinicio no hay pruebas confiables");

  console.log("\n— A) Roles y origen en cada ruta nueva —");
  const rutas: Array<[string, string, string, unknown?]> = [
    ...TIPOS.flatMap((t): Array<[string, string, string, unknown?]> => [[`GET catálogo ${t}`, "GET", `/api/admin/catalogos/${t}`], [`POST alta ${t}`, "POST", `/api/admin/catalogos/${t}`, NUEVO[t]], [`PUT edición ${t}`, "PUT", `/api/admin/catalogos/${t}/2`, NUEVO[t]], [`POST desactivar ${t}`, "POST", `/api/admin/catalogos/${t}/2/desactivar`]]),
    ["GET parámetros", "GET", "/api/admin/parametros"], ["PUT parámetros", "PUT", "/api/admin/parametros", { version_aviso_privacidad: "2.0" }], ["POST restablecer", "POST", "/api/admin/parametros/restablecer"], ["GET estados del caso", "GET", "/api/admin/estados-caso"],
  ];
  const antesA = await totalBitacora();
  const denegadas: string[] = [];
  for (const [nombre, metodo, ruta, cuerpo] of rutas) {
    const llamar = (rol: RolPrueba | null) => (metodo === "GET" ? como(rol, ruta) : enviar(rol, ruta, cuerpo, metodo));
    const [sin, tutora] = [await llamar(null), await llamar("tutor1")];
    if (!(sin.estado === 401 && tutora.estado === 403 && codigo(sin) === "SIN_SESION" && codigo(tutora) === "SIN_PERMISO" && sin.cabeceras.get("cache-control") === "no-store")) denegadas.push(`${nombre}: ${sin.estado}/${tutora.estado}`);
  }
  ver(denegadas.length === 0, `las ${rutas.length} rutas nuevas: sin sesión 401 SIN_SESION · Tutor 403 SIN_PERMISO · no-store`, `rutas con guarda incorrecta: ${denegadas.join("; ")}`);
  ver((await totalBitacora()) === antesA, "las denegadas no escribieron nada en la bitácora", "una petición denegada escribió en la bitácora");
  const foraneo = await enviar("admin", "/api/admin/catalogos/razas", NUEVO.razas, "POST", "https://otro-sitio.example");
  ver(foraneo.estado === 403 && codigo(foraneo) === "ORIGEN_NO_PERMITIDO", "Origin de otro sitio: 403 ORIGEN_NO_PERMITIDO (también en parámetros)", linea(foraneo));
  const foraneoP = await enviar("admin", "/api/admin/parametros", { version_aviso_privacidad: "9.9" }, "PUT", "https://otro-sitio.example");
  ver(foraneoP.estado === 403 && codigo(foraneoP) === "ORIGEN_NO_PERMITIDO", "PUT /api/admin/parametros con Origin ajeno: 403", linea(foraneoP));
  const sinEscritura = await Promise.all(["POST", "PUT", "PATCH", "DELETE"].map((m) => enviar("admin", "/api/admin/estados-caso", { nombre: "Nuevo" }, m)));
  ver(sinEscritura.every((r) => r.estado === 405), "estados del caso SOLO consulta: POST, PUT, PATCH y DELETE dan 405 (ni el Administrador los modifica)", sinEscritura.map(linea).join(" | "));
  const bit405 = await Promise.all(["POST", "PUT", "PATCH", "DELETE"].map((m) => enviar("admin", "/api/admin/bitacora", { tipo: "x" }, m)));
  ver(bit405.every((r) => r.estado === 405), "la bitácora no se edita ni se borra: POST, PUT, PATCH y DELETE dan 405", bit405.map(linea).join(" | "));
  const eliminar = await Promise.all(TIPOS.map((t) => enviar("admin", `/api/admin/catalogos/${t}/2`, undefined, "DELETE")));
  ver(eliminar.every((r) => r.estado === 405), "los catálogos no se eliminan: DELETE da 405 en los 4", eliminar.map(linea).join(" | "));
  const desconocido = await Promise.all([como("admin", "/api/admin/catalogos/usuarios"), edita("razas", "abc", NUEVO.razas), edita("razas", 9999, NUEVO.razas), desactiva("razas", 9999)]);
  ver(desconocido.every((r) => r.estado === 404), "catálogo desconocido, id mal formado o inexistente: 404 uniforme", desconocido.map(linea).join(" | "));

  console.log("\n— B) Altas, unicidad, saneado y protegidos —");
  const base0 = await totalBitacora();
  const ids: Record<string, number> = {};
  for (const [i, t] of TIPOS.entries()) {
    const r = await alta(t, NUEVO[t]);
    ids[t] = r.json?.item?.id;
    ver(r.estado === 201 && r.json?.item?.activo === true && r.json?.item?.id === [18, 15, 16, 18][i], `alta en ${t}: 201 activo con el siguiente id (${r.json?.item?.id})`, linea(r));
  }
  ver((await totalBitacora()) === base0 + 4, "4 altas = 4 entradas «alta de catálogo» (una por acción)", `total ${await totalBitacora()} (esperado ${base0 + 4})`);
  const ultimaAlta = (await bitacora("?tipo=alta%20de%20cat%C3%A1logo")).items[0];
  ver(ultimaAlta?.detalle === "Estado Nuevo" && ultimaAlta?.entidadAfectada === "Estados del animal · Estado Nuevo (18)" && ultimaAlta?.administrador === "Ricardo Vega Ficticio", "la entrada de bitácora lleva el nombre, la entidad legible y quién la hizo", JSON.stringify(ultimaAlta));
  const sana = await alta("razas", { nombre: " <b>x</b> " });
  ver(sana.estado === 201 && sana.json?.item?.nombre === "x", "R34: «<b>x</b>» se guarda como «x»", linea(sana));
  const duplicados = await Promise.all([alta("razas", { nombre: "  PUG   (carlino) " }), alta("alcaldias", { nombre: "coyoacan", clave: "09019" }), alta("alcaldias", { nombre: "Otra", clave: "09003" }), alta("motivos", { nombre: "PANICO por ruidos fuertes", idCategoria: 1, descripcion: "d" }), alta("estados-animal", { nombre: "fallecido", idCategoria: 1, descripcion: "d" })]);
  ver(duplicados.map((r) => `${r.estado} ${codigo(r)}`).join() === "409 NOMBRE_DUPLICADO,409 NOMBRE_DUPLICADO,409 CLAVE_DUPLICADA,409 NOMBRE_DUPLICADO,409 NOMBRE_DUPLICADO" && duplicados.every((r) => r.json?.error?.campos), "nombre repetido sin acentos ni mayúsculas (razas, alcaldías, motivos, estados) y clave repetida: 409 con el campo señalado", duplicados.map(linea).join(" | "));
  const invalidos = await Promise.all([alta("razas", { nombre: "" }), alta("razas", { nombre: "x".repeat(81) }), alta("alcaldias", { nombre: "x".repeat(61), clave: "09020" }), alta("alcaldias", { nombre: "Sin clave" }), alta("alcaldias", { nombre: "Clave mala", clave: "10020" }), alta("motivos", { nombre: "M", idCategoria: 9, descripcion: "d" }), alta("motivos", { nombre: "M", idCategoria: 1, descripcion: "x".repeat(256) }), alta("estados-animal", { nombre: "E", idCategoria: 1 })]);
  ver(invalidos.every((r) => r.estado === 422 && codigo(r) === "VALIDACION" && r.json?.error?.campos), "formato: nombre vacío o >80 (60 en alcaldías), clave faltante o fuera de 09XXX, categoría inexistente, descripción >255 u omitida: 422 con campos", invalidos.map((r) => r.estado).join());
  const protegidos: Array<[Tipo, number]> = [["alcaldias", 17], ["razas", 1], ["razas", 14], ["motivos", 14], ["motivos", 15], ["estados-animal", 1], ["estados-animal", 5], ["estados-animal", 6]];
  const prot = await Promise.all(protegidos.map(([t, id]) => desactiva(t, id)));
  ver(prot.every((r) => r.estado === 409 && codigo(r) === "VALOR_PROTEGIDO"), "protegidos (alcaldía 17; razas 1 y 14; motivos 14 y 15; estados 1, 5 y 6): 409 VALOR_PROTEGIDO", prot.map(linea).join(" | "));
  const renombrar = await edita("razas", 14, { nombre: "Otra raza" });
  ver(renombrar.estado === 200 && renombrar.json?.item?.activo === true && renombrar.json?.item?.protegido === true, "un protegido SÍ puede renombrarse y sigue activo", linea(renombrar));
  await edita("razas", 14, { nombre: "Otra" });

  console.log("\n— C) Edición, reactivación, sin cambios y bitácora «anterior → nuevo» —");
  const b1 = await totalBitacora();
  const e1 = await edita("motivos", 3, { nombre: "Cambios en el entorno", idCategoria: 2, descripcion: "Otra descripción" });
  const eb = (await bitacora("?tipo=edici%C3%B3n%20de%20cat%C3%A1logo")).items[0];
  ver(e1.estado === 200 && e1.json?.sinCambios === false && eb?.detalle === "nombre: «Cambios drásticos en el entorno» → «Cambios en el entorno»; categoría: «Detonantes Emocionales y Ambientales» → «Impulsos Biológicos y Conductuales»; descripción modificada" && (await totalBitacora()) === b1 + 1, "edición: una entrada con «anterior → nuevo» (la descripción solo dice «modificada»)", `${linea(e1)} · ${eb?.detalle}`);
  const sinCambio = await edita("motivos", 3, { nombre: "Cambios en el entorno", idCategoria: 2, descripcion: "Otra descripción" });
  ver(sinCambio.estado === 200 && sinCambio.json?.sinCambios === true && (await totalBitacora()) === b1 + 1, "sin cambios: 200 sinCambios:true y NO se escribe bitácora", linea(sinCambio));
  const d12 = await desactiva("alcaldias", 12);
  const f12 = (await filas("alcaldias")).find((x) => x.id === 12)!;
  ver(d12.estado === 200 && d12.json?.item?.activo === false && (await bitacora("?tipo=desactivaci%C3%B3n%20de%20cat%C3%A1logo")).items[0]?.detalle === "Activa → Inactiva", "desactivar: 200 inactivo + entrada «Activa → Inactiva»; sigue en el listado", linea(d12));
  const otraVez = await desactiva("alcaldias", 12);
  ver(otraVez.estado === 409 && codigo(otraVez) === "YA_DESACTIVADO", "desactivar de nuevo: 409 YA_DESACTIVADO", linea(otraVez));
  const react = await edita("alcaldias", 12, { nombre: f12.nombre, clave: f12.clave, activo: true });
  ver(react.estado === 200 && react.json?.reactivado === true && react.json?.item?.activo === true && (await bitacora("?tipo=edici%C3%B3n%20de%20cat%C3%A1logo")).items[0]?.detalle === "Inactiva → Activa", "reactivar = editar con activo:true (R9): entrada «Inactiva → Activa»", linea(react));
  const noDesact = await edita("razas", 3, { nombre: "Schnauzer Miniatura", activo: false });
  ver(noDesact.estado === 422 && noDesact.json?.error?.campos?.activo, "editar no desactiva (activo:false): 422 con campo", linea(noDesact));
  await desactiva("estados-animal", 16);
  await desactiva("estados-animal", 17);
  const ultima = await desactiva("estados-animal", 15);
  ver(ultima.estado === 409 && codigo(ultima) === "ULTIMA_ACTIVA_DE_CATEGORIA" && ultima.json?.error?.mensaje.includes("Identificación visible"), "última opción activa: con 16 y 17 desactivados, el 15 (única de «Identificación visible») da 409", linea(ultima));
  const mueve = await edita("estados-animal", 15, { nombre: "Con placa y collar", idCategoria: 3, descripcion: "d" });
  ver(mueve.estado === 409 && codigo(mueve) === "ULTIMA_ACTIVA_DE_CATEGORIA", "tampoco puede cambiarse de categoría la última activa", linea(mueve));
  const f16 = (await filas("estados-animal")).find((x) => x.id === 16)!;
  await edita("estados-animal", 16, { nombre: f16.nombre, idCategoria: 4, descripcion: f16.descripcion, activo: true });
  ver((await desactiva("estados-animal", 15)).estado === 200, "al reactivar otra de la categoría, el 15 ya puede desactivarse", "no se pudo desactivar tras reactivar");
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18]) await desactiva("alcaldias", id); // 18 = la que se dio de alta arriba
  const unica = await desactiva("alcaldias", 16);
  ver(unica.estado === 409 && codigo(unica) === "ULTIMA_ALCALDIA_ACTIVA", "EXTENSIÓN (no pedida por las HU): la última alcaldía oficial activa no se desactiva: 409 ULTIMA_ALCALDIA_ACTIVA", linea(unica));
  await reiniciarDatos(base);

  console.log("\n— D) Concurrencia —");
  const altas = await Promise.all(Array.from({ length: 25 }, () => alta("razas", { nombre: "Raza Concurrente" })));
  const [creadas, conflictos] = [altas.filter((r) => r.estado === 201).length, altas.filter((r) => r.estado === 409 && codigo(r) === "NOMBRE_DUPLICADO").length];
  ver(creadas === 1 && conflictos === 24, `25 altas simultáneas del mismo nombre: 1 × 201 y 24 × 409 (${creadas} × 201, ${conflictos} × 409)`, `altas: ${altas.map((r) => r.estado).join()}`);
  ver((await filas("razas")).filter((x) => x.nombre === "Raza Concurrente").length === 1, "queda UNA sola fila con ese nombre", "hay filas duplicadas");
  const variantes = await Promise.all(["Raza Variante", "raza variante", "RAZA  VARIANTE", "Raza Varíante"].flatMap((n) => Array.from({ length: 6 }, () => alta("razas", { nombre: n }))));
  ver(variantes.filter((r) => r.estado === 201).length === 1, "24 altas simultáneas del mismo nombre escrito de 4 maneras (acentos, mayúsculas, espacios): 1 sola creada", `creadas: ${variantes.filter((r) => r.estado === 201).length}`);
  const bAntes = await totalBitacora();
  const desactivaciones = await Promise.all(Array.from({ length: 25 }, () => desactiva("razas", 7)));
  const [okD, ya] = [desactivaciones.filter((r) => r.estado === 200).length, desactivaciones.filter((r) => r.estado === 409 && codigo(r) === "YA_DESACTIVADO").length];
  ver(okD === 1 && ya === 24, `25 desactivaciones simultáneas del mismo id: 1 × 200 y 24 × 409 (${okD} × 200, ${ya} × 409)`, `desactivaciones: ${desactivaciones.map((r) => r.estado).join()}`);
  ver((await totalBitacora()) === bAntes + 1, "y una sola entrada de bitácora", `entradas nuevas: ${(await totalBitacora()) - bAntes}`);
  const carrera = await Promise.all(["15", "16", "17", "15", "16", "17"].map((id) => desactiva("estados-animal", id)));
  const activos4 = (await filas("estados-animal")).filter((x) => x.idCategoria === 4 && x.activo).length;
  ver(carrera.filter((r) => r.estado === 200).length === 2 && activos4 === 1, "desactivar a la vez los 3 estados de una categoría: solo 2 proceden y queda 1 activo", `procedentes ${carrera.filter((r) => r.estado === 200).length}, activos ${activos4}`);
  await reiniciarDatos(base);

  console.log("\n— E) Formularios: valores desactivados, casos existentes y estados nuevos —");
  const catalogoRazas = await filas("razas");
  const fichas = await Promise.all(CASOS_ORIGEN.map((c) => como(null, `/api/fichas/${c.folio}`)));
  const conRaza = fichas.find((f) => catalogoRazas.some((r) => r.nombre === f.json?.ficha?.raza && !r.protegido))!;
  const pug = catalogoRazas.find((r) => r.nombre === conRaza.json?.ficha?.raza)!;
  const razaId = pug.id;
  const registrar = (extra: Record<string, unknown>) => postCaso(datosDeCaso(extra));
  const ok0 = await registrar({ idRaza: razaId });
  ver(ok0.estado === 201, "antes de desactivar: se registra un extravío con la raza activa (201)", linea(ok0));
  await desactiva("razas", razaId);
  await desactiva("alcaldias", 12);
  await desactiva("motivos", 3);
  const r422 = await Promise.all([registrar({ idRaza: razaId }), registrar({ alcaldia: "Milpa Alta" }), registrar({ idMotivo: 3 })]);
  ver(r422.map((r) => `${r.estado} ${Object.keys(r.json?.error?.campos ?? {}).join()}`).join("|") === "422 raza|422 alcaldia|422 motivo" && r422.every((r) => !/\d{3,}/.test(JSON.stringify(r.json?.error?.campos))), "registrar con raza, alcaldía o motivo DESACTIVADOS: 422 amable, solo ese campo, sin identificadores", r422.map(linea).join(" | "));
  const siguenAhi = await registrar({ idRaza: razaId === 7 ? 8 : 7 });
  ver(siguenAhi.estado === 201, "las demás opciones activas siguen funcionando (201)", linea(siguenAhi));
  const fichaDespues = await como(null, `/api/fichas/${conRaza.json!.ficha.folio}`);
  ver(fichaDespues.estado === 200 && fichaDespues.json?.ficha?.raza === pug.nombre, `el caso existente con la raza desactivada la sigue mostrando en su ficha pública: «${fichaDespues.json?.ficha?.raza}»`, linea(fichaDespues));
  const milpa = (await filas("alcaldias")).find((x) => x.id === 12)!;
  await edita("razas", razaId, { nombre: pug.nombre, activo: true });
  await edita("alcaldias", 12, { nombre: milpa.nombre, clave: milpa.clave, activo: true });
  await edita("motivos", 3, { nombre: (await filas("motivos")).find((x) => x.id === 3)!.nombre, idCategoria: 1, descripcion: (await filas("motivos")).find((x) => x.id === 3)!.descripcion, activo: true });
  const vuelve = await Promise.all([registrar({ idRaza: razaId }), registrar({ alcaldia: milpa.nombre }), registrar({ idMotivo: 3 })]);
  ver(vuelve.every((r) => r.estado === 201), "reactivados, vuelven a aceptarse en el registro (201 ×3)", vuelve.map(linea).join(" | "));
  await reiniciarDatos(base);

  const nuevoA = await alta("estados-animal", { nombre: "Cojea levemente", idCategoria: 1, descripcion: "Camina con dificultad." });
  const nuevoB = await alta("estados-animal", { nombre: "Juguetón", idCategoria: 3, descripcion: "Quiere jugar." });
  const reportar = (estadosAnimal: number[]) => postAvistamientoAFolio(MAX, { fecha: "2026-10-17", hora: "10:00", direccion: "Calle 1", idAlcaldia: 6, estadosAnimal });
  const [r1, r2, r3, r4] = [await reportar([2, nuevoA.json?.item?.id, 7]), await reportar([nuevoA.json?.item?.id, 7, nuevoB.json?.item?.id]), await reportar([1, nuevoA.json?.item?.id, 7]), await reportar([5, 7, nuevoB.json?.item?.id])];
  ver(nuevoA.json?.item?.id === 18 && r1.estado === 201 && r2.estado === 201, "estado NUEVO de «Integridad» (id 18) y otro de «Conducta» (19): el reporte de avistamiento los acepta (201) y se combinan con los combinables", `${linea(r1)} | ${linea(r2)}`);
  ver(r3.estado === 422 && r4.estado === 422, "R3 con estados nuevos: «Ileso» (1) no se combina con el nuevo y «Fallecido» (5) deshabilita Conducta, también con uno nuevo: 422", `${linea(r3)} | ${linea(r4)}`);
  const inicio = await como(null, `/api/fichas/${MAX}`);
  ver(inicio.estado === 200, "la ficha del caso sigue sirviéndose con los catálogos modificados", linea(inicio));
  await reiniciarDatos(base);

  console.log("\n— F) Parámetros —");
  const lista = await como("admin", "/api/admin/parametros");
  ver(lista.estado === 200 && lista.json?.parametros.map((p: Datos) => `${p.clave}=${p.valor}/${p.valorPorDefecto}`).join() === "version_aviso_privacidad=1.0/1.0,expiracion_token_minutos=60/60,tamano_maximo_archivo_mb=4/4", "valores iniciales: aviso 1.0 · token 60 · tamaño 4 (con su valor por defecto)", linea(lista));
  const malos = await Promise.all([params({ tamano_maximo_archivo_mb: 4.51 }), params({ tamano_maximo_archivo_mb: 0 }), params({ expiracion_token_minutos: 1.5 }), params({ expiracion_token_minutos: 0 }), params({ version_aviso_privacidad: "1." }), params({ version_aviso_privacidad: "1".repeat(21) }), params({}), params({ inventado: 1 })]);
  ver(malos.every((r) => r.estado === 422 && r.json?.error?.campos), "valores inválidos (4.51 MB, 0, token 1.5 o 0, versión «1.» o de 21 caracteres, vacío, parámetro inventado): 422 con campos", malos.map((r) => r.estado).join());
  const b0 = await totalBitacora();
  const mixto = await params({ version_aviso_privacidad: "3.0", tamano_maximo_archivo_mb: 4.51 });
  ver(mixto.estado === 422 && (await totalBitacora()) === b0 && (await como("admin", "/api/admin/parametros")).json?.parametros[0].valor === "1.0", "un valor malo junto a uno bueno: no se cambia NINGUNO y no hay bitácora", linea(mixto));
  const limite = await params({ tamano_maximo_archivo_mb: 4.5 });
  ver(limite.estado === 200 && limite.json?.cambios[0]?.nuevo === "4.5", "4.5 MB sí (límite técnico)", linea(limite));
  const sinCambios = await params({ tamano_maximo_archivo_mb: "4.50", version_aviso_privacidad: "1.0" });
  ver(sinCambios.estado === 200 && sinCambios.json?.sinCambios === true, "mismos valores (4.50 = 4.5): 200 sinCambios:true", linea(sinCambios));
  await reiniciarDatos(base);
  const b1p = await totalBitacora();
  const multi = await params({ version_aviso_privacidad: "2.0", expiracion_token_minutos: 30, tamano_maximo_archivo_mb: 4 });
  const ent = (await bitacora("?tipo=modificar%20par%C3%A1metro")).items;
  ver(multi.estado === 200 && multi.json?.cambios.length === 2 && multi.json?.avisoReaceptacion === true && (await totalBitacora()) === b1p + 2 && ent[0]?.detalle === "60 → 30" && ent[1]?.detalle === "1.0 → 2.0", "dos parámetros cambiados = dos entradas, cada una con «anterior → nuevo» (el que no cambió no escribe)", `${linea(multi)} · ${ent.slice(0, 2).map((e) => e.detalle).join(" / ")}`);

  // R22: la tutora debe reaceptar el aviso 2.0 en su siguiente inicio de sesión.
  const c2 = credencial("tutor2");
  const entrar = (extra: object = {}) => fetch(`${base}/api/acceso/iniciar`, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGEN }, body: JSON.stringify({ correo: c2.correo, contrasena: c2.contrasena, ...extra }) }).then(leer);
  const sin = await entrar();
  ver(sin.estado === 409 && codigo(sin) === "AVISO_DESACTUALIZADO" && sin.json?.error?.versionAviso === "2.0" && sin.cabeceras.get("set-cookie") === null, "R22: con el aviso en 2.0, la tutora SIN aceptar: 409 AVISO_DESACTUALIZADO (versionAviso 2.0) y sin cookie", linea(sin));
  const acepta = await entrar({ aceptarAviso: true });
  const despues = await entrar();
  ver(acepta.estado === 200 && despues.estado === 200, "aceptándolo: 200; el siguiente inicio ya no lo pide (200)", `${acepta.estado} / ${despues.estado}`);
  await params({ version_aviso_privacidad: "1.0" });
  const dev = await enviar("admin", "/api/dev/parametro", { valor: "2.0" });
  ver(dev.estado === 404, "/api/dev/parametro ya no existe (404)", linea(dev));

  // Tope de tamaño: el Administrador lo baja a 0.2 MB y se suben fotos REALES (decodificables) de distinto peso.
  const MB = 1024 * 1024;
  const mediana = await fotoEntre(0.2 * MB + 2048, 0.2 * MB + 40_000); // pasa del tope, pero cabe en el margen del cuerpo: llega al servicio y se valida allí
  const enorme = await fotoConRuido(700); // mucho mayor: el cuerpo ni se lee
  const chica = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 120, b: 40 } } }).jpeg().toBuffer();
  ver(mediana.length > 0.2 * MB && chica.length < 0.2 * MB && enorme.length > 0.4 * MB, `fotos de prueba reales: mediana ${(mediana.length / 1024).toFixed(0)} KB · chica ${(chica.length / 1024).toFixed(1)} KB · enorme ${(enorme.length / 1024).toFixed(0)} KB`, `tamaños ${mediana.length}/${chica.length}/${enorme.length}`);
  const antesTope = await postCaso(datosDeCaso(), mediana);
  ver(antesTope.estado === 201, "con el tope en 4 MB la foto mediana SÍ se acepta (201)", linea(antesTope));
  const bajar = await params({ tamano_maximo_archivo_mb: 0.2 });
  const rechazada = await postCaso(datosDeCaso(), mediana);
  const aceptada = await postCaso(datosDeCaso(), chica);
  ver(bajar.estado === 200 && rechazada.estado === 422 && /0\.2 MB/.test(rechazada.json?.error?.campos?.foto ?? "") && aceptada.estado === 201, "el Administrador baja el tope a 0.2 MB: la MISMA foto real mediana da 422 «no puede pesar más de 0.2 MB»; la chica, 201", `${linea(rechazada)} | ${aceptada.estado}`);
  const cuerpoGrande = await postCaso(datosDeCaso(), enorme);
  ver(cuerpoGrande.estado === 413 && codigo(cuerpoGrande) === "CUERPO_DEMASIADO_GRANDE", "el límite de cuerpo sigue al parámetro: la foto real enorme con el tope en 0.2 MB da 413 sin leerse", linea(cuerpoGrande));
  const avistamientoGrande = await postAvistamientoAFolio(MAX, { fecha: "2026-10-17", hora: "10:00", direccion: "Calle 1", idAlcaldia: 6, estadosAnimal: [1, 7] }, mediana);
  ver(avistamientoGrande.estado === 422 && !!avistamientoGrande.json?.error?.campos?.foto, "el mismo tope gobierna la foto del reporte de avistamiento (422)", linea(avistamientoGrande));
  await params({ tamano_maximo_archivo_mb: 4 });
  const devuelta = await postCaso(datosDeCaso(), enorme);
  ver(devuelta.estado === 201, "al volver a 4 MB, la foto enorme se acepta de nuevo (201)", linea(devuelta));
  const rest = await enviar("admin", "/api/admin/parametros/restablecer", undefined);
  const b2 = await totalBitacora();
  const rest2 = await enviar("admin", "/api/admin/parametros/restablecer", undefined);
  ver(rest.estado === 200 && rest.json?.parametros.map((p: Datos) => p.valor).join() === "1.0,60,4", "restablecer deja 1.0 · 60 · 4 (copia los valores por defecto; solo cambió el token: 30 → 60)", linea(rest));
  ver(rest2.estado === 200 && rest2.json?.sinCambios === true && (await totalBitacora()) === b2, "restablecer otra vez: sinCambios y nada escrito", linea(rest2));

  console.log("\n— G) Cifras del tablero y de Reportes, y claves de respuesta —");
  await reiniciarDatos(base);
  const pagina = async (ruta: string) => huellaDe((await como("admin", ruta)).texto.replace(/\s+/g, " "));
  const [tab0, rep0] = [await pagina("/admin"), await pagina("/admin/reportes?desde=2026-06-01&hasta=2026-10-18")];
  const textoTablero = (await como("admin", "/admin")).texto;
  ver(["163", "141", "19", "199"].every((n) => textoTablero.includes(n)), "el tablero muestra las cifras de siempre (163 casos, 141 activos, 19 localizados, 199 avistamientos)", "faltan cifras en el tablero");
  for (const t of TIPOS) await alta(t, NUEVO[t]);
  await edita("alcaldias", 4, { nombre: "Coyoacán Renombrada", clave: "09003" });
  await edita("razas", 4, { nombre: "Labrador" });
  await edita("motivos", 1, { nombre: "Pánico", idCategoria: 1, descripcion: "d" });
  await edita("estados-animal", 2, { nombre: "Herido", idCategoria: 1, descripcion: "d" });
  for (const [t, id] of [["alcaldias", 5], ["razas", 6], ["motivos", 2], ["estados-animal", 16]] as Array<[Tipo, number]>) await desactiva(t, id);
  const [tab1, rep1] = [await pagina("/admin"), await pagina("/admin/reportes?desde=2026-06-01&hasta=2026-10-18")];
  ver(tab0 === tab1 && rep0 === rep1, `tras crear, renombrar y desactivar en los 4 catálogos, el tablero (#${tab0}) y Reportes (#${rep0}) son IDÉNTICOS (huella del contenido)`, `tablero #${tab0}→#${tab1} · reportes #${rep0}→#${rep1}`);
  const claves = async (t: Tipo) => {
    const l = await como("admin", `/api/admin/catalogos/${t}`);
    return (l.json?.items as Datos[]).every((x) => Object.keys(x).every((k) => (CAMPOS_CATALOGO_ADMIN as readonly string[]).includes(k))) && !l.texto.includes("estatus") && !l.texto.includes("claveGeoestadistica") && Object.keys(l.json ?? {}).sort().join() === "categorias,filtros,items,pagina,porPagina,tipo,total,totalPaginas";
  };
  ver((await Promise.all(TIPOS.map(claves))).every(Boolean), "claves de los listados: solo la lista permitida (sin estatus, claveGeoestadistica ni filas del almacén)", "un listado trae claves fuera de la lista");
  const [pa, ec] = [await como("admin", "/api/admin/parametros"), await como("admin", "/api/admin/estados-caso")];
  ver((pa.json?.parametros as Datos[]).every((p) => Object.keys(p).sort().join() === [...CAMPOS_PARAMETRO_ADMIN].sort().join()) && (ec.json?.items as Datos[]).every((e) => Object.keys(e).sort().join() === [...CAMPOS_ESTADO_CASO_ADMIN].sort().join()) && ec.json?.items.map((e: Datos) => e.nombre).join() === "Extraviado,En búsqueda,Avistamiento reportado,En seguimiento,Localizado,Cerrado", "claves de parámetros y de estados del caso exactas; los 6 estados en su orden", `${linea(pa)} | ${linea(ec)}`);
  const pag = await Promise.all(["abc", "-1", "0", "999"].map((p) => como("admin", `/api/admin/catalogos/alcaldias?pagina=${p}`)));
  ver(pag.map((r) => r.json?.pagina).join() === "1,1,1,3" && (await como("admin", "/api/admin/catalogos/alcaldias?texto=COYOACAN")).json?.items.length === 1, "paginación en el servidor: ?pagina= inválido → 1, fuera de rango → última; búsqueda sin acentos ni mayúsculas", pag.map((r) => r.json?.pagina).join());
  await reiniciarDatos(base);
}

/** Reporte público de un avistamiento por folio (sin sesión). */
async function postAvistamientoAFolio(folio: string, datos: object, bytes: Uint8Array = JPEG_REAL): Promise<Resp> {
  const f = new FormData();
  f.set("datos", JSON.stringify({ acceso: { canal: "folio", folio }, ...datos }));
  f.set("fotografia", new Blob([bytes as BlobPart], { type: "image/jpeg" }), "fotografia.jpg");
  return leer(await fetch(`${base}/api/avistamientos`, { method: "POST", headers: { Origin: ORIGEN }, body: f, redirect: "manual" }));
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
  try {
    if (servidor) await esperarServidor(servidor);
    await pruebas();
  } finally {
    apagar();
  }
  console.log(fallos === 0 ? `\nOK: ${total} comprobaciones de catálogos y parámetros del Administrador por HTTP` : `\n${fallos} de ${total} verificación(es) fallida(s)`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
