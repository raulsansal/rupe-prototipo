// Captura las rutas de capturas.config.ts en cada ancho y tema → capturas/<ruta>_<ancho>_<tema>.png
// Levanta el servidor por sí mismo (build + start) y lo apaga al terminar.
// En una corrida completa (sin --secciones ni --rutas) borra los PNG de capturas que ya no están en la configuración.
// Opciones: --sin-build  reutiliza el build existente en .next
//           --autoprueba  demuestra que la verificación de solapes falla con la captura defectuosa de TUT-05 «cerrado» y pasa con la corregida
//           --secciones=a,b  solo captura esas secciones (data-seccion) y omite las rutas completas
//           --rutas=/dev/plantillas  solo captura las entradas cuya ruta empiece con ese prefijo
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { ALTO_TELEFONO, ALTO_VENTANA, ANCHOS, PUERTO, RUTAS, TEMAS, type Captura } from "../capturas.config";
import { CLAVE_TEMA } from "../src/lib/tema";
import { agregarSesion, reiniciarDatos, rolDeRuta } from "./sesion-pruebas";

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
  await pagina.waitForFunction(() => [...document.images].every((i) => i.complete || !i.checkVisibility()));
  const rotas = await pagina.evaluate(() =>
    [...document.images].filter((i) => i.checkVisibility() && i.naturalWidth === 0).map((i) => i.getAttribute("src")),
  );
  if (rotas.length) throw new Error(`Imágenes sin cargar: ${rotas.join(", ")}`);
}

type Problema = string;
type Medicion = { barras: number; problemas: Problema[]; detalle: string };

/**
 * Mide por posiciones (en el estado real de la página, sin transformar nada) si alguna barra fija o pegajosa anclada abajo
 * queda sobre el contenido.
 *  - modo "pagina": la ventana ya mide lo que la página; la barra debe quedar pegada al borde inferior Y por debajo de todo
 *    el texto y los controles (nada de contenido bajo su borde superior), y la página no debe necesitar scroll.
 *  - modo "ventana": captura tipo pantalla de teléfono con un modal abierto; la barra va al fondo de la ventana y el modal
 *    debe quedar encima (el punto central de la barra y los controles del modal responden al modal, no a la barra).
 */
async function medirSolapes(pagina: Page, modo: "pagina" | "ventana"): Promise<Medicion> {
  return pagina.evaluate((modoActual) => {
    const barras = [...document.querySelectorAll<HTMLElement>("body *")].filter((el) => {
      if (el.closest("dialog")) return false; // un modal no es una barra
      if (el.getClientRects().length === 0) return false; // oculta (p. ej. la barra inferior desde 768 px)
      const cs = getComputedStyle(el);
      return (cs.position === "fixed" || cs.position === "sticky") && cs.bottom !== "auto" && cs.top === "auto";
    });
    const problemas: string[] = [];
    const detalle: string[] = [`ventana ${innerWidth}×${innerHeight}`, `alto de página ${document.documentElement.scrollHeight}`];
    for (const barra of barras) {
      const r = barra.getBoundingClientRect();
      const y0 = Math.round(r.top + scrollY);
      const y1 = Math.round(r.bottom + scrollY);
      const nombre = `${barra.tagName.toLowerCase()}[${barra.getAttribute("aria-label") ?? ""}]`;
      detalle.push(`${nombre} y=${y0}–${y1} (${getComputedStyle(barra).position})`);
      if (Math.abs(r.bottom - innerHeight) > 1.5) problemas.push(`${nombre} no queda pegada al borde inferior (termina en y=${y1} y la ventana mide ${innerHeight})`);
      if (modoActual === "pagina") {
        if (document.documentElement.scrollHeight > innerHeight + 1) problemas.push(`la página (${document.documentElement.scrollHeight} px) es más alta que la ventana (${innerHeight} px): la barra ${nombre} quedaría a media página en una captura completa`);
        const debajo = [...document.querySelectorAll<HTMLElement>("header *, main *, footer *")].filter((x) => !barra.contains(x) && x.children.length === 0 && (x.textContent ?? "").trim() !== "" && x.getBoundingClientRect().height > 0 && x.getBoundingClientRect().bottom > r.top + 1);
        if (debajo.length) problemas.push(`${nombre} cubre ${debajo.length} elemento(s) de texto, p. ej. «${debajo.slice(0, 3).map((x) => (x.textContent ?? "").trim().slice(0, 24)).join("», «")}»`);
      } else {
        const centro = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (centro && barra.contains(centro)) problemas.push(`${nombre} queda sobre el modal (el punto central de la barra responde a la barra)`);
        for (const c of document.querySelectorAll<HTMLElement>("dialog[open] button, dialog[open] a[href], dialog[open] input, dialog[open] textarea")) {
          const q = c.getBoundingClientRect();
          if (q.width <= 2 || q.height <= 2) continue;
          const golpe = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
          if (golpe && !c.contains(golpe) && !c.closest("label")?.contains(golpe)) problemas.push(`un control del modal («${(c.textContent ?? "").trim().slice(0, 24)}») queda cubierto por ${golpe.tagName.toLowerCase()}`);
        }
      }
    }
    return { barras: barras.length, problemas, detalle: detalle.join("; ") };
  }, modo);
}

