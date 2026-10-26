// Verifica las plantillas de página con Playwright (sin abrir capturas): estructura semántica, enlace «Saltar al
// contenido», desbordamiento horizontal, visibilidad responsiva de barras, menús (abrir, Escape, foco),
// persistencia del tema entre plantillas y áreas táctiles de 44 px.
// Opciones: --sin-build  reutiliza el build existente en .next
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { agregarSesion, rolDeRuta } from "./sesion-pruebas";
import { CLAVE_TEMA } from "../src/lib/tema";

const PUERTO = 3104;
const base = `http://localhost:${PUERTO}`;
const ANCHOS = [390, 768, 1280];
const PAGINAS = [
  { ruta: "/dev/plantillas/publica", nombre: "pública (demo)" },
  { ruta: "/dev/plantillas/tutor", nombre: "tutor (demo)" },
  { ruta: "/dev/plantillas/admin", nombre: "admin (demo)" },
  { ruta: "/dev/plantillas/flujo", nombre: "flujo (demo)" },
  { ruta: "/", nombre: "ruta real / (layout público)" },
  { ruta: "/tutor", nombre: "ruta real /tutor (layout tutor)" },
  { ruta: "/admin", nombre: "ruta real /admin (layout admin)" },
];

let fallos = 0;
const ver = (ok: boolean, bien: string, mal: string) => {
  if (ok) console.log(`✓ ${bien}`);
  else {
    fallos++;
    console.log(`✗ ${mal}`);
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

async function nuevaPagina(navegador: Browser, ancho: number, tema: "light" | "dark" | null = "light"): Promise<{ contexto: BrowserContext; pagina: Page }> {
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: 900 }, colorScheme: "light" });
  if (tema) await contexto.addInitScript(([k, v]) => localStorage.setItem(k, v), [CLAVE_TEMA, tema]);
  return { contexto, pagina: await contexto.newPage() };
}

async function irA(pagina: Page, ruta: string) {
  // Las rutas /tutor y /admin las protege el servidor: se visitan con la sesión real del rol (cuentas ficticias de .env.local).
  const rol = rolDeRuta(ruta);
  if (rol) await agregarSesion(pagina.context(), base, rol);
  // No se espera "networkidle": Next precarga (prefetch) enlaces a rutas que aún no existen y esas peticiones no terminan.
  await pagina.goto(`${base}${ruta}`, { waitUntil: "load" });
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForFunction(() => [...document.images].every((i) => i.complete));
}

async function estructura(pagina: Page, etiqueta: string) {
  const e = await pagina.evaluate(() => ({
    mains: document.querySelectorAll("main").length,
    idMain: document.querySelector("main")?.id,
    headers: document.querySelectorAll("header").length,
    navs: document.querySelectorAll("nav").length,
    footers: document.querySelectorAll("footer").length,
  }));
  ver(e.mains === 1 && e.idMain === "contenido" && e.headers >= 1 && e.navs >= 1 && e.footers >= 1, `${etiqueta}: un solo <main id="contenido">, con header (${e.headers}), nav (${e.navs}) y footer (${e.footers})`, `${etiqueta}: estructura incorrecta ${JSON.stringify(e)}`);
}

async function enlaceSaltar(pagina: Page, etiqueta: string) {
  await pagina.keyboard.press("Tab");
  const visible = await pagina.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    const r = a?.getBoundingClientRect();
    return { texto: a?.textContent?.trim(), dentro: !!r && r.width > 40 && r.height >= 43.5 && r.top >= 0 && r.left >= 0 && r.right <= window.innerWidth };
  });
  ver(visible.texto === "Saltar al contenido" && visible.dentro, `${etiqueta}: «Saltar al contenido» es lo primero al tabular y se ve (≥ 44 px) al recibir el foco`, `${etiqueta}: el enlace para saltar no es el primero o no se ve (${JSON.stringify(visible)})`);
  await pagina.keyboard.press("Enter");
  const destino = await pagina.evaluate(() => ({ hash: location.hash, id: document.activeElement?.id }));
  ver(destino.hash === "#contenido" && destino.id === "contenido", `${etiqueta}: el enlace lleva el foco a <main id="contenido">`, `${etiqueta}: el salto falló ${JSON.stringify(destino)}`);
}

async function desborde(pagina: Page, etiqueta: string) {
  const d = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ver(d <= 0, `${etiqueta}: sin desplazamiento horizontal`, `${etiqueta}: se desborda ${d}px`);
}

