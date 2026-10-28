// Verifica el PDF REAL de la ficha de búsqueda (HU 019 a 023, 026 y 027) con next start y un navegador (pdf.js rasteriza, jsQR decodifica el QR IMPRESO):
//  · los casos sembrados en curso (Max, Luna, Nala, Coco, Bruno, Mia y Duque), un caso nuevo y los peores casos de texto, en Carta y Media carta: 200, application/pdf, página de tamaño exacto;
//  · el QR del PDF rasterizado se lee con jsQR como <base>/ficha/<token> (base larga, ≈ 70 caracteres), en versión ≤ 5: BLOQUEANTE a 300 y a 150 ppp con el 100 % de lecturas (casos HTTP y un conjunto DETERMINISTA
//    de tokens por hoja, con los que alguna vez fallaron); a 112 y 75 ppp solo se INFORMA la tasa con una muestra más amplia; se informa el módulo impreso;
//  · tras regenerar el QR, el PDF lleva un token distinto (el anterior ya no es el vigente) y el enlace para compartir (folio) no cambia;
//  · Localizado y Cerrado dan 409 y no hay PDF.
// Opciones: --sin-build · --base=URL (servidor que ya corre con RUPE_PERMITIR_REINICIO=1 y RUPE_URL_PUBLICA=https://nombre-largo.vercel.app) · --imagenes=carpeta guarda cada hoja como imagen de página completa.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, type Browser } from "playwright";
import QRCode from "qrcode";
import sharp from "sharp";
import { QR_SIMBOLO_CM, type TamanoHoja } from "../src/lib/ficha/composicion";
import { decodificarQr } from "../src/server/pruebas/pdf";
import { ESCENARIOS, registrar, usarImagenDePrueba } from "./ficha-peores-casos";
import { generarFichaPdf } from "../src/server/pdf/generarFichaPdf";
import { matrizQr, urlDelQr } from "../src/server/qr/matrizQr";
import { rasterizarPdf, rasterizarPdfVarios } from "./lib/rasterizarPdf";
import { TOKENS_FIJOS, tokensDeterministas } from "./lib/tokensQr";
import { fetchComo, reiniciarDatos } from "./sesion-pruebas";

