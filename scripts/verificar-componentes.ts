// Comprueba en /dev/componentes (sin abrir capturas): áreas táctiles ≥ 44 px, campos de 48 px, diálogo
// (abre, Escape cierra, el foco regresa), pestañas con flechas y que no haya desbordamiento horizontal.
// Opciones: --sin-build  reutiliza el build existente en .next
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { CLAVE_TEMA } from "../src/lib/tema";

const PUERTO = 3103;
const base = `http://localhost:${PUERTO}`;
let fallos = 0;
const ver = (ok: boolean, ok_msg: string, mal_msg: string) => {
  if (ok) console.log(`✓ ${ok_msg}`);
  else {
    fallos++;
    console.log(`✗ ${mal_msg}`);
  }
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
    return await chromium.launch({ channel: "chrome" }); // sin Chromium de Playwright (p. ej. macOS 13)
  }
}

async function areasTactiles(pagina: Page, ancho: number) {
  const pequenos = await pagina.evaluate(() => {
    const SEL = "button, a[href], input, select, textarea, [role=tab], [role=switch]";
    const salida: string[] = [];
    let total = 0;
    for (const el of document.querySelectorAll<HTMLElement>(SEL)) {
      if (el.closest("[hidden], dialog:not([open])")) continue;
      // Controles ocultos visualmente (sr-only): el área pulsable es la de su <label>.
      const objetivo = el instanceof HTMLInputElement && ["checkbox", "radio", "file"].includes(el.type) ? (el.closest("label") ?? el.closest("div") ?? el) : el;
      const r = objetivo.getBoundingClientRect();
      if (getComputedStyle(objetivo).display === "none" || r.width === 0 || r.height === 0) continue;
      // Enlaces dentro de un texto corrido (p. ej. «Aviso de Privacidad» en una casilla) quedan exentos.
      if (el instanceof HTMLAnchorElement && el.closest("label, p")) continue;
      total++;
      if (r.height < 43.5) salida.push(`${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label")}]` : ""} "${(el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.height * 10) / 10}px`);
    }
    return { salida, total };
  });
  ver(pequenos.salida.length === 0, `${ancho}px: ${pequenos.total} elementos interactivos, ninguno de menos de 44 px de alto`, `${ancho}px: áreas menores de 44 px → ${pequenos.salida.join(" | ")}`);
}

async function campos(pagina: Page, ancho: number) {
  const alturas = await pagina.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("input:not([type=checkbox]):not([type=radio]):not([type=file]), select")].map((e) => Math.round(e.getBoundingClientRect().height * 10) / 10),
  );
  const malos = alturas.filter((h) => Math.abs(h - 48) > 0.5);
  ver(alturas.length > 0 && malos.length === 0, `${ancho}px: ${alturas.length} campos de texto y selectores miden 48 px`, `${ancho}px: campos con altura distinta de 48 px → ${malos.join(", ")} (de ${alturas.length})`);
  const px16 = await pagina.evaluate(() => [...document.querySelectorAll("input[type=text], select, textarea")].every((e) => getComputedStyle(e).fontSize === "16px"));
  ver(px16, `${ancho}px: texto de los campos en 16 px`, `${ancho}px: algún campo no tiene 16 px`);
}

async function dialogo(pagina: Page) {
  const panel = pagina.locator("section[data-seccion=retroalimentacion] [data-theme=light]");
  const abrir = panel.getByRole("button", { name: "Cancelar registro…", exact: true });
  await abrir.focus();
  await abrir.click();
  const dlg = panel.locator("dialog");
  ver(await dlg.evaluate((d: HTMLDialogElement) => d.open), "diálogo: abre (<dialog> modal)", "diálogo: no abrió");
  const enfocado = await pagina.evaluate(() => document.activeElement?.textContent?.trim());
  ver(enfocado === "Volver", "diálogo: el foco inicial queda en «Volver»", `diálogo: foco inicial en «${enfocado}»`);
  let dentro = true;
  for (let i = 0; i < 4; i++) {
    await pagina.keyboard.press("Tab");
    // Un diálogo modal vuelve inerte el resto de la página: el foco queda dentro o sale al navegador (body), nunca a la página.
    dentro &&= await dlg.evaluate((d) => d.contains(document.activeElement) || document.activeElement === document.body);
  }
  ver(dentro, "diálogo: al tabular, el foco nunca llega a la página de fondo (queda inerte)", "diálogo: el foco salió del diálogo");
  await pagina.keyboard.press("Escape");
  ver(!(await dlg.evaluate((d: HTMLDialogElement) => d.open)), "diálogo: Escape lo cierra", "diálogo: Escape no lo cerró");
  const devuelto = await abrir.evaluate((b) => b === document.activeElement);
  ver(devuelto, "diálogo: el foco regresa al botón que lo abrió", "diálogo: el foco no regresó al botón de origen");
}