async function areasTactiles(pagina: Page, etiqueta: string) {
  const r = await pagina.evaluate(() => {
    const malos: string[] = [];
    let total = 0;
    for (const el of document.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [role=tab], [role=switch]")) {
      if (el.closest("[hidden]")) continue;
      const rect = el.getBoundingClientRect();
      if (getComputedStyle(el).display === "none" || (rect.width <= 2 && rect.height <= 2)) continue; // ocultos o sr-only
      if (el instanceof HTMLAnchorElement && el.closest("p, label")) continue; // enlaces dentro de texto corrido
      total++;
      if (rect.height < 43.5) malos.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 28)}" ${Math.round(rect.height * 10) / 10}px`);
    }
    return { malos, total };
  });
  ver(r.malos.length === 0, `${etiqueta}: ${r.total} elementos interactivos, ninguno de menos de 44 px de alto`, `${etiqueta}: áreas menores de 44 px → ${r.malos.join(" | ")}`);
}

const visible = (pagina: Page, selector: string) => pagina.locator(selector).first().isVisible();

async function barrasResponsivas(navegador: Browser) {
  const casos: { ancho: number; inferior: boolean; navEscritorio: boolean }[] = [
    { ancho: 390, inferior: true, navEscritorio: false },
    { ancho: 767, inferior: true, navEscritorio: false },
    { ancho: 768, inferior: false, navEscritorio: true },
    { ancho: 1280, inferior: false, navEscritorio: true },
  ];
  for (const c of casos) {
    const { contexto, pagina } = await nuevaPagina(navegador, c.ancho);
    await irA(pagina, "/dev/plantillas/tutor");
    const inferior = await visible(pagina, 'nav[aria-label="Navegación inferior"]');
    const escritorio = await visible(pagina, 'header nav[aria-label="Navegación principal"]');
    ver(inferior === c.inferior && escritorio === c.navEscritorio, `tutor ${c.ancho}px: barra inferior ${inferior ? "visible" : "oculta"} y navegación del encabezado ${escritorio ? "visible" : "oculta"} (esperado)`, `tutor ${c.ancho}px: barra inferior ${inferior}, navegación de encabezado ${escritorio}; se esperaba ${c.inferior}/${c.navEscritorio}`);
    await contexto.close();

    const g = await nuevaPagina(navegador, c.ancho);
    await irA(g.pagina, "/dev/componentes");
    const natural = await visible(g.pagina, '[data-prueba="barra-escritorio-natural"] header');
    ver(natural === c.navEscritorio, `BarraNavegacionEscritorio sin forzarVisible a ${c.ancho}px: ${natural ? "visible" : "oculta"} (esperado)`, `BarraNavegacionEscritorio a ${c.ancho}px: visible=${natural}, se esperaba ${c.navEscritorio}`);
    await g.contexto.close();
  }
  // Pública y administrador.
  const reglas: { ancho: number; menu: boolean; botones: boolean; nav: boolean; lateral: boolean }[] = [
    { ancho: 390, menu: true, botones: false, nav: false, lateral: false },
    { ancho: 768, menu: true, botones: true, nav: false, lateral: false },
    { ancho: 1280, menu: false, botones: true, nav: true, lateral: true },
  ];
  for (const r of reglas) {
    const a = await nuevaPagina(navegador, r.ancho);
    await irA(a.pagina, "/dev/plantillas/publica");
    const p = { menu: await visible(a.pagina, 'header button[aria-controls="menu-movil"]'), botones: await visible(a.pagina, 'header a:has-text("Iniciar sesión")'), nav: await visible(a.pagina, 'header nav[aria-label="Navegación principal"]') };
    ver(p.menu === r.menu && p.botones === r.botones && p.nav === r.nav, `pública ${r.ancho}px: botón de menú ${p.menu}, «Iniciar sesión» en el encabezado ${p.botones}, navegación ${p.nav} (esperado)`, `pública ${r.ancho}px: ${JSON.stringify(p)}; se esperaba ${JSON.stringify({ menu: r.menu, botones: r.botones, nav: r.nav })}`);
    await a.contexto.close();
    const b = await nuevaPagina(navegador, r.ancho);
    await irA(b.pagina, "/dev/plantillas/admin");
    const lateral = await visible(b.pagina, 'aside nav[aria-label="Administración"]');
    const menu = await visible(b.pagina, 'header button[aria-controls="cajon-admin"]');
    ver(lateral === r.lateral && menu === !r.lateral, `admin ${r.ancho}px: barra lateral ${lateral ? "visible" : "oculta"}, botón de menú ${menu ? "visible" : "oculto"} (esperado)`, `admin ${r.ancho}px: lateral ${lateral}, menú ${menu}`);
    await b.contexto.close();
  }
}