const PUERTO = 3113;
const BASE_PUBLICA = "https://nombre-largo.vercel.app"; // base larga: la URL del QR mide ≈ 70 caracteres con la ruta y el token
const baseExterna = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1];
const base = baseExterna ?? `http://localhost:${PUERTO}`;
const imagenes = process.argv.find((a) => a.startsWith("--imagenes="))?.split("=")[1];
const PT = { carta: [612, 792], "media-carta": [612, 396] } as const;
const SEMBRADOS = [["tutor1", "RUPE-K7M4XQ9T", "Max"], ["tutor1", "RUPE-P3H8WD5N", "Luna"], ["tutor1", "RUPE-Y9F4LK2E", "Nala"], ["tutor1", "RUPE-H4TQ7V2M", "Coco"], ["tutor1", "RUPE-N8D5GX3W", "Bruno"], ["tutor2", "RUPE-J2C6PZ9H", "Mia"], ["tutor2", "RUPE-G8R4TV3K", "Duque"]] as const;
const NO_ACTIVOS = [["tutor1", "RUPE-B6R2TZ7C", "Toby (Localizado)"], ["tutor1", "RUPE-C2J9RK6Z", "Lola (Localizado)"], ["tutor1", "RUPE-3HN8WD2B", "Rocky (Cerrado)"], ["tutor2", "RUPE-D5W2QK8X", "Kira (Cerrado por deshabilitación)"], ["tutor2", "RUPE-F7L3MN6Y", "Simba (Cerrado por cancelación)"]] as const;
let versionMaxima = 0;
const informativo = { reescalado: { ok: 0, total: 0 } };
let fallos = 0;
let total = 0;
const ver = (ok: boolean, bien: string, mal: string) => {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${ok ? bien : mal}`);
};

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

async function abrirNavegador(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch {
    return await chromium.launch({ channel: "chrome" });
  }
}

async function rgba(png: Buffer, escala = 1) {
  let img = sharp(png).removeAlpha().ensureAlpha();
  if (escala !== 1) {
    const m = await sharp(png).metadata();
    img = sharp(await img.resize(Math.round(m.width! * escala), undefined, { kernel: "linear" }).png().toBuffer()).ensureAlpha();
  }
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), ancho: info.width, alto: info.height };
}

type Leido = { token: string; version: number; modulo: number };
async function leerQr(navegador: Browser, pdf: Uint8Array, tamano: TamanoHoja, nombreImagen?: string): Promise<{ resultados: Record<string, Leido | undefined>; paginas: number; pt: [number, number] }> {
  const a300 = await rasterizarPdf(navegador, pdf, 300);
  const a150 = await rasterizarPdf(navegador, pdf, 150);
  if (imagenes && nombreImagen) writeFileSync(`${imagenes}/${nombreImagen}.png`, a150.png);
  const intentos: [string, Awaited<ReturnType<typeof rgba>>][] = [["300 ppp", await rgba(a300.png)], ["150 ppp", await rgba(a150.png)], ["reescalado a la baja (150 ppp × 0,75)", await rgba(a150.png, 0.75)]];
  const resultados: Record<string, Leido | undefined> = {};
  for (const [nombre, img] of intentos) {
    const r = decodificarQr(img);
    const url = r?.texto ?? "";
    const m = new RegExp(`^${BASE_PUBLICA.replaceAll(".", "\\.")}/ficha/([A-Za-z0-9]{32})$`).exec(url);
    // La versión real sale de la URL decodificada (qrcode la calcula igual que al generar el PDF); la que estima jsQR de una imagen rasterizada puede variar.
    const version = m ? QRCode.create(url, { errorCorrectionLevel: "M" }).version : 0;
    versionMaxima = Math.max(versionMaxima, version);
    resultados[nombre] = m ? { token: m[1], version, modulo: (QR_SIMBOLO_CM[tamano] * 10) / (17 + 4 * version) } : undefined;
  }
  return { resultados, paginas: a150.paginas, pt: [a150.ptAncho, a150.ptAlto] };
}


const PPP = [300, 150, 112, 75] as const;
const MUESTRA = 150; // tokens deterministas por hoja (además de TOKENS_FIJOS)
/**
 * Lectura del QR con un conjunto FIJO de tokens (semilla fija + los que alguna vez fallaron): no depende del azar de la corrida. BLOQUEANTE: 300 y 150 ppp con el 100 % de lecturas por hoja.
 * INFORMATIVO (no bloquea): la tasa a 112 y 75 ppp con la misma muestra, que es más ancha que la de los casos HTTP.
 */
async function qrDeterminista(navegador: Browser) {
  const ficha = { nombre: "Max", sexo: "Macho", raza: "Mestizo/No identificada", edad: "11 años", tamano: "Mediano", color: "Café con blanco", caracteristicasDistintivas: "Mancha blanca en el pecho", fechaExtravio: "2026-10-26", coloniaZona: "Del Valle Centro", alcaldia: "Benito Juárez", folio: "RUPE-K7M4XQ9T" };
  const tokens = [...TOKENS_FIJOS, ...tokensDeterministas(MUESTRA)];
  for (const hoja of ["carta", "media-carta"] as const) {
    const ok: Record<number, number> = { 300: 0, 150: 0, 112: 0, 75: 0 };
    const malos: Record<number, string[]> = { 300: [], 150: [], 112: [], 75: [] };
    const versiones = new Set<number>();
    for (const token of tokens) {
      const url = urlDelQr(BASE_PUBLICA, token);
      const m = matrizQr(url);
      versiones.add(m.version);
      const pdf = await generarFichaPdf({ ficha, fechaLarga: "26 de octubre de 2026", dominio: "nombre-largo.vercel.app", tamano: hoja, qr: m, ahora: new Date("2026-10-26T12:00:00Z") });
      const pngs = await rasterizarPdfVarios(navegador, pdf, [...PPP]);
      for (let k = 0; k < PPP.length; k++) {
        if (decodificarQr(await rgba(pngs[k]))?.texto === url) ok[PPP[k]]++;
        else malos[PPP[k]].push(`${token} (v${m.version})`);
      }
    }
    const n = tokens.length;
    for (const p of [300, 150]) ver(ok[p] === n, `QR determinista · ${hoja} · ${p} ppp: ${n}/${n} lecturas (100 %, ${TOKENS_FIJOS.length} tokens fijos + ${MUESTRA} de semilla fija; versiones ${[...versiones].sort().join(", ")})`, `QR determinista · ${hoja} · ${p} ppp: ${ok[p]}/${n}; fallan: ${malos[p].slice(0, 5).join(", ")}`);
    console.log(`  ℹ ${hoja}: tasa de lectura a 112 ppp ${((ok[112] / n) * 100).toFixed(1)} % y a 75 ppp ${((ok[75] / n) * 100).toFixed(1)} % (${n} tokens; informativo, no bloquea)${malos[112].length ? `; fallan a 112: ${malos[112].slice(0, 3).join(", ")}` : ""}`);
  }
}

async function pdfDe(rol: "tutor1" | "tutor2", folio: string, hoja: TamanoHoja) {
  const r = await fetchComo(base, rol, `/api/casos/${folio}/ficha?hoja=${hoja}`);
  return { estado: r.status, tipo: r.headers.get("content-type"), disposicion: r.headers.get("content-disposition"), bytes: new Uint8Array(await r.arrayBuffer()) };
}

async function main() {
  let servidor: ChildProcess | undefined;
  if (!baseExterna) {
    if (!process.argv.includes("--sin-build") && spawnSync("npx", ["next", "build"], { stdio: "inherit" }).status !== 0) throw new Error("Falló next build");
    servidor = spawn("npx", ["next", "start", "-p", String(PUERTO)], { stdio: "ignore", detached: true, env: { ...process.env, RUPE_PERMITIR_REINICIO: "1", RUPE_URL_PUBLICA: BASE_PUBLICA } });
  }
  const apagar = () => {
    try {
      if (servidor?.pid) process.kill(-servidor.pid);
    } catch {
      // ya terminó
    }
  };
  let navegador: Browser | undefined;
  try {
    if (servidor) await esperarServidor(servidor);
    await reiniciarDatos(base);
    navegador = await abrirNavegador();
    if (imagenes) mkdirSync(imagenes, { recursive: true });
    const fichaPagina = await navegador.newPage();
    await usarImagenDePrueba(fichaPagina, 800, 1000);
    await fichaPagina.close();

    // 1) Casos sembrados en curso, un caso nuevo y los peores casos: ambos tamaños.
    const casos: { rol: "tutor1" | "tutor2"; folio: string; etiqueta: string; imagen?: string }[] = SEMBRADOS.map(([rol, folio, nombre]) => ({ rol, folio, etiqueta: nombre }));
    const nuevo = await registrar(base, ESCENARIOS[0]);
    casos.push({ rol: "tutor1", folio: nuevo, etiqueta: "caso nuevo (normal)", imagen: "normal" });
    const peor = await registrar(base, ESCENARIOS[2]);
    casos.push({ rol: "tutor1", folio: peor, etiqueta: "peor caso de texto", imagen: "peor-caso" });
    const sinEspacios = await registrar(base, ESCENARIOS[4]);
    casos.push({ rol: "tutor1", folio: sinEspacios, etiqueta: "textos sin espacios", imagen: "sin-espacios" });
    for (const c of casos) for (const hoja of ["carta", "media-carta"] as const) {
      const r = await pdfDe(c.rol, c.folio, hoja);
      const cab = r.estado === 200 && r.tipo === "application/pdf" && r.disposicion === `attachment; filename="ficha-${c.folio}-${hoja}.pdf"` && Buffer.from(r.bytes.slice(0, 5)).toString() === "%PDF-";
      ver(cab, `${c.etiqueta} · ${hoja}: 200 application/pdf con nombre ficha-<FOLIO>-${hoja}.pdf (${(r.bytes.length / 1024).toFixed(0)} KB)`, `${c.etiqueta} · ${hoja}: HTTP ${r.estado} ${r.tipo} ${r.disposicion}`);
      if (!cab) continue;
      const q = await leerQr(navegador, r.bytes, hoja, c.imagen ? `p3-pdf-${hoja}-${c.imagen}` : undefined);
      ver(q.paginas === 1 && q.pt[0] === PT[hoja][0] && q.pt[1] === PT[hoja][1], `${c.etiqueta} · ${hoja}: una página de ${PT[hoja][0]}×${PT[hoja][1]} pt exactos`, `${c.etiqueta} · ${hoja}: ${q.paginas} página(s) de ${q.pt.join("×")}`);
      for (const [nombre, l] of Object.entries(q.resultados)) {
        if (nombre.startsWith("reescalado")) {
          informativo.reescalado.total++;
          if (l) informativo.reescalado.ok++;
          continue; // no bloqueante: la tasa a baja resolución se informa aparte
        }
        ver(!!l && l.version <= 5, `${c.etiqueta} · ${hoja}: el QR impreso se lee con jsQR a ${nombre} como <base>/ficha/<token> (versión ${l?.version})`, `${c.etiqueta} · ${hoja}: no se pudo leer el QR a ${nombre} o su versión pasa de 5`);
      }
    }
    const n = 17 + 4 * versionMaxima;
    console.log(`\n  ℹ QR con base larga (URL de 70 caracteres): versión máxima encontrada ${versionMaxima} (${n} módulos; según el contenido del token sale 4 o 5); módulo impreso mínimo: Carta ${((QR_SIMBOLO_CM.carta * 10) / n).toFixed(2)} mm, Media carta ${((QR_SIMBOLO_CM["media-carta"] * 10) / n).toFixed(2)} mm`);
    ver(versionMaxima <= 5, "la versión del QR no pasa de 5 (37 módulos), la del cálculo del tamaño impreso", `la versión del QR llegó a ${versionMaxima}`);

    // 2) Regenerar: el PDF cambia de token y el enlace para compartir (folio) no.
    const antes = await leerQr(navegador, (await pdfDe("tutor1", "RUPE-K7M4XQ9T", "carta")).bytes, "carta");
    const reg = await fetchComo(base, "tutor1", "/api/casos/RUPE-K7M4XQ9T/qr/regenerar", { method: "POST", headers: { Origin: new URL(base).origin } });
    const despues = await leerQr(navegador, (await pdfDe("tutor1", "RUPE-K7M4XQ9T", "carta")).bytes, "carta");
    const t0 = antes.resultados["300 ppp"]?.token;
    const t1 = despues.resultados["300 ppp"]?.token;
    ver(reg.status === 200 && !!t0 && !!t1 && t0 !== t1, "regenerar el QR: el PDF siguiente lleva un token distinto (el del PDF anterior ya no es el vigente)", `regenerar: HTTP ${reg.status}, tokens ${t0} / ${t1}`);
    const pagina = await fetchComo(base, "tutor1", "/tutor/casos/RUPE-K7M4XQ9T/ficha");
    const html = await pagina.text();
    ver(html.includes(`${BASE_PUBLICA}/ficha/RUPE-K7M4XQ9T`) && !html.includes(t0!) && !html.includes(t1!), "el enlace para compartir lleva el FOLIO (no cambia al regenerar) y la pantalla no imprime ningún token", "la pantalla de la ficha: el enlace con el folio falta o aparece un token");

    // 2b) Conjunto determinista de tokens: 300 y 150 ppp bloqueantes; 112 y 75 ppp informativos.
    await qrDeterminista(navegador);
    console.log(`  ℹ Reescalado a 112 ppp en los PDF de los casos HTTP: ${informativo.reescalado.ok}/${informativo.reescalado.total} lecturas (informativo)`);

    // 3) Localizado y Cerrado: 409, sin PDF.
    for (const [rol, folio, etiqueta] of NO_ACTIVOS) {
      const r = await pdfDe(rol, folio, "carta");
      ver(r.estado === 409 && r.tipo?.includes("json") === true, `${etiqueta}: 409 y no hay PDF`, `${etiqueta}: HTTP ${r.estado} ${r.tipo}`);
    }
  } finally {
    await reiniciarDatos(base);
    await navegador?.close();
    apagar();
  }
  console.log(fallos === 0 ? `\nOK: ${total} comprobaciones del PDF de la ficha` : `\n${fallos} de ${total} verificación(es) fallida(s)`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
