// Detector general de imágenes rotas (P4): recorre las pantallas principales con fotografías, con sesión REAL de la persona tutora donde hace falta, y falla si alguna <img> VISIBLE tiene naturalWidth 0
// (p. ej. una foto protegida que pasó por el optimizador de Next sin `unoptimized`). Vale con las fotos reales y con el respaldo del maquetado (SVG).
// Opciones: --sin-build reutiliza el build · --base=URL usa un servidor que ya corre.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { CASOS_ORIGEN, FOLIO_EN_CURSO } from "../src/mocks/casos";
import { agregarSesion, reiniciarDatos } from "./sesion-pruebas";

const PUERTO = 3138;
const baseExterna = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1];
const base = baseExterna ?? `http://localhost:${PUERTO}`;
let fallos = 0;
let total = 0;
const ver = (ok: boolean, bien: string, mal: string) => {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${ok ? bien : mal}`);
};

const NALA = "RUPE-Y9F4LK2E"; // En seguimiento: avistamientos 101 a 104 visibles (102 «Fallecido»)
const TOBY = "RUPE-B6R2TZ7C"; // Localizado
const MAX = FOLIO_EN_CURSO;
const TOKEN_MAX = CASOS_ORIGEN.find((c) => c.folio === MAX)!.tokenPublico;

type Pantalla = { ruta: string; rol: "tutor1" | null; etiqueta: string };
const PANTALLAS: Pantalla[] = [
  { ruta: "/", rol: null, etiqueta: "Inicio" },
  { ruta: `/ficha/${MAX}`, rol: null, etiqueta: "Ficha pública por folio" },
  { ruta: `/ficha/${TOKEN_MAX}`, rol: null, etiqueta: "Ficha pública por QR" },
  { ruta: `/ficha/${TOBY}`, rol: null, etiqueta: "Ficha pública de un caso Localizado" },
  { ruta: `/ficha/${MAX}/avistamiento`, rol: null, etiqueta: "Reportar avistamiento (paso 1)" },
  { ruta: "/tutor", rol: "tutor1", etiqueta: "Mis registros" },
  { ruta: `/tutor/casos/${MAX}`, rol: "tutor1", etiqueta: "Detalle del caso" },
  { ruta: `/tutor/casos/${NALA}`, rol: "tutor1", etiqueta: "Detalle de un caso con avistamientos" },
  { ruta: `/tutor/casos/${MAX}/ficha`, rol: "tutor1", etiqueta: "Ficha de búsqueda" },
  { ruta: `/tutor/casos/${NALA}/avistamientos`, rol: "tutor1", etiqueta: "Listado de avistamientos" },
  { ruta: `/tutor/casos/${NALA}/avistamientos/101`, rol: "tutor1", etiqueta: "Detalle de un avistamiento" },
  { ruta: `/tutor/casos/${NALA}/avistamientos/102?foto=visible`, rol: "tutor1", etiqueta: "Detalle del avistamiento «Fallecido» con la foto revelada" },
];

/** Recorre la página para que carguen las imágenes diferidas y devuelve las <img> visibles que no cargaron (naturalWidth 0). */
async function imagenesRotas(p: Page): Promise<{ visibles: number; rotas: string[] }> {
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await p.waitForFunction(() => [...document.images].filter((i) => i.checkVisibility()).every((i) => i.complete), undefined, { timeout: 15000 }).catch(() => undefined);
  return p.evaluate(() => {
    const visibles = [...document.images].filter((i) => i.checkVisibility());
    return { visibles: visibles.length, rotas: visibles.filter((i) => i.naturalWidth === 0).map((i) => `${i.getAttribute("alt") ?? "(sin alt)"} → ${(i.getAttribute("src") ?? "").slice(0, 70)}`) };
  });
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
async function abrirNavegador(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch {
    return await chromium.launch({ channel: "chrome" });
  }
}

async function pruebas(navegador: Browser) {
  await reiniciarDatos(base);
  for (const ancho of [390, 1280]) {
    const sesiones = new Map<string, BrowserContext>();
    for (const rol of [null, "tutor1"] as const) {
      const contexto = await navegador.newContext({ viewport: { width: ancho, height: 900 } });
      if (rol) await agregarSesion(contexto, base, rol);
      sesiones.set(String(rol), contexto);
    }
    for (const pantalla of PANTALLAS) {
      const pagina = await sesiones.get(String(pantalla.rol))!.newPage();
      await pagina.goto(`${base}${pantalla.ruta}`, { waitUntil: "load" });
      const r = await imagenesRotas(pagina);
      ver(r.rotas.length === 0, `${pantalla.etiqueta} (${ancho} px): ${r.visibles} imagen(es) visible(s), todas cargan`, `${pantalla.etiqueta} (${ancho} px): imagen(es) rota(s) → ${r.rotas.join(" | ")}`);
      await pagina.close();
    }
    for (const c of sesiones.values()) await c.close();
  }
  await reiniciarDatos(base);
}

async function main() {
  let servidor: ChildProcess | undefined;
  if (!baseExterna) {
    if (!process.argv.includes("--sin-build") && spawnSync("npx", ["next", "build"], { stdio: "ignore" }).status !== 0) throw new Error("Falló next build");
    servidor = spawn("npx", ["next", "start", "-p", String(PUERTO)], { stdio: "ignore", detached: true, env: { ...process.env, RUPE_PERMITIR_REINICIO: "1" } });
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
  console.log(fallos === 0 ? `\nOK: ${total} pantallas sin imágenes rotas` : `\n${fallos} de ${total} pantalla(s) con imágenes rotas`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