async function pestanas(pagina: Page) {
  const lista = pagina.locator("section[data-seccion=navegacion] [data-theme=light]").getByRole("tablist");
  const tabs = lista.getByRole("tab");
  await tabs.first().focus();
  const estado = async () => ({
    sel: await tabs.evaluateAll((t) => t.findIndex((x) => x.getAttribute("aria-selected") === "true")),
    foco: await tabs.evaluateAll((t) => t.findIndex((x) => x === document.activeElement)),
  });
  const pasos: [string, number][] = [["ArrowRight", 1], ["ArrowRight", 2], ["ArrowRight", 0], ["ArrowLeft", 2], ["Home", 0], ["End", 2]];
  let bien = true;
  for (const [tecla, esperado] of pasos) {
    await pagina.keyboard.press(tecla);
    const e = await estado();
    if (e.sel !== esperado || e.foco !== esperado) bien = false;
  }
  ver(bien, "pestañas: flechas, Inicio y Fin mueven el foco y la selección (con vuelta al final/inicio)", "pestañas: la navegación con teclado falló");
  const tabindex = await tabs.evaluateAll((t) => t.map((x) => x.getAttribute("tabindex")));
  ver(tabindex.filter((x) => x === "0").length === 1, "pestañas: solo la activa está en el orden de tabulación", `pestañas: tabindex ${tabindex.join(",")}`);
}


async function tablaYPestanas(pagina: Page, ancho: number) {
  // Folios, perros y fechas de la tabla nunca se parten en dos líneas.
  const partidos = await pagina.evaluate(() => {
    const salida: string[] = [];
    let revisados = 0;
    for (const td of document.querySelectorAll<HTMLElement>("table td[data-etiqueta]")) {
      if (getComputedStyle(td).display === "none") continue;
      revisados++;
      // Solo los nodos de texto: un texto en una sola línea produce rectángulos con la misma coordenada vertical.
      const tops = new Set<number>();
      const recorrido = document.createTreeWalker(td, NodeFilter.SHOW_TEXT);
      for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) {
        if (!n.textContent?.trim()) continue;
        const rango = document.createRange();
        rango.selectNodeContents(n);
        for (const r of rango.getClientRects()) if (r.width > 0) tops.add(Math.round(r.top));
      }
      if (tops.size > 1) salida.push(`${td.dataset.etiqueta}: "${(td.textContent ?? "").trim().slice(0, 25)}"`);
    }
    return { salida, revisados };
  });
  ver(partidos.salida.length === 0, `${ancho}px: ${partidos.revisados} celdas de la tabla sin partirse en dos líneas`, `${ancho}px: celdas partidas → ${partidos.salida.join(" | ")}`);
  const folios = await pagina.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("span")].filter((e) => /^RUPE-[A-Z2-9]{8}$/.test(e.textContent ?? "") && e.children.length === 0).map((e) => e.getClientRects().length),
  );
  ver(folios.length > 0 && folios.every((n) => n === 1), `${ancho}px: ${folios.length} folios en una sola línea (tabla y tarjetas)`, `${ancho}px: algún folio se parte`);

  // Pestañas: las tres caben completas en el contenedor.
  const cabe = await pagina.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[role=tablist]")].map((l) => {
      const c = l.getBoundingClientRect();
      return { desborda: l.scrollWidth > l.clientWidth + 1, fuera: [...l.children].some((t) => t.getBoundingClientRect().right > c.right + 1), n: l.children.length };
    }),
  );
  ver(cabe.length > 0 && cabe.every((c) => !c.desborda && !c.fuera), `${ancho}px: las pestañas (${cabe[0]?.n}) caben completas, sin truncarse`, `${ancho}px: pestañas desbordadas ${JSON.stringify(cabe)}`);
}

async function toast(pagina: Page) {
  const panel = pagina.locator("section[data-seccion=retroalimentacion] [data-theme=light]");
  const aviso = pagina.locator("div[role=status].fixed");
  ver((await aviso.count()) === 0, "toast: no hay aviso antes de pedirlo", "toast: ya había un aviso");
  const abrir = panel.getByRole("button", { name: "Mostrar aviso temporal" });
  await abrir.click();
  await pagina.mouse.move(0, 0); // que el puntero no pause el aviso
  const t0 = Date.now();
  ver((await aviso.count()) === 1, "toast: aparece al pedirlo", "toast: no apareció");
  while ((await aviso.count()) > 0 && Date.now() - t0 < 9000) await pagina.waitForTimeout(50);
  const duro = Date.now() - t0;
  ver(duro >= 4950 && duro <= 5700, `toast: se cerró solo a los ${(duro / 1000).toFixed(2)} s (ni antes de 5 s ni mucho después)`, `toast: se cerró a los ${duro} ms (se esperaban ~5000)`);
}

