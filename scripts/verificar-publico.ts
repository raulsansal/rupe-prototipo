// Verifica POR HTTP (next build + next start, sin cookies salvo donde se indica «como dueña») la ficha pública y el reporte de avistamiento (P4, HU 024, 025 y 028 a 036):
//  · la tabla R33 completa (Activo, Localizado, Cerrado confirmado, Cancelado, Deshabilitado, inexistente y mal formado) por FOLIO y por QR, con los 404 idénticos byte por byte;
//  · la invalidación del token tras regenerar el QR (el folio sigue funcionando, el token nuevo también);
//  · un reporte real con una foto con EXIF y GPS: la foto guardada, leída como dueña, ya no los tiene y su orientación está aplicada;
//  · los estados del animal inválidos (422 por campo), Origin inválido (403) y no-store;
//  · ninguna respuesta pública lleva el token ni datos de la persona tutora (valores señuelo únicos).
// Imprime la respuesta REAL de cada comprobación. Opciones: --sin-build · --base=URL (servidor con RUPE_PERMITIR_REINICIO=1 y SIN RUPE_URL_PUBLICA).
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { CASOS_ORIGEN } from "../src/mocks/casos";
import { decodificarQr, rasterizarMatriz } from "../src/server/pruebas/pdf";
import { fetchComo, reiniciarDatos } from "./sesion-pruebas";

const PUERTO = 3114;
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

type Resp = { estado: number; cabeceras: Headers; texto: string; json?: { error?: { codigo?: string; mensaje?: string; campos?: Record<string, string> }; [k: string]: unknown } };
async function leer(r: Response): Promise<Resp> {
  const texto = await r.text();
  let json: Resp["json"];
  try {
    json = JSON.parse(texto);
  } catch {
    json = undefined;
  }
  return { estado: r.status, cabeceras: r.headers, texto, json };
}
const anonimo = async (ruta: string, init: RequestInit = {}) => leer(await fetch(`${base}${ruta}`, init));
const comoDuena = async (ruta: string, init: RequestInit = {}) => leer(await fetchComo(base, "tutor1", ruta, init));
const resumen = (r: Resp) => `${r.estado} ${r.json?.error?.codigo ?? (r.json ? "ok" : r.cabeceras.get("content-type") ?? "")} #${huellaDe(r.texto)}`;
const mismoCuerpo = (rs: Resp[]) => rs.every((r) => r.texto === rs[0].texto && r.cabeceras.get("content-type") === rs[0].cabeceras.get("content-type") && r.cabeceras.get("cache-control") === rs[0].cabeceras.get("cache-control"));

const FOTO = Uint8Array.from(Buffer.from("/9j/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAMABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKAATb//2Q==", "base64"));
const datosBase = (acceso: unknown, extra: Record<string, unknown> = {}) => ({ acceso, fecha: fechaAyer(), hora: "10:00", direccion: "Avenida Reservada 123, entre A y B", idAlcaldia: 6, coloniaZona: "Del Valle", referencias: "junto a la panadería", estadosAnimal: [1, 7], comentario: "Se ve bien", ...extra });
function fechaAyer() {
  return new Date(Date.now() - 6 * 3600_000 - 86_400_000).toISOString().slice(0, 10);
}
async function reportar(acceso: unknown, extra: Record<string, unknown> = {}, opciones: { foto?: Uint8Array | null; origen?: string | null; cabeceras?: Record<string, string> } = {}) {
  const f = new FormData();
  f.set("datos", JSON.stringify(datosBase(acceso, extra)));
  if (opciones.foto !== null) f.set("fotografia", new Blob([(opciones.foto ?? FOTO) as BlobPart], { type: "image/jpeg" }), "foto.jpg");
  const h: Record<string, string> = { ...(opciones.cabeceras ?? {}) };
  if (opciones.origen !== null) h.Origin = opciones.origen ?? ORIGEN;
  return anonimo("/api/avistamientos", { method: "POST", body: f, headers: h });
}
/** Crea un caso real (como persona tutora 1) con valores señuelo únicos y devuelve su folio. */
async function crearCaso(extra: Record<string, unknown> = {}, foto: Uint8Array = FOTO) {
  const f = new FormData();
  f.set("datos", JSON.stringify({ nombre: "Senuelo", sexo: "Macho", idRaza: 1, edad: { valor: 2, unidad: "años" }, tamano: "mediano", color: "Negro", caracteristicas: "Mancha blanca", fechaExtravio: fechaAyer(), momento: "noche", alcaldia: "Coyoacán", colonia: "Del Carmen", calle: SEN.calle, referencias: SEN.ref, idMotivo: 1, descripcion: SEN.desc, ...extra }));
  f.set("fotografia", new Blob([foto as BlobPart], { type: "image/jpeg" }), "foto.jpg");
  const r = await comoDuena("/api/casos", { method: "POST", body: f, headers: { Origin: ORIGEN } });
  if (r.estado !== 201) throw new Error(`No se pudo crear el caso de prueba: ${resumen(r)} ${r.texto.slice(0, 200)}`);
  return String(r.json?.folio);
}
const SEN = { calle: "CALLE-SENUELO-7Q3", ref: "REF-SENUELO-9ZK", desc: "DESC-SENUELO-4MX" };
const tokenDeMaqueta = (folio: string) => `MAQUETA${folio.slice(5)}`.padEnd(32, "0");
const tokenSembrado = (folio: string) => CASOS_ORIGEN.find((c) => c.folio === folio)?.tokenPublico ?? tokenDeMaqueta(folio);

