// Comprueba en el navegador que cada logotipo de /dev/fundaciones se ve, en cada tema.
// Por cada logotipo: imagen visible con naturalWidth > 0 y tamaño > 0, y solo una versión
// (primario u oscuro) visible a la vez, la que corresponde al tema más cercano.
// Opciones: --sin-build  reutiliza el build existente en .next
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { CLAVE_TEMA } from "../src/lib/tema";

const PUERTO = 3101;
const base = `http://localhost:${PUERTO}`;
const raiz = process.cwd();

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
    return await chromium.launch({ channel: "chrome" }); // sin Chromium de Playwright (p. ej. macOS 13)
  }
}

type Resultado = { src: string; temaEfectivo: string; visible: boolean; naturalWidth: number; ancho: number; alto: number };

async function main() {
  if (!process.argv.includes("--sin-build")) {
    if (spawnSync("npx", ["next", "build"], { stdio: "inherit", cwd: raiz }).status !== 0) throw new Error("Falló next build");
  }
  const servidor = spawn("npx", ["next", "start", "-p", String(PUERTO)], { cwd: raiz, stdio: "ignore", detached: true });
  const apagar = () => {
    try {
      if (servidor.pid) process.kill(-servidor.pid);
    } catch {
      // ya terminó
    }
  };
  let navegador: Browser | undefined;
  let fallos = 0;
  try {
    await esperarServidor(servidor);
    navegador = await abrirNavegador();
    for (const tema of ["light", "dark"]) {
      const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
      await contexto.addInitScript(([k, v]) => localStorage.setItem(k, v), [CLAVE_TEMA, tema]);
      const pagina = await contexto.newPage();
      await pagina.goto(`${base}/dev/fundaciones`, { waitUntil: "networkidle" });
      await pagina.waitForFunction(() => [...document.images].every((i) => i.complete || getComputedStyle(i).display === "none"));

      const imgs: Resultado[] = await pagina.evaluate(() =>
        [...document.querySelectorAll<HTMLImageElement>("img[src*='/brand/']")].map((i) => {
          const r = i.getBoundingClientRect();
          return {
            src: i.getAttribute("src") ?? "",
            temaEfectivo: i.closest("[data-theme]")?.getAttribute("data-theme") ?? "",
            visible: getComputedStyle(i).display !== "none" && r.width > 0 && r.height > 0,
            naturalWidth: i.naturalWidth,
            ancho: Math.round(r.width),
            alto: Math.round(r.height),
          };
        }),
      );

      const ver = (ok: boolean, msg: string) => {
        if (!ok) {
          fallos++;
          console.log(`✗ [html ${tema}] ${msg}`);
        }
      };
      // Pares: se recorren de a dos en el orden del DOM (primario, oscuro).
      const noBlancas = imgs.filter((r) => !r.src.endsWith("_blanco.svg"));
      for (let i = 0; i < noBlancas.length; i += 2) {
        const par = noBlancas.slice(i, i + 2);
        const visibles = par.filter((p) => p.visible);
        ver(visibles.length === 1, `${par[0].src}: ${visibles.length} versiones visibles (debe ser 1)`);
        for (const v of visibles) {
          ver(v.naturalWidth > 0, `${v.src}: naturalWidth = ${v.naturalWidth}`);
          ver(v.ancho > 0 && v.alto > 0, `${v.src}: tamaño ${v.ancho}×${v.alto}`);
          const esperado = v.temaEfectivo === "dark" ? "_oscuro.svg" : "_primario.svg";
          ver(v.src.endsWith(esperado), `${v.src}: en tema ${v.temaEfectivo} debía verse ${esperado}`);
        }
      }
      for (const b of imgs.filter((r) => r.src.endsWith("_blanco.svg"))) {
        ver(b.visible && b.naturalWidth > 0 && b.ancho > 0 && b.alto > 0, `${b.src}: no visible o sin cargar`);
      }
      console.log(`html ${tema}: ${imgs.length} imágenes de logotipo revisadas (${noBlancas.length / 2} logotipos por tema + ${imgs.length - noBlancas.length} blancos)`);
      await contexto.close();
    }
  } finally {
    await navegador?.close();
    apagar();
  }
  console.log(fallos === 0 ? "OK: todos los logotipos se ven y solo una versión está visible" : `${fallos} fallo(s)`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