/** Ajusta la ventana al alto del contenido: así la captura es una sola «pantalla» sin pintar más allá de la ventana. */
async function ajustarVentanaAlContenido(pagina: Page, ancho: number) {
  for (let i = 0; i < 5; i++) {
    const alto = await pagina.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
    if (alto === pagina.viewportSize()?.height) return;
    await pagina.setViewportSize({ width: ancho, height: alto });
    await pagina.waitForTimeout(120);
  }
}

/** Alto en píxeles de un PNG, leído de su cabecera (no se analiza la imagen). */
const altoPng = (png: Buffer) => png.readUInt32BE(20);

/**
 * Autoprueba de la verificación con el caso tutor-caso-cerrado a 390 px: la captura DEFECTUOSA (página completa sin ajustar la
 * ventana: la barra pegajosa queda a media página, sobre «Datos del perro») debe fallar, y la corregida debe pasar.
 */
async function autoprueba(navegador: Browser): Promise<boolean> {
  const ruta = RUTAS.find((r) => r.archivo === "tutor-caso-cerrado")!.ruta;
  const abrir = async () => {
    const contexto = await navegador.newContext({ viewport: { width: 390, height: ALTO_VENTANA } });
    await agregarSesion(contexto, base, "tutor1"); // la ruta es de la persona tutora
    const pagina = await contexto.newPage();
    await pagina.goto(`${base}${ruta}`, { waitUntil: "load" });
    await esperarRecursos(pagina);
    return { contexto, pagina };
  };
  let bien = true;
  const a = await abrir();
  const defectuosa = await medirSolapes(a.pagina, "pagina");
  console.log(`Versión defectuosa (${ruta}, ventana de ${ALTO_VENTANA} px, sin ajustar): ${defectuosa.detalle}`);
  for (const p of defectuosa.problemas) console.log(`  ✗ ${p}`);
  if (defectuosa.problemas.length === 0) {
    console.log("✗ la verificación NO detectó el defecto");
    bien = false;
  } else console.log(`✓ la verificación falla con la versión defectuosa (${defectuosa.problemas.length} problema(s))`);
  await a.contexto.close();
  const b = await abrir();
  await ajustarVentanaAlContenido(b.pagina, 390);
  const corregida = await medirSolapes(b.pagina, "pagina");
  console.log(`Versión corregida: ${corregida.detalle}`);
  if (corregida.problemas.length) {
    for (const p of corregida.problemas) console.log(`  ✗ ${p}`);
    bien = false;
  } else console.log("✓ la verificación pasa con la versión corregida (la barra queda pegada al final de la página y bajo todo el contenido)");
  await b.contexto.close();
  return bien;
}