async function cargaFotografia(pagina: Page) {
  const panel = pagina.locator("section[data-seccion=formularios] [data-theme=light]");
  const entrada = panel.locator("input[type=file]").first();
  const tile = entrada.locator("xpath=..");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  await entrada.setInputFiles({ name: "perro.png", mimeType: "image/png", buffer: png });
  const vista = tile.locator('img[alt="Vista previa de la fotografía"]');
  await vista.waitFor({ timeout: 3000 }).catch(() => undefined);
  ver((await vista.count()) === 1 && (await vista.evaluate((i: HTMLImageElement) => i.naturalWidth > 0)), "carga de fotografía: un PNG válido muestra la vista previa", "carga de fotografía: el PNG válido no mostró vista previa");

  await entrada.setInputFiles({ name: "nota.txt", mimeType: "text/plain", buffer: Buffer.from("no soy una foto") });
  ver((await tile.getByText("Solo se admite JPG o PNG").count()) === 1 && (await vista.count()) === 0, "carga de fotografía: un archivo de tipo no permitido se rechaza con su mensaje", "carga de fotografía: no rechazó el tipo no permitido");

  await entrada.setInputFiles({ name: "grande.png", mimeType: "image/png", buffer: Buffer.alloc(4 * 1024 * 1024 + 1024) });
  ver((await tile.getByText("La foto pesa más de 4 MB").count()) === 1 && (await tile.getByText("Elige otra o redúcela").count()) === 1, "carga de fotografía: un archivo de más de 4 MB se rechaza con su mensaje", "carga de fotografía: no rechazó el archivo de más de 4 MB");

  await entrada.setInputFiles({ name: "perro.png", mimeType: "image/png", buffer: png });
  await vista.waitFor({ timeout: 3000 }).catch(() => undefined);
  ver((await vista.count()) === 1, "carga de fotografía: tras un error, un archivo válido vuelve a mostrarse", "carga de fotografía: no se recuperó tras el error");
}

async function radios(pagina: Page) {
  const panel = pagina.locator("section[data-seccion=formularios] [data-theme=light]");
  await panel.getByRole("radio", { name: "Macho" }).focus();
  const marcado = () => panel.getByRole("radio", { checked: true }).evaluateAll((r) => r.map((x) => (x as HTMLInputElement).value));
  const pasos: [string, string][] = [["ArrowDown", "Hembra"], ["ArrowDown", "No sé"], ["ArrowUp", "Hembra"], ["ArrowRight", "No sé"], ["ArrowLeft", "Hembra"]];
  let bien = true;
  for (const [tecla, esperado] of pasos) {
    await pagina.keyboard.press(tecla);
    if (!(await marcado()).includes(esperado)) bien = false;
  }
  ver(bien, "radios: las flechas del teclado mueven la selección (Macho → Hembra → No sé y de regreso)", "radios: las flechas no movieron la selección como se esperaba");
}

async function main() {
  if (!process.argv.includes("--sin-build")) {
    if (spawnSync("npx", ["next", "build"], { stdio: "inherit" }).status !== 0) throw new Error("Falló next build");
  }
  const servidor = spawn("npx", ["next", "start", "-p", String(PUERTO)], { stdio: "ignore", detached: true });
  const apagar = () => {
    try {
      if (servidor.pid) process.kill(-servidor.pid);
    } catch {
      // ya terminó
    }
  };
  let navegador: Browser | undefined;
  try {
    await esperarServidor(servidor);
    navegador = await abrirNavegador();
    for (const ancho of [390, 768, 1280]) {
      const contexto = await navegador.newContext({ viewport: { width: ancho, height: 900 } });
      await contexto.addInitScript(([k, v]) => localStorage.setItem(k, v), [CLAVE_TEMA, "light"]);
      const pagina = await contexto.newPage();
      await pagina.goto(`${base}/dev/componentes`, { waitUntil: "networkidle" });
      await pagina.evaluate(() => document.fonts.ready);
      await areasTactiles(pagina, ancho);
      await campos(pagina, ancho);
      await tablaYPestanas(pagina, ancho);
      const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const culpables = desborde > 0
        ? await pagina.evaluate(() =>
            [...document.querySelectorAll<HTMLElement>("body *")]
              .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 0.5 && !e.closest("[class*=overflow-x-auto]"))
              .slice(0, 5)
              .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 50)}`),
          )
        : [];
      ver(desborde <= 0, `${ancho}px: sin desplazamiento horizontal de la página`, `${ancho}px: la página se desborda ${desborde}px → ${culpables.join(" | ")}`);
      if (ancho === 1280) {
        await dialogo(pagina);
        await pestanas(pagina);
        await radios(pagina);
        await cargaFotografia(pagina);
        await toast(pagina);
      }
      await contexto.close();
    }
  } finally {
    await navegador?.close();
    apagar();
  }
  console.log(fallos === 0 ? "OK: componentes verificados" : `${fallos} verificación(es) fallida(s)`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
