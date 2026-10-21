// Captura las rutas de capturas.config.ts en cada ancho y tema → capturas/<ruta>_<ancho>_<tema>.png
// Levanta el servidor por sí mismo (build + start) y lo apaga al terminar.
// Opciones: --sin-build  reutiliza el build existente en .next
//           --secciones=a,b  solo captura esas secciones (data-seccion) y omite las rutas completas
//           --rutas=/dev/plantillas  solo captura las entradas cuya ruta empiece con ese prefijo
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { ALTO_VENTANA, ANCHOS, PUERTO, RUTAS, TEMAS, type Captura } from "../capturas.config";
import { CLAVE_TEMA } from "../src/lib/tema";

const raiz = process.cwd();
const soloRutas = process.argv.find((a) => a.startsWith("--rutas="))?.split("=")[1];
const soloSecciones = process.argv.find((a) => a.startsWith("--secciones="))?.split("=")[1]?.split(",");
const salida = join(raiz, "capturas");
const base = `http://localhost:${PUERTO}`;
const nombreArchivo = (entrada: Captura, seccion: string | undefined, ancho: number, tema: string) => {
  const base = entrada.archivo ?? (entrada.ruta.split("?")[0].replace(/^\/+|\/+$/g, "").replace(/\//g, "-") || "inicio");
  return `${[base, seccion].filter(Boolean).join("_")}_${ancho}_${tema}.png`;
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
    // Playwright no trae Chromium para algunos sistemas (p. ej. macOS 13): se usa Google Chrome instalado.
    return await chromium.launch({ channel: "chrome" });
  }
}

/** Espera fuentes e imágenes; falla si alguna imagen visible no cargó (aprendizaje del Bloque 0). */
async function esperarRecursos(pagina: Page) {
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForFunction(() => [...document.images].every((i) => i.complete || getComputedStyle(i).display === "none"));
  const rotas = await pagina.evaluate(() =>
    [...document.images].filter((i) => getComputedStyle(i).display !== "none" && i.naturalWidth === 0).map((i) => i.getAttribute("src")),
  );
  if (rotas.length) throw new Error(`Imágenes sin cargar: ${rotas.join(", ")}`);
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
    for (const entrada of RUTAS) {
      const { ruta } = entrada;
      if (soloRutas && !ruta.startsWith(soloRutas)) continue;
      const secciones = soloSecciones ? entrada.secciones?.filter((x) => soloSecciones.includes(x)) : entrada.secciones;
      if (soloSecciones && !secciones?.length) continue;
      for (const ancho of entrada.anchos ?? ANCHOS) {
        for (const tema of TEMAS) {
          const valor = tema === "oscuro" ? "dark" : "light";
          const contexto = await navegador.newContext({ viewport: { width: ancho, height: ALTO_VENTANA } });
          await contexto.addInitScript(([clave, v]) => localStorage.setItem(clave, v), [CLAVE_TEMA, valor]);
          const pagina = await contexto.newPage();
          await pagina.goto(`${base}${ruta}`, { waitUntil: "load" });
          await esperarRecursos(pagina);
          for (const seccion of secciones ?? [undefined]) {
            const archivo = nombreArchivo(entrada, seccion, ancho, tema);
            const destino = join(salida, archivo);
            if (seccion) await pagina.locator(`[data-seccion="${seccion}"]`).screenshot({ path: destino });
            else await pagina.screenshot({ path: destino, fullPage: true });
            console.log(`✓ capturas/${archivo}`);
          }
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