const generadas = new Set<string>();

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
    if (process.argv.includes("--autoprueba")) {
      if (!(await autoprueba(navegador))) process.exitCode = 1;
      return;
    }
    for (const entrada of RUTAS) {
      const { ruta } = entrada;
      if (soloRutas && !ruta.startsWith(soloRutas)) continue;
      const secciones = soloSecciones ? entrada.secciones?.filter((x) => soloSecciones.includes(x)) : entrada.secciones;
      if (soloSecciones && !secciones?.length) continue;
      for (const ancho of entrada.anchos ?? ANCHOS) {
        for (const tema of TEMAS) {
          const valor = tema === "oscuro" ? "dark" : "light";
          const contexto = await navegador.newContext({ viewport: { width: ancho, height: entrada.ventana ? ALTO_TELEFONO : ALTO_VENTANA } });
          await contexto.addInitScript(([clave, v]) => localStorage.setItem(clave, v), [CLAVE_TEMA, valor]);
          const rol = entrada.rol !== undefined ? entrada.rol : rolDeRuta(ruta);
          if (rol) await agregarSesion(contexto, base, rol);
          const pagina = await contexto.newPage();
          await pagina.goto(`${base}${ruta}`, { waitUntil: "load" });
          await esperarRecursos(pagina);
          if (entrada.preparar) {
            await entrada.preparar(pagina, { base });
            await esperarRecursos(pagina);
          }
          for (const seccion of secciones ?? [undefined]) {
            const archivo = nombreArchivo(entrada, seccion, ancho, tema);
            generadas.add(archivo);
            const destino = join(salida, archivo);
            if (seccion) await pagina.locator(`[data-seccion="${seccion}"]`).screenshot({ path: destino });
            else if (entrada.ventana) {
              // Modal abierto: se captura la ventana visible (como una pantalla de teléfono), con la barra al fondo y el modal encima.
              const m = await medirSolapes(pagina, "ventana");
              if (m.problemas.length) throw new Error(`${archivo}: ${m.problemas.join("; ")} [${m.detalle}]`);
              const png = await pagina.screenshot({ path: destino });
              console.log(`✓ capturas/${archivo} (ventana ${ancho}×${altoPng(png)}; ${m.barras} barra(s) inferior(es) al fondo y el modal encima, sin solapes)`);
              continue;
            } else {
              // Página completa: la ventana se ajusta al alto de la página y se mide ANTES de capturar.
              await ajustarVentanaAlContenido(pagina, ancho);
              const m = await medirSolapes(pagina, "pagina");
              if (m.problemas.length) throw new Error(`${archivo}: ${m.problemas.join("; ")} [${m.detalle}]`);
              const png = await pagina.screenshot({ path: destino });
              const alto = pagina.viewportSize()!.height;
              if (altoPng(png) !== alto) throw new Error(`${archivo}: el PNG mide ${altoPng(png)} px de alto y la página ${alto}`);
              console.log(`✓ capturas/${archivo}${m.barras ? ` (${m.barras} barra(s) inferior(es) al final de la página, PNG ${ancho}×${altoPng(png)}, sin solapes)` : ""}`);
              continue;
            }
            console.log(`✓ capturas/${archivo}`);
          }
          await contexto.close();
        }
      }
    }
    // Corrida completa (sin filtros): se borran los PNG de capturas que ya no existen en la configuración, para que no se acumulen.
    if (!soloRutas && !soloSecciones && generadas.size > 0) {
      for (const f of readdirSync(salida)) {
        if (f.endsWith(".png") && !generadas.has(f)) {
          rmSync(join(salida, f));
          console.log(`🗑 capturas/${f} (sobrante de una configuración anterior)`);
        }
      }
    }
  } finally {
    // Deja limpios los datos (contadores de intentos del bloqueo, versión del aviso, sesiones) para que nada se arrastre a otras corridas.
    console.log(`Datos ficticios reiniciados al terminar (HTTP ${await reiniciarDatos(base)})`);
    await navegador?.close();
    apagar();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