/** Con scroll hasta el final, la barra inferior del tutor no tapa el último contenido ni el pie (en móvil). */
async function barraInferiorNoTapa(navegador: Browser) {
  for (const ruta of ["/dev/plantillas/tutor", "/tutor"]) {
    const { contexto, pagina } = await nuevaPagina(navegador, 390);
    await irA(pagina, ruta);
    // Con la página corta no hay scroll que probar: se alarga el contenido para que la barra pegajosa sí se superponga.
    await pagina.evaluate(() => {
      const relleno = document.createElement("div");
      relleno.id = "relleno-prueba";
      relleno.style.height = "2400px";
      relleno.textContent = "último contenido";
      document.querySelector("main")!.appendChild(relleno);
    });
    await pagina.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await pagina.waitForTimeout(150);
    const r = await pagina.evaluate(() => {
      const barra = document.querySelector('nav[aria-label="Navegación inferior"]')!.getBoundingClientRect();
      const pie = document.querySelector("footer")!.getBoundingClientRect();
      const enlaces = [...document.querySelectorAll("footer a")];
      const tapados = enlaces.filter((a) => {
        const b = a.getBoundingClientRect();
        const alto = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return alto !== a && !a.contains(alto);
      }).length;
      const ultimo = document.getElementById("relleno-prueba")!.getBoundingClientRect();
      return { barraTop: barra.top, barraBottom: barra.bottom, pieBottom: pie.bottom, ultimoBottom: ultimo.bottom, alto: window.innerHeight, tapados, enlaces: enlaces.length };
    });
    ver(
      r.pieBottom <= r.barraTop + 0.5 && r.ultimoBottom <= r.barraTop + 0.5 && r.tapados === 0 && Math.abs(r.barraBottom - r.alto) < 1,
      `${ruta} 390px, scroll al final: la barra inferior queda bajo el pie (${r.enlaces} enlaces del pie sin tapar) y no cubre el último contenido`,
      `${ruta} 390px, scroll al final: ${JSON.stringify(r)}`,
    );
    await contexto.close();
  }
}

async function flujo(navegador: Browser) {
  for (const ancho of [390, 767, 768, 1280]) {
    const { contexto, pagina } = await nuevaPagina(navegador, ancho);
    await irA(pagina, "/dev/plantillas/flujo");
    const barra = await visible(pagina, "main [role=progressbar]");
    const circulos = await visible(pagina, "main ol");
    const movil = ancho < 768;
    ver(barra === movil && circulos === !movil, `flujo ${ancho}px: indicador de pasos en ${barra ? "barra segmentada" : "círculos"} (esperado)`, `flujo ${ancho}px: barra=${barra}, círculos=${circulos}`);
    if (ancho === 1280) {
      const x = await pagina.evaluate(() => {
        const e = document.querySelector("header > div")!.getBoundingClientRect();
        const p = document.querySelector("footer > div")!.getBoundingClientRect();
        return { encabezado: e.left, pie: p.left, anchoE: e.width, anchoP: p.width };
      });
      ver(x.encabezado === x.pie && x.anchoE === x.anchoP, `flujo 1280px: el pie comparte contenedor central con el encabezado (x=${x.encabezado}, ancho=${x.anchoE})`, `flujo 1280px: encabezado ${JSON.stringify([x.encabezado, x.anchoE])} y pie ${JSON.stringify([x.pie, x.anchoP])} no coinciden`);
    }
    if (ancho === 390) {
      const texto = await pagina.locator("main [role=progressbar]").evaluate((e) => ({ vt: e.getAttribute("aria-valuetext"), t: e.textContent?.replace(/\s+/g, " ").trim() }));
      ver(texto.vt === "Paso 3 de 6: Ubicación" && texto.t === "Paso 3 de 6 · Ubicación", `flujo: la barra dice «${texto.t}»`, `flujo: texto de la barra ${JSON.stringify(texto)}`);
      const botones = await pagina.locator("main").getByRole("button", { name: "Continuar" }).isVisible();
      const regresar = await pagina.locator("main").getByRole("link", { name: "Regresar" }).isVisible();
      const sinInferior = (await pagina.locator('nav[aria-label="Navegación inferior"]').count()) === 0;
      const redes = await pagina.locator('footer ul[aria-label="Redes sociales"]').count();
      ver(botones && regresar && sinInferior && redes === 0, "flujo: botones Regresar y Continuar, sin barra inferior y con pie mínimo (sin redes)", `flujo: continuar=${botones}, regresar=${regresar}, sinInferior=${sinInferior}, redes=${redes}`);
    }
    await contexto.close();
  }
}

