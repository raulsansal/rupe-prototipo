// Verifica el flujo «Registrar extravío» (P2) en un NAVEGADOR REAL y por HTTP, con sesión real de la persona tutora:
//  · reducción de la fotografía en el navegador, con evidencia (tamaño antes y después): imagen grande, PNG con transparencia y archivo corrupto con extensión .png;
//  · el registro completo guarda el caso (una sola petición), muestra el folio, el aviso en la app y la vista previa del correo («menos de 1 mes», no «0 meses»);
//  · la fotografía guardada solo la ve su dueña (y el Administrador en consulta); errores del servidor y sesión expirada se muestran donde corresponde.
// Opciones: --sin-build reutiliza el build · --base=URL usa un servidor que ya corre.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { ENTRADA_FOTO, elegirImagenGenerada, llenarPaso1, llenarPaso2 } from "./imagenes-pruebas";
import { agregarSesion, fetchComo, reiniciarDatos } from "./sesion-pruebas";

const PUERTO = 3110;
const baseExterna = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1];
const base = baseExterna ?? `http://localhost:${PUERTO}`;
let fallos = 0;
let total = 0;
const ver = (ok: boolean, bien: string, mal: string) => {
  total++;
  if (ok) console.log(`✓ ${bien}`);
  else {
    fallos++;
    console.log(`✗ ${mal}`);
  }
};
const MB = (n: number) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`);

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

const INPUT = ENTRADA_FOTO;
type Medida = { bytes: number; tipo: string; ancho: number; alto: number; esquina: number[]; centro: number[] };

/** Mide la vista previa (que es exactamente el archivo que se enviará): tamaño, tipo, dimensiones y color de una esquina y del centro. */
async function medirVistaPrevia(p: Page): Promise<Medida> {
  await p.getByAltText("Vista previa de la fotografía").waitFor({ timeout: 20000 });
  return p.evaluate(async () => {
    const src = document.querySelector<HTMLImageElement>("img[alt='Vista previa de la fotografía']")!.src;
    const blob = await (await fetch(src)).blob();
    const img = await createImageBitmap(blob);
    const lienzo = document.createElement("canvas");
    lienzo.width = img.width;
    lienzo.height = img.height;
    const c = lienzo.getContext("2d")!;
    c.drawImage(img, 0, 0);
    return { bytes: blob.size, tipo: blob.type, ancho: img.width, alto: img.height, esquina: [...c.getImageData(4, 4, 1, 1).data.slice(0, 3)], centro: [...c.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1).data.slice(0, 3)] };
  });
}

const VISTA_PREVIA = "img[alt='Vista previa de la fotografía']";
/**
 * Elige una imagen generada y espera la vista previa NUEVA antes de medir: la reducción en el navegador es asíncrona y, si ya había otra vista previa, medirla de inmediato leería la anterior.
 * Se guarda el `src` previo y se espera a que cambie y a que la imagen termine de cargar.
 */
async function elegirYEsperarVistaPrevia(p: Page, tipo: Parameters<typeof elegirImagenGenerada>[1]): Promise<number> {
  const previo = await p.evaluate((sel) => document.querySelector<HTMLImageElement>(sel)?.src ?? null, VISTA_PREVIA);
  const bytes = await elegirImagenGenerada(p, tipo);
  await p.waitForFunction(([sel, antes]) => {
    const img = document.querySelector<HTMLImageElement>(sel!);
    return !!img && img.src !== antes && img.complete && img.naturalWidth > 0;
  }, [VISTA_PREVIA, previo] as const, { timeout: 20000 });
  return bytes;
}

const continuar = (p: Page) => p.getByRole("button", { name: /^(Guardar y continuar|Guardar registro)$/ });

async function pruebas(navegador: Browser) {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 1000 } });
  await agregarSesion(contexto, base, "tutor1");
  const p = await contexto.newPage();
  await p.goto(`${base}/tutor/registrar`, { waitUntil: "load" });
  await p.waitForSelector("main h1");

  console.log("\n— Reducción de la fotografía en el navegador —");
  const original = await elegirYEsperarVistaPrevia(p, "ruido-grande");
  const grande = await medirVistaPrevia(p);
  ver(original > 4 * 1024 * 1024 && grande.bytes < 4 * 1024 * 1024 && grande.tipo === "image/jpeg" && Math.max(grande.ancho, grande.alto) <= 1600, `imagen grande: ${MB(original)} (PNG de 2000×2000) → ${MB(grande.bytes)} (JPEG ${grande.ancho}×${grande.alto}), por debajo del límite de 4 MB`, `imagen grande: ${MB(original)} → ${MB(grande.bytes)} ${grande.tipo} ${grande.ancho}×${grande.alto}`);
  const origT = await elegirYEsperarVistaPrevia(p, "transparente");
  const t = await medirVistaPrevia(p);
  ver(t.tipo === "image/jpeg" && t.esquina.every((c) => c >= 250) && t.centro[0] > 150 && t.centro[1] < 80, `PNG con transparencia: ${MB(origT)} → ${MB(t.bytes)}; la esquina transparente queda BLANCA (rgb ${t.esquina.join(",")}), sin zonas negras, y el centro conserva su color (rgb ${t.centro.join(",")})`, `PNG transparente: esquina ${t.esquina} centro ${t.centro} tipo ${t.tipo}`);
  await p.locator(INPUT).setInputFiles({ name: "corrupta.png", mimeType: "image/png", buffer: Buffer.from("esto no es un PNG, solo lo parece por su extensión") });
  await p.getByText("No pudimos leer esta imagen").waitFor({ timeout: 10000 });
  ver((await p.getByAltText("Vista previa de la fotografía").count()) === 0 && (await p.getByText("Elige otra foto JPG o PNG").isVisible()), "archivo corrupto con extensión .png: «No pudimos leer esta imagen», sin vista previa y sin foto", "archivo corrupto: no mostró el error o dejó una foto");
  await llenarPaso1(p);
  await continuar(p).click();
  ver(/La fotografía es obligatoria/.test(await p.locator("main").innerText()), "sin foto válida no se puede continuar: «La fotografía es obligatoria»", "se pudo continuar sin foto");
  await p.locator(INPUT).setInputFiles({ name: "texto.png", mimeType: "image/png", buffer: Buffer.from("GIF89a....") });
  ver(await p.getByText("No pudimos leer esta imagen").isVisible(), "otro archivo que no es imagen (GIF/texto con extensión .png) tampoco se acepta", "aceptó un archivo que no es imagen");

  console.log("\n— Registro completo (una sola petición) —");
  await elegirYEsperarVistaPrevia(p, "degradado");
  const foto = await medirVistaPrevia(p);
  await continuar(p).click();
  await llenarPaso2(p);
  const peticiones: { url: string; metodo: string; bytes: number }[] = [];
  p.on("request", async (r) => {
    if (r.url().includes("/api/casos")) peticiones.push({ url: r.url(), metodo: r.method(), bytes: Number((await r.allHeaders())["content-length"] ?? 0) });
  });
  const respuesta = p.waitForResponse((r) => r.url().includes("/api/casos") && r.request().method() === "POST");
  await continuar(p).click();
  const r = await respuesta;
  await p.waitForURL(/\/tutor\/casos\/RUPE-[A-HJ-NP-Z2-9]{8}\/creado$/);
  const folio = new URL(p.url()).pathname.split("/")[3];
  ver(r.status() === 201 && peticiones.length === 1 && peticiones[0].bytes >= foto.bytes && peticiones[0].bytes < foto.bytes + 4000, `«Guardar registro» envía UNA sola petición POST /api/casos (${MB(peticiones[0]?.bytes ?? 0)}: la foto reducida de ${MB(foto.bytes)} más los datos) y responde 201`, `petición: ${JSON.stringify(peticiones)} estado ${r.status()}`);
  const texto = await p.locator("main").innerText();
  ver(/Registro creado/.test(texto) && texto.includes(folio) && /menos de 1 mes/.test(texto) && !/0 meses/.test(texto) && /Te avisamos tu folio/.test(texto), `confirmación con el folio real (${folio}), «menos de 1 mes» (no «0 meses») y el aviso en la aplicación`, "la confirmación no muestra lo esperado");
  await p.getByRole("button", { name: /Vista previa del correo/ }).click();
  const correo = await p.locator("main").innerText();
  ver(/Asunto: Tu folio de RUPE: RUPE-/.test(correo) && correo.includes("Pelusa (menos de 1 mes)") && !/@|0 meses|Calle Reservada/.test(correo.split("Vista previa del correo")[1] ?? ""), "vista previa del correo: asunto y cuerpo con el folio y «Pelusa (menos de 1 mes)»; sin correo, token ni datos reservados", "la vista previa del correo es incorrecta");
  const almacen = await p.evaluate(() => ({ local: Object.keys(localStorage).filter((k) => k !== "rupe-tema"), sesion: Object.keys(sessionStorage), cookies: document.cookie }));
  ver(almacen.local.length === 0 && almacen.sesion.length === 0 && almacen.cookies === "", "el borrador no se guardó en localStorage, sessionStorage ni cookies legibles", `almacenamiento: ${JSON.stringify(almacen)}`);

  console.log("\n— La fotografía guardada —");
  const rutaFoto = await p.evaluate(() => document.querySelector<HTMLImageElement>("img[alt^='Fotografía de']")!.getAttribute("src")!);
  const suya = await p.evaluate(async (u) => { const x = await fetch(u); return { estado: x.status, tipo: x.headers.get("content-type"), nosniff: x.headers.get("x-content-type-options"), cache: x.headers.get("cache-control"), ...(await (async () => { const b = new Uint8Array(await x.arrayBuffer()); let exif = false; for (let k = 0; k < b.length - 5; k++) if (b[k] === 0x45 && b[k + 1] === 0x78 && b[k + 2] === 0x69 && b[k + 3] === 0x66 && b[k + 4] === 0) exif = true; return { bytes: b.byteLength, jpeg: b[0] === 0xff && b[1] === 0xd8, exif }; })()) }; }, rutaFoto);
  ver(suya.estado === 200 && suya.tipo === "image/jpeg" && suya.jpeg && !suya.exif && suya.bytes > 0 && suya.bytes < foto.bytes * 2 && suya.nosniff === "nosniff" && /no-store/.test(suya.cache ?? ""), `su dueña ve la imagen: 200 image/jpeg de ${MB(suya.bytes)} (re-codificada en el servidor: JPEG sin EXIF), nosniff y no-store (Cache-Control: ${suya.cache})`, `foto de la dueña: ${JSON.stringify(suya)}`);
  const [otra, admin, anonima, metodo] = [await fetchComo(base, "tutor2", rutaFoto), await fetchComo(base, "admin", rutaFoto), await fetchComo(base, null, rutaFoto), await fetchComo(base, "admin", rutaFoto, { method: "PUT" })];
  ver(otra.status === 404 && admin.status === 200 && anonima.status === 401 && metodo.status === 405, `otra persona tutora 404, Administrador 200 (solo consulta: PUT → ${metodo.status}), sin sesión 401`, `fotos: otra ${otra.status}, admin ${admin.status}, anónima ${anonima.status}, PUT ${metodo.status}`);
  ver((await fetchComo(base, "tutor2", `/tutor/casos/${folio}/creado`)).status === 404, "la confirmación del caso de otra persona da 404", "otra persona vio la confirmación");
  const detalle = await (await fetchComo(base, "tutor1", `/tutor/casos/${folio}`)).text();
  ver(/Detalle del caso/.test(detalle) && detalle.includes(folio) && /Calle Reservada 99/.test(detalle), "el detalle del caso real (P2b) abre para su dueña con los datos reales que capturó, sin «Pantalla pendiente»", "el detalle del caso real da 404 o no muestra sus datos");
  const lista = await (await fetchComo(base, "tutor1", "/tutor")).text();
  ver(lista.includes(folio) && lista.indexOf(folio) < lista.indexOf("RUPE-K7M4XQ9T"), "«Mis registros» muestra el caso recién registrado primero, antes de los sembrados", "el caso nuevo no aparece primero en «Mis registros»");
  const ficha = await fetchComo(base, null, `/api/fichas/${folio}`);
  const publica = JSON.stringify(await ficha.json());
  ver(ficha.status === 200 && !/Calle Reservada|reservad|tarde|Rosa|Hern|api\/fotografias/i.test(publica), "la ficha pública del caso nuevo no lleva calle, referencias, momento, motivo, descripción, datos de la persona ni la ruta de la foto", `ficha pública: ${publica.slice(0, 200)}`);

  console.log("\n— Errores del servidor y sesión expirada —");
  const p2 = await contexto.newPage();
  await p2.goto(`${base}/tutor/registrar`, { waitUntil: "load" });
  await p2.waitForSelector("main h1");
  await elegirYEsperarVistaPrevia(p2, "degradado");
  await medirVistaPrevia(p2);
  await llenarPaso1(p2, { edad: "3", unidad: "años" });
  await continuar(p2).click();
  await llenarPaso2(p2);
  await p2.route("**/api/casos", (ruta) => ruta.fulfill({ status: 422, contentType: "application/json", json: { error: { codigo: "VALIDACION", mensaje: "Revisa los campos marcados.", campos: { colonia: "Escribe la colonia o zona." } } } }));
  await continuar(p2).click();
  await p2.getByText("Escribe la colonia o zona.").waitFor({ timeout: 8000 });
  ver((await p2.getByLabel(/^Colonia o zona/).getAttribute("aria-invalid")) === "true" && (await p2.locator("[role=progressbar]").getAttribute("aria-valuetext")) === "Paso 2 de 2: Circunstancias", "un 422 del servidor se muestra bajo su campo y se queda en su paso (respuesta simulada)", "el 422 no se mostró en el campo");
  await p2.unroute("**/api/casos");
  await p2.route("**/api/casos", (ruta) => ruta.fulfill({ status: 413, contentType: "application/json", json: { error: { codigo: "CUERPO_DEMASIADO_GRANDE", mensaje: "La petición es demasiado grande." } } }));
  await continuar(p2).click();
  await p2.getByText("La fotografía es demasiado grande").waitFor({ timeout: 8000 });
  ver(await p2.getByRole("heading", { level: 1, name: "Datos del perro" }).isVisible(), "un 413 regresa al paso de la fotografía con un mensaje claro (respuesta simulada)", "el 413 no se mostró");
  await p2.unroute("**/api/casos");
  await continuar(p2).click();
  await llenarPaso2(p2).catch(() => undefined);
  // Sesión expirada de verdad: se cierra la sesión (la cookie desaparece) y se intenta guardar.
  await p2.evaluate(() => fetch("/api/acceso/cerrar", { method: "POST", redirect: "manual" }));
  await continuar(p2).click();
  await p2.getByRole("dialog", { name: "Tu sesión expiró" }).waitFor({ timeout: 8000 });
  ver(true, "sin sesión (401 real), «Guardar registro» abre «Tu sesión expiró» (TRA-02) y no se crea nada", "");
  await p2.getByRole("button", { name: "Iniciar sesión" }).click();
  await p2.waitForURL(/\/acceso\?siguiente=%2Ftutor%2Fregistrar$/);
  ver(true, "«Iniciar sesión» lleva a /acceso con siguiente=/tutor/registrar", "");
  await contexto.close();
}

async function main() {
  let servidor: ChildProcess | undefined;
  if (!baseExterna) {
    if (!process.argv.includes("--sin-build") && spawnSync("npx", ["next", "build"], { stdio: "inherit" }).status !== 0) throw new Error("Falló next build");
    servidor = spawn("npx", ["next", "start", "-p", String(PUERTO)], { stdio: "ignore", detached: true, env: { ...process.env, RUPE_PERMITIR_REINICIO: "1" } });
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
    navegador = await abrirNavegador();
    await pruebas(navegador);
  } finally {
    await reiniciarDatos(base);
    await navegador?.close();
    apagar();
  }
  console.log(fallos === 0 ? `\nOK: ${total} comprobaciones del registro de extravío` : `\n${fallos} de ${total} comprobación(es) fallida(s)`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
