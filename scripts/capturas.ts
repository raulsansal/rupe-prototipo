// Captura las rutas de capturas.config.ts en cada ancho y tema → capturas/<ruta>_<ancho>_<tema>.png
// Levanta el servidor por sí mismo (build + start) y lo apaga al terminar.
// Opciones: --sin-build  reutiliza el build existente en .next
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { ALTO_VENTANA, ANCHOS, PUERTO, RUTAS, TEMAS } from "../capturas.config";
import { CLAVE_TEMA } from "../src/lib/tema";

const raiz = process.cwd();
const salida = join(raiz, "capturas");
const base = `http://localhost:${PUERTO}`;
const nombreArchivo = (ruta: string, ancho: number, tema: string) =>
  `${ruta.replace(/^\/+|\/+$/g, "").replace(/\//g, "-") || "inicio"}_${ancho}_${tema}.png`;

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
    // Playwright no trae Chromium para algunos sistemas (p. ej. macOS 13): se usa Google Chrome instalado.
    return await chromium.launch({ channel: "chrome" });
  }
}

async function main() {
  if (!process.argv.includes("--sin-build")) {
    const r = spawnSync("npx", ["next", "build"], { stdio: "inherit", cwd: raiz });
    if (r.status !== 0) throw new Error("Falló next build");
  }
  mkdirSync(salida, { recursive: true });

  const servidor = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
    cwd: raiz,
    stdio: "ignore",
    detached: true, // grupo propio para poder apagar también al proceso hijo
  });
  const apagar = () => {
    try {
      if (servidor.pid) process.kill(-servidor.pid);
    } catch {
      // ya terminó
    }
  };
  process.on("SIGINT", () => {
    apagar();
    process.exit(130);
  });

  let navegador: Browser | undefined;
  try {
    await esperarServidor(servidor);
    navegador = await abrirNavegador();
    for (const ruta of RUTAS) {
      for (const ancho of ANCHOS) {
        for (const tema of TEMAS) {
          const valor = tema === "oscuro" ? "dark" : "light";
          const contexto = await navegador.newContext({ viewport: { width: ancho, height: ALTO_VENTANA } });
          await contexto.addInitScript(([clave, v]) => localStorage.setItem(clave, v), [CLAVE_TEMA, valor]);
          const pagina = await contexto.newPage();
          await pagina.goto(`${base}${ruta}`, { waitUntil: "networkidle" });
          await pagina.evaluate(() => document.fonts.ready);
          const archivo = nombreArchivo(ruta, ancho, tema);
          await pagina.screenshot({ path: join(salida, archivo), fullPage: true });
          console.log(`✓ capturas/${archivo}`);
          await contexto.close();
        }
      }
    }
  } finally {
    await navegador?.close();
    apagar();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