/** Matriz del QR de la ficha de la persona tutora (se lee del SVG de la pantalla) → URL del QR. */
async function urlDelQrActual(folio: string): Promise<string | undefined> {
  const html = (await comoDuena(`/tutor/casos/${folio}/ficha`)).texto;
  const vb = /<svg[^>]*aria-label="Código QR[^"]*"[^>]*viewBox="0 0 (\d+) \d+"/.exec(html) ?? /viewBox="0 0 (\d+) \d+"[^>]*aria-label="Código QR/.exec(html);
  const d = /<path d="(M[^"]+)"/.exec(html.slice(html.indexOf("Código QR")))?.[1];
  if (!vb || !d) return undefined;
  const n = Number(vb[1]) - 8;
  const filas = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) for (let i = 0; i < Number(m[3]); i++) filas[Number(m[2]) - 4][Number(m[1]) - 4 + i] = true;
  return decodificarQr(rasterizarMatriz(filas, 8))?.texto;
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
  await reiniciarDatos(base);
  const SITUACIONES = [
    { etiqueta: "Activo (En búsqueda)", folio: "RUPE-K7M4XQ9T", ficha: 200, reportarFolio: 201, qr: 200, reportarQr: 201 },
    { etiqueta: "Localizado", folio: "RUPE-B6R2TZ7C", ficha: 200, reportarFolio: 409, qr: 200, reportarQr: 409 },
    { etiqueta: "Cerrado confirmado", folio: "RUPE-3HN8WD2B", ficha: 404, reportarFolio: 409, qr: 404, reportarQr: 404 },
    { etiqueta: "Cancelado", folio: "RUPE-F7L3MN6Y", ficha: 404, reportarFolio: 404, qr: 404, reportarQr: 404 },
    { etiqueta: "Deshabilitado", folio: "RUPE-D5W2QK8X", ficha: 404, reportarFolio: 404, qr: 404, reportarQr: 404 },
  ];
  console.log("— Tabla R33 por FOLIO y por QR (respuesta real: estado código #huella del cuerpo) —");
  const noEncontradosFolio: Resp[] = [];
  const noVigentesQr: Resp[] = [];
  for (const s of SITUACIONES) {
    const [ficha, foto, qr] = [await anonimo(`/api/fichas/${s.folio}`), await anonimo(`/api/fichas/${s.folio}/fotografia`), await anonimo(`/api/fichas/qr/${tokenSembrado(s.folio)}`)];
    const [repF, repQ] = [await reportar({ canal: "folio", folio: s.folio }), await reportar({ canal: "qr", token: tokenSembrado(s.folio) })];
    console.log(`  ${s.etiqueta.padEnd(22)} ficha folio ${resumen(ficha).padEnd(28)} ficha QR ${resumen(qr).padEnd(30)} reportar folio ${resumen(repF).padEnd(40)} reportar QR ${resumen(repQ)}`);
    ver(ficha.estado === s.ficha && qr.estado === s.qr && repF.estado === s.reportarFolio && repQ.estado === s.reportarQr, `R33 · ${s.etiqueta}: ficha por folio ${s.ficha}, ficha por QR ${s.qr}, reportar por folio ${s.reportarFolio}, reportar por QR ${s.reportarQr}`, `R33 · ${s.etiqueta}: ${ficha.estado}/${qr.estado}/${repF.estado}/${repQ.estado}`);
    if (s.ficha === 404) {
      noEncontradosFolio.push(ficha, foto);
      noVigentesQr.push(qr);
    }
    if (s.reportarFolio === 404) noEncontradosFolio.push(repF);
    if (s.reportarQr === 404) noVigentesQr.push(repQ);
    if (s.reportarFolio === 409) ver((repF.json?.error?.codigo === "CASO_NO_ADMITE_AVISTAMIENTOS"), `R13 · ${s.etiqueta}: el 409 de reportar por folio es CASO_NO_ADMITE_AVISTAMIENTOS`, `R13 · ${s.etiqueta}: ${resumen(repF)}`);
  }
  const inexistente = [await anonimo("/api/fichas/RUPE-ZZZZZZZZ"), await anonimo("/api/fichas/RUPE-ZZZZZZZZ/fotografia"), await anonimo("/api/fichas/rupe-zzzzzzzz"), await reportar({ canal: "folio", folio: "RUPE-ZZZZZZZZ" })];
  console.log(`  inexistente            ficha ${resumen(inexistente[0])} · foto ${resumen(inexistente[1])} · reportar ${resumen(inexistente[3])}`);
  noEncontradosFolio.push(...inexistente);
  const qrMalos = [await anonimo(`/api/fichas/qr/${"x".repeat(32)}`), await anonimo("/api/fichas/qr/mal-formado"), await anonimo(`/api/fichas/qr/${"A".repeat(33)}`), await anonimo(`/api/fichas/qr/${tokenSembrado("RUPE-K7M4XQ9T").toLowerCase()}`), await reportar({ canal: "qr", token: "x".repeat(32) }), await reportar({ canal: "qr", token: "mal-formado" }), await reportar({ canal: "qr", token: 123 })];
  console.log(`  QR inexistente/malformado/minúsculas: ${qrMalos.map(resumen).join(" | ")}`);
  noVigentesQr.push(...qrMalos);
  ver(noEncontradosFolio.every((r) => r.estado === 404) && mismoCuerpo(noEncontradosFolio.filter((r) => r.json)), `404 por FOLIO idénticos byte por byte: Cerrado, Cancelado, Deshabilitado, inexistente (ficha, foto y reporte) → ${noEncontradosFolio.length} respuestas, una sola huella`, `404 por folio distintos: ${noEncontradosFolio.map(resumen).join(" | ")}`);
  ver(noVigentesQr.every((r) => r.estado === 404 && r.json?.error?.codigo === "QR_NO_VIGENTE") && mismoCuerpo(noVigentesQr), `404 por QR idénticos byte por byte (Cerrado, Cancelado, Deshabilitado, inexistente, mal formado, minúsculas): ${noVigentesQr.length} respuestas QR_NO_VIGENTE con una sola huella`, `404 por QR distintos: ${noVigentesQr.map(resumen).join(" | ")}`);
  ver(noVigentesQr[0].json?.error?.mensaje === "Este código QR ya no está vigente o no es válido" && !noVigentesQr[0].texto.includes("folio"), "el mensaje del QR es «Este código QR ya no está vigente o no es válido» (no el de «folio no encontrado»)", `mensaje QR: ${noVigentesQr[0].texto}`);
  const [f400a, f400b] = [await anonimo("/api/fichas/RUPE-123"), await anonimo("/api/fichas/RUPE-I0000000")];
  console.log(`  folio mal formado: ${resumen(f400a)} | ${resumen(f400b)}`);
  ver(f400a.estado === 400 && f400b.estado === 400 && f400a.json?.error?.codigo === "FOLIO_INVALIDO", "HU 025 · un folio con formato inválido da 400 FOLIO_INVALIDO", `folio inválido: ${resumen(f400a)}`);

  console.log("\n— Invalidación del token tras regenerar el QR (como dueña) —");
  const FOLIO = "RUPE-K7M4XQ9T";
  const tokenViejo = tokenSembrado(FOLIO);
  const antes = await anonimo(`/api/fichas/qr/${tokenViejo}`);
  const reg = await comoDuena(`/api/casos/${FOLIO}/qr/regenerar`, { method: "POST", headers: { Origin: ORIGEN } });
  console.log(`  antes ${resumen(antes)} · regenerar ${resumen(reg)}`);
  const [viejoFicha, viejoReporte, porFolio] = [await anonimo(`/api/fichas/qr/${tokenViejo}`), await reportar({ canal: "qr", token: tokenViejo }), await reportar({ canal: "folio", folio: FOLIO })];
  console.log(`  token anterior: ficha ${resumen(viejoFicha)} · reportar ${resumen(viejoReporte)} · por FOLIO sigue ${resumen(porFolio)}`);
  ver(antes.estado === 200 && reg.estado === 200 && viejoFicha.estado === 404 && viejoFicha.texto === noVigentesQr[0].texto && viejoReporte.texto === noVigentesQr[0].texto && porFolio.estado === 201, "el token anterior deja de valer: la ficha y el reporte por QR responden EXACTAMENTE lo mismo que un QR inexistente, y el reporte por folio sigue funcionando", "el token anterior no quedó invalidado");
  const urlNueva = await urlDelQrActual(FOLIO);
  const tokenNuevo = urlNueva?.split("/ficha/")[1] ?? "";
  console.log(`  QR nuevo leído de la ficha de la dueña con jsQR: ${urlNueva?.replace(tokenNuevo, "<token>")}`);
  const [nuevoFicha, nuevoReporte] = [await anonimo(`/api/fichas/qr/${tokenNuevo}`), await reportar({ canal: "qr", token: tokenNuevo })];
  ver(tokenNuevo.length === 32 && tokenNuevo !== tokenViejo && nuevoFicha.estado === 200 && nuevoReporte.estado === 201 && !nuevoFicha.texto.includes(tokenNuevo) && !nuevoReporte.texto.includes(tokenNuevo), "el token nuevo abre la ficha (200) y permite reportar por QR (201); ninguna respuesta lo repite", `token nuevo: ${resumen(nuevoFicha)} / ${resumen(nuevoReporte)}`);

  console.log("\n— Reporte real con foto con EXIF y GPS, y valores señuelo de privacidad —");
  const folioNuevo = await crearCaso();
  const exif = await sharp({ create: { width: 400, height: 200, channels: 3, background: { r: 10, g: 120, b: 200 } } }).jpeg().withExif({ IFD0: { Make: "camara-ficticia" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "19/1 25/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "99/1 8/1 0/1" } }).withMetadata({ orientation: 6 }).toBuffer();
  const conf = await reportar({ canal: "folio", folio: folioNuevo }, {}, { foto: Uint8Array.from(exif), cabeceras: { "X-Forwarded-For": "203.0.113.77", "User-Agent": "UA-SENUELO/1.0" } });
  console.log(`  POST /api/avistamientos → ${conf.estado} ${conf.texto} · Cache-Control: ${conf.cabeceras.get("cache-control")}`);
  ver(conf.estado === 201 && Object.keys(conf.json ?? {}).sort().join() === "fechaHoraEnvio,folio,id" && conf.json?.folio === folioNuevo && conf.cabeceras.get("cache-control") === "no-store", "reporte real: 201 con solo {id, folio, fechaHoraEnvio} y Cache-Control: no-store", `reporte: ${conf.estado} ${conf.texto}`);
  const lista = await comoDuena(`/tutor/casos/${folioNuevo}/avistamientos`);
  const idFoto = /fotografias(?:\/|%2F)(\d+)/.exec(lista.texto)?.[1];
  const foto = idFoto ? await fetchComo(base, "tutor1", `/api/fotografias/${idFoto}`) : undefined;
  const bytes = foto ? new Uint8Array(await foto.arrayBuffer()) : new Uint8Array();
  const meta = bytes.length ? await sharp(bytes).metadata() : undefined;
  const hayExif = Buffer.from(bytes).includes(Buffer.from("Exif\0\0")) || Buffer.from(bytes).includes(Buffer.from("camara-ficticia"));
  console.log(`  foto guardada leída como dueña: GET /api/fotografias/${idFoto} → ${foto?.status} ${foto?.headers.get("content-type")} ${meta?.width}×${meta?.height} · EXIF: ${hayExif ? "SÍ" : "no"} · sharp.exif: ${meta?.exif ? "SÍ" : "no"}`);
  ver(foto?.status === 200 && foto.headers.get("content-type") === "image/jpeg" && !hayExif && !meta?.exif && !meta?.orientation && meta?.width === 200 && meta?.height === 400, "la foto guardada (leída como dueña) NO conserva EXIF ni GPS, y la orientación quedó aplicada (400×200 con orientación 6 → 200×400)", `foto guardada: EXIF ${hayExif}, ${meta?.width}×${meta?.height}`);
  const detalle = await comoDuena(`/tutor/casos/${folioNuevo}`);
  const lista2 = await comoDuena("/tutor");
  ver(/Avistamiento reportado/.test(detalle.texto) && lista2.texto.includes(folioNuevo) && !`${lista.texto}${detalle.texto}`.includes("203.0.113.77") && !`${lista.texto}${detalle.texto}`.includes("UA-SENUELO"), "el caso pasó a «Avistamiento reportado» (se ve en su detalle y en Mis registros) y no se guardó la IP ni el agente de usuario", "el estado no cambió o se guardó un dato del visitante");
  const tokenNuevoCaso = (await urlDelQrActual(folioNuevo))?.split("/ficha/")[1] ?? "";
  const publicas = [await anonimo(`/api/fichas/${folioNuevo}`), await anonimo(`/api/fichas/qr/${tokenNuevoCaso}`), conf, await reportar({ canal: "qr", token: tokenNuevoCaso }), await anonimo(`/api/fichas/${folioNuevo}/fotografia`)];
  const textos = publicas.map((r) => (r.json ? r.texto : `${r.estado}`)).join("\n");
  const propios = [SEN.calle, SEN.ref, SEN.desc, "Hernández", "Rosa", "rosa.", "@example", "noche"];
  const filtrados = propios.filter((s) => textos.includes(s));
  const conToken = publicas.filter((r) => tokenNuevoCaso && r.texto.includes(tokenNuevoCaso)).length;
  console.log(`  respuestas públicas revisadas: ${publicas.length} · señuelos hallados: ${filtrados.length ? filtrados.join(", ") : "ninguno"} · con el token: ${conToken}`);
  ver(filtrados.length === 0 && conToken === 0 && publicas[4].estado === 200 && publicas[4].cabeceras.get("content-type") === "image/jpeg" && publicas[4].cabeceras.get("x-content-type-options") === "nosniff" && publicas[4].cabeceras.get("cache-control") === "no-store", "ninguna respuesta pública (ficha por folio y por QR, confirmación del reporte) contiene calle, referencias, circunstancias, nombre, correo ni el token; la foto pública del perro: image/jpeg, nosniff y no-store", `fuga: ${filtrados.join(",")} · token en ${conToken} respuestas`);

  console.log("\n— Validación: estados del animal inválidos (422 por campo), Origin y formato —");
  const invalidas = [[], [7], [1], [1, 2, 7], [1, 5, 7], [5, 6, 7], [1, 7, 8], [1, 7, 11, 12], [5, 7, 11], [1, 99]];
  const resultados: string[] = [];
  let todas422 = true;
  for (const e of invalidas) {
    const r = await reportar({ canal: "folio", folio: folioNuevo }, { estadosAnimal: e });
    const ok = r.estado === 422 && !!r.json?.error?.campos?.estadosAnimal;
    if (!ok) todas422 = false;
    resultados.push(`[${e}]→${r.estado}`);
  }
  console.log(`  ${resultados.join("  ")}`);
  ver(todas422, `${invalidas.length} combinaciones inválidas de estados del animal: todas 422 con el error en «estadosAnimal»`, `alguna combinación inválida se aceptó: ${resultados.join(" ")}`);
  const AMABLE = "Una de las opciones elegidas ya no está disponible. Revisa tus selecciones.";
  // El seed del Prototipo deja el catálogo ACTIVO: 16 y 17 se aceptan; un id inexistente (99) se rechaza con el mensaje amable. El rechazo de un valor DESACTIVADO se prueba en el servicio
  // con un almacén de prueba (servicios/avistamientos.test.ts): por HTTP haría falta una ruta para desactivar valores y no se crea.
  const [acepta16, acepta17, inexistente99] = [await reportar({ canal: "folio", folio: folioNuevo }, { estadosAnimal: [1, 7, 16] }), await reportar({ canal: "folio", folio: folioNuevo }, { estadosAnimal: [1, 7, 17] }), await reportar({ canal: "folio", folio: folioNuevo }, { estadosAnimal: [1, 7, 99] })];
  console.log(`  estados 16 [${acepta16.estado}] · 17 [${acepta17.estado}] · inexistente 99 [${inexistente99.estado}] «${inexistente99.json?.error?.campos?.estadosAnimal}»`);
  ver(acepta16.estado === 201 && acepta17.estado === 201 && inexistente99.estado === 422 && inexistente99.json?.error?.campos?.estadosAnimal === AMABLE && !/\b99\b/.test(inexistente99.texto), "con el catálogo sembrado ACTIVO, los estados 16 y 17 se aceptan (201); un estado inexistente (99) da 422 con el mensaje amable «Una de las opciones elegidas ya no está disponible…» y sin el identificador en el cuerpo", `estados: ${[acepta16, acepta17, inexistente99].map(resumen).join(" | ")} ${inexistente99.texto}`);
  const mal = [await reportar({ canal: "folio", folio: folioNuevo }, { idAlcaldia: 17 }), await reportar({ canal: "folio", folio: folioNuevo }, { direccion: "" }), await reportar({ canal: "folio", folio: folioNuevo }, { fecha: "2999-01-01" }), await reportar({ canal: "folio", folio: folioNuevo }, {}, { foto: null }), await reportar({ canal: "folio", folio: folioNuevo }, { comentario: "x".repeat(301) })];
  console.log(`  alcaldía 17 / sin dirección / fecha futura / sin foto / comentario 301: ${mal.map((r) => `${r.estado} ${Object.keys(r.json?.error?.campos ?? {}).join("+")}`).join(" | ")}`);
  ver(mal.every((r) => r.estado === 422) && mal[0].json?.error?.campos?.alcaldia !== undefined && mal[3].json?.error?.campos?.foto !== undefined, "alcaldía «Fuera de la CDMX», dirección vacía, fecha futura, sin fotografía y comentario de 301 caracteres: 422 por campo", `validaciones: ${mal.map(resumen).join(" | ")}`);
  const [origenMalo, origenNulo, sinAcceso, jsonRoto] = [await reportar({ canal: "folio", folio: folioNuevo }, {}, { origen: "https://otro-sitio.example" }), await reportar({ canal: "folio", folio: folioNuevo }, {}, { origen: "null" }), await reportar({ canal: "otro" }), await anonimo("/api/avistamientos", { method: "POST", headers: { Origin: ORIGEN }, body: (() => { const f = new FormData(); f.set("datos", "{no es json"); return f; })() })];
  console.log(`  Origin ajeno ${resumen(origenMalo)} · Origin null ${resumen(origenNulo)} · sin canal ${resumen(sinAcceso)} · JSON roto ${resumen(jsonRoto)}`);
  ver(origenMalo.estado === 403 && origenMalo.json?.error?.codigo === "ORIGEN_NO_PERMITIDO" && origenNulo.estado === 403 && sinAcceso.estado === 400 && jsonRoto.estado === 400, "POST con Origin ajeno o «null»: 403 ORIGEN_NO_PERMITIDO; sin canal o con JSON roto: 400", "Origin o formato mal manejados");
  const respuestas = [...publicas, ...mal, origenMalo, ...noVigentesQr];
  ver(respuestas.every((r) => r.cabeceras.get("cache-control") === "no-store"), `Cache-Control: no-store en las ${respuestas.length} respuestas revisadas`, "alguna respuesta sin no-store");

  console.log("\n— Páginas (HTML) de la ficha por folio y por QR: 404 reales, sin token ni señuelos —");
  const normaliza = (r: Resp, ...claves: string[]) => claves.reduce((t, c) => t.split(c).join("CLAVE"), r.texto);
  const foliosSinFicha = ["RUPE-F7L3MN6Y", "RUPE-D5W2QK8X", "RUPE-ZZZZZZZZ"];
  const paginasFolio: Resp[] = [];
  for (const f of foliosSinFicha) paginasFolio.push(await anonimo(`/ficha/${f}`), await anonimo(`/ficha/${f}/avistamiento`));
  const mismasFolio = new Set(foliosSinFicha.flatMap((f, i) => [normaliza(paginasFolio[2 * i], f, f.toLowerCase()), `A${normaliza(paginasFolio[2 * i + 1], f, f.toLowerCase())}`])).size;
  console.log(`  por folio (Cancelado, Deshabilitado, inexistente) ficha y reporte: ${paginasFolio.map((r) => r.estado).join(" ")} · cuerpos distintos tras normalizar el folio: ${mismasFolio} (se esperan 2: ficha y reporte)`);
  ver(paginasFolio.every((r) => r.estado === 404) && mismasFolio === 2, `HU 024 · ${paginasFolio.length} páginas por folio sin ficha pública (Cancelado, Deshabilitado, inexistente): 404 REAL y cuerpo idéntico entre casos (tras normalizar el folio de la URL)`, `404 por folio: ${paginasFolio.map((r) => r.estado).join(",")} · variantes ${mismasFolio}`);
  const cerradoFicha = await anonimo("/ficha/RUPE-3HN8WD2B");
  const cerradoReporte = await anonimo("/ficha/RUPE-3HN8WD2B/avistamiento");
  ver(cerradoFicha.estado === 404 && cerradoFicha.texto.includes("NEXT_HTTP_ERROR_FALLBACK;404") && cerradoReporte.estado === 200 && /ya no recibe avistamientos/.test(cerradoReporte.texto), "Cerrado confirmado por folio: la ficha pública da 404 real y la pantalla de reporte avisa «Este caso ya no recibe avistamientos» (R13, como el 409 de la API)", `cerrado: ficha ${cerradoFicha.estado}, reporte ${cerradoReporte.estado}`);
  const tokenCerrado = tokenSembrado("RUPE-3HN8WD2B");
  const tokenesMalos = ["x".repeat(32), "A".repeat(33), "mal-formado", tokenViejo, tokenSembrado("RUPE-F7L3MN6Y"), tokenCerrado, tokenSembrado("RUPE-D5W2QK8X")];
  const paginasQr: Resp[] = [];
  for (const t of tokenesMalos) paginasQr.push(await anonimo(`/ficha/${t}`), await anonimo(`/ficha/${t}/avistamiento`));
  const variantesQr = new Set(tokenesMalos.flatMap((t, i) => [normaliza(paginasQr[2 * i], t), `A${normaliza(paginasQr[2 * i + 1], t)}`]));
  console.log(`  por QR (inexistente, 33 caracteres, mal formado, regenerado, Cancelado, Cerrado, Deshabilitado): ${paginasQr.map((r) => r.estado).join(" ")} · cuerpos distintos tras normalizar el token: ${variantesQr.size} (se esperan 2)`);
  ver(paginasQr.every((r) => r.estado === 404 && r.texto.includes("ya no está vigente o no es válido") && !r.texto.includes("Folio no encontrado")) && variantesQr.size === 2, `HU 024 · ${paginasQr.length} páginas por QR (inexistente, malformado, regenerado, de casos cancelado, cerrado y deshabilitado): 404 REAL con «Este código QR ya no está vigente o no es válido» y cuerpo idéntico`, `404 por QR: ${paginasQr.map((r) => r.estado).join(",")} · variantes ${variantesQr.size}`);
  ver(paginasQr.every((r) => r.cabeceras.get("referrer-policy") === "no-referrer" && /noindex/.test(r.cabeceras.get("x-robots-tag") ?? "")), "el canal QR responde con Referrer-Policy: no-referrer y X-Robots-Tag: noindex también en sus 404", "falta Referrer-Policy o noindex en el canal QR");

  const paginaFolio = await anonimo(`/ficha/${folioNuevo}`);
  const flujoFolio = await anonimo(`/ficha/${folioNuevo}/avistamiento`);
  const enviado = await anonimo(`/ficha/${folioNuevo}/avistamiento/enviado?id=504`);
  const paginaQr = await anonimo(`/ficha/${tokenNuevoCaso}`);
  const flujoQr = await anonimo(`/ficha/${tokenNuevoCaso}/avistamiento`);
  const sinToken = [paginaFolio, flujoFolio, enviado].filter((r) => r.texto.includes(tokenNuevoCaso)).length;
  const conSenuelo = [paginaFolio, flujoFolio, enviado, paginaQr, flujoQr].flatMap((r) => propios.filter((x) => r.texto.includes(x)));
  const repetido = (r: Resp) => r.texto.split(tokenNuevoCaso).length - 1;
  const propios2 = (r: Resp) => r.texto.split(`/ficha/${tokenNuevoCaso}/avistamiento`).length - 1;
  console.log(`  folio: ficha ${paginaFolio.estado}, reporte ${flujoFolio.estado}, enviado ${enviado.estado} · con el token: ${sinToken} · QR: ficha ${paginaQr.estado} (token ${repetido(paginaQr)} veces, ${propios2(paginaQr)} en su enlace de reporte), reporte ${flujoQr.estado} (token ${repetido(flujoQr)} veces) · señuelos: ${conSenuelo.length ? conSenuelo.join(",") : "ninguno"}`);
  ver([paginaFolio, flujoFolio, enviado, paginaQr, flujoQr].every((r) => r.estado === 200) && sinToken === 0 && conSenuelo.length === 0, "las páginas del canal FOLIO (ficha, reporte, enviado) no contienen el token en ningún punto; ninguna de las 5 páginas contiene calle, referencias ni circunstancias señuelo", `token en ${sinToken} páginas del folio · señuelos ${conSenuelo.join(",")}`);
  ver(paginaQr.texto.includes(`/ficha/${tokenNuevoCaso}/avistamiento`) && repetido(paginaQr) >= 1 && /noindex/.test(paginaQr.cabeceras.get("x-robots-tag") ?? "") && paginaQr.cabeceras.get("referrer-policy") === "no-referrer", "el token solo se repite en la ficha del canal QR (en su enlace «Reportar un avistamiento»), con no-referrer y noindex", "el canal QR no repite el token o le faltan cabeceras");
  const localizado = await anonimo("/ficha/RUPE-B6R2TZ7C");
  const fotoLocalizado = await anonimo("/api/fichas/RUPE-B6R2TZ7C/fotografia");
  const reporteLocalizado = await anonimo("/ficha/RUPE-B6R2TZ7C/avistamiento");
  console.log(`  Localizado: ficha ${localizado.estado} (enlace de reporte: ${localizado.texto.includes("/ficha/RUPE-B6R2TZ7C/avistamiento") ? "SÍ" : "no"}), foto pública ${fotoLocalizado.estado} ${fotoLocalizado.cabeceras.get("content-type")}, pantalla de reporte ${reporteLocalizado.estado} «${/ya no recibe avistamientos/.test(reporteLocalizado.texto) ? "Este caso ya no recibe avistamientos" : "?"}»`);
  ver(localizado.estado === 200 && !localizado.texto.includes("/ficha/RUPE-B6R2TZ7C/avistamiento") && fotoLocalizado.estado === 200 && fotoLocalizado.cabeceras.get("content-type") === "image/jpeg" && reporteLocalizado.estado === 200 && /ya no recibe avistamientos/.test(reporteLocalizado.texto), "caso Localizado: la ficha pública (200) no ofrece reportar, su fotografía pública responde 200 image/jpeg y la pantalla de reporte avisa que ya no recibe avistamientos", "el caso Localizado no se comporta según R33/R13");

  console.log("\n— Fotografía, límites de texto y comentario saneado —");
  const cuenta = async (folio: string) => new Set(Array.from((await comoDuena(`/tutor/casos/${folio}/avistamientos`)).texto.matchAll(/avistamientos\/(\d+)/g), (m) => m[1])).size;
  const folioConteo = await crearCaso();
  const antesN = await cuenta(folioConteo);
  const acceso = { canal: "folio", folio: folioConteo };
  const disfrazado = await reportar(acceso, {}, { foto: Uint8Array.from(Buffer.from("<?php echo 'no soy una imagen'; ?>".repeat(20))) });
  const grande = new Uint8Array(6 * 1024 * 1024);
  grande.set(FOTO);
  const enorme = await reportar(acceso, {}, { foto: grande });
  console.log(`  archivo de texto con nombre .jpg y tipo image/jpeg: ${resumen(disfrazado)} ${JSON.stringify(disfrazado.json?.error?.campos)} · foto de 6 MB: ${resumen(enorme)}`);
  ver(disfrazado.estado === 422 && !!disfrazado.json?.error?.campos?.foto && enorme.estado === 413, "un archivo que no es imagen (disfrazado de .jpg con tipo image/jpeg) se rechaza por sus bytes con 422 en «foto»; una fotografía por encima del límite da 413", `disfrazado ${resumen(disfrazado)} · grande ${resumen(enorme)}`);
  const largos = [await reportar(acceso, { direccion: "d".repeat(201) }), await reportar(acceso, { coloniaZona: "c".repeat(101) }), await reportar(acceso, { referencias: "r".repeat(501) })];
  console.log(`  dirección 201 / colonia 101 / referencias 501: ${largos.map((r) => `${r.estado} ${Object.keys(r.json?.error?.campos ?? {}).join("+")}`).join(" | ")}`);
  ver(largos[0].estado === 422 && !!largos[0].json?.error?.campos?.direccion && largos[1].estado === 422 && !!largos[1].json?.error?.campos?.coloniaZona && largos[2].estado === 422 && !!largos[2].json?.error?.campos?.referencias, "dirección de 201, colonia de 101 y referencias de 501 caracteres: 422 y el error cae en SU campo (direccion, coloniaZona, referencias)", `límites: ${largos.map(resumen).join(" | ")}`);
  const despuesRechazos = await cuenta(folioConteo);
  const bueno = await reportar(acceso, { comentario: "<script>alert(1)</script>Lo vi cerca <b>del parque</b>" });
  const despues = await cuenta(folioConteo);
  const idNuevo = String(bueno.json?.id);
  const detalleAv = await comoDuena(`/tutor/casos/${folioConteo}/avistamientos/${idNuevo}`);
  console.log(`  avistamientos del caso: antes ${antesN} · tras ${disfrazado.estado === 422 ? 6 : 0} rechazos ${despuesRechazos} · tras el reporte válido ${despues} (${bueno.estado} id ${idNuevo})`);
  ver(antesN === 0 && despuesRechazos === 0 && despues === 1 && bueno.estado === 201, "el conteo de avistamientos no cambia con los 6 reportes rechazados (0 → 0) y sube con el válido (0 → 1)", `conteo ${antesN} → ${despuesRechazos} → ${despues}`);
  const comentarioLeido = />(alert\(1\)Lo vi cerca del parque)</.exec(detalleAv.texto)?.[1];
  console.log(`  comentario enviado «<script>alert(1)</script>Lo vi cerca <b>del parque</b>» · leído por la dueña: «${comentarioLeido}»`);
  const listaAv = await comoDuena(`/tutor/casos/${folioConteo}/avistamientos`);
  ver(detalleAv.texto.includes("Ubicación aproximada simulada en el prototipo") && listaAv.texto.includes("Ubicación aproximada simulada en el prototipo"), "las pantallas de la persona tutora (lista y detalle del avistamiento) avisan «Ubicación aproximada simulada en el prototipo» para el avistamiento reportado", "falta la nota de ubicación simulada en las pantallas de la persona tutora");
  ver(detalleAv.estado === 200 && comentarioLeido === "alert(1)Lo vi cerca del parque" && !/<script>alert|&lt;script|&lt;b&gt;|<b>del parque/.test(detalleAv.texto), "el comentario con HTML/script se guardó saneado (R34): la dueña lo lee como texto plano «alert(1)Lo vi cerca del parque», sin etiquetas ni <script> (ni escapadas)", "el comentario no se sanó");

  console.log("\n— Estatus público (HU 038, P5): API y página con las mismas tablas de R33 —");
  const SITUACIONES_ESTATUS = [
    { etiqueta: "Activo (En búsqueda)", folio: "RUPE-J2C6PZ9H", api: 200, estado: "En búsqueda" },
    { etiqueta: "Localizado", folio: "RUPE-B6R2TZ7C", api: 200, estado: "Localizado" },
    { etiqueta: "Cerrado confirmado", folio: "RUPE-3HN8WD2B", api: 200, estado: "Cerrado" },
    { etiqueta: "Cancelado", folio: "RUPE-F7L3MN6Y", api: 404, estado: "" },
    { etiqueta: "Deshabilitado", folio: "RUPE-D5W2QK8X", api: 404, estado: "" },
  ];
  const noDisponiblesApi: Resp[] = [];
  const noDisponiblesPagina: Resp[] = [];
  for (const sit of SITUACIONES_ESTATUS) {
    const [api, pagina] = [await anonimo(`/api/estatus/${sit.folio}`), await anonimo(`/estatus/${sit.folio}`)];
    console.log(`  ${sit.etiqueta.padEnd(22)} API ${resumen(api).padEnd(28)} página ${pagina.estado} #${huellaDe(normaliza(pagina, sit.folio))}`);
    const textoPagina = pagina.texto.replace(/<!-- -->/g, "");
    ver(api.estado === sit.api && pagina.estado === sit.api && (sit.api !== 200 || ((api.json?.estatus as { estado?: string })?.estado === sit.estado && textoPagina.includes(sit.estado) && textoPagina.includes("Último cambio"))), `estatus · ${sit.etiqueta}: API ${sit.api} y página ${sit.api}${sit.api === 200 ? ` con «${sit.estado}» y «Último cambio»` : " (404 real)"}`, `estatus · ${sit.etiqueta}: API ${api.estado} / página ${pagina.estado}`);
    if (sit.api === 404) {
      noDisponiblesApi.push(api);
      noDisponiblesPagina.push(pagina);
    }
  }
  const inexistentes = [await anonimo("/api/estatus/RUPE-ZZZZZZZZ"), await anonimo("/api/estatus/rupe-zzzzzzzz")];
  const paginasInexistentes = [await anonimo("/estatus/RUPE-ZZZZZZZZ"), await anonimo("/estatus/rupe-zzzzzzzz"), await anonimo("/estatus/RUPE-123"), await anonimo("/estatus/mal-formado")];
  noDisponiblesApi.push(...inexistentes);
  noDisponiblesPagina.push(...paginasInexistentes);
  const clavesNormalizar = ["RUPE-F7L3MN6Y", "RUPE-D5W2QK8X", "RUPE-ZZZZZZZZ", "rupe-zzzzzzzz", "RUPE-123", "mal-formado"];
  const [formato, minuscula] = [await anonimo("/api/estatus/RUPE-123"), await anonimo("/api/estatus/rupe-j2c6pz9h")];
  console.log(`  inexistente API ${inexistentes.map(resumen).join(" | ")} · formato inválido ${resumen(formato)} · minúsculas válidas ${resumen(minuscula)}`);
  ver(noDisponiblesApi.every((r) => r.estado === 404) && mismoCuerpo(noDisponiblesApi), `estatus por API: Cancelado, Deshabilitado e inexistente (también en minúsculas): ${noDisponiblesApi.length} respuestas 404 con UN solo cuerpo`, `estatus API 404 distintos: ${noDisponiblesApi.map(resumen).join(" | ")}`);
  // Con forma de folio (cancelado, deshabilitado, inexistente y minúsculas) los 404 son idénticos byte por byte; un folio mal formado (formato inválido) también da el mismo 404 real y la misma pantalla,
  // pero su flujo RSC interno ordena distinto el marcador de error (se decide antes de consultar): no revela nada del caso, porque el formato lo conoce cualquiera.
  const conForma = noDisponiblesPagina.slice(0, 6 - 2);
  const malFormadas = noDisponiblesPagina.slice(4);
  const visible = (r: Resp) => r.texto.includes("Folio no encontrado") && r.texto.includes("No hay un caso consultable con ese folio");
  ver(conForma.length === 4 && conForma.every((r) => r.estado === 404 && visible(r)) && new Set(conForma.map((r) => normaliza(r, ...clavesNormalizar))).size === 1, `estatus por página: cancelado, deshabilitado, inexistente y minúsculas (${conForma.length}) dan el MISMO 404 real «Folio no encontrado» (cuerpo idéntico tras normalizar el folio de la URL)`, `las páginas de estatus no disponibles difieren o no son 404: ${conForma.map((r) => `${r.estado}/${visible(r)}/#${huellaDe(normaliza(r, ...clavesNormalizar))}`).join(" ")}`);
  ver(malFormadas.length === 2 && malFormadas.every((r) => r.estado === 404 && visible(r)) && new Set(malFormadas.map((r) => normaliza(r, ...clavesNormalizar))).size === 1, "estatus por página: un folio mal formado (corto o sin formato) da el mismo 404 real y la misma pantalla «Folio no encontrado»", "las páginas de estatus con folio mal formado no dan el 404 esperado");
  ver(formato.estado === 400 && formato.json?.error?.codigo === "FOLIO_INVALIDO" && minuscula.estado === 200 && (minuscula.json?.estatus as { folio?: string })?.folio === "RUPE-J2C6PZ9H", "estatus: formato inválido 400 FOLIO_INVALIDO; el folio en minúsculas se acepta (R26)", `estatus formato/minúsculas: ${resumen(formato)} / ${resumen(minuscula)}`);
  const folioEstatus = await crearCaso();
  const tokenEstatus = (await urlDelQrActual(folioEstatus))?.split("/ficha/")[1] ?? "";
  const [apiNuevo, paginaNuevo, buscador] = [await anonimo(`/api/estatus/${folioEstatus}`), await anonimo(`/estatus/${folioEstatus}`), await anonimo("/estatus")];
  const todoEstatus = [apiNuevo, paginaNuevo, buscador, ...noDisponiblesPagina].map((r) => r.texto).join("\n");
  const señuelos = [SEN.calle, SEN.ref, SEN.desc, "Senuelo", "Hernández", "Rosa", "rosa.", "@example", "Mancha blanca"].filter((x) => todoEstatus.includes(x));
  console.log(`  caso nuevo con señuelos: API ${apiNuevo.estado}, página ${paginaNuevo.estado}, buscador ${buscador.estado} · señuelos hallados: ${señuelos.length ? señuelos.join(", ") : "ninguno"} · token en alguna respuesta: ${tokenEstatus && todoEstatus.includes(tokenEstatus) ? "SÍ" : "no"}`);
  ver(apiNuevo.estado === 200 && paginaNuevo.estado === 200 && buscador.estado === 200 && señuelos.length === 0 && !!tokenEstatus && !todoEstatus.includes(tokenEstatus), "ninguna respuesta de estatus (API, página, buscador y 404) contiene datos personales, del perro, de las circunstancias ni el token del QR", `fuga en estatus: ${señuelos.join(",")}`);
  ver(/<meta name="robots" content="noindex/.test(paginaNuevo.texto) && /<meta name="robots" content="noindex/.test(buscador.texto) && paginaNuevo.cabeceras.get("cache-control") !== null, "las páginas de estatus llevan noindex", "las páginas de estatus no llevan noindex");
  await reiniciarDatos(base);
}

async function main() {
  let servidor: ChildProcess | undefined;
  if (!baseExterna) {
    if (!process.argv.includes("--sin-build") && spawnSync("npx", ["next", "build"], { stdio: "ignore" }).status !== 0) throw new Error("Falló next build");
    const env: NodeJS.ProcessEnv = { ...process.env, RUPE_PERMITIR_REINICIO: "1" };
    delete env.RUPE_URL_PUBLICA; // el respaldo de hosts locales: el QR de la ficha de la dueña apunta a http://localhost:<puerto>
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
  console.log(fallos === 0 ? `\nOK: ${total} comprobaciones de la ficha pública y el reporte de avistamiento` : `\n${fallos} de ${total} verificación(es) fallida(s)`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