async function menus(navegador: Browser) {
  // Menú móvil de la plantilla pública.
  let { contexto, pagina } = await nuevaPagina(navegador, 390);
  await irA(pagina, "/dev/plantillas/publica");
  const boton = pagina.getByRole("button", { name: "Menú" });
  await boton.focus();
  await boton.click();
  const panel = pagina.locator("#menu-movil");
  ver(await panel.isVisible(), "menú móvil público: abre al pulsar el botón", "menú móvil público: no abrió");
  const grupos = await panel.locator("h2").allTextContents();
  ver(grupos.join("|") === "Cuenta|Explorar", "menú móvil público: grupos «Cuenta» y «Explorar»", `menú móvil público: grupos ${grupos.join("|")}`);
  const primero = await pagina.evaluate(() => document.activeElement?.textContent?.trim());
  ver(primero === "Iniciar sesión", "menú móvil público: el foco pasa a su primer enlace", `menú móvil público: foco en «${primero}»`);
  ver(await pagina.locator("main").evaluate((m) => (m as HTMLElement).inert), "menú móvil público: el contenido de fondo queda inerte", "menú móvil público: el contenido sigue accesible");
  await areasTactiles(pagina, "menú móvil público abierto 390px");
  await desborde(pagina, "menú móvil público abierto 390px");
  await pagina.keyboard.press("Escape");
  const cerrado = !(await panel.isVisible());
  const devuelto = await boton.evaluate((b) => b === document.activeElement);
  ver(cerrado && devuelto && (await boton.getAttribute("aria-expanded")) === "false", "menú móvil público: Escape lo cierra y el foco regresa al botón", `menú móvil público: tras Escape cerrado=${cerrado}, foco en el botón=${devuelto}`);
  await contexto.close();

  // Cajón del administrador.
  ({ contexto, pagina } = await nuevaPagina(navegador, 390));
  await irA(pagina, "/dev/plantillas/admin");
  const abrir = pagina.getByRole("button", { name: "Menú", exact: true });
  await abrir.focus();
  await abrir.click();
  const dlg = pagina.locator("dialog#cajon-admin");
  ver(await dlg.evaluate((d: HTMLDialogElement) => d.open), "cajón de administración: abre como diálogo modal", "cajón de administración: no abrió");
  const grupo = await dlg.locator("h2").allTextContents();
  ver(grupo.join("|") === "Resumen|Moderación|Usuarios|Catálogos|Sistema", "cajón de administración: grupos del mockup 3.1", `cajón de administración: grupos ${grupo.join("|")}`);
  await areasTactiles(pagina, "cajón de administración abierto 390px");
  const salirCajon = dlg.getByRole("button", { name: "Cerrar sesión" });
  const ultimo = await dlg.evaluate((d) => { const as = [...d.querySelectorAll("a, button")]; return as[as.length - 1]?.textContent?.trim(); });
  ver((await salirCajon.isVisible()) && ultimo === "Cerrar sesión" && (await dlg.getByText("Ricardo Vega").first().isVisible()), "cajón de administración: «Cerrar sesión» al final, con el nombre y el rol arriba", `cajón de administración: «Cerrar sesión» visible=${await salirCajon.isVisible()}, último control «${ultimo}»`);
  await pagina.keyboard.press("Escape");
  ver(!(await dlg.evaluate((d: HTMLDialogElement) => d.open)) && (await abrir.evaluate((b) => b === document.activeElement)), "cajón de administración: Escape lo cierra y el foco regresa al botón", "cajón de administración: Escape no cerró o no devolvió el foco");
  await contexto.close();

  // Barra lateral del administrador (escritorio): avatar, nombre, rol y «Cerrar sesión» al pie.
  ({ contexto, pagina } = await nuevaPagina(navegador, 1280));
  await irA(pagina, "/dev/plantillas/admin");
  const lateral = pagina.locator("aside");
  const pie = await lateral.evaluate((a) => {
    const salir = [...a.querySelectorAll("button")].find((x) => x.textContent?.includes("Cerrar sesión"));
    const r = salir?.getBoundingClientRect();
    const ar = a.getBoundingClientRect();
    return { hay: !!salir, alPie: !!r && ar.bottom - r.bottom < 40, avatar: !!a.querySelector('[role=img][aria-label^="Avatar de"]'), texto: a.textContent ?? "" };
  });
  ver(pie.hay && pie.alPie && pie.avatar && pie.texto.includes("Ricardo Vega") && pie.texto.includes("Administrador"), "barra lateral del administrador: avatar, nombre, rol y «Cerrar sesión» al pie", `barra lateral del administrador: ${JSON.stringify({ ...pie, texto: undefined })}`);
  ver((await pagina.getByRole("button", { name: /^Cuenta de / }).count()) === 0, "administrador: el encabezado no tiene menú de cuenta (el mockup solo muestra el avatar)", "administrador: aún hay menú de cuenta en el encabezado");
  await areasTactiles(pagina, "barra lateral del administrador 1280px");
  await contexto.close();

  // Menú de cuenta de la persona tutora.
  ({ contexto, pagina } = await nuevaPagina(navegador, 1280));
  await irA(pagina, "/dev/plantillas/tutor");
  const cuenta = pagina.getByRole("button", { name: /^Cuenta de / });
  await cuenta.click();
  const salir = pagina.getByRole("button", { name: "Cerrar sesión" });
  ver((await salir.isVisible()) && (await pagina.getByText("Rosa Hernández").first().isVisible()), "menú de cuenta (tutor): muestra el nombre y «Cerrar sesión»", "menú de cuenta (tutor): no muestra nombre o «Cerrar sesión»");
  await areasTactiles(pagina, "menú de cuenta (tutor) abierto");
  await pagina.keyboard.press("Escape");
  ver(!(await salir.isVisible()) && (await cuenta.evaluate((b) => b === document.activeElement)), "menú de cuenta (tutor): Escape lo cierra y devuelve el foco", "menú de cuenta (tutor): Escape no cerró o no devolvió el foco");
  await contexto.close();
}

