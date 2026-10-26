// Auditoría de objetivos táctiles a 390 px: recorre las pantallas de capturas.config.ts (en claro; la medida no cambia con el tema)
// y reporta los controles interactivos de menos de 44 px de alto o de ancho: botones, enlaces, chips, pestañas, casillas y
// radios (se mide su fila), campos y controles de solo ícono.
// Excepciones documentadas (no cuentan como falla, pero se listan aparte):
//  · enlaces dentro de una frase (<p> o la etiqueta de una casilla): WCAG 2.5.8 los exime;
//  · controles dentro de una tabla de administración marcada como compacta (atributo data-tabla-compacta), que solo se muestra
//    desde 768 px: a 390 px los mismos datos salen como tarjetas con controles de 44 px.
// Opciones: --sin-build reutiliza el build · --galerias audita las galerías de desarrollo en lugar de las pantallas.
// Termina con error si hay controles fuera de las excepciones.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { ANCHOS, RUTAS } from "../capturas.config";
import { CLAVE_TEMA } from "../src/lib/tema";
import { agregarSesion, reiniciarDatos, rolDeRuta } from "./sesion-pruebas";

const PUERTO = 3107;
const base = `http://localhost:${PUERTO}`;
const galerias = process.argv.includes("--galerias");

type Hallazgo = { clase: string; control: string; medida: string; pantallas: Set<string>; exento: boolean };
const nombre = (e: { ruta: string; archivo?: string }) => e.archivo ?? (e.ruta.split("?")[0].replace(/^\/+|\/+$/g, "").replace(/\//g, "-") || "inicio");

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

async function main() {
  if (!process.argv.includes("--sin-build") && spawnSync("npx", ["next", "build"], { stdio: "inherit" }).status !== 0) throw new Error("Falló next build");
  const servidor = spawn("npx", ["next", "start", "-p", String(PUERTO)], { stdio: "ignore", detached: true });
  const apagar = () => {
    try {
      if (servidor.pid) process.kill(-servidor.pid);
    } catch {
      // ya terminó
    }
  };
  const hallazgos = new Map<string, Hallazgo>();
  let revisadas = 0;
  let navegador: Browser | undefined;
  try {
    await esperarServidor(servidor);
    navegador = await abrirNavegador();
    for (const e of RUTAS) {
      const esGaleria = Boolean(e.secciones) || e.ruta === "/dev/fundaciones";
      if (esGaleria !== galerias || !(e.anchos ?? ANCHOS).includes(390)) continue;
      const contexto = await navegador.newContext({ viewport: { width: 390, height: e.ventana ? 844 : 900 } });
      await contexto.addInitScript(([k, v]) => localStorage.setItem(k, v), [CLAVE_TEMA, "light"]);
      const rol = e.rol !== undefined ? e.rol : rolDeRuta(e.ruta);
      if (rol) await agregarSesion(contexto, base, rol);
      const pagina = await contexto.newPage();
      await pagina.goto(`${base}${e.ruta}`, { waitUntil: "load" });
      if (e.preparar) await e.preparar(pagina, { base });
      await pagina.evaluate(() => document.fonts.ready);
      await pagina.waitForTimeout(200);
      const lista = await pagina.evaluate(() => {
        const salida: { clase: string; control: string; w: number; h: number; exento: boolean }[] = [];
        const selector = "button, a[href], input, select, textarea, summary, [role=button], [role=tab], [role=switch], [role=slider], [role=link], label";
        for (const el of document.querySelectorAll<HTMLElement>(selector)) {
          if (el.closest("[hidden], [inert]")) continue;
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          if (el instanceof HTMLInputElement && ["file", "checkbox", "radio", "hidden"].includes(el.type)) continue; // se miden por su botón o su fila
          if (el instanceof HTMLLabelElement && !el.querySelector("input[type=checkbox], input[type=radio]")) continue;
          const r = el.getBoundingClientRect();
          if (r.width <= 2 && r.height <= 2) continue; // sr-only
          if (r.height >= 43.5 && r.width >= 43.5) continue;
          const enFrase = el instanceof HTMLAnchorElement && !!el.closest("p, label, li > p");
          const enTablaCompacta = !!el.closest("[data-tabla-compacta]");
          const texto = (el.getAttribute("aria-label") ?? el.textContent ?? el.getAttribute("name") ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
          const tipo = el instanceof HTMLButtonElement ? "botón" : el instanceof HTMLAnchorElement ? "enlace" : el instanceof HTMLLabelElement ? "casilla o radio" : el.tagName.toLowerCase();
          const soloIcono = !el.textContent?.trim() && !!el.querySelector("svg");
          salida.push({ clase: enFrase ? "enlace en una frase (excepción)" : enTablaCompacta ? "control de tabla compacta (excepción)" : soloIcono ? `${tipo} de solo ícono` : tipo, control: texto || `(${el.tagName.toLowerCase()} sin texto)`, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, exento: enFrase || enTablaCompacta });
        }
        return salida;
      });
      revisadas++;
      for (const x of lista) {
        const k = `${x.clase}|${x.control}|${x.w}x${x.h}`;
        const h = hallazgos.get(k) ?? { clase: x.clase, control: x.control, medida: `${x.w} × ${x.h} px`, pantallas: new Set<string>(), exento: x.exento };
        h.pantallas.add(nombre(e));
        hallazgos.set(k, h);
      }
      await contexto.close();
    }
  } finally {
    await reiniciarDatos(base); // limpia bloqueos y aviso de las pantallas con estado real
    await navegador?.close();
    apagar();
  }
  const faltas = [...hallazgos.values()].filter((h) => !h.exento);
  const excepciones = [...hallazgos.values()].filter((h) => h.exento);
  console.log(`${galerias ? "Galerías de desarrollo" : "Pantallas"} revisadas a 390 px: ${revisadas}`);
  const imprimir = (titulo: string, lista: Hallazgo[]) => {
    console.log(`\n${titulo} (${lista.length})`);
    for (const h of lista) console.log(`  - [${h.clase}] «${h.control}» ${h.medida} · ${[...h.pantallas].slice(0, 5).join(", ")}${h.pantallas.size > 5 ? ` … (+${h.pantallas.size - 5})` : ""}`);
  };
  imprimir("Controles menores de 44 px (fallas)", faltas);
  imprimir("Excepciones documentadas", excepciones);
  console.log(faltas.length === 0 ? "\nOK: ningún control interactivo mide menos de 44 px (salvo las excepciones documentadas)" : `\n${faltas.length} control(es) por debajo de 44 px`);
  process.exit(faltas.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