async function temaPersistente(navegador: Browser) {
  const { contexto, pagina } = await nuevaPagina(navegador, 1280, null);
  await irA(pagina, "/dev/plantillas/publica");
  const inicial = await pagina.getAttribute("html", "data-theme");
  await pagina.getByRole("button", { name: "Modo oscuro" }).click();
  const tras = await pagina.getAttribute("html", "data-theme");
  const destinos = ["/dev/plantillas/tutor", "/dev/plantillas/admin", "/dev/plantillas/flujo", "/tutor", "/admin", "/"];
  const temas: string[] = [];
  for (const d of destinos) {
    await irA(pagina, d);
    temas.push((await pagina.getAttribute("html", "data-theme")) ?? "");
  }
  ver(inicial === "light" && tras === "dark" && temas.every((t) => t === "dark"), `tema: elegido «dark» en la pública y se conserva en ${destinos.length} pantallas de otras plantillas`, `tema: inicial ${inicial}, tras clic ${tras}, en destinos ${temas.join(",")}`);
  // Y de regreso a claro desde otra plantilla.
  await irA(pagina, "/dev/plantillas/admin");
  await pagina.getByRole("button", { name: "Modo oscuro" }).click();
  await irA(pagina, "/dev/plantillas/publica");
  ver((await pagina.getAttribute("html", "data-theme")) === "light", "tema: el cambio hecho en la plantilla del administrador se refleja en la pública", "tema: el cambio de la plantilla admin no se conservó");
  await contexto.close();
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
    for (const p of PAGINAS) {
      for (const ancho of ANCHOS) {
        const { contexto, pagina } = await nuevaPagina(navegador, ancho);
        await irA(pagina, p.ruta);
        const etiqueta = `${p.nombre} ${ancho}px`;
        await estructura(pagina, etiqueta);
        await desborde(pagina, etiqueta);
        await areasTactiles(pagina, etiqueta);
        if (ancho === 1280) await enlaceSaltar(pagina, p.nombre);
        await contexto.close();
      }
    }
    await barrasResponsivas(navegador);
    await barraInferiorNoTapa(navegador);
    await flujo(navegador);
    await menus(navegador);
    await temaPersistente(navegador);
  } finally {
    await navegador?.close();
    apagar();
  }
  console.log(fallos === 0 ? "\nOK: plantillas verificadas" : `\n${fallos} verificación(es) fallida(s)`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
