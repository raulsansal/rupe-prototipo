// Verifica el rol Administrador (plantilla, ADM-01 tablero, ADM-03 usuarios, moderación, catálogos y, en 5c, ADM-02 reportes, ADM-10, ADM-11 y ADM-12) con Playwright, sin abrir capturas:
//  · armazón: sin barra inferior ni campana, cajón (abrir, foco atrapado, Esc, clic fuera, ícono, elegir opción), barra lateral,
//    etiqueta «Administrador», «Cerrar sesión» y opciones pendientes que nunca dan 404;
//  · tablero: indicadores y gráficas que respetan el periodo, colores leídos de los tokens (claro y oscuro), valores visibles;
//  · usuarios: tarjetas y tabla, búsqueda y filtro, MOD-10, regla del último administrador activo, estados de carga y vacío;
//  · sin hex ni colores fijos fuera de globals.css, sin datos de usuarios en pantallas públicas, sin desbordes ni objetivos < 44 px.
// Opciones: --sin-build reutiliza el build · --base=URL usa un servidor que ya corre.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import { CASOS_ORIGEN } from "../src/mocks/casos";
import { CASOS_TABLERO, MOVIMIENTOS_CIERRE, reporteOraculo, tableroOraculo, type ResumenTableroOraculo } from "./mocks-de-prueba";
import { USUARIOS_INICIALES } from "../src/mocks/usuarios";
import { CASOS_MODERACION, AVISTAMIENTOS_MODERACION, FOLIO_MODERACION_ACTIVO, FOLIO_MODERACION_CANCELADO, FOLIO_MODERACION_DESHABILITADO, ID_AVISTAMIENTO_FALLECIDO, ID_AVISTAMIENTO_VISIBLE } from "../src/mocks/moderacion";
import { CATEGORIAS_MOTIVO, ESTADOS_ANIMAL, MOTIVOS, RAZAS } from "../src/mocks/catalogos";
import { AVISTAMIENTOS } from "../src/mocks/avistamientos";
import { CLAVE_TEMA } from "../src/lib/tema";
import { JPEG_REAL } from "../src/server/pruebas/imagenes";
import { elegirImagenGenerada, registrarPorLaInterfaz } from "./imagenes-pruebas";
import { filasDeHoja, leerXlsx } from "./lib/leerXlsx";
import { textoDePdf } from "./lib/textoPdf";
import { agregarSesion, credencial, fetchComo, NOMBRE_COOKIE, olvidarSesiones, reiniciarDatos, rolDeRuta, valorDeSesion, type RolPrueba } from "./sesion-pruebas";
import { BITACORA, ENTIDAD_DE_TIPO, TIPOS_ACCION } from "../src/mocks/bitacora";
import { esDeshabilitado } from "../src/lib/moderacion";
import { ALCALDIAS, ESTADOS_CASO, FUERA_DE_LA_CIUDAD } from "../src/mocks/tipos";
import { fechaLocalISO, formatearFechaCorta, formatearFechaHora } from "../src/lib/formato";

const PUERTO = 3108;
const baseExterna = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1];
const base = baseExterna ?? `http://localhost:${PUERTO}`;
const ANCHOS = [390, 768, 1280];
/** Hoy en la Ciudad de México (UTC−6) según el reloj de esta máquina (el servidor corre aquí). El periodo predeterminado del tablero es 1 oct → HOY; la base sintética termina el 18 de octubre. */
const hoyCDMX = (masDias = 0) => new Date(Date.now() - 6 * 3600_000 + masDias * 86_400_000).toISOString().slice(0, 10);
const PERIODO_BASE = { desde: "2026-10-01", hasta: "2026-10-18" } as const;
/** Registra un caso NUEVO como la persona tutora 1, por la API real (multipart «datos» + «fotografia»). Devuelve el folio. */
async function crearCasoPorApi(extra: Record<string, unknown> = {}): Promise<string> {
  const f = new FormData();
  f.set("datos", JSON.stringify({ nombre: "Nuevo", sexo: "Hembra", idRaza: 1, edad: { valor: 3, unidad: "años" }, tamano: "pequeño", color: "Blanco", fechaExtravio: hoyCDMX(), momento: "tarde", alcaldia: "Coyoacán", colonia: "Del Carmen", calle: "Calle Reservada 99", idMotivo: 1, ...extra }));
  f.set("fotografia", new Blob([JPEG_REAL as BlobPart], { type: "image/jpeg" }), "fotografia.jpg");
  const r = await fetch(`${base}/api/casos`, { method: "POST", headers: { Origin: new URL(base).origin, Cookie: `${NOMBRE_COOKIE}=${await valorDeSesion(base, "tutor1")}` }, body: f, redirect: "manual" });
  const j = (await r.json().catch(() => ({}))) as { folio?: string };
  if (r.status !== 201 || !j.folio) throw new Error(`No se pudo registrar el caso de prueba por la API: HTTP ${r.status}`);
  return j.folio;
}

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

/** Con la sesión REAL del Administrador (las rutas /admin las protege el servidor); `null` = sin sesión. */
async function nuevaPagina(navegador: Browser, ancho = 390, tema: "light" | "dark" = "light", rol: RolPrueba | null = "admin"): Promise<{ contexto: BrowserContext; pagina: Page }> {
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: 900 }, colorScheme: "light" });
  if (rol) await agregarSesion(contexto, base, rol);
  await contexto.addInitScript(([k, v]) => localStorage.setItem(k, v), [CLAVE_TEMA, tema]);
  return { contexto, pagina: await contexto.newPage() };
}

async function irA(pagina: Page, ruta: string) {
  await pagina.goto(`${base}${ruta}`, { waitUntil: "load" });
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForSelector("main h1");
}

const boton = (p: Page | Locator, nombre: string | RegExp) => p.getByRole("button", { name: nombre });
const enlace = (p: Page | Locator, nombre: string | RegExp) => p.getByRole("link", { name: nombre });
const foco = (p: Page) => p.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim() || document.activeElement?.tagName);
const dialogoAbierto = (p: Page) => p.evaluate(() => [...document.querySelectorAll("dialog")].some((d) => d.open));
const textoDescrito = (l: Locator) => l.evaluate((el) => (el.getAttribute("aria-describedby") ?? "").split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() ?? "").join(" | "));

async function desborde(pagina: Page, etiqueta: string) {
  const d = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ver(d <= 0, `${etiqueta}: sin desplazamiento horizontal`, `${etiqueta}: se desborda ${d}px`);
}

/** Áreas táctiles de 44 px; los controles de una tabla marcada con data-tabla-compacta están exentos (se listan en el mensaje). */
async function areasTactiles(pagina: Page, etiqueta: string) {
  const r = await pagina.evaluate(() => {
    const malos: string[] = [];
    let total = 0;
    let compactos = 0;
    const selector = "button, a[href], input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea, label:has(input[type=checkbox]), label:has(input[type=radio]), [role=group][tabindex], [role=tab]";
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (el.closest("[hidden]") || el.closest("[inert]")) continue;
      const rect = el.getBoundingClientRect();
      if (getComputedStyle(el).display === "none" || (rect.width <= 2 && rect.height <= 2)) continue;
      if (el instanceof HTMLAnchorElement && el.closest("p, label")) continue;
      if (el.closest("[data-tabla-compacta]")) {
        compactos++;
        continue;
      }
      total++;
      if (rect.height < 43.5 || (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) && rect.width < 43.5)) malos.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 28)}" ${Math.round(rect.width)}×${Math.round(rect.height)}px`);
    }
    return { malos, total, compactos };
  });
  ver(r.malos.length === 0, `${etiqueta}: ${r.total} controles de 44 px o más${r.compactos ? ` (+${r.compactos} en la tabla compacta, exentos)` : ""}`, `${etiqueta}: menores de 44 px → ${r.malos.join(" | ")}`);
}

// ---------- armazón ----------
const GRUPOS = ["Resumen", "Moderación", "Usuarios", "Catálogos", "Sistema"];
async function armazon(navegador: Browser) {
  let { contexto, pagina } = await nuevaPagina(navegador, 390);
  await irA(pagina, "/admin");
  const campana = await pagina.locator("header").locator("a[href*='avistamientos'], [aria-label*='Avistamientos'], [aria-label*='otificacion'], [aria-label*='campana']").count();
  ver(campana === 0 && (await pagina.locator("nav[aria-label='Navegación inferior']").count()) === 0, "plantilla del Administrador (390 px): sin campana de notificaciones y sin barra inferior", "plantilla del Administrador: hay campana o barra inferior");
  ver((await pagina.locator("header [role=img][aria-label^='Avatar de']").isVisible()) && !(await pagina.locator("header").getByText("Administrador", { exact: true }).isVisible()), "plantilla del Administrador (390 px): avatar en el encabezado; la etiqueta «Administrador» va dentro del cajón", "plantilla del Administrador: avatar o etiqueta incorrectos en móvil");
  const menu = pagina.getByRole("button", { name: "Menú", exact: true });
  await menu.click();
  const cajon = pagina.getByRole("dialog", { name: "Menú de administración" });
  ver((await cajon.isVisible()) && (await cajon.getByText("Administrador", { exact: true }).isVisible()) && JSON.stringify(await cajon.locator("h2").allTextContents()) === JSON.stringify(GRUPOS), "cajón: se abre con el ícono de menú, con la etiqueta «Administrador» y los 5 grupos (Resumen, Moderación, Usuarios, Catálogos, Sistema)", "cajón: no abrió o su contenido es incorrecto");
  const ultimo = await cajon.evaluate((d) => { const as = [...d.querySelectorAll("a, button")]; return as[as.length - 1]?.textContent?.trim(); });
  ver(ultimo === "Cerrar sesión" && (await boton(cajon, "Cerrar sesión").locator("xpath=ancestor::form").getAttribute("action")) === "/api/acceso/cerrar", "cajón: «Cerrar sesión» al final (formulario POST a /api/acceso/cerrar, que redirige a la página principal)", `cajón: último control «${ultimo}»`);
  // Foco atrapado: tabular muchas veces nunca saca el foco del cajón.
  // (Chrome puede pasar por su propia barra al dar la vuelta; el foco no debe quedar fuera dos pulsaciones seguidas ni al final.)
  let seguidas = 0;
  let maxSeguidas = 0;
  for (let i = 0; i < 40; i++) {
    await pagina.keyboard.press("Tab");
    seguidas = (await pagina.evaluate(() => !!document.activeElement?.closest("dialog"))) ? 0 : seguidas + 1;
    maxSeguidas = Math.max(maxSeguidas, seguidas);
  }
  ver(maxSeguidas < 2 && seguidas === 0, "cajón: el foco queda atrapado (40 pulsaciones de Tab sin salir del cajón)", `cajón: el foco salió (${maxSeguidas} pulsaciones seguidas fuera)`);
  await pagina.keyboard.press("Escape");
  ver(!(await dialogoAbierto(pagina)) && (await foco(pagina)) === "Menú", "cajón: Escape lo cierra y el foco vuelve al ícono de menú", "cajón: Escape no cerró o no devolvió el foco");
  await menu.click();
  await pagina.mouse.click(380, 450);
  ver(!(await dialogoAbierto(pagina)), "cajón: clic fuera lo cierra", "cajón: clic fuera no cerró");
  await menu.click();
  const caja = (await menu.boundingBox())!;
  await pagina.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
  ver(!(await dialogoAbierto(pagina)), "cajón: tocar el ícono de menú (que queda bajo el fondo oscurecido) lo cierra", "cajón: el ícono de menú no cerró el cajón");
  await menu.click();
  await boton(cajon, "Cerrar menú").click();
  ver(!(await dialogoAbierto(pagina)), "cajón: el botón de cerrar lo cierra", "cajón: el botón de cerrar no cerró");
  await menu.click();
  await enlace(cajon, "Usuarios").click();
  await pagina.waitForURL("**/admin/usuarios");
  ver(!(await dialogoAbierto(pagina)), "cajón: al elegir una opción navega y se cierra", "cajón: sigue abierto tras elegir una opción");
  await contexto.close();

  // Escritorio.
  ({ contexto, pagina } = await nuevaPagina(navegador, 1280));
  await irA(pagina, "/admin");
  const lateral = pagina.locator("aside nav[aria-label='Administración']");
  ver((await lateral.isVisible()) && JSON.stringify(await lateral.locator("h2").allTextContents()) === JSON.stringify(GRUPOS) && (await pagina.getByRole("button", { name: "Menú", exact: true }).count()) === 0, "plantilla del Administrador (1280 px): barra lateral con los 5 grupos y sin botón de menú", "plantilla del Administrador (1280 px): barra lateral incorrecta");
  ver((await pagina.locator("header").getByText("Administrador", { exact: true }).isVisible()) && (await pagina.locator("header [role=img][aria-label^='Avatar de']").isVisible()) && (await pagina.locator("header").locator("a[href*='avistamientos'], [aria-label*='otificacion']").count()) === 0, "plantilla del Administrador (1280 px): avatar y etiqueta «Administrador» en el encabezado, sin campana", "plantilla del Administrador (1280 px): encabezado incorrecto");
  ver((await pagina.locator("aside").getByRole("link", { name: "Tablero" }).getAttribute("aria-current")) === "page" && (await boton(pagina.locator("aside"), "Cerrar sesión").isVisible()), "barra lateral: «Tablero» activo y «Cerrar sesión» al pie", "barra lateral: activo o Cerrar sesión incorrectos");
  await irA(pagina, "/admin/usuarios");
  ver((await pagina.locator("aside").getByRole("link", { name: "Usuarios" }).getAttribute("aria-current")) === "page", "barra lateral: «Usuarios» activo en ADM-03", "barra lateral: «Usuarios» no está activo");
  // Las 12 opciones del menú llevan a pantallas reales (ya no queda ninguna «Pantalla pendiente») y la opción de la ruta queda resaltada; las desconocidas dan 404.
  const hrefs = await lateral.locator("a").evaluateAll((as) => as.map((a) => [a.getAttribute("href")!, a.textContent!.trim()]));
  const malos: string[] = [];
  for (const [h, etiqueta] of hrefs) {
    const r = await pagina.goto(`${base}${h}`, { waitUntil: "load" });
    const t = await pagina.locator("main").innerText();
    const activo = await pagina.locator("aside").getByRole("link", { name: etiqueta, exact: true }).first().getAttribute("aria-current");
    if (r?.status() !== 200 || /Esta pantalla se construye en un bloque posterior/.test(t) || (await pagina.locator("main h1").count()) !== 1 || activo !== "page") malos.push(`${h} → ${r?.status()} ${activo}`);
  }
  ver(hrefs.length === 12 && malos.length === 0, `menú: las ${hrefs.length} opciones llevan a pantallas reales (sin «Pantalla pendiente»), con la opción activa resaltada`, `menú: ${malos.join("; ")}`);
  const x = await pagina.goto(`${base}/admin/no-existe`, { waitUntil: "load" });
  ver(x?.status() === 404, "una ruta de administración desconocida responde 404 (TRA-01)", `ruta desconocida: HTTP ${x?.status()}`);
  await contexto.close();
}

// ---------- encabezados de grupo del menú ----------
/** Mide los encabezados (h2) y las opciones (enlaces) del menú que cuelga de `raiz`: fondo EFECTIVO de cada uno (el primer ancestro con color), token, foco y cursor. */
const medirMenu = (pagina: Page, raiz: string) =>
  pagina.evaluate<{ encabezado: string; opcion: string; activa: string; tokenEncabezado: string; tokenSuperficie: string; tokenPrimario: string; tokenSoft: string; etiqueta: string; tabIndex: number; rol: string | null; cursor: string; altoOpcion: number; enlace: string }>(
    `(function(){
      var nav = document.querySelector(${JSON.stringify(raiz)});
      var h = nav.querySelector("h2");
      var opcion = Array.prototype.find.call(nav.querySelectorAll("a"), function(a){ return a.getAttribute("aria-current") !== "page"; });
      var activa = nav.querySelector("a[aria-current=page]");
      function efectivo(el){ for (var e = el; e; e = e.parentElement) { var c = getComputedStyle(e).backgroundColor; if (!/^rgba\\(0, 0, 0, 0\\)$|^transparent$/.test(c)) return c; } return "?"; }
      function token(n){ var d = document.createElement("div"); document.body.append(d); d.style.backgroundColor = "var(--" + n + ")"; var c = getComputedStyle(d).backgroundColor; d.remove(); return c; }
      return { encabezado: efectivo(h), opcion: efectivo(opcion), activa: efectivo(activa), tokenEncabezado: token("menu-encabezado"), tokenSuperficie: token("surface"), tokenPrimario: token("primary"), tokenSoft: token("primary-soft"),
        etiqueta: h.tagName, tabIndex: h.tabIndex, rol: h.getAttribute("role"), cursor: getComputedStyle(h).cursor, altoOpcion: opcion.getBoundingClientRect().height, enlace: opcion.textContent.trim() };
    })()`,
  );

/** Los ENCABEZADOS de grupo del menú del Administrador se distinguen de las opciones (fondo gris tenue del token --menu-encabezado, en claro y en oscuro) y no son interactivos; las opciones conservan activo, hover y foco. */
async function menuEncabezados(navegador: Browser) {
  for (const tema of ["light", "dark"] as const) {
    const nombreTema = tema === "light" ? "claro" : "oscuro";
    let { contexto, pagina } = await nuevaPagina(navegador, 1280, tema);
    await irA(pagina, "/admin");
    const raiz = "aside nav[aria-label='Administración']";
    const m = await medirMenu(pagina, raiz);
    ver(m.encabezado === m.tokenEncabezado && m.encabezado !== m.opcion && m.opcion === m.tokenSuperficie, `menú lateral (${nombreTema}): el fondo del encabezado (${m.encabezado}, token --menu-encabezado) difiere del de una opción (${m.opcion}, la superficie del menú)`, `menú lateral (${nombreTema}): encabezado ${m.encabezado} · opción ${m.opcion} · token ${m.tokenEncabezado}`);
    const h = pagina.locator(`${raiz} h2`).first();
    await h.hover();
    const trasHover = (await medirMenu(pagina, raiz)).encabezado;
    await pagina.mouse.move(700, 600);
    const enfocados: string[] = [];
    await pagina.locator("body").click({ position: { x: 700, y: 600 } });
    for (let i = 0; i < 45; i++) {
      await pagina.keyboard.press("Tab");
      enfocados.push(await pagina.evaluate(() => document.activeElement?.tagName ?? "?"));
    }
    ver(m.etiqueta === "H2" && m.tabIndex === -1 && m.rol === null && m.cursor !== "pointer" && trasHover === m.encabezado && !enfocados.includes("H2") && enfocados.includes("A"), `menú lateral (${nombreTema}): el encabezado no es un botón ni se enfoca (h2, tabIndex -1, sin rol, cursor «${m.cursor}», sin cambio al pasar el puntero; 45 Tab sin enfocarlo y sí a los enlaces)`, `menú lateral (${nombreTema}): etiqueta ${m.etiqueta} tabIndex ${m.tabIndex} rol ${m.rol} cursor ${m.cursor} hover ${m.encabezado}→${trasHover} Tab ${[...new Set(enfocados)]}`);
    const opcion = pagina.locator(`${raiz} a`).filter({ hasText: m.enlace }).first();
    await opcion.hover();
    const hover = await pagina.evaluate<string>(`(function(){ var a = Array.prototype.find.call(document.querySelectorAll(${JSON.stringify(raiz + " a")}), function(x){ return x.textContent.trim() === ${JSON.stringify(m.enlace)}; }); return getComputedStyle(a).backgroundColor; })()`);
    await opcion.focus();
    const anillo = await pagina.evaluate<boolean>(`(function(){ var a = document.activeElement; var c = getComputedStyle(a); return a.tagName === "A" && c.outlineStyle !== "none" && c.outlineWidth !== "0px"; })()`);
    ver(m.activa === m.tokenPrimario && hover === m.tokenSoft && anillo && m.altoOpcion >= 44, `menú lateral (${nombreTema}): las opciones conservan su estilo (activa con --primary, hover con --primary-soft, anillo de foco visible, ${Math.round(m.altoOpcion)} px de alto ≥ 44)`, `menú lateral (${nombreTema}): activa ${m.activa} · hover ${hover} (esperado ${m.tokenSoft}) · anillo ${anillo} · alto ${m.altoOpcion}`);
    await contexto.close();
    ({ contexto, pagina } = await nuevaPagina(navegador, 390, tema));
    await irA(pagina, "/admin");
    await pagina.getByRole("button", { name: "Menú", exact: true }).click();
    await pagina.getByRole("dialog", { name: "Menú de administración" }).waitFor();
    const c = await medirMenu(pagina, "dialog nav");
    ver(c.encabezado === c.tokenEncabezado && c.encabezado !== c.opcion && c.tabIndex === -1 && c.altoOpcion >= 44, `cajón móvil (${nombreTema}): el mismo componente: encabezado ${c.encabezado} ≠ opción ${c.opcion}, sin foco y con opciones de ${Math.round(c.altoOpcion)} px`, `cajón móvil (${nombreTema}): encabezado ${c.encabezado} · opción ${c.opcion} · tabIndex ${c.tabIndex}`);
    await contexto.close();
  }
}

// ---------- tablero ----------
const valorDe = (p: Page, titulo: string) => p.locator("article", { has: p.getByRole("heading", { name: titulo, exact: true }) }).locator("p.text-cifra").innerText();
const fmtProm = (n: number | null) => (n === null ? "—" : `${n.toFixed(1)} días`);

async function comprobarKpis(pagina: Page, t: ResumenTableroOraculo, etiqueta: string) {
  const real = [await valorDe(pagina, "Casos activos"), await valorDe(pagina, "Casos localizados"), await valorDe(pagina, "Total de avistamientos"), await valorDe(pagina, "Promedio de tiempo de localización"), await valorDe(pagina, "Avistamientos ocultos")];
  const esperado = [String(t.casosActivos), String(t.casosLocalizados), String(t.totalAvistamientos), fmtProm(t.promedioLocalizacion), String(t.avistamientosOcultos)];
  ver(JSON.stringify(real) === JSON.stringify(esperado), `${etiqueta}: indicadores ${real.join(" · ")}`, `${etiqueta}: indicadores ${real.join(" · ")}; se esperaba ${esperado.join(" · ")}`);
}

async function tablero(navegador: Browser) {
  const def = tableroOraculo(PERIODO_BASE); // el predeterminado es 1 oct → hoy, pero la base termina el 18: mismas cifras
  const HOY = hoyCDMX();
  let { contexto, pagina } = await nuevaPagina(navegador, 390);
  await irA(pagina, "/admin");
  const titulos = await pagina.locator("main article h3").allTextContents();
  ver(JSON.stringify(titulos) === JSON.stringify(["Casos activos", "Casos localizados", "Total de avistamientos", "Promedio de tiempo de localización", "Avistamientos ocultos"]), "ADM-01: los 5 indicadores de la HU 055", `ADM-01: indicadores ${titulos.join(", ")}`);
  // En móvil el orden visual (de arriba abajo) es el de siempre, aunque el DOM agrupe las tarjetas por columna de escritorio.
  const graficas = await pagina.evaluate(() => [...document.querySelectorAll<HTMLElement>("main figure")].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map((f) => f.querySelector("h3")!.textContent!));
  ver(JSON.stringify(graficas) === JSON.stringify(["Casos por categoría de motivo", "Casos por estado del caso", "Casos cerrados por tipo de cierre", "Avistamientos por estado del animal", "Avistamientos por alcaldía"]), "ADM-01 en móvil: las 5 gráficas en una sola columna y en el orden de siempre (motivo, estado del caso, cierres, estado del animal y alcaldía)", `ADM-01: gráficas ${graficas.join(", ")}`);
  const actualizacion = (await pagina.getByText(/Última actualización: /).innerText()).match(/Última actualización: (\d{1,2} [a-z]{3} \d{4}, \d{2}:\d{2})/)?.[1];
  const esperada = formatearFechaHora(new Date().toISOString());
  const minutos = (t: string) => Number(t.slice(-5, -3)) * 60 + Number(t.slice(-2));
  const cerca = !!actualizacion && actualizacion.slice(0, -6) === esperada.slice(0, -6) && Math.abs(minutos(actualizacion) - minutos(esperada)) <= 3;
  ver((await pagina.getByText(`1 oct 2026 – ${formatearFechaCorta(HOY)}`).isVisible()) && cerca && !(await pagina.getByText(/10:42/).count()) && (await boton(pagina, "Actualizar tablero").isVisible()) && (await boton(pagina, "Aplicar periodo").isVisible()), `ADM-01: periodo por defecto «1 oct 2026 – ${formatearFechaCorta(HOY)}» (hoy), «Última actualización: ${actualizacion}» con la hora REAL del servidor (${esperada} ahora), «Aplicar periodo» y «Actualizar tablero»`, `ADM-01: periodo, hora de actualización (${actualizacion} vs ${esperada}) o botones`);
  ver(!(await pagina.locator("main").innerText()).includes("Datos ficticios") && (await pagina.locator("#periodo-desde").getAttribute("min")) === "2026-06-01" && (await pagina.locator("#periodo-hasta").getAttribute("max")) === HOY && (await pagina.locator("#periodo-desde").getAttribute("max")) === HOY, `ADM-01: sin «Datos ficticios»; los campos de fecha limitan de 2026-06-01 a hoy (${HOY})`, "ADM-01: queda «Datos ficticios» o los límites de las fechas no son los reales");
  await comprobarKpis(pagina, def, "ADM-01 (periodo por defecto)");
  ver((await pagina.locator("main section[aria-label=Indicadores]").evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(" ").length)) === 2, "ADM-01 en móvil: indicadores en 2 columnas", "ADM-01 en móvil: columnas de indicadores incorrectas");
  await boton(pagina, "Actualizar tablero").click();
  ver(await pagina.getByRole("status").getByText("Tablero actualizado").waitFor({ timeout: 3000 }).then(() => true, () => false), "ADM-01: «Actualizar tablero» lo anuncia (role=\"status\")", "ADM-01: «Actualizar tablero» no respondió");
  // Invariantes de las gráficas con el periodo por defecto.
  const suma = (b: { valor: number }[]) => b.reduce((s, x) => s + x.valor, 0);
  ver(suma(def.porMotivo) === def.totalCasos && suma(def.porEstadoCaso) === def.totalCasos && def.casosActivos === def.porEstadoCaso.slice(0, 4).reduce((s, x) => s + x.valor, 0) && suma(def.porAlcaldia) === def.totalAvistamientos && def.porEstadoAnimal.flatMap((g) => g.barras).length === 17, `datos: casos por motivo y por estado suman los ${def.totalCasos} casos, los activos son los 4 estados activos, las alcaldías suman los ${def.totalAvistamientos} avistamientos y hay 17 estados del animal`, "datos del tablero incoherentes");
  // Coherencia de las cifras (HU 055) en varios periodos: los mocks no deben volver a desalinearse.
  // Estados, activos y localizados cuentan casos REGISTRADOS en el periodo; los cierres, movimientos con FECHA de cierre en el periodo (regla 6).
  const periodos = [PERIODO_BASE, { desde: "2026-09-01", hasta: "2026-09-30" }, { desde: "2026-06-01", hasta: "2026-10-18" }, { desde: "2026-08-10", hasta: "2026-08-16" }, { desde: "2026-10-18", hasta: "2026-10-18" }];
  const incoherentes: string[] = [];
  const movimientosMal = MOVIMIENTOS_CIERRE.filter((m) => m.fecha < CASOS_TABLERO[m.folioIndice].fecha || m.fecha > PERIODO_BASE.hasta || CASOS_TABLERO[m.folioIndice].estado !== "Cerrado");
  if (movimientosMal.length) incoherentes.push(`${movimientosMal.length} movimientos de cierre con fecha anterior al registro, posterior a hoy o de un caso que no está en «Cerrado»`);
  for (const per of periodos) {
    const r = tableroOraculo(per);
    const est = Object.fromEntries(r.porEstadoCaso.map((e) => [e.nombre, e.valor]));
    const cier = Object.fromEntries(r.cierres.map((e) => [e.nombre, e.valor]));
    const et = `${per.desde}..${per.hasta}`;
    const registrados = CASOS_TABLERO.filter((c) => c.fecha >= per.desde && c.fecha <= per.hasta);
    const confirmadosRegistrados = registrados.filter((c) => c.cierre === "Cierre confirmado").length;
    if (suma(r.porEstadoCaso) !== r.totalCasos) incoherentes.push(`${et}: los 6 estados suman ${suma(r.porEstadoCaso)} y el total es ${r.totalCasos}`);
    if (r.casosLocalizados !== est["Localizado"] + confirmadosRegistrados) incoherentes.push(`${et}: localizados ${r.casosLocalizados} ≠ Localizado ${est["Localizado"]} + cierres confirmados de los casos registrados ${confirmadosRegistrados}`);
    if (r.casosActivos !== est["Extraviado"] + est["En búsqueda"] + est["Avistamiento reportado"] + est["En seguimiento"]) incoherentes.push(`${et}: activos ${r.casosActivos} ≠ suma de los 4 estados activos`);
    if (r.casosActivos + r.casosLocalizados > r.totalCasos || suma(r.porMotivo) !== r.totalCasos) incoherentes.push(`${et}: un número de los casos del periodo supera al total`);
    for (const tipo of ["Cierre confirmado", "Cancelación", "Deshabilitación"] as const) {
      const propio = MOVIMIENTOS_CIERRE.filter((m) => m.tipo === tipo && m.fecha >= per.desde && m.fecha <= per.hasta).length;
      if (cier[tipo] !== propio) incoherentes.push(`${et}: ${tipo} ${cier[tipo]} ≠ ${propio} movimientos con fecha en el periodo`);
    }
  }
  ver(incoherentes.length === 0, `coherencia de cifras en ${periodos.length} periodos: los 6 estados suman el total; localizados = Localizado + cierres confirmados de los casos registrados; activos = suma de los 4 estados activos; cada tipo de cierre = movimientos con fecha dentro del periodo (aunque el caso sea anterior)`, `cifras incoherentes → ${incoherentes.join(" | ")}`);
  ver(def.cierres.map((c) => c.nombre).join() === "Cierre confirmado,Cancelación,Deshabilitación" && suma(def.cierres) === MOVIMIENTOS_CIERRE.filter((m) => m.fecha >= PERIODO_BASE.desde && m.fecha <= PERIODO_BASE.hasta).length, `periodo por defecto: cierres ${def.cierres.map((c) => `${c.nombre} ${c.valor}`).join(" · ")}, derivados de movimientos fechados; Cerrado (estado de los casos registrados) = ${def.porEstadoCaso.find((e) => e.nombre === "Cerrado")!.valor}, otra base`, "periodo por defecto: los cierres no salen de los movimientos fechados");
  const tablaMotivo = await pagina.locator("figure", { has: pagina.getByRole("heading", { name: "Casos por categoría de motivo" }) }).locator("div.sr-only table tbody tr").evaluateAll((trs) => trs.map((t) => [t.querySelector("th")!.textContent, Number(t.querySelector("td")!.textContent)]));
  ver(JSON.stringify(tablaMotivo) === JSON.stringify(def.porMotivo.map((b) => [b.nombre, b.valor])), "gráfica de motivos: la tabla alternativa para lectores de pantalla trae los mismos valores", "gráfica de motivos: la tabla alternativa no coincide");
  const visibles = await pagina.locator("figure", { has: pagina.getByRole("heading", { name: "Casos por categoría de motivo" }) }).locator("[aria-hidden=true] > div > div").evaluateAll((filas) => filas.map((f) => f.textContent!.trim()));
  ver(def.porMotivo.every((b, i) => visibles[i].includes(b.nombre) && visibles[i].endsWith(String(b.valor))), "gráfica de motivos: cada barra lleva su etiqueta y su valor (no depende solo del color)", `gráfica de motivos: ${visibles.join(" | ")}`);
  const animal = await pagina.locator("figure", { has: pagina.getByRole("heading", { name: "Avistamientos por estado del animal" }) }).locator("[aria-hidden=true] > div > p").allTextContents();
  ver(JSON.stringify(animal) === JSON.stringify(["Integridad física y salud", "Contención y ubicación", "Conducta", "Identificación visible"]), "gráfica de estados del animal: agrupada por las 4 categorías del catálogo", `gráfica de estados del animal: grupos ${animal.join(", ")}`);
  const leyenda = await pagina.locator("figure", { has: pagina.getByRole("heading", { name: "Casos por estado del caso" }) }).locator("ul li").allTextContents();
  ver(leyenda.length === 6 && def.porEstadoCaso.every((e, i) => leyenda[i] === `${e.nombre}${e.valor}`), "gráfica por estado del caso: leyenda con el nombre y la cantidad de cada uno de los 6 estados", `gráfica por estado: ${leyenda.join(" | ")}`);

  // Periodo.
  const otro = { desde: "2026-09-01", hasta: "2026-09-30" };
  await pagina.getByLabel("Desde").fill(otro.desde);
  await pagina.getByLabel("Hasta").fill(otro.hasta);
  await boton(pagina, "Aplicar periodo").click();
  await pagina.waitForURL(`**/admin?desde=${otro.desde}&hasta=${otro.hasta}`);
  const t2 = tableroOraculo(otro);
  await comprobarKpis(pagina, t2, "ADM-01 (1 al 30 de septiembre)");
  ver(t2.totalCasos !== def.totalCasos && (await pagina.getByText("1 sep 2026 – 30 sep 2026").isVisible()), "ADM-01: el selector de periodo cambia los indicadores y la etiqueta del periodo", "ADM-01: el periodo no cambió los indicadores");
  const sumaMotivo = (await pagina.locator("figure", { has: pagina.getByRole("heading", { name: "Casos por categoría de motivo" }) }).locator("div.sr-only table tbody td").allTextContents()).reduce((s, x) => s + Number(x), 0);
  ver(sumaMotivo === t2.totalCasos, `ADM-01: las gráficas también respetan el periodo (${t2.totalCasos} casos en septiembre)`, "ADM-01: las gráficas no respetaron el periodo");
  // Un periodo inválido ya no cae en silencio al periodo por defecto: el SERVIDOR lo rechaza y la página muestra su mensaje bajo el campo, sin indicadores.
  for (const [d, h, msg, campo] of [["2026-10-10", "2026-10-01", "no puede ser posterior", "Hasta"], ["2026-10-01", hoyCDMX(1), "después de hoy", "Hasta"], ["2026-05-01", "2026-10-01", "1 de junio de 2026", "Desde"]] as const) {
    await pagina.getByLabel("Desde").fill(d);
    await pagina.getByLabel("Hasta").fill(h);
    await boton(pagina, "Aplicar periodo").click();
    await pagina.waitForURL(`**/admin?desde=${d}&hasta=${h}`);
    const entrada = pagina.getByLabel(campo);
    await entrada.waitFor();
    ver((await entrada.getAttribute("aria-invalid")) === "true" && (await textoDescrito(entrada)).includes(msg) && (await pagina.locator("main article").count()) === 0 && (await pagina.getByLabel("Desde").inputValue()) === d, `ADM-01: periodo ${d} a ${h} rechazado por el servidor («…${msg}…» bajo «${campo}»), sin indicadores y conservando lo escrito`, `ADM-01: periodo inválido ${d} a ${h} no se rechazó como se esperaba`);
  }
  await irA(pagina, "/admin?desde=basura&hasta=2026-10-01");
  ver((await pagina.getByLabel("Desde").getAttribute("aria-invalid")) === "true" && (await pagina.locator("main article").count()) === 0 && !(await pagina.getByText(/Última actualización/).count()), "ADM-01: ?desde=basura → error del servicio («Elige una fecha válida.») y NO el periodo por defecto en silencio", "ADM-01: un periodo inválido de la URL cayó en silencio al periodo por defecto");
  // Un periodo sin datos REALES: del 19 de octubre en adelante no hay casos ni avistamientos (la base termina el 18 y esta sección parte de datos reiniciados): ceros y promedio «—».
  await irA(pagina, "/admin?desde=2026-10-19&hasta=2026-10-19");
  const ceros = [await valorDe(pagina, "Casos activos"), await valorDe(pagina, "Casos localizados"), await valorDe(pagina, "Total de avistamientos"), await valorDe(pagina, "Promedio de tiempo de localización"), await valorDe(pagina, "Avistamientos ocultos")];
  ver(JSON.stringify(ceros) === JSON.stringify(["0", "0", "0", "—", "0"]), `ADM-01: periodo sin datos (19 oct 2026): indicadores ${ceros.join(" · ")}`, `ADM-01: periodo sin datos: ${ceros.join(" · ")}`);
  await contexto.close();

  // Colores de las gráficas: salen de los tokens, en claro y en oscuro.
  for (const tema of ["light", "dark"] as const) {
    ({ contexto, pagina } = await nuevaPagina(navegador, 1280, tema));
    await irA(pagina, "/admin");
    const nombreTema = tema === "light" ? "claro" : "oscuro";
    // Leyenda y barra: cada tramo y su cuadro de la leyenda usan exactamente el mismo color (el mismo token --barra-estado-*).
    const coinciden = await pagina.evaluate(() => {
      const fig = [...document.querySelectorAll("main figure")].find((f) => f.querySelector("h3")?.textContent === "Casos por estado del caso")!;
      const tramos = [...fig.querySelectorAll<HTMLElement>("div[aria-hidden=true] > span")].map((x) => [/bg-(barra-estado-[a-z-]+)/.exec(x.className)![1], getComputedStyle(x).backgroundColor]);
      const cuadros = [...fig.querySelectorAll<HTMLElement>("ul li > span:first-child")].map((x) => [/bg-(barra-estado-[a-z-]+)/.exec(x.className)![1], getComputedStyle(x).backgroundColor]);
      const mapa = new Map(cuadros.map(([n, c]) => [n, c]));
      return { tramos: tramos.length, cuadros: cuadros.length, distintos: new Set(cuadros.map(([, c]) => c)).size, ok: tramos.every(([n, c]) => mapa.get(n) === c) };
    });
    ver(coinciden.ok && coinciden.cuadros === 6 && coinciden.distintos === 6, `barra por estado (${nombreTema}): los ${coinciden.tramos} tramos y los 6 cuadros de la leyenda usan los mismos tokens, con 6 colores distintos`, `barra por estado (${nombreTema}): ${JSON.stringify(coinciden)}`);
    if (tema === "light") {
      // Escritorio: dos columnas independientes; la diferencia de altura entre ellas es menor que la tarjeta más baja.
      const cajas = await pagina.evaluate(() => [...document.querySelectorAll<HTMLElement>("main section[aria-label=Gráficas] figure")].map((f) => { const r = f.getBoundingClientRect(); return { x: Math.round(r.left), top: r.top + scrollY, h: r.height }; }));
      const xs = [...new Set(cajas.map((c) => c.x))];
      const fondo = (x: number) => Math.max(...cajas.filter((c) => c.x === x).map((c) => c.top + c.h));
      const base = Math.min(...cajas.map((c) => c.top));
      const minAlto = Math.min(...cajas.map((c) => c.h));
      const dif = xs.length === 2 ? Math.abs(fondo(xs[0]) - fondo(xs[1])) : Infinity;
      ver(xs.length === 2 && cajas.length === 5 && dif < minAlto, `ADM-01 (1280 px): 2 columnas de gráficas (${xs.map((x) => `${cajas.filter((c) => c.x === x).length} tarjetas`).join(" y ")}); alto ${Math.round(fondo(xs[0]) - base)} y ${Math.round(fondo(xs[1]) - base)} px, diferencia ${Math.round(dif)} px < ${Math.round(minAlto)} px (la tarjeta más baja)`, `ADM-01 (1280 px): columnas ${xs.length}, diferencia de altura ${Math.round(dif)} px, tarjeta más baja ${Math.round(minAlto)} px`);
    }
    const c = await pagina.evaluate(() => {
      const barra = document.querySelector("figure span.bg-chart-1") as HTMLElement;
      const segmento = [...document.querySelectorAll<HTMLElement>("figure div[aria-hidden=true] > span")].find((s) => s.className.includes("barra-estado-"))!;
      const nombre = /bg-(barra-estado-[a-z-]+)/.exec(segmento.className)![1];
      const sonda = document.createElement("div");
      document.body.appendChild(sonda);
      sonda.style.backgroundColor = "var(--chart-1)";
      const chart1 = getComputedStyle(sonda).backgroundColor;
      sonda.style.backgroundColor = `var(--${nombre})`;
      const tokenSegmento = getComputedStyle(sonda).backgroundColor;
      const res = { barra: getComputedStyle(barra).backgroundColor, chart1, segmento: getComputedStyle(segmento).backgroundColor, tokenSegmento };
      sonda.remove();
      return res;
    });
    ver(c.barra === c.chart1 && c.segmento === c.tokenSegmento, `gráficas (${tema === "light" ? "claro" : "oscuro"}): las barras usan --chart-1 (${c.chart1}) y los segmentos por estado los tokens --barra-estado-* (${c.tokenSegmento})`, `gráficas (${tema}): colores ${JSON.stringify(c)}`);
    if (tema === "dark") ver((await pagina.getAttribute("html", "data-theme")) === "dark", "gráficas: modo oscuro activo", "gráficas: el modo oscuro no se aplicó");
    await contexto.close();
  }
  // «Actualizar» recalcula DE VERDAD (al final, porque deja un caso nuevo en el almacén): un caso registrado por la API mientras la pantalla está abierta aparece al actualizar, sin recargar.
  ({ contexto, pagina } = await nuevaPagina(navegador, 1280));
  await irA(pagina, "/admin");
  const activosAntes = await valorDe(pagina, "Casos activos");
  const folioNuevo = await crearCasoPorApi();
  await boton(pagina, "Actualizar tablero").click();
  const esperado = String(Number(activosAntes) + 1);
  await pagina.locator("article", { has: pagina.getByRole("heading", { name: "Casos activos", exact: true }) }).locator("p.text-cifra", { hasText: new RegExp(`^${esperado}$`) }).waitFor({ timeout: 8000 }).catch(() => undefined);
  const activosDespues = await valorDe(pagina, "Casos activos");
  ver(activosDespues === esperado && Number(activosAntes) === def.casosActivos, `ADM-01: «Actualizar tablero» recalcula de verdad: «Casos activos» ${activosAntes} → ${activosDespues} tras registrar ${folioNuevo} por la API (sin recargar la página)`, `ADM-01: «Actualizar tablero» no recalculó (activos ${activosAntes} → ${activosDespues})`);
  await contexto.close();
}

// ---------- usuarios ----------
const tarjeta = (p: Page, id: number) => p.locator(`ul > li[data-usuario="${id}"]`);
const fila = (p: Page, id: number) => p.locator(`tr[data-usuario="${id}"]`);

/** Navega (formularios GET, enlaces) y espera a que la página nueva termine de cargar. */
async function navegando(pagina: Page, accion: () => Promise<unknown>) {
  await Promise.all([pagina.waitForNavigation({ waitUntil: "load" }), accion()]);
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForSelector("main h1");
}
/** Espera (hasta 8 s) a que una condición asincrónica sea cierta: las acciones reales terminan con router.refresh(). */
async function hasta(condicion: () => Promise<boolean>, ms = 8000): Promise<boolean> {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    if (await condicion().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

/** Pulsa un control de paginación (navegación del cliente) y espera a que la página cambie. */
async function cambiarPagina(pagina: Page, nombre: string) {
  const actual = () => pagina.locator("nav[aria-label='Paginación'] [aria-current='page']").getAttribute("aria-label");
  const antes = await actual();
  await boton(pagina, nombre).click();
  await hasta(async () => (await actual()) !== antes || antes === nombre);
  await pagina.waitForTimeout(150);
}

async function usuarios(navegador: Browser) {
  let { contexto, pagina } = await nuevaPagina(navegador, 390);
  await irA(pagina, "/admin/usuarios");
  const ids = async () => pagina.locator("ul > li[data-usuario]").evaluateAll((l) => l.map((x) => Number(x.getAttribute("data-usuario"))));
  const aviso = (re: RegExp) => hasta(() => pagina.getByRole("status").getByText(re).isVisible());
  ver(JSON.stringify(await ids()) === "[1,2,3,4,5]" && (await pagina.locator("table[data-tabla-compacta]").isVisible()) === false, "ADM-03 en móvil: 5 tarjetas por página (del almacén) y la tabla no se muestra", "ADM-03 en móvil: tarjetas o tabla incorrectas");
  const r = await pagina.locator("main").innerText();
  ver(/1–5 de 12 usuarios/.test(r) && (await tarjeta(pagina, 1).getByText("Rol: Administrador").isVisible()) && (await tarjeta(pagina, 1).getByText("Activo", { exact: true }).isVisible()) && /Última modificación: 12 oct 2026/.test(await tarjeta(pagina, 1).innerText()), "ADM-03: tarjeta del usuario 1 con nombre, correo, rol, estatus y fecha de última modificación", "ADM-03: tarjeta 1 incorrecta");
  ver((await tarjeta(pagina, 3).evaluate((e) => getComputedStyle(e).borderStyle)) === "dashed" && (await tarjeta(pagina, 3).getByText("Inactivo", { exact: true }).isVisible()) && (await boton(tarjeta(pagina, 3), /^Habilitar a/).isVisible()), "ADM-03: la cuenta inactiva lleva borde discontinuo, «Inactivo» y «Habilitar»", "ADM-03: cuenta inactiva incorrecta");
  // Regla del último administrador activo (R21).
  const ricardo = tarjeta(pagina, 1);
  const bloq = [await boton(ricardo, /^Cambiar rol de/).isDisabled(), await boton(ricardo, /^Deshabilitar a/).isDisabled()];
  ver(bloq.every(Boolean) && /Último administrador activo: no se puede deshabilitar ni cambiar su rol/.test(await textoDescrito(boton(ricardo, /^Deshabilitar a/))), "último administrador activo: «Cambiar rol» y «Deshabilitar» deshabilitados y con su motivo a la vista (aria-describedby)", "último administrador: acciones sin bloquear o sin motivo");
  ver((await boton(tarjeta(pagina, 2), /^Cambiar rol de/).isEnabled()) && (await boton(tarjeta(pagina, 2), /^Deshabilitar a/).isEnabled()), "las demás cuentas conservan sus acciones", "otras cuentas con acciones bloqueadas");

  // Habilitar a la otra administradora (acción REAL): ya no es el último.
  await boton(tarjeta(pagina, 4), /^Habilitar a/).click();
  let dlg = pagina.getByRole("dialog", { name: "Habilitar cuenta" });
  ver((await dlg.isVisible()) && (await dlg.getByText("Carmen Ortiz Ejemplo").isVisible()) && (await dlg.getByRole("button").allInnerTexts()).join("|") === "Cancelar|Confirmar", "MOD-10 «Habilitar cuenta»: nombre, correo y botones «Cancelar» y «Confirmar»", "MOD-10 habilitar: contenido incorrecto");
  await boton(dlg, "Confirmar").click();
  ver(await hasta(async () => !(await dialogoAbierto(pagina)) && (await tarjeta(pagina, 4).getByText("Activo", { exact: true }).isVisible()) && (await boton(ricardo, /^Cambiar rol de/).isEnabled()) && (await boton(ricardo, /^Deshabilitar a/).isEnabled())), "habilitar a Carmen es REAL: pasa a «Activo», Ricardo deja de ser el último y sus acciones se habilitan (la pantalla se refrescó con el servidor)", "habilitar a Carmen: la pantalla no refleja el cambio");
  ver(await aviso(/Cuenta de Carmen Ortiz Ejemplo habilitada/), "MOD-10: el resultado se anuncia (role=\"status\")", "MOD-10: sin aviso de resultado");
  // Deshabilitar a Carmen (sin sesiones abiertas): el aviso NO afirma que se cerraron sesiones.
  await boton(tarjeta(pagina, 4), /^Deshabilitar a/).click();
  dlg = pagina.getByRole("dialog", { name: "Deshabilitar cuenta" });
  ver(/no podrá iniciar sesión y, si tiene sesiones abiertas, se cerrarán/.test(await dlg.innerText()), "MOD-10 «Deshabilitar cuenta»: advierte que no podrá iniciar sesión y que se cerrarán las sesiones abiertas (si las hay)", "MOD-10 deshabilitar: falta la advertencia");
  await boton(dlg, "Confirmar").click();
  ver(await hasta(async () => (await tarjeta(pagina, 4).getByText("Inactivo", { exact: true }).isVisible()) && (await boton(ricardo, /^Deshabilitar a/).isDisabled()) && (await ricardo.getByText(/Último administrador activo/).isVisible())), "al deshabilitar a Carmen, Ricardo vuelve a ser el último administrador activo y se bloquea", "deshabilitar a Carmen: Ricardo no volvió a bloquearse");
  ver(await aviso(/Cuenta de Carmen Ortiz Ejemplo deshabilitada; no tenía sesiones abiertas/), "el aviso es fiel: Carmen no tenía sesiones, así que NO dice que se cerraron", "el aviso de deshabilitar a Carmen no es fiel");

  // Cambiar rol de una persona tutora que SÍ tiene una sesión abierta: el aviso dice que se cerró y la cookie deja de valer.
  const cookieRosa = await valorDeSesion(base, "tutor1");
  const rosa = tarjeta(pagina, 2);
  const antes = await rosa.getByText(/Última modificación/).innerText();
  const cambiar = boton(rosa, /^Cambiar rol de/);
  await cambiar.click();
  dlg = pagina.getByRole("dialog", { name: "Cambiar rol" });
  const opciones = await dlg.getByLabel("Seleccionar rol").locator("option").allTextContents();
  ver((await dlg.getByText("Rosa Hernández Ficticia").isVisible()) && (await dlg.getByText("Rol actual").isVisible()) && /Tutor/.test(await dlg.locator("p.h-campo").innerText()) && JSON.stringify(opciones) === JSON.stringify(["Administrador", "Tutor"]) && /bitácora con el rol anterior y el nuevo/.test(await dlg.innerText()), "MOD-10 «Cambiar rol»: persona, rol actual, selector con Administrador y Tutor y la nota de bitácora", "MOD-10 cambiar rol: contenido incorrecto");
  await dlg.getByLabel("Seleccionar rol").selectOption("Tutor");
  await boton(dlg, "Guardar cambios").click();
  ver((await dialogoAbierto(pagina)) && /rol distinto al actual/.test(await textoDescrito(dlg.getByLabel("Seleccionar rol"))), "MOD-10: elegir el mismo rol no se envía y el error queda asociado (aria-describedby)", "MOD-10: aceptó el mismo rol");
  for (const via of ["«Cancelar»", "Escape", "clic fuera"] as const) {
    if (via === "«Cancelar»") await boton(dlg, "Cancelar").click();
    else if (via === "Escape") await pagina.keyboard.press("Escape");
    else await pagina.mouse.click(4, 4);
    ver(!(await dialogoAbierto(pagina)) && (await foco(pagina)) === "Cambiar rol de Rosa Hernández Ficticia" && (await rosa.getByText("Rol: Tutor").isVisible()), `MOD-10: ${via} cierra sin cambiar nada y el foco vuelve al botón de origen`, `MOD-10: ${via} no cerró bien`);
    await cambiar.click();
  }
  await dlg.getByLabel("Seleccionar rol").selectOption("Administrador");
  await boton(dlg, "Guardar cambios").click();
  ver(await hasta(async () => !(await dialogoAbierto(pagina)) && (await rosa.getByText("Rol: Administrador").isVisible()) && (await rosa.getByText(/Última modificación/).innerText()) !== antes), "MOD-10: «Guardar cambios» cambia el rol de verdad (rol y fecha de última modificación nuevos tras refrescar)", "MOD-10: el rol no cambió");
  ver(await aviso(/Rol de Rosa Hernández Ficticia actualizado a Administrador; se cerró su sesión abierta/), "el aviso del cambio de rol dice que se cerró su sesión abierta (era cierto: Rosa tenía una)", "aviso del cambio de rol no fiel");
  const trasRol = await fetch(`${base}/api/admin/bitacora`, { headers: { Cookie: `${NOMBRE_COOKIE}=${cookieRosa}` } });
  ver(trasRol.status === 401, `la cookie que Rosa tenía antes del cambio de rol dejó de valer (${trasRol.status})`, `la cookie anterior de Rosa sigue valiendo (${trasRol.status})`);
  // Con 2 administradores activos (Ricardo y Rosa) ninguno es el último; si Rosa se deshabilita, Ricardo vuelve a serlo.
  await boton(rosa, /^Deshabilitar a/).click();
  await boton(pagina.getByRole("dialog", { name: "Deshabilitar cuenta" }), "Confirmar").click();
  ver(await hasta(async () => (await rosa.getByText("Inactivo", { exact: true }).isVisible()) && (await boton(ricardo, /^Cambiar rol de/).isDisabled())), "regla del último administrador: tras deshabilitar a Rosa, Ricardo queda bloqueado otra vez", "regla del último administrador: no se re-bloqueó");

  // Paginación, búsqueda y filtro: viven en la URL y el servidor los valida.
  await navegando(pagina, () => boton(pagina, "Página siguiente").click());
  ver(JSON.stringify(await ids()) === "[6,7,8,9,10]" && /6–10 de 12 usuarios/.test(await pagina.locator("main").innerText()) && /[?&]pagina=2/.test(pagina.url()), "ADM-03: la paginación pasa a la página 2 (usuarios 6 a 10) y queda en la URL (?pagina=2)", `ADM-03: página 2 incorrecta (${pagina.url()})`);
  await navegando(pagina, () => boton(pagina, "Página 3").click());
  ver(JSON.stringify(await ids()) === "[11,12]" && (await boton(pagina, "Página siguiente").isDisabled()), "ADM-03: la página 3 trae los 2 últimos y «Siguiente» se deshabilita", "ADM-03: página 3 incorrecta");
  await pagina.getByLabel("Buscar usuario").fill("hector");
  await navegando(pagina, () => boton(pagina, "Buscar").click());
  ver(JSON.stringify(await ids()) === "[11]" && /[?&]q=hector/.test(pagina.url()), "búsqueda: «hector» encuentra a Héctor (sin distinguir acentos), regresa a la página 1 y queda en la URL (?q=)", `búsqueda: ${await ids()}`);
  await pagina.getByLabel("Buscar usuario").fill("");
  await pagina.getByLabel("Filtrar por estatus").selectOption("inactivo");
  await navegando(pagina, () => boton(pagina, "Buscar").click());
  ver(JSON.stringify((await ids()).sort((a, b) => a - b)) === "[2,3,4,8]" && /estatus=inactivo/.test(pagina.url()), "filtro «Inactivo»: solo cuentas inactivas (2 —deshabilitada arriba—, 3, 4 y 8) y queda en la URL", `filtro Inactivo: ${await ids()}`);
  await pagina.getByLabel("Buscar usuario").fill("ejemplo");
  await navegando(pagina, () => boton(pagina, "Buscar").click());
  const combinadas = await ids();
  ver(combinadas.length > 0 && combinadas.every((n) => [3, 4, 8].includes(n)), `búsqueda «ejemplo» + «Inactivo» combinadas: ${combinadas.join(", ")} (inactivas cuyo nombre o correo contiene «ejemplo»)`, `búsqueda + estatus: ${combinadas}`);
  await pagina.getByLabel("Buscar usuario").fill("zzzz");
  await navegando(pagina, () => boton(pagina, "Buscar").click());
  ver((await pagina.getByText("Ningún usuario coincide").isVisible()) && (await enlace(pagina, "Limpiar búsqueda").isVisible()), "búsqueda sin resultados: estado vacío «Ningún usuario coincide» con «Limpiar búsqueda»", "búsqueda sin resultados: falta el estado vacío");
  await navegando(pagina, () => enlace(pagina, "Limpiar búsqueda").click());
  ver((await ids()).length === 5 && /de 12 usuarios/.test(await pagina.locator("main").innerText()), "«Limpiar búsqueda» restaura los 12 usuarios", "Limpiar búsqueda no restauró la lista");
  // El servidor valida lo que llega por la URL: un estatus inventado se informa y no filtra; una página fuera de rango va a la última.
  await irA(pagina, "/admin/usuarios?estatus=raro&pagina=99");
  ver((await pagina.locator("main").innerText()).includes("de 12 usuarios") && /Elige «Activo» o «Inactivo»|Elige/.test(await pagina.locator("main").innerText()) && (await ids()).join() === "11,12", "?estatus=raro&pagina=99: el servidor informa el estatus inválido (sin filtrar) y lleva a la última página", "la URL inválida no se validó en el servidor");
  await contexto.close();

  // Escritorio: tabla compacta con acciones por fila y la misma regla.
  ({ contexto, pagina } = await nuevaPagina(navegador, 1280));
  await irA(pagina, "/admin/usuarios");
  const cab = await pagina.locator("table[data-tabla-compacta] thead th").allTextContents();
  ver(JSON.stringify(cab) === JSON.stringify(["Usuario", "Rol", "Estatus", "Última modificación", "Acciones"]) && (await pagina.locator("ul > li[data-usuario]").evaluateAll((l) => l.every((x) => getComputedStyle(x).display === "none" || x.getBoundingClientRect().height === 0))), "ADM-03 en escritorio: tabla de 5 columnas y sin tarjetas", `ADM-03 escritorio: encabezados ${cab}`);
  const altos = await pagina.locator("table[data-tabla-compacta] button").evaluateAll((bs) => bs.map((b) => Math.round(b.getBoundingClientRect().height)));
  ver(altos.length > 0 && altos.every((h) => h === 36), `ADM-03: los botones de la tabla son del tamaño compacto (${altos[0]} px), marcada con data-tabla-compacta`, `ADM-03: alturas de la tabla ${altos}`);
  ver((await boton(fila(pagina, 1), /^Cambiar rol de/).isDisabled()) && (await boton(fila(pagina, 1), /^Deshabilitar a/).isDisabled()) && (await fila(pagina, 1).getByText("Último administrador activo").isVisible()), "ADM-03 en escritorio: la regla del último administrador también se ve en la tabla", "ADM-03 escritorio: el último administrador no se bloqueó");
  await boton(fila(pagina, 5), /^Cambiar rol de/).click();
  ver(await pagina.getByRole("dialog", { name: "Cambiar rol" }).isVisible(), "ADM-03 en escritorio: «Cambiar rol» abre MOD-10", "ADM-03 escritorio: MOD-10 no abrió");
  await pagina.keyboard.press("Escape");
  ver((await foco(pagina)) === "Cambiar rol de Luis Navarro Ficticio", "MOD-10 en escritorio: Escape devuelve el foco al botón de la fila", `MOD-10 escritorio: foco ${await foco(pagina)}`);
  await contexto.close();

  // La PROPIA cuenta: con otra persona administradora activa se puede, pero pide confirmación explícita y cierra la sesión. La hace Rosa (promovida a Administrador),
  // no Ricardo: la cuenta de Ricardo es la única con credenciales de Administrador y deshabilitarla dejaría sin acceso a las demás pruebas.
  await reiniciarDatos(base);
  const ascenso = await fetchComo(base, "admin", "/api/admin/usuarios/2/rol", { method: "PUT", headers: { "Content-Type": "application/json", Origin: new URL(base).origin }, body: JSON.stringify({ rol: "Administrador" }) });
  ver(ascenso.status === 200, "preparación: Rosa se promueve a Administrador (hay dos administradores activos)", `no se pudo promover a Rosa: HTTP ${ascenso.status}`);
  olvidarSesiones();
  ({ contexto, pagina } = await nuevaPagina(navegador, 390, "light", "tutor1"));
  await irA(pagina, "/admin/usuarios");
  await boton(tarjeta(pagina, 2), /^Deshabilitar a/).click();
  dlg = pagina.getByRole("dialog", { name: "Deshabilitar cuenta" });
  ver(/Es tu propia cuenta/.test(await dlg.innerText()) && /se cerrará tu sesión/.test(await dlg.innerText()) && (await dlg.getByLabel("Entiendo que se cerrará mi sesión").isVisible()), "autoacción: sobre la propia cuenta el modal avisa «Es tu propia cuenta» y que se cerrará la sesión, y pide una casilla de confirmación", "autoacción: el modal no avisa ni pide confirmación");
  await boton(dlg, "Confirmar").click();
  ver((await dialogoAbierto(pagina)) && /Confirma que entiendes/.test(await textoDescrito(dlg.getByLabel("Entiendo que se cerrará mi sesión"))) && (await tarjeta(pagina, 2).getByText("Activo", { exact: true }).isVisible()), "autoacción: sin marcar la casilla no se envía nada (el error queda asociado a la casilla) y la cuenta sigue activa", "autoacción: se envió sin confirmación");
  await dlg.getByText("Entiendo que se cerrará mi sesión").click();
  await Promise.all([pagina.waitForURL(/\/acceso/, { timeout: 10000 }), boton(dlg, "Confirmar").click()]);
  ver(/\/acceso/.test(pagina.url()), "autoacción confirmada: se cierra la sesión y la pantalla lleva a iniciar sesión", `autoacción: no llevó a iniciar sesión (${pagina.url()})`);
  const trasAuto = await pagina.goto(`${base}/admin/usuarios`, { waitUntil: "load" });
  ver(/\/acceso/.test(pagina.url()) || (trasAuto?.status() ?? 0) >= 400, "autoacción: la cookie de esa sesión ya no entra a /admin", `autoacción: aún entra a /admin (${pagina.url()})`);
  await contexto.close();
  olvidarSesiones();

  // Roles: una persona tutora no entra a la pantalla.
  const t403 = await fetchComo(base, "tutor2", "/admin/usuarios", { redirect: "manual" });
  ver(t403.status === 403, `una persona tutora que abre /admin/usuarios recibe ${t403.status}`, `tutora en /admin/usuarios: ${t403.status}`);
}

/** Folios «RUPE-XXXXXXXX» visibles y cuántos se parten en dos líneas (se mide cada folio con un Range). */
const medirFolios = (pagina: Page) =>
  pagina.evaluate(() => {
    const malos: string[] = [];
    let n = 0;
    const recorrido = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let nodo = recorrido.nextNode(); nodo; nodo = recorrido.nextNode()) {
      for (const m of (nodo.textContent ?? "").matchAll(/RUPE-[A-Z0-9]{8}/g)) {
        const rango = document.createRange();
        rango.setStart(nodo, m.index!);
        rango.setEnd(nodo, m.index! + m[0].length);
        const cajas = [...rango.getClientRects()].filter((c) => c.width > 0);
        if (cajas.length === 0) continue;
        n++;
        if (new Set(cajas.map((c) => Math.round(c.top))).size > 1) malos.push(m[0]);
      }
    }
    return { n, malos };
  });

/** Cada folio «RUPE-XXXXXXXX» visible cabe en una sola línea (no se parte en el guion), en tarjetas, tablas y modales; con autoprueba del defecto. */
async function foliosEnUnaLinea(navegador: Browser) {
  const rutas = ["/admin/registros", `/admin/registros/${FOLIO_MODERACION_ACTIVO}`, `/admin/registros/${FOLIO_MODERACION_DESHABILITADO}`, "/admin/avistamientos?pagina=1", "/admin/avistamientos?pagina=2", "/admin/avistamientos?pagina=3", "/admin/avistamientos?detalle=101", "/admin/avistamientos?detalle=105", "/admin/avistamientos?detalle=102&foto=visible"];
  // Los modales de moderación se abren con clics reales (ya no existen ?modal=).
  const conModal: Array<[string, RegExp, string]> = [["/admin/registros", /^Deshabilitar RUPE/, "Deshabilitar registro"], [`/admin/registros/${FOLIO_MODERACION_ACTIVO}`, /^Deshabilitar registro$/, "Deshabilitar registro"], ["/admin/avistamientos", /^Ocultar el avistamiento/, "Ocultar avistamiento"]];
  for (const ancho of [390, 1280]) {
    const { contexto, pagina } = await nuevaPagina(navegador, ancho);
    let total = 0;
    const partidos: string[] = [];
    for (const ruta of rutas) {
      await irA(pagina, ruta);
      const r = await medirFolios(pagina);
      total += r.n;
      partidos.push(...r.malos.map((f) => `${ruta} → ${f}`));
    }
    for (const [ruta, abrir, dialogo] of conModal) {
      await irA(pagina, ruta);
      await boton(pagina, abrir).first().click();
      await pagina.getByRole("dialog", { name: dialogo }).waitFor();
      const r = await medirFolios(pagina);
      total += r.n;
      partidos.push(...r.malos.map((f) => `${ruta} (modal) → ${f}`));
    }
    ver(total > 40 && partidos.length === 0, `folios de ADM-04 y ADM-05 (${ancho}px): ${total} folios visibles en ${rutas.length + conModal.length} pantallas (con 3 modales abiertos por clic), ninguno se parte en dos líneas`, `folios partidos (${ancho}px): ${partidos.join(" | ")}`);
    // Autoprueba: con el estilo anterior (white-space normal) la misma medición debe marcar el defecto.
    let conDefecto = 0;
    for (const ruta of ["/admin/avistamientos?pagina=1", "/admin/avistamientos?pagina=2", "/admin/registros"]) {
      await irA(pagina, ruta);
      await pagina.addStyleTag({ content: ".whitespace-nowrap { white-space: normal !important; }" });
      conDefecto += (await medirFolios(pagina)).malos.length;
    }
    ver(conDefecto > 0, `autoprueba de los folios (${ancho}px): con white-space normal la comprobación marca ${conDefecto} folio(s) partido(s); con la corrección, ninguno`, `autoprueba de los folios (${ancho}px): con white-space normal no marcó ningún folio partido (la comprobación no detecta el defecto)`);
    await contexto.close();
  }
}

// ---------- moderación de registros y de avistamientos (ADM-04, ADM-05, MOD-08, MOD-09 y TUT-05 variante Administrador) ----------
const REGISTROS_RUTA = "/admin/registros";
const TEXTO_ADVERTENCIA_MOD08 = "El registro pasará a «Cerrado», no generará ficha ni aceptará avistamientos y dejará de consultarse por folio.";
const TEXTO_AVISO_MOD09 = "Dejará de verse en el historial de la persona tutora; no se elimina.";

/** «Cancelar», Escape y clic fuera cierran el modal sin cambiar nada y devuelven el foco al botón de origen. */
async function viasDeCierre(pagina: Page, abrir: Locator, nombreDialogo: string, etiqueta: string, alVolver: () => Promise<boolean>, botonCierre = "Cancelar") {
  for (const via of ["botón", "Escape", "clic fuera"] as const) {
    await abrir.click();
    const dlg = pagina.getByRole("dialog", { name: nombreDialogo });
    await dlg.waitFor();
    if (via === "botón") await boton(dlg, botonCierre).click();
    else if (via === "Escape") await pagina.keyboard.press("Escape");
    else await pagina.mouse.click(4, 4);
    const nombre = await abrir.evaluate((el) => el.getAttribute("aria-label") || el.textContent?.trim());
    await hasta(async () => !(await dialogoAbierto(pagina)) && (await foco(pagina)) === nombre && (await alVolver()));
    ver(!(await dialogoAbierto(pagina)) && (await foco(pagina)) === nombre && (await alVolver()), `${etiqueta}: ${via === "botón" ? `«${botonCierre}»` : via} cierra sin cambiar nada y el foco vuelve al botón de origen`, `${etiqueta}: ${via} → abierto=${await dialogoAbierto(pagina)}, foco=${await foco(pagina)}`);
  }
}

/** El foco queda atrapado en el modal abierto (Tab nunca sale de él). */
async function focoAtrapado(pagina: Page, etiqueta: string) {
  let fuera = 0;
  let seguidas = 0;
  let maxSeguidas = 0;
  for (let i = 0; i < 24; i++) {
    await pagina.keyboard.press("Tab");
    const dentro = await pagina.evaluate(() => Boolean(document.activeElement?.closest("dialog[open]")));
    seguidas = dentro ? 0 : seguidas + 1;
    maxSeguidas = Math.max(maxSeguidas, seguidas);
    if (!dentro) fuera++;
  }
  // Chrome pasa una vez por su propia interfaz al dar la vuelta (el foco cae en <body>); no puede haber dos pulsaciones seguidas fuera.
  if (seguidas > 0) {
    await pagina.keyboard.press("Tab");
    seguidas = (await pagina.evaluate(() => Boolean(document.activeElement?.closest("dialog[open]")))) ? 0 : seguidas + 1;
  }
  ver(maxSeguidas < 2 && seguidas === 0, `${etiqueta}: el foco queda atrapado (Tab nunca recorre la página de fondo: 24 pulsaciones sin dos seguidas fuera del modal)`, `${etiqueta}: el foco salió (${fuera} de 24 pulsaciones fuera, ${maxSeguidas} seguidas)`);
}

/** Motivo obligatorio: sin texto no se confirma, el error queda asociado al campo y el foco va a él. */
async function motivoObligatorio(pagina: Page, dlg: Locator, etiqueta: string) {
  await boton(dlg, "Confirmar").click();
  const campo = dlg.getByLabel(/^Motivo \(obligatorio\)/);
  const descrito = await textoDescrito(campo);
  ver((await dialogoAbierto(pagina)) && (await campo.getAttribute("aria-invalid")) === "true" && /Escribe el motivo para continuar/.test(descrito) && (await foco(pagina)) === (await campo.evaluate((e) => e.tagName)) && (await campo.getAttribute("maxlength")) === "300", `${etiqueta}: sin motivo no se confirma; el error queda asociado al campo (aria-describedby), el foco va al campo y el límite es de 300 caracteres`, `${etiqueta}: abierto=${await dialogoAbierto(pagina)}, invalido=${await campo.getAttribute("aria-invalid")}, descrito=${descrito}`);
  await campo.fill("   ");
  await boton(dlg, "Confirmar").click();
  ver((await dialogoAbierto(pagina)) && /Escribe el motivo para continuar/.test(await textoDescrito(campo)), `${etiqueta}: un motivo de solo espacios tampoco se acepta`, `${etiqueta}: aceptó espacios`);
}

const medirRotulos = (pagina: Page) =>
  pagina.evaluate(() => {
    const malos: string[] = [];
    let total = 0;
    for (const dt of document.querySelectorAll("dl dt")) {
      const dd = dt.nextElementSibling;
      const caja = dt.getBoundingClientRect();
      const rango = document.createRange();
      rango.selectNodeContents(dt);
      let derecha = 0;
      for (const r of rango.getClientRects()) derecha = Math.max(derecha, r.right);
      const hueco = dd ? dd.getBoundingClientRect().left - caja.right : 99;
      total++;
      if (dt.scrollWidth > dt.clientWidth + 1 || derecha > caja.right + 0.5 || hueco < 8) malos.push(`«${(dt.textContent ?? "").trim()}» (texto hasta ${Math.round(derecha)}, columna hasta ${Math.round(caja.right)}, separación ${Math.round(hueco)} px)`);
    }
    return { malos, total };
  });

/** Ningún rótulo de las tarjetas de datos del detalle invade la columna de valores (componente compartido con TUT-05). */
async function rotulosDelDetalle(navegador: Browser) {
  for (const ancho of [390, 1280]) {
    for (const tema of ["light", "dark"] as const) {
      const { contexto, pagina } = await nuevaPagina(navegador, ancho, tema);
      for (const folio of [FOLIO_MODERACION_ACTIVO, FOLIO_MODERACION_CANCELADO]) {
        await irA(pagina, `/admin/registros/${folio}`);
        const r = await medirRotulos(pagina);
        ver(r.total >= 15 && r.malos.length === 0, `detalle del Administrador ${folio} ${ancho}px (${tema === "light" ? "claro" : "oscuro"}): ${r.total} rótulos caben en su columna, con al menos 8 px antes del valor`, `detalle del Administrador ${folio} ${ancho}px (${tema}): rótulos desbordados → ${r.malos.join(" | ")}`);
      }
      await contexto.close();
    }
  }
}

async function moderacionRegistros(navegador: Browser) {
  const folios = CASOS_MODERACION.map((c) => c.folio);
  const tarj = (p: Page, folio: string) => p.locator(`li[data-registro="${folio}"]`);
  let { contexto, pagina } = await nuevaPagina(navegador, 390);
  await irA(pagina, "/admin/registros");
  const visibles = () => pagina.locator("li[data-registro]").evaluateAll((l) => l.map((x) => x.getAttribute("data-registro")));
  ver(JSON.stringify(await visibles()) === JSON.stringify(folios.slice(0, 5)) && /1–5 de 12 registros/.test(await pagina.locator("main").innerText()) && (await pagina.locator("table[data-tabla-compacta]").isVisible()) === false, "ADM-04 en móvil: 5 tarjetas por página, del registro más reciente al más antiguo, y la tabla no se muestra", `ADM-04 en móvil: ${await visibles()}`);
  ver(JSON.stringify(await pagina.locator("main form[aria-label='Filtrar registros'] label").allInnerTexts()) === JSON.stringify(["Estado del caso", "Alcaldía"]) && (await enlace(pagina, "Limpiar filtros").isVisible()) && (await boton(pagina, "Aplicar filtros").isVisible()), "ADM-04: filtros «Estado del caso» y «Alcaldía» con «Limpiar filtros» y «Aplicar filtros» (sin búsqueda)", "ADM-04: filtros incorrectos");
  const max = tarj(pagina, "RUPE-K7M4XQ9T");
  ver((await max.getByRole("heading").innerText()) === "RUPE-K7M4XQ9T · Max" && /Fecha de registro: 18 oct 2026/.test(await max.innerText()) && (await max.getByText("En búsqueda", { exact: true }).isVisible()) && (await enlace(max, /^Ver detalle/).getAttribute("href")) === "/admin/registros/RUPE-K7M4XQ9T" && (await boton(max, /^Deshabilitar/).isEnabled()), "ADM-04: la tarjeta lleva «Folio · Nombre», fecha de registro, estado y «Ver detalle» / «Deshabilitar»", "ADM-04: tarjeta incorrecta");
  // Casos cerrados: por deshabilitación (restaurable), por cancelación y por cierre confirmado.
  await pagina.getByLabel("Estado del caso").selectOption("Cerrado");
  await navegando(pagina, () => boton(pagina, "Aplicar filtros").click());
  const cerrados = folios.filter((f) => CASOS_MODERACION.find((c) => c.folio === f)!.estado === "Cerrado");
  ver(JSON.stringify((await visibles()).sort()) === JSON.stringify([...cerrados].sort()) && cerrados.length === 3, "filtro «Estado del caso: Cerrado»: los 3 casos cerrados (deshabilitado, cancelado y cerrado tras localizar)", `filtro Cerrado: ${await visibles()}`);
  const kira = tarj(pagina, FOLIO_MODERACION_DESHABILITADO);
  const simba = tarj(pagina, FOLIO_MODERACION_CANCELADO);
  const rocky = tarj(pagina, "RUPE-3HN8WD2B");
  ver((await kira.getByText("Cerrado (deshabilitado)").isVisible()) && /Motivo de moderación: La fotografía no corresponde a un perro extraviado/.test(await kira.innerText()) && /Deshabilitado el 13 oct 2026/.test(await kira.innerText()) && (await kira.evaluate((e) => getComputedStyle(e).borderStyle)) === "dashed" && (await boton(kira, /^Restaurar/).isEnabled()) && (await boton(kira, /^Deshabilitar/).count()) === 0, "caso deshabilitado: chip «Cerrado (deshabilitado)», motivo y fecha a la vista, borde discontinuo y «Restaurar» disponible", "caso deshabilitado: tarjeta incorrecta");
  const noDisp: [Locator, RegExp][] = [[simba, /Cancelado por la persona tutora: no puede deshabilitarse ni restaurarse/], [rocky, /Cerrado tras una localización confirmada: no puede deshabilitarse ni restaurarse/]];
  let bien = true;
  for (const [t, motivo] of noDisp) bien = bien && (await boton(t, /^Deshabilitar/).isDisabled()) && motivo.test(await textoDescrito(boton(t, /^Deshabilitar/))) && motivo.test(await t.innerText()) && (await boton(t, /^Restaurar/).count()) === 0 && (await t.getByText("Cerrado", { exact: true }).isVisible());
  ver(bien, "HU 018: un caso cancelado («Cancelado por la persona tutora…») o cerrado tras localizar («Cerrado tras una localización confirmada…») no se deshabilita ni se restaura; «Deshabilitar» queda deshabilitado con el motivo según el cierre a la vista (aria-describedby)", "HU 018: acciones de casos cerrados incorrectas");
  await navegando(pagina, () => enlace(pagina, "Limpiar filtros").click());
  ver(JSON.stringify(await visibles()) === JSON.stringify(folios.slice(0, 5)), "«Limpiar filtros» restaura la lista", "«Limpiar filtros» no restauró la lista");
  await pagina.getByLabel("Alcaldía").selectOption({ label: "Tlalpan" });
  await navegando(pagina, () => boton(pagina, "Aplicar filtros").click());
  const enTlalpan = CASOS_MODERACION.filter((c) => c.alcaldia === "Tlalpan").map((c) => c.folio);
  ver(JSON.stringify((await visibles()).sort()) === JSON.stringify(enTlalpan.sort()) && enTlalpan.length >= 2, `filtro «Alcaldía: Tlalpan»: ${enTlalpan.length} casos`, `filtro Tlalpan: ${await visibles()}`);
  await navegando(pagina, () => enlace(pagina, "Limpiar filtros").click());
  await pagina.getByLabel("Estado del caso").selectOption("Extraviado");
  await navegando(pagina, () => boton(pagina, "Aplicar filtros").click());
  ver((await pagina.getByText("Ningún registro coincide").isVisible()) && (await pagina.locator("li[data-registro]").count()) === 0, "filtros sin resultados: estado vacío «Ningún registro coincide»", "filtros sin resultados: falta el estado vacío");
  await navegando(pagina, () => enlace(pagina, "Limpiar filtros").click());
  await cambiarPagina(pagina, "Página siguiente");
  ver(JSON.stringify(await visibles()) === JSON.stringify(folios.slice(5, 10)), "ADM-04: la paginación pasa a la página 2", `ADM-04: página 2 → ${await visibles()}`);
  await cambiarPagina(pagina, "Página 3");
  ver(JSON.stringify(await visibles()) === JSON.stringify(folios.slice(10)) && (await boton(pagina, "Página siguiente").isDisabled()), "ADM-04: la página 3 trae los 2 últimos y «Siguiente» se deshabilita", `ADM-04: página 3 → ${await visibles()}`);
  await cambiarPagina(pagina, "Página 1");

  // MOD-08: deshabilitar.
  const abrir = boton(max, /^Deshabilitar/);
  await abrir.click();
  let dlg = pagina.getByRole("dialog", { name: "Deshabilitar registro" });
  ver((await dlg.getByText("RUPE-K7M4XQ9T").isVisible()) && (await dlg.getByText(TEXTO_ADVERTENCIA_MOD08).isVisible()) && (await dlg.getByLabel(/^Motivo \(obligatorio\)/).isVisible()) && (await dlg.getByRole("button").allInnerTexts()).join("|") === "Cancelar|Confirmar", "MOD-08 «Deshabilitar registro»: folio, advertencia (pasa a «Cerrado», sin ficha ni avistamientos, deja de consultarse por folio), motivo obligatorio, «Cancelar» y «Confirmar»", "MOD-08: contenido incorrecto");
  await focoAtrapado(pagina, "MOD-08");
  await motivoObligatorio(pagina, dlg, "MOD-08");
  await pagina.keyboard.press("Escape");
  await viasDeCierre(pagina, abrir, "Deshabilitar registro", "MOD-08", async () => (await boton(max, /^Deshabilitar/).isEnabled()) && (await max.getByText("En búsqueda", { exact: true }).isVisible()));
  await abrir.click();
  await dlg.getByLabel(/^Motivo \(obligatorio\)/).fill("Incumple las condiciones de uso.");
  await boton(dlg, "Confirmar").click();
  await hasta(() => max.getByText("Cerrado (deshabilitado)").isVisible());
  ver(!(await dialogoAbierto(pagina)) && (await max.getByText("Cerrado (deshabilitado)").isVisible()) && /Motivo de moderación: Incumple las condiciones de uso\./.test(await max.innerText()) && /Deshabilitado el \d+ \w+ 2026/.test(await max.innerText()) && (await boton(max, /^Restaurar/).isEnabled()) && (await boton(max, /^Deshabilitar/).count()) === 0 && (await pagina.getByRole("status").getByText(/Registro RUPE-K7M4XQ9T deshabilitado/).isVisible()), "MOD-08: «Confirmar» deshabilita: pasa a «Cerrado (deshabilitado)» con su motivo y fecha, aparece «Restaurar» y el resultado se anuncia", "MOD-08: la deshabilitación no se reflejó");
  await boton(max, /^Restaurar/).click();
  await hasta(async () => !/Motivo de moderación/.test(await max.innerText()));
  ver((await max.getByText("En búsqueda", { exact: true }).isVisible()) && /Motivo de moderación/.test(await max.innerText()) === false && (await boton(max, /^Deshabilitar/).isEnabled()) && (await pagina.getByRole("status").getByText(/restaurado: volvió a «En búsqueda»/).isVisible()), "«Restaurar» regresa el caso al estado que tenía antes de deshabilitarlo («En búsqueda») y se anuncia", "«Restaurar»: no volvió al estado previo");
  // Restaurar un caso con otro estado previo: Kira estaba «En búsqueda»; Luna («Avistamiento reportado») se deshabilita y vuelve a ese estado.
  const luna = tarj(pagina, "RUPE-P3H8WD5N");
  await boton(luna, /^Deshabilitar/).click();
  dlg = pagina.getByRole("dialog", { name: "Deshabilitar registro" });
  await dlg.getByLabel(/^Motivo \(obligatorio\)/).fill("Prueba de restauración.");
  await boton(dlg, "Confirmar").click();
  await hasta(async () => (await boton(luna, /^Restaurar/).count()) > 0);
  await boton(luna, /^Restaurar/).click();
  await hasta(async () => (await boton(luna, /^Deshabilitar/).count()) > 0 && (await boton(luna, /^Deshabilitar/).isEnabled()));
  ver(await luna.getByText("Avistamiento reportado", { exact: true }).isVisible(), "restauración: un caso deshabilitado desde «Avistamiento reportado» vuelve a «Avistamiento reportado» (estado previo, no siempre el mismo)", "restauración: estado previo incorrecto");
  await contexto.close();

  // Escritorio: tabla compacta.
  ({ contexto, pagina } = await nuevaPagina(navegador, 1280));
  await irA(pagina, "/admin/registros");
  const cab = await pagina.locator("table[data-tabla-compacta] thead th").allTextContents();
  ver(JSON.stringify(cab) === JSON.stringify(["Registro", "Fecha de registro", "Alcaldía", "Estado", "Moderación", "Acciones"]) && (await pagina.locator("ul > li[data-registro]").evaluateAll((l) => l.every((x) => getComputedStyle(x).display === "none" || x.getBoundingClientRect().height === 0))), "ADM-04 en escritorio: tabla con Registro, Fecha de registro, Alcaldía, Estado, Moderación y Acciones", `ADM-04 escritorio: columnas ${cab}`);
  const altos = await pagina.locator("table[data-tabla-compacta] button, table[data-tabla-compacta] a").evaluateAll((bs) => bs.map((b) => Math.round(b.getBoundingClientRect().height)));
  ver(altos.length > 0 && altos.every((h) => h === 36) && (await pagina.locator("table[data-tabla-compacta]").getAttribute("data-excepcion-tactil")) === "compacto", `ADM-04: los botones de la tabla son del tamaño compacto (${altos[0]} px) y la tabla lleva la marca data-excepcion-tactil`, `ADM-04: alturas ${altos}`);
  await pagina.getByLabel("Estado del caso").selectOption("Cerrado");
  await navegando(pagina, () => boton(pagina, "Aplicar filtros").click());
  const filaKira = pagina.locator(`tr[data-registro="${FOLIO_MODERACION_DESHABILITADO}"]`);
  const filaSimba = pagina.locator(`tr[data-registro="${FOLIO_MODERACION_CANCELADO}"]`);
  ver((await boton(filaKira, /^Restaurar/).isEnabled()) && (await boton(filaSimba, /^Deshabilitar/).isDisabled()) && (await filaSimba.getByText("Cancelado por la persona tutora", { exact: true }).isVisible()) && /Cancelado por la persona tutora/.test(await textoDescrito(boton(filaSimba, /^Deshabilitar/))), "ADM-04 en escritorio: «Restaurar» solo en el deshabilitado; en los demás cerrados «Deshabilitar» va deshabilitado con su motivo", "ADM-04 escritorio: acciones incorrectas");
  await boton(filaKira, /^Restaurar/).click();
  await hasta(async () => (await filaKira.count()) === 0);
  ver((await filaKira.count()) === 0 && (await pagina.getByRole("status").getByText(/restaurado: volvió a «En búsqueda»/).isVisible()), "ADM-04 en escritorio: «Restaurar» devuelve el caso a «En búsqueda» (sale del filtro «Cerrado») y se anuncia", "ADM-04 escritorio: restauración incorrecta");
  await navegando(pagina, () => enlace(pagina, "Limpiar filtros").click());
  await cambiarPagina(pagina, "Página siguiente");
  ver((await filaKira.getByText("En búsqueda", { exact: true }).isVisible()) && !/Motivo de moderación/.test(await filaKira.innerText()), "ADM-04 en escritorio: tras restaurar, la fila vuelve a «En búsqueda» sin motivo de moderación", "ADM-04 escritorio: la fila restaurada conserva el motivo");
  await contexto.close();

  // Variantes del maquetado RETIRADAS: la URL ya no fija esqueletos, estados vacíos ni modales abiertos; el estado vacío real es el de «filtros sin resultados» (arriba).
  ({ contexto, pagina } = await nuevaPagina(navegador, 390));
  for (const v of ["?estado=cargando", "?estado=vacio", "?modal=deshabilitar", "?modal=deshabilitar&error=motivo"]) {
    await irA(pagina, `/admin/registros${v}`);
    ver((await pagina.locator("li[data-registro]").count()) === 5 && !(await dialogoAbierto(pagina)) && (await pagina.getByRole("status").count()) === 0, `ADM-04 /admin/registros${v}: variante retirada, se ignora (lista real de 5 tarjetas, sin esqueletos ni modal)`, `ADM-04 ${v}: la variante sigue activa`);
  }
  await contexto.close();

  // Detalle (TUT-05 variante Administrador). Las acciones de arriba fueron reales (Kira se restauró): se parte de datos reiniciados.
  await reiniciarDatos(base);
  ({ contexto, pagina } = await nuevaPagina(navegador, 390));
  await irA(pagina, `/admin/registros/${FOLIO_MODERACION_ACTIVO}`);
  const texto = await pagina.locator("main").innerText();
  const origenAdmin = CASOS_MODERACION.find((c) => c.folio === FOLIO_MODERACION_ACTIVO)!;
  const prohibidas = ["vistoPorTutora", "relevante", "ubicacionSimulada", "tokenPublico", "contrasenaHash", "telefono", "intentosFallidos"];
  const enPaginas: string[] = [];
  for (const ruta of [REGISTROS_RUTA, `${REGISTROS_RUTA}/${FOLIO_MODERACION_ACTIVO}`, "/admin/avistamientos", "/admin/avistamientos?detalle=101", "/admin/bitacora"]) {
    const h = await (await fetchComo(base, "admin", ruta)).text();
    for (const k of prohibidas) if (h.includes(k)) enPaginas.push(`${ruta} → ${k}`);
  }
  ver(enPaginas.length === 0, `datos del Administrador: ninguna llave interna (${prohibidas.join(", ")}) viaja en el HTML ni en los datos de Next de las 5 pantallas de moderación y bitácora`, `llaves internas en: ${enPaginas.join(" | ")}`);
  // Nada de la persona tutora ni el token del QR viajan al navegador en ninguna pantalla de moderación; los reservados, solo en el detalle.
  const tutor = CASOS_ORIGEN[0].tutor;
  const secretosTutor = [tutor.nombreCompleto, tutor.correo, tutor.telefono, credencial("tutor1").correo, ...CASOS_ORIGEN.map((c) => c.tokenPublico)];
  const reservadosDe = (c: (typeof CASOS_MODERACION)[number]) => [c.direccionAproximada, c.referenciasDelLugar, c.descripcionCircunstancias].filter((v): v is string => Boolean(v));
  const fugasTutor: string[] = [];
  for (const ruta of [REGISTROS_RUTA, ...CASOS_MODERACION.map((c) => `${REGISTROS_RUTA}/${c.folio}`), "/admin/avistamientos", "/admin/avistamientos?detalle=102", "/admin/bitacora"]) {
    const h = await (await fetchComo(base, rolDeRuta(ruta), ruta)).text();
    for (const v of secretosTutor) if (h.includes(v)) fugasTutor.push(`${ruta} → ${v.slice(0, 12)}…`);
  }
  ver(fugasTutor.length === 0, `la persona tutora (nombre, correo, teléfono) y el token del QR no aparecen en ninguna de las ${CASOS_MODERACION.length + 3} pantallas de moderación (ni en los datos que viajan al navegador)`, `datos de la persona tutora en: ${fugasTutor.join(" | ")}`);
  const listaHtml = await (await fetchComo(base, "admin", REGISTROS_RUTA)).text();
  const avHtml = await (await fetchComo(base, "admin", "/admin/avistamientos")).text();
  const reservadosEnListas = CASOS_MODERACION.flatMap(reservadosDe).filter((v) => listaHtml.includes(v) || avHtml.includes(v));
  ver(reservadosEnListas.length === 0, "los datos reservados del extravío (calle, referencias, descripción) no viajan en la lista de ADM-04 ni en ADM-05: solo están en el detalle", `reservados en las listas: ${reservadosEnListas.join(" | ")}`);
  const detalleHtml = await (await fetchComo(base, "admin", `${REGISTROS_RUTA}/${FOLIO_MODERACION_ACTIVO}`)).text();
  ver(reservadosDe(CASOS_MODERACION.find((c) => c.folio === FOLIO_MODERACION_ACTIVO)!).every((v) => detalleHtml.includes(v.replace(/&/g, "&amp;"))), "el detalle del Administrador sí lleva los datos reservados del caso (HU 016)", "el detalle del Administrador no trae los datos reservados");
  ver((await enlace(pagina, "Regresar a moderación de registros").getAttribute("href")) === "/admin/registros" && (await pagina.getByRole("heading", { level: 1 }).innerText()) === FOLIO_MODERACION_ACTIVO && (await pagina.getByText("En búsqueda", { exact: true }).first().isVisible()) && (await pagina.getByText("Vista de la persona Administrador: solo consulta.").isVisible()), "TUT-05 Administrador: enlace «Regresar a moderación de registros», folio, estado y el mensaje «solo consulta»", "TUT-05 Administrador: encabezado incorrecto");
  const acc = await pagina.locator("main").getByRole("button").allInnerTexts();
  const enl = await pagina.locator("main a").allInnerTexts();
  ver(JSON.stringify(acc) === JSON.stringify(["Deshabilitar registro"]) && !enl.some((t) => /Editar registro|Ver ficha|Compartir|Ver mapa|Ver avistamientos|Notificaciones/.test(t)), "TUT-05 Administrador: de solo consulta, sin acciones de la persona tutora; la única acción es «Deshabilitar registro»", `TUT-05 Administrador: botones ${acc} · enlaces ${enl}`);
  const titulosTarjetas = await pagina.locator("main section h2").allInnerTexts();
  const reservada = pagina.locator("section[aria-labelledby=datos-reservados]");
  ver(JSON.stringify(titulosTarjetas) === JSON.stringify(["Datos del perro", "Datos del extravío · públicos en la ficha", "Datos reservados · no aparecen en la ficha", "Historial de estados"]) && /Nombre\s*Max/.test(texto) && /Sexo\s*Macho/.test(texto) && /Raza\s*Mestizo/.test(texto) && /Edad\s*4 años/.test(texto) && /Tamaño\s*Mediano/.test(texto) && /Color\s*Café con blanco/.test(texto) && /Características distintivas\s*Collar rojo con placa/.test(texto) && /Fecha del extravío\s*18 oct 2026/.test(texto) && /Alcaldía\s*Coyoacán/.test(texto) && /Colonia o zona\s*Del Carmen/.test(texto), "TUT-05 Administrador: los mismos bloques que TUT-05 de la persona tutora: datos del perro (nombre, sexo, raza, edad, tamaño, color, características), datos del extravío (fecha, alcaldía, colonia o zona) e historial", "TUT-05 Administrador: faltan bloques o datos");
  const textoReservada = await reservada.innerText();
  ver((await reservada.evaluate((e) => getComputedStyle(e).borderStyle)) === "dashed" && ["Momento del día", "Calle o cruce", "Referencias del lugar", "Motivo", "Descripción de las circunstancias"].every((t) => textoReservada.includes(t)) && /Momento del día\s*Tarde/.test(textoReservada) && textoReservada.includes(origenAdmin.direccionAproximada!) && textoReservada.includes(origenAdmin.referenciasDelLugar!) && textoReservada.includes(origenAdmin.descripcionCircunstancias!) && new RegExp(`Motivo\\s*${origenAdmin.motivo}`).test(textoReservada) && !/Motivo reservado:/.test(texto), "TUT-05 Administrador: tarjeta de datos reservados con borde discontinuo (momento del día, calle o cruce, referencias, motivo sin el prefijo «Motivo reservado:» y descripción)", `TUT-05 Administrador: reservados → ${textoReservada.slice(0, 160)}`);
  await boton(pagina, "Deshabilitar registro").click();
  dlg = pagina.getByRole("dialog", { name: "Deshabilitar registro" });
  await motivoObligatorio(pagina, dlg, "MOD-08 (detalle)");
  await dlg.getByLabel(/^Motivo \(obligatorio\)/).fill("Datos falsos en el registro.");
  await boton(dlg, "Confirmar").click();
  await hasta(async () => (await boton(pagina, "Restaurar registro").count()) > 0);
  const histo = await pagina.locator("section[aria-labelledby=historial-titulo]").innerText();
  ver(!(await dialogoAbierto(pagina)) && (await pagina.getByText("Cerrado (deshabilitado)").first().isVisible()) && /Caso deshabilitado/.test(histo) && /Motivo: Datos falsos en el registro\./.test(histo) && (await boton(pagina, "Restaurar registro").isVisible()) && (await boton(pagina, "Deshabilitar registro").count()) === 0, "TUT-05 Administrador: al deshabilitar, el historial suma «Caso deshabilitado» con su motivo y aparece «Restaurar registro»", "TUT-05 Administrador: la deshabilitación no se reflejó");
  await boton(pagina, "Restaurar registro").click();
  await hasta(async () => (await boton(pagina, "Deshabilitar registro").count()) > 0);
  ver((await pagina.getByText("En búsqueda", { exact: true }).first().isVisible()) && /Caso restaurado/.test(await pagina.locator("section[aria-labelledby=historial-titulo]").innerText()) && (await boton(pagina, "Deshabilitar registro").isEnabled()), "TUT-05 Administrador: «Restaurar registro» vuelve a «En búsqueda» y queda en el historial", "TUT-05 Administrador: restauración incorrecta");
  await irA(pagina, `/admin/registros/${FOLIO_MODERACION_DESHABILITADO}`);
  ver((await boton(pagina, "Restaurar registro").isEnabled()) && /La fotografía no corresponde a un perro extraviado/.test(await pagina.locator("section[aria-labelledby=historial-titulo]").innerText()) && (await pagina.getByText("Cerrado (deshabilitado)").first().isVisible()), "detalle de un caso deshabilitado: «Restaurar registro» y el motivo en el historial", "detalle de un caso deshabilitado: incorrecto");
  await irA(pagina, `/admin/registros/${FOLIO_MODERACION_CANCELADO}`);
  ver((await boton(pagina, "Deshabilitar registro").isDisabled()) && /Cancelado por la persona tutora: no puede deshabilitarse ni restaurarse/.test(await textoDescrito(boton(pagina, "Deshabilitar registro"))) && (await boton(pagina, "Restaurar registro").count()) === 0, "detalle de un caso cancelado: «Deshabilitar registro» deshabilitado con su motivo y sin «Restaurar»", "detalle de un caso cancelado: incorrecto");
  const r404 = await pagina.goto(`${base}/admin/registros/RUPE-ZZZZZZZZ`, { waitUntil: "load" });
  ver(r404?.status() === 404, "un folio desconocido en el detalle de moderación responde 404 (TRA-01)", `folio desconocido: HTTP ${r404?.status()}`);
  await contexto.close();
}

async function moderacionAvistamientos(navegador: Browser) {
  const ids = AVISTAMIENTOS_MODERACION.map((a) => a.id);
  const tarj = (p: Page, id: number) => p.locator(`li[data-avistamiento="${id}"]`);
  let { contexto, pagina } = await nuevaPagina(navegador, 390);
  await irA(pagina, "/admin/avistamientos");
  const visibles = () => pagina.locator("li[data-avistamiento]").evaluateAll((l) => l.map((x) => Number(x.getAttribute("data-avistamiento"))));
  ver(JSON.stringify(await visibles()) === JSON.stringify(ids.slice(0, 5)) && new RegExp(`1–5 de ${ids.length} avistamientos`).test(await pagina.locator("main").innerText()), `ADM-05 en móvil: 5 tarjetas por página (${ids.length} avistamientos), del más reciente al más antiguo`, `ADM-05 en móvil: ${await visibles()}`);
  ver(JSON.stringify(await pagina.locator("main form[aria-label='Filtrar avistamientos'] label").allInnerTexts()) === JSON.stringify(["Estatus", "Desde", "Hasta"]) && (await pagina.locator("main form[aria-label='Filtrar avistamientos'] legend").innerText()) === "Fecha", "ADM-05: filtros «Estatus» y «Fecha» (Desde y Hasta) con «Limpiar filtros» y «Aplicar filtros»", "ADM-05: filtros incorrectos");
  // Filtro por estatus.
  await pagina.getByLabel("Estatus", { exact: true }).selectOption({ label: "Oculto" });
  await navegando(pagina, () => boton(pagina, "Aplicar filtros").click());
  const ocultos = AVISTAMIENTOS_MODERACION.filter((a) => !a.visible).map((a) => a.id);
  ver(JSON.stringify((await visibles()).sort()) === JSON.stringify([...ocultos].sort()) && ocultos.length === 2, "filtro «Estatus: Oculto»: solo los 2 avistamientos ocultos", `filtro Oculto: ${await visibles()}`);
  const oculto = tarj(pagina, 105);
  ver((await oculto.getByText("Oculto", { exact: true }).isVisible()) && /Motivo de moderación: El comentario incluía un número telefónico/.test(await oculto.innerText()) && /Ocultado el 9 oct 2026/.test(await oculto.innerText()) && (await oculto.evaluate((e) => getComputedStyle(e).borderStyle)) === "dashed" && (await boton(oculto, /^Restaurar/).isEnabled()) && (await boton(oculto, /^Ocultar/).count()) === 0, "avistamiento oculto: chip «Oculto» con texto, motivo y fecha a la vista, borde discontinuo y «Restaurar» disponible", "avistamiento oculto: tarjeta incorrecta");
  await pagina.getByLabel("Estatus", { exact: true }).selectOption({ label: "Visible" });
  await navegando(pagina, () => boton(pagina, "Aplicar filtros").click());
  ver((await visibles()).length === 5 && !(await visibles()).some((i) => ocultos.includes(i)), "filtro «Estatus: Visible»: ninguno de los ocultos", "filtro Visible: incorrecto");
  await navegando(pagina, () => enlace(pagina, "Limpiar filtros").click());
  // Filtro por fecha: rango inválido y rango válido (día local de la Ciudad de México).
  await pagina.getByLabel("Desde").fill("2026-10-10");
  await pagina.getByLabel("Hasta").fill("2026-10-01");
  await navegando(pagina, () => boton(pagina, "Aplicar filtros").click());
  ver(/«Hasta» no puede ser anterior a «Desde»/.test(await textoDescrito(pagina.getByLabel("Hasta"))) && (await pagina.getByLabel("Hasta").getAttribute("aria-invalid")) === "true", "filtro de fecha: «Hasta» anterior a «Desde» muestra el error asociado al campo", "filtro de fecha: no validó el rango");
  await pagina.getByLabel("Desde").fill("2026-10-10");
  await pagina.getByLabel("Hasta").fill("2026-10-12");
  await navegando(pagina, () => boton(pagina, "Aplicar filtros").click());
  const enRango = AVISTAMIENTOS_MODERACION.filter((a) => { const d = new Date(new Date(a.fechaHora).getTime() - 6 * 3600 * 1000).toISOString().slice(0, 10); return d >= "2026-10-10" && d <= "2026-10-12"; }).map((a) => a.id);
  ver(JSON.stringify((await visibles()).sort()) === JSON.stringify([...enRango].sort()) && enRango.length >= 2, `filtro de fecha 10 a 12 oct: ${enRango.length} avistamientos`, `filtro de fecha: ${await visibles()} (esperados ${enRango})`);
  await navegando(pagina, () => enlace(pagina, "Limpiar filtros").click());
  await cambiarPagina(pagina, "Página siguiente");
  ver(JSON.stringify(await visibles()) === JSON.stringify(ids.slice(5, 10)), "ADM-05: la paginación pasa a la página 2", `ADM-05: página 2 → ${await visibles()}`);
  await cambiarPagina(pagina, "Página 1");

  // Coherencia con la persona tutora: un avistamiento oculto no está en su historial (HU 037, regla 3).
  const htmlTutor = await (await fetchComo(base, "tutor1", "/tutor/casos/RUPE-Y9F4LK2E/avistamientos")).text();
  ver(AVISTAMIENTOS_MODERACION.filter((a) => !a.visible).every((a) => !AVISTAMIENTOS.some((x) => x.id === a.id)) && !htmlTutor.includes("Texto con datos de contacto de un tercero."), "coherencia: los avistamientos ocultos por moderación no aparecen en el historial de la persona tutora", "coherencia: un avistamiento oculto aparece en el historial de la persona tutora");
  // La fotografía de un «Fallecido» nunca se dibuja en la lista.
  const fallecido = tarj(pagina, ID_AVISTAMIENTO_FALLECIDO);
  const siguiente = JSON.stringify(await visibles()).includes(String(ID_AVISTAMIENTO_FALLECIDO));
  if (!siguiente) await cambiarPagina(pagina, "Página siguiente");
  const marcador = fallecido.getByRole("img", { name: "Fotografía oculta: contenido sensible", exact: true });
  ver((await fallecido.locator("img").count()) === 0 && (await marcador.count()) === 1 && (await marcador.evaluate((e) => e.querySelector("svg, span")?.getAttribute("aria-hidden") === "true" || e.querySelector("[aria-hidden=true]") !== null)), "avistamiento «Fallecido» (tarjeta): la lista no dibuja su fotografía; el marcador del ojo tachado tiene el texto alternativo «Fotografía oculta: contenido sensible» (role=\"img\") y su ícono es decorativo", "avistamiento «Fallecido»: la lista muestra una imagen o el marcador no tiene texto alternativo");
  await cambiarPagina(pagina, "Página 1");

  // MOD-09: ocultar.
  const av = tarj(pagina, ID_AVISTAMIENTO_VISIBLE);
  const abrir = boton(av, /^Ocultar/);
  await abrir.click();
  let dlg = pagina.getByRole("dialog", { name: "Ocultar avistamiento" });
  ver((await dlg.getByText(`ID ${ID_AVISTAMIENTO_VISIBLE}`).isVisible()) && (await dlg.getByText(TEXTO_AVISO_MOD09).isVisible()) && (await dlg.getByLabel(/^Motivo \(obligatorio\)/).isVisible()) && (await dlg.getByRole("button").allInnerTexts()).join("|") === "Cancelar|Confirmar", "MOD-09 «Ocultar avistamiento»: foto, ID, folio, fecha y alcaldía, aviso (deja de verse en el historial de la persona tutora; no se elimina), motivo obligatorio, «Cancelar» y «Confirmar»", "MOD-09: contenido incorrecto");
  await focoAtrapado(pagina, "MOD-09");
  await motivoObligatorio(pagina, dlg, "MOD-09");
  await pagina.keyboard.press("Escape");
  await viasDeCierre(pagina, abrir, "Ocultar avistamiento", "MOD-09", async () => (await av.getByText("Visible", { exact: true }).isVisible()) && (await boton(av, /^Ocultar/).isEnabled()));
  await abrir.click();
  await dlg.getByLabel(/^Motivo \(obligatorio\)/).fill("Contiene información personal de un tercero.");
  await boton(dlg, "Confirmar").click();
  await hasta(async () => (await boton(av, /^Restaurar/).count()) > 0);
  ver(!(await dialogoAbierto(pagina)) && (await av.getByText("Oculto", { exact: true }).isVisible()) && /Motivo de moderación: Contiene información personal de un tercero\./.test(await av.innerText()) && /Ocultado el \d+ \w+ 2026/.test(await av.innerText()) && (await boton(av, /^Restaurar/).isEnabled()) && (await boton(av, /^Ocultar/).count()) === 0 && (await pagina.getByRole("status").getByText(/Avistamiento 201 ocultado/).isVisible()), "MOD-09: «Confirmar» oculta el avistamiento: chip «Oculto», motivo y fecha a la vista, aparece «Restaurar» y el resultado se anuncia", "MOD-09: el ocultamiento no se reflejó");
  await boton(av, /^Restaurar/).click();
  await hasta(async () => (await boton(av, /^Ocultar/).count()) > 0);
  ver((await av.getByText("Visible", { exact: true }).isVisible()) && !/Motivo de moderación/.test(await av.innerText()) && (await boton(av, /^Ocultar/).isEnabled()), "«Restaurar» devuelve el avistamiento a «Visible» y limpia el motivo de moderación (D12)", "«Restaurar»: no limpió el motivo");
  await abrir.click();
  ver((await dlg.getByLabel(/^Motivo \(obligatorio\)/).inputValue()) === "", "al ocultar de nuevo, el campo de motivo empieza vacío (no conserva el anterior)", "MOD-09: el motivo anterior quedó en el campo");
  await pagina.keyboard.press("Escape");

  // Detalle de solo lectura.
  await enlace(av, /^Ver detalle/).click();
  dlg = pagina.getByRole("dialog", { name: "Detalle del avistamiento" });
  await dlg.waitFor();
  ver(new RegExp(`[?&]detalle=${ID_AVISTAMIENTO_VISIBLE}`).test(pagina.url()), `ADM-05: «Ver detalle» abre el detalle por la URL (?detalle=${ID_AVISTAMIENTO_VISIBLE})`, `ADM-05: la URL no lleva el detalle (${pagina.url()})`);
  const t101 = await dlg.innerText();
  const a101 = AVISTAMIENTOS.find((a) => a.id === ID_AVISTAMIENTO_VISIBLE)!;
  const reservadas = [a101.direccionAproximada, a101.referencias].filter((v): v is string => Boolean(v));
  ver((await dlg.locator("img").count()) === 1 && ["ID", "Folio", "Fecha y hora", "Alcaldía"].every((e) => t101.includes(e)) && /Integridad física y salud/.test(t101) && /Contención y ubicación/.test(t101) && /Conducta/.test(t101) && /Identificación visible/.test(t101) && /Corría entre los autos/.test(t101) && /Visible/.test(t101) && !/Dirección|Referencias/.test(t101) && reservadas.every((r) => !t101.includes(r)) && (await boton(dlg, "Cerrar").isVisible()), "ADM-05 «Ver detalle»: modal de solo lectura con foto, ID, folio, fecha y hora, alcaldía, estados por categoría, comentario y estatus; sin dirección ni referencias", `ADM-05 detalle: ${t101.slice(0, 200)}`);
  await focoAtrapado(pagina, "ADM-05 «Ver detalle»");
  await pagina.keyboard.press("Escape");
  await viasDeCierre(pagina, enlace(av, /^Ver detalle/), "Detalle del avistamiento", "ADM-05 «Ver detalle»", async () => (await av.getByText("Visible", { exact: true }).isVisible()), "Cerrar");
  await pagina.goto(`${base}/admin/avistamientos`, { waitUntil: "load" });
  const htmlLista = await pagina.content();
  const fugasDir = AVISTAMIENTOS.flatMap((a) => [a.direccionAproximada, a.referencias]).filter((v): v is string => Boolean(v)).filter((v) => htmlLista.includes(v));
  ver(fugasDir.length === 0, "ADM-05: la dirección aproximada y las referencias de los avistamientos no aparecen en ninguna parte de la pantalla (reservadas a la persona tutora, TUT-10)", `ADM-05: fugas → ${fugasDir.join(" | ")}`);
  await contexto.close();

  // «Fallecido» (patrón de la foto sensible de P4): el detalle se abre por la URL y la DIRECCIÓN de la foto solo existe con ?foto=visible.
  ({ contexto, pagina } = await nuevaPagina(navegador, 390));
  const ID_FALL = ID_AVISTAMIENTO_FALLECIDO;
  await irA(pagina, `/admin/avistamientos?detalle=${ID_FALL}&foto=visible`);
  dlg = pagina.getByRole("dialog", { name: "Detalle del avistamiento" });
  await dlg.waitFor();
  const imgListaParaVer = () => dlg.locator("img").evaluateAll((l) => l.map((i) => ({ src: i.getAttribute("src") ?? "", ok: (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0 })));
  await hasta(async () => (await imgListaParaVer()).some((i) => i.ok));
  const imgs = await imgListaParaVer();
  const srcFoto = imgs[0]?.src ?? "";
  ver(imgs.length === 1 && imgs[0].ok && srcFoto.length > 0, `?detalle=${ID_FALL}&foto=visible: la fotografía se muestra y CARGA (naturalWidth > 0)`, "?foto=visible: la imagen no cargó o no hay imagen");
  ver(await hasta(async () => (await pagina.evaluate(() => document.activeElement?.getAttribute("aria-label"))) === "Fotografía del avistamiento"), "al mostrar la fotografía el foco pasa a su región", `el foco no pasó a la región de la imagen (${await foco(pagina)})`);
  const textoRevelada = await dlg.innerText();
  const avisoOculta = /La fotografía permanece oculta hasta que decidas verla/;
  const avisoRevelada = /La fotografía se muestra porque decidiste verla/;
  ver(avisoRevelada.test(textoRevelada) && !avisoOculta.test(textoRevelada) && /Este avistamiento reporta un perro sin vida/.test(textoRevelada) && (await enlace(dlg, "Ocultar fotografía").isVisible()), "con la foto revelada: el aviso dice «La fotografía se muestra porque decidiste verla», ya no dice que permanece oculta y hay «Ocultar fotografía»", "aviso o enlace incorrectos con la foto revelada");
  // Sin ?foto=visible la dirección NO está en el HTML crudo (que incluye los datos de Next), ni en el listado, ni en el DOM, ni se pidió por la red.
  const peticiones: string[] = [];
  pagina.on("request", (r) => peticiones.push(r.url()));
  await irA(pagina, `/admin/avistamientos?detalle=${ID_FALL}`);
  dlg = pagina.getByRole("dialog", { name: "Detalle del avistamiento" });
  await dlg.waitFor();
  await pagina.waitForTimeout(1200); // si los enlaces se precargaran (prefetch), la petición ya habría salido
  const crudoSin = await (await fetchComo(base, "admin", `/admin/avistamientos?detalle=${ID_FALL}`)).text();
  const crudoLista = [await (await fetchComo(base, "admin", "/admin/avistamientos")).text(), await (await fetchComo(base, "admin", "/admin/avistamientos?pagina=2")).text(), await (await fetchComo(base, "admin", "/admin/avistamientos?pagina=3")).text()];
  const dom = await pagina.content();
  ver(!crudoSin.includes(srcFoto) && !dom.includes(srcFoto) && crudoLista.every((h) => !h.includes(srcFoto)) && (await dlg.locator("img").count()) === 0, `sin ?foto=visible la dirección de la foto (${srcFoto.slice(0, 40)}…) no está en el HTML crudo, ni en los datos de Next (self.__next_f), ni en el DOM, ni en el listado (3 páginas)`, "la dirección de la foto del «Fallecido» aparece sin ?foto=visible");
  ver(!peticiones.some((u) => u.includes("foto=visible") || u.includes(srcFoto)), `«Ver fotografía» no se precarga: durante 1,2 s no hubo ninguna petición a ?foto=visible ni a la imagen (prefetch={false})`, "«Ver fotografía» se precargó");
  ver((await dlg.getByText("Esta imagen puede resultar sensible").isVisible()) && /perro sin vida/.test(await dlg.innerText()) && avisoOculta.test(await dlg.innerText()) && /Conducta: no aplica con «Fallecido»/.test(await dlg.innerText()) && /[?&]foto=visible/.test((await enlace(dlg, "Ver fotografía").getAttribute("href")) ?? ""), "aviso «Esta imagen puede resultar sensible» siempre visible y «Ver fotografía» como enlace a ?foto=visible", "aviso o enlace «Ver fotografía» incorrectos");
  await enlace(dlg, "Ver fotografía").click();
  await hasta(async () => (await dlg.locator("img").count()) === 1);
  ver((await dlg.locator("img").count()) === 1 && /[?&]foto=visible/.test(pagina.url()), "«Ver fotografía» revela la imagen (la URL gana ?foto=visible)", "«Ver fotografía» no reveló la imagen");
  await enlace(dlg, "Ocultar fotografía").click();
  await hasta(async () => (await dlg.locator("img").count()) === 0);
  const textoVuelta = await dlg.innerText();
  ver((await dlg.locator("img").count()) === 0 && avisoOculta.test(textoVuelta) && !avisoRevelada.test(textoVuelta) && !/foto=visible/.test(pagina.url()), "«Ocultar fotografía» la vuelve a ocultar, el aviso vuelve a decir que permanece oculta y la URL pierde ?foto=visible", "«Ocultar fotografía»: el aviso o la URL no volvieron a su estado");

  // Un avistamiento OCULTO: el Administrador sigue viendo su foto (y el motivo), sin dirección.
  await irA(pagina, "/admin/avistamientos?detalle=105");
  const dOculto = pagina.getByRole("dialog", { name: "Detalle del avistamiento" });
  await dOculto.waitFor();
  await hasta(async () => (await dOculto.locator("img").evaluateAll((l) => l.filter((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0).length)) === 1);
  const tOculto = await dOculto.innerText();
  ver((await dOculto.locator("img").count()) === 1 && /Oculto/.test(tOculto) && /Motivo de moderación: El comentario incluía un número telefónico/.test(tOculto) && /Ocultado el 9 oct 2026/.test(tOculto) && !/Dirección|Referencias/.test(tOculto), "detalle de un avistamiento oculto: estatus «Oculto», motivo y fecha, su foto SÍ carga para el Administrador y no hay dirección ni referencias", "detalle de un avistamiento oculto incorrecto");
  const ocultoEnTutora = await (await fetchComo(base, "tutor1", "/tutor/casos/RUPE-Y9F4LK2E/avistamientos")).text();
  ver(!ocultoEnTutora.includes("Texto con datos de contacto de un tercero."), "el avistamiento oculto sigue sin verse en el historial de la persona tutora", "el avistamiento oculto aparece a la persona tutora");

  // Variantes del maquetado RETIRADAS: la URL ya no fija esqueletos, vacíos, modales ni errores.
  for (const v of ["?estado=cargando", "?estado=vacio", "?modal=ocultar", "?modal=ocultar&error=motivo", "?modal=detalle-oculto", "?modal=detalle-fallecido&foto=visible"]) {
    await irA(pagina, `/admin/avistamientos${v}`);
    ver((await pagina.locator("li[data-avistamiento]").count()) === 5 && !(await dialogoAbierto(pagina)) && (await pagina.getByRole("status").count()) === 0, `ADM-05 /admin/avistamientos${v}: variante retirada, se ignora (lista real de 5 tarjetas, sin esqueletos ni modal)`, `ADM-05 ${v}: la variante sigue activa`);
  }
  // El servidor valida el detalle pedido: uno inexistente no abre nada y la lista sigue.
  await irA(pagina, "/admin/avistamientos?detalle=99999");
  ver(!(await dialogoAbierto(pagina)) && (await pagina.locator("li[data-avistamiento]").count()) === 5, "?detalle=99999 (inexistente): no abre ningún detalle y la lista sigue", "?detalle inexistente: abrió algo o rompió la lista");
  await irA(pagina, "/admin/avistamientos?pagina=2");
  ver((await pagina.locator("li[data-avistamiento]").count()) === 5 && (await pagina.locator(`li[data-avistamiento="${ID_AVISTAMIENTO_FALLECIDO}"]`).count()) === 1 && (await pagina.locator(`li[data-avistamiento="${ID_AVISTAMIENTO_FALLECIDO}"] img`).count()) === 0, "ADM-05 ?pagina=2: la lista abre en la página 2, donde está el «Fallecido» sin su fotografía (variante de captura)", "ADM-05 ?pagina=2: incorrecta");
  await contexto.close();

  // Escritorio: tabla compacta.
  ({ contexto, pagina } = await nuevaPagina(navegador, 1280));
  await irA(pagina, "/admin/avistamientos");
  const cab = await pagina.locator("table[data-tabla-compacta] thead th").allTextContents();
  ver(JSON.stringify(cab) === JSON.stringify(["Avistamiento", "Fecha y hora", "Alcaldía", "Estatus", "Moderación", "Acciones"]) && (await pagina.locator("table[data-tabla-compacta]").getAttribute("data-excepcion-tactil")) === "compacto", "ADM-05 en escritorio: tabla con Avistamiento, Fecha y hora, Alcaldía, Estatus, Moderación y Acciones, marcada como compacta", `ADM-05 escritorio: columnas ${cab}`);
  await pagina.getByLabel("Estatus", { exact: true }).selectOption({ label: "Oculto" });
  await navegando(pagina, () => boton(pagina, "Aplicar filtros").click());
  await pagina.goto(`${base}/admin/avistamientos?pagina=2`, { waitUntil: "load" });
  const filaFallecido = pagina.locator(`tr[data-avistamiento="${ID_AVISTAMIENTO_FALLECIDO}"]`);
  ver((await filaFallecido.locator("img").count()) === 0 && (await filaFallecido.getByRole("img", { name: "Fotografía oculta: contenido sensible", exact: true }).count()) === 1, "avistamiento «Fallecido» (tabla en escritorio): sin fotografía y con el texto alternativo «Fotografía oculta: contenido sensible»", "avistamiento «Fallecido» en la tabla: muestra una imagen o no tiene texto alternativo");
  await pagina.goto(`${base}/admin/avistamientos`, { waitUntil: "load" });
  await pagina.getByLabel("Estatus", { exact: true }).selectOption({ label: "Oculto" });
  await navegando(pagina, () => boton(pagina, "Aplicar filtros").click());
  const filaOculta = pagina.locator('tr[data-avistamiento="303"]');
  ver((await boton(filaOculta, /^Restaurar/).isEnabled()) && /La fotografía no corresponde a un perro\./.test(await filaOculta.innerText()), "ADM-05 en escritorio: la fila oculta muestra su motivo y «Restaurar»", "ADM-05 escritorio: fila oculta incorrecta");
  await boton(filaOculta, /^Restaurar/).click();
  await hasta(async () => (await filaOculta.count()) === 0);
  ver((await filaOculta.count()) === 0, "ADM-05 en escritorio: «Restaurar» saca el avistamiento del filtro «Oculto»", "ADM-05 escritorio: el restaurado sigue en «Oculto»");
  await navegando(pagina, () => enlace(pagina, "Limpiar filtros").click());
  const filaRestaurada = pagina.locator('tr[data-avistamiento="303"]');
  ver((await filaRestaurada.getByText("Visible", { exact: true }).isVisible()) && !/Motivo de moderación/.test(await filaRestaurada.innerText()), "ADM-05 en escritorio: tras restaurar, la fila queda «Visible» y sin motivo de moderación (D12)", "ADM-05 escritorio: la fila restaurada conserva el motivo");
  await contexto.close();
}

/** El chip «Valor protegido» es neutro (superficie, texto y borde de los tokens base, con candado) y nunca usa los colores de estado del caso. */
async function chipValorProtegido(navegador: Browser) {
  const fuente = readFileSync("src/components/ui/ChipEstatus.tsx", "utf8");
  const linea = fuente.split("\n").find((l) => l.includes('"Valor protegido":') && l.includes("bg-")) ?? "";
  ver(linea !== "" && !/estado-/.test(linea) && /bg-surface/.test(linea) && /text-text/.test(linea) && /border-border-strong/.test(linea), "chip «Valor protegido»: su definición usa solo bg-surface, text-text y border-border-strong (ningún token de estado del caso)", `chip «Valor protegido»: definición «${linea.trim()}»`);
  for (const [ruta, etiqueta] of [["/admin/alcaldias?pagina=3", "alcaldías"], ["/admin/razas?pagina=1", "razas"], ["/admin/motivos?pagina=3", "motivos"], ["/admin/estados-animal?pagina=1", "estados del animal"]] as const) {
    for (const ancho of [390, 1280]) {
      for (const tema of ["light", "dark"] as const) {
        const { contexto, pagina } = await nuevaPagina(navegador, ancho, tema);
        await irA(pagina, ruta);
        const r = await pagina.evaluate(() => {
          const sonda = document.createElement("div");
          document.body.appendChild(sonda);
          sonda.style.borderTopStyle = "solid";
          sonda.style.backgroundColor = "var(--surface)";
          const fondo = getComputedStyle(sonda).backgroundColor;
          sonda.style.color = "var(--text)";
          const texto = getComputedStyle(sonda).color;
          sonda.style.borderTopColor = "var(--border-strong)";
          const borde = getComputedStyle(sonda).borderTopColor;
          const esperado = { fondo, texto, borde };
          sonda.remove();
          const chips = [...document.querySelectorAll<HTMLElement>("main span")].filter((e) => e.textContent?.trim() === "Valor protegido" && e.className.includes("rounded-chip") && e.getClientRects().length > 0);
          return {
            n: chips.length,
            malos: chips.filter((c) => {
              const e = getComputedStyle(c);
              return /estado-/.test(c.className) || e.backgroundColor !== esperado.fondo || e.color !== esperado.texto || e.borderTopColor !== esperado.borde || e.borderTopWidth !== "1px" || !c.querySelector("svg[aria-hidden=true]");
            }).length,
          };
        });
        ver(r.n >= 1 && r.malos === 0, `chip «Valor protegido» en ${etiqueta} (${ancho}px, ${tema === "light" ? "claro" : "oscuro"}): ${r.n} chip(s) neutros con fondo, texto y borde de los tokens base, borde de 1 px y candado decorativo`, `chip «Valor protegido» en ${etiqueta} (${ancho}px, ${tema}): ${r.malos} de ${r.n} no cumplen`);
        await contexto.close();
      }
    }
  }
}

// ---------- catálogos (ADM-06 a ADM-09 y MOD-11) ----------
/** Llamada REAL a la API del Administrador (misma sesión y Origin que el navegador). */
async function api(metodo: string, ruta: string, cuerpo?: unknown, rol: RolPrueba | null = "admin") {
  const r = await fetchComo(base, rol, ruta, { method: metodo, redirect: "manual", headers: { "Content-Type": "application/json", Origin: new URL(base).origin }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const texto = await r.text();
  let json: Record<string, any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    json = JSON.parse(texto);
  } catch {
    json = undefined;
  }
  return { estado: r.status, json, texto };
}
type Elemento = { id: number; nombre: string; clave?: string; idCategoria?: number; categoria?: string; descripcion?: string; activo: boolean; protegido: boolean; motivoNoDesactivable?: string };
/** Todas las filas de un catálogo, leyendo todas las páginas del servidor. */
async function filasDelCatalogo(tipo: string): Promise<Elemento[]> {
  const todas: Elemento[] = [];
  for (let p = 1; ; p++) {
    const r = await api("GET", `/api/admin/catalogos/${tipo}?pagina=${p}`);
    todas.push(...(r.json?.items ?? []));
    if (p >= (r.json?.totalPaginas ?? 1)) return todas;
  }
}

/** Reglas del diccionario (R9) con acciones REALES sobre datos reiniciados: el servidor es el que dice qué se puede desactivar (no hay datos de demostración). */
async function reglasDeCatalogos() {
  const esperados: Record<string, number[]> = { alcaldias: [17], razas: [1, 14], motivos: [14, 15], "estados-animal": [1, 5, 6] };
  const malos: string[] = [];
  for (const [tipo, ids] of Object.entries(esperados)) {
    const filas = await filasDelCatalogo(tipo);
    const prot = filas.filter((f) => f.protegido).map((f) => f.id);
    if (JSON.stringify(prot) !== JSON.stringify(ids)) malos.push(`${tipo}: protegidos ${prot}`);
    for (const f of filas) {
      if (!f.activo) malos.push(`${tipo}:${f.id} sembrado inactivo`);
      if (f.protegido && !/valor protegido: no puede desactivarse ni eliminarse/.test(f.motivoNoDesactivable ?? "")) malos.push(`${tipo}:${f.id} protegido sin bloqueo`);
      if (!f.protegido && f.motivoNoDesactivable) malos.push(`${tipo}:${f.id} bloqueado sin razón (${f.motivoNoDesactivable})`);
    }
    for (const id of ids) if ((await api("POST", `/api/admin/catalogos/${tipo}/${id}/desactivar`)).estado !== 409) malos.push(`${tipo}:${id} se desactivó`);
  }
  ver(malos.length === 0, "catálogos del servidor: los valores protegidos (alcaldía 17; razas 1 y 14; motivos 14 y 15; estados 1, 5 y 6) existen, están activos, dicen por qué no se desactivan y el servidor los rechaza con 409; el resto no trae bloqueo", `catálogos del servidor: ${malos.join(" | ")}`);
  // Última opción activa de una categoría (R9): se desactivan, una a una, 3 de las 4 de «Contención y ubicación».
  const seguidas: number[] = [];
  for (const id of [7, 8, 9]) seguidas.push((await api("POST", `/api/admin/catalogos/estados-animal/${id}/desactivar`)).estado);
  const diez = (await filasDelCatalogo("estados-animal")).find((f) => f.id === 10)!;
  const rechazo = await api("POST", "/api/admin/catalogos/estados-animal/10/desactivar");
  const f7 = (await filasDelCatalogo("estados-animal")).find((f) => f.id === 7)!;
  const reactivar7 = await api("PUT", "/api/admin/catalogos/estados-animal/7", { nombre: f7.nombre, idCategoria: f7.idCategoria, descripcion: f7.descripcion, activo: true });
  const libre = (await filasDelCatalogo("estados-animal")).find((f) => f.id === 10)!;
  ver(seguidas.join() === "200,200,200" && /[Úú]ltima opción activa de «Contención y ubicación»/.test(diez.motivoNoDesactivable ?? "") && rechazo.estado === 409 && rechazo.json?.error?.codigo === "ULTIMA_ACTIVA_DE_CATEGORIA" && libre.motivoNoDesactivable === undefined, "R9: tras desactivar 3 de las 4 opciones de «Contención y ubicación», la última queda bloqueada (el servidor la rechaza con 409); reactivar otra con «Editar» la libera", `R9: ${seguidas} · ${diez.motivoNoDesactivable} · ${rechazo.estado} · reactivar ${reactivar7.estado} ${reactivar7.texto.slice(0, 200)} · libre: ${libre.motivoNoDesactivable}`);
  // Alta y edición de alcaldías: nombre único (sin acentos), clave de 5 caracteres (09 + 3 dígitos) única, «Fuera de la Ciudad de México» sin clave, reactivar con Editar.
  const alta = (cuerpo: object) => api("POST", "/api/admin/catalogos/alcaldias", { nombre: "Nueva alcaldía", clave: "09018", ...cuerpo });
  const errores = [await alta({ nombre: "" }), await alta({ nombre: "  coyoacan " }), await alta({ clave: "" }), await alta({ clave: "9018" }), await alta({ clave: "10018" }), await alta({ clave: "09003" })];
  const campos = errores.map((e) => Object.keys(e.json?.error?.campos ?? {}).join());
  const fuera = await api("PUT", "/api/admin/catalogos/alcaldias/17", { nombre: FUERA_DE_LA_CIUDAD });
  const milpa = (await filasDelCatalogo("alcaldias")).find((f) => f.id === 12)!;
  await api("POST", "/api/admin/catalogos/alcaldias/12/desactivar");
  const reactivada = await api("PUT", "/api/admin/catalogos/alcaldias/12", { nombre: milpa.nombre, clave: milpa.clave, activo: true });
  ver(campos.join("|") === "nombre|nombre|clave|clave|clave|clave" && errores.every((e) => e.estado === 422 || e.estado === 409) && (await alta({})).estado === 201 && fuera.estado === 200 && fuera.json?.sinCambios === true && reactivada.json?.reactivado === true && reactivada.json?.item?.activo === true, "HU 049: el servidor exige nombre único sin acentos ni mayúsculas y clave de 5 caracteres 09XXX única; «Fuera de la Ciudad de México» se edita sin clave; reactivar es editar con activo", `HU 049: ${campos.join("|")} · ${errores.map((e) => e.estado)} · ${fuera.estado} · ${JSON.stringify(reactivada.json)}`);
  const em = await api("POST", "/api/admin/catalogos/motivos", { nombre: "Otro nuevo" });
  const er = await api("POST", "/api/admin/catalogos/razas", { nombre: "Raza nueva" });
  ver(Boolean(em.json?.error?.campos?.idCategoria) && Boolean(em.json?.error?.campos?.descripcion) && !em.json?.error?.campos?.clave && er.estado === 201, "HU 050 y 051: las razas solo piden nombre; los motivos, además, categoría y descripción", `HU 050 y 051: ${JSON.stringify(em.json)} ${er.estado}`);
}

async function catalogos(navegador: Browser) {
  const tarj = (p: Page, id: number) => p.locator(`li[data-elemento="${id}"]`);
  const fil = (p: Page, id: number) => p.locator(`tr[data-elemento="${id}"]`);
  const visibles = (p: Page) => p.locator("li[data-elemento]").evaluateAll((l) => l.map((x) => Number(x.getAttribute("data-elemento"))));
  const aviso = (p: Page, texto: string) => p.getByRole("status").getByText(texto).isVisible();
  let { contexto, pagina } = await nuevaPagina(navegador, 390);

  // ADM-06 alcaldías, móvil.
  await irA(pagina, "/admin/alcaldias");
  ver(JSON.stringify(await visibles(pagina)) === "[1,2,3,4,5,6]" && /1–6 de 17 elementos/.test(await pagina.locator("main").innerText()) && (await boton(pagina, "Agregar alcaldía").isVisible()) && (await pagina.getByLabel("Buscar", { exact: true }).isVisible()) && (await pagina.locator("table[data-tabla-compacta]").isVisible()) === false, "ADM-06 en móvil: «Agregar alcaldía», búsqueda por nombre, 6 tarjetas por página (1–6 de 17 elementos) y sin tabla", `ADM-06 móvil: ${await visibles(pagina)}`);
  const a1 = tarj(pagina, 1);
  ver((await a1.getByRole("heading").innerText()) === "Álvaro Obregón" && /Clave geoestadística: 09010/.test(await a1.innerText()) && (await a1.getByText("Activa", { exact: true }).isVisible()) && (await boton(a1, /^Editar/).isEnabled()) && (await boton(a1, /^Desactivar/).isEnabled()), "ADM-06: la tarjeta lleva nombre, clave geoestadística, estatus «Activa», «Editar» y «Desactivar»", "ADM-06: tarjeta incorrecta");
  // Paginación en el SERVIDOR por la URL.
  await cambiarPagina(pagina, "Página 2");
  ver(/[?&]pagina=2/.test(pagina.url()) && JSON.stringify(await visibles(pagina)) === "[7,8,9,10,11,12]" && /7–12 de 17 elementos/.test(await pagina.locator("main").innerText()), "paginación en el servidor: «Página 2» cambia la URL (?pagina=2) y trae las alcaldías 7 a 12", `paginación: ${pagina.url()} ${await visibles(pagina)}`);
  // Desactivar de verdad: sin motivo, sigue en la lista como «Inactiva» (borde discontinuo) y sin botón «Activar»; reactivar es «Editar» (R9).
  const milpa = tarj(pagina, 12);
  const abrirDesactivar = boton(milpa, /^Desactivar/);
  await abrirDesactivar.click();
  let dlg = pagina.getByRole("dialog", { name: "Desactivar alcaldía" });
  ver((await dlg.getByText("Milpa Alta").isVisible()) && (await dlg.getByText("Dejará de ofrecerse en los formularios nuevos; los registros existentes se conservan.").isVisible()) && (await dlg.getByLabel(/Motivo/).count()) === 0 && (await dlg.getByRole("button").allInnerTexts()).join("|") === "Cancelar|Confirmar", "confirmación «Desactivar alcaldía»: advierte que dejará de ofrecerse y los registros se conservan, sin pedir motivo (Cancelar | Confirmar)", "confirmación de desactivar incorrecta");
  await pagina.keyboard.press("Escape");
  await viasDeCierre(pagina, abrirDesactivar, "Desactivar alcaldía", "confirmación de desactivar", async () => (await milpa.getByText("Activa", { exact: true }).isVisible()));
  await abrirDesactivar.click();
  await boton(dlg, "Confirmar").click();
  await hasta(async () => (await milpa.getByText("Inactiva", { exact: true }).count()) === 1);
  ver((await milpa.getByText("Inactiva", { exact: true }).isVisible()) && (await milpa.evaluate((e) => getComputedStyle(e).borderStyle)) === "dashed" && (await boton(milpa, /^Editar/).isEnabled()) && (await boton(milpa, /^Desactivar/).count()) === 0 && (await pagina.getByRole("button", { name: /^Activar/ }).count()) === 0 && (await aviso(pagina, "«Milpa Alta» quedó desactivada; los registros existentes se conservan")), "desactivar de verdad: «Milpa Alta» sigue en la lista como «Inactiva» (texto y borde discontinuo), sin «Desactivar» ni botón «Activar», y se anuncia", "desactivar: la alcaldía no quedó inactiva");
  ver((await api("GET", "/api/admin/catalogos/alcaldias?pagina=2")).json?.items.find((x: Elemento) => x.id === 12)?.activo === false && (await bitacora_tipo("desactivación de catálogo")).includes("alcaldia:12"), "el cambio es REAL: el servidor la tiene inactiva y la bitácora registra «desactivación de catálogo» de alcaldia:12", "desactivar: el servidor no lo registró");
  // Editar reactiva: el campo de estatus solo aparece para reactivar.
  await boton(milpa, /^Editar/).click();
  dlg = pagina.getByRole("dialog", { name: "Editar alcaldía" });
  ver((await dlg.getByLabel(/^Nombre de la alcaldía/).inputValue()) === "Milpa Alta" && (await dlg.getByLabel(/^Clave geoestadística/).inputValue()) === "09009" && (await dlg.getByLabel("Inactiva", { exact: true }).isChecked()) && (await dlg.getByLabel("Activa", { exact: true }).isEnabled()) && /Elige «Activa» y guarda para reactivar la alcaldía/.test(await dlg.innerText()), "MOD-11 «Editar alcaldía» sobre una inactiva: trae los datos, muestra el estatus (Inactiva marcada) e indica cómo reactivarla", "MOD-11 editar inactiva: incorrecto");
  await dlg.getByText("Activa", { exact: true }).click();
  await boton(dlg, "Guardar cambios").click();
  await hasta(async () => (await milpa.getByText("Activa", { exact: true }).count()) === 1);
  ver((await milpa.getByText("Activa", { exact: true }).isVisible()) && (await milpa.evaluate((e) => getComputedStyle(e).borderStyle)) === "solid" && (await boton(milpa, /^Desactivar/).isEnabled()) && (await aviso(pagina, "«Milpa Alta» quedó reactivada")), "Editar con «Activa» reactiva la alcaldía: vuelve a «Activa» y recupera «Desactivar»", "reactivar con Editar: no reactivó");
  await boton(tarj(pagina, 7), /^Editar/).click();
  dlg = pagina.getByRole("dialog", { name: "Editar alcaldía" });
  ver((await dlg.getByText("Estatus", { exact: true }).count()) === 0 && (await dlg.getByLabel("Inactiva", { exact: true }).count()) === 0, "editar NO desactiva: en una alcaldía activa el modal no muestra el campo de estatus (desactivar es su propia acción)", "editar activa: muestra el estatus");
  await pagina.keyboard.press("Escape");
  await cambiarPagina(pagina, "Página 3");
  const fuera = tarj(pagina, 17);
  ver((await fuera.getByText("Valor protegido", { exact: true }).isVisible()) && /sin clave/.test(await fuera.innerText()) && (await boton(fuera, /^Desactivar/).isDisabled()) && /valor protegido: no puede desactivarse ni eliminarse/.test(await textoDescrito(boton(fuera, /^Desactivar/))) && (await boton(fuera, /^Editar/).isEnabled()), "«Fuera de la Ciudad de México»: «Valor protegido», sin clave, «Desactivar» deshabilitado con su motivo y «Editar» disponible", "«Fuera de la Ciudad de México»: protección incorrecta");
  await boton(fuera, /^Editar/).click();
  dlg = pagina.getByRole("dialog", { name: "Editar alcaldía" });
  ver((await dlg.getByLabel(/^Clave geoestadística/).isDisabled()) && (await dlg.getByText("Estatus", { exact: true }).count()) === 0 && /Esta opción no lleva clave/.test(await dlg.innerText()), "MOD-11 sobre «Fuera de la Ciudad de México»: la clave no aplica y no hay forma de dejarla inactiva", "MOD-11 sobre el valor protegido: incorrecto");
  await pagina.keyboard.press("Escape");
  // Búsqueda en el servidor (formulario GET): la URL lleva ?q= y el estado vacío es real.
  await pagina.getByLabel("Buscar", { exact: true }).fill("xochi");
  await navegando(pagina, () => boton(pagina, "Buscar").click());
  ver(/[?&]q=xochi/.test(pagina.url()) && JSON.stringify(await visibles(pagina)) === "[16]" && (await pagina.getByLabel("Buscar", { exact: true }).inputValue()) === "xochi", "búsqueda en el servidor: «xochi» (?q=xochi) encuentra a Xochimilco y repite el texto en el campo", `búsqueda: ${pagina.url()} ${await visibles(pagina)}`);
  await pagina.getByLabel("Buscar", { exact: true }).fill("zzzz");
  await navegando(pagina, () => boton(pagina, "Buscar").click());
  ver((await pagina.getByText("Ningún elemento coincide").isVisible()) && (await enlace(pagina, "Limpiar búsqueda").isVisible()), "búsqueda sin resultados: estado vacío real con «Limpiar búsqueda»", "búsqueda sin resultados: falta el estado vacío");
  await navegando(pagina, () => enlace(pagina, "Limpiar búsqueda").click());

  // MOD-11: alta con validaciones del servidor, cada error junto a su campo.
  const abrirAlta = boton(pagina, "Agregar alcaldía");
  await abrirAlta.click();
  dlg = pagina.getByRole("dialog", { name: "Agregar alcaldía" });
  ver((await dlg.getByLabel(/^Nombre de la alcaldía/).isVisible()) && (await dlg.getByLabel(/^Clave geoestadística/).getAttribute("placeholder")) === "5 caracteres" && (await dlg.getByText("Estatus", { exact: true }).count()) === 0 && (await dlg.getByRole("button").allInnerTexts()).join("|").endsWith("Cancelar|Guardar cambios") && (await dlg.getByLabel(/^Categoría/).count()) === 0, "MOD-11 «Agregar alcaldía»: nombre y clave (5 caracteres), sin estatus ni categoría, «Cancelar» y «Guardar cambios»", "MOD-11 alta: campos incorrectos");
  await focoAtrapado(pagina, "MOD-11");
  await boton(dlg, "Guardar cambios").click();
  await hasta(async () => /Escribe el nombre/.test(await textoDescrito(dlg.getByLabel(/^Nombre de la alcaldía/))));
  ver((await dialogoAbierto(pagina)) && /Escribe el nombre/.test(await textoDescrito(dlg.getByLabel(/^Nombre de la alcaldía/))) && /Escribe la clave geoestadística/.test(await textoDescrito(dlg.getByLabel(/^Clave geoestadística/))) && (await pagina.evaluate(() => document.activeElement?.id)) === "catalogo-nombre", "MOD-11: sin nombre ni clave no se guarda; el servidor señala cada campo y el foco va al primero", "MOD-11: no señaló los campos");
  await dlg.getByLabel(/^Nombre de la alcaldía/).fill("coyoacán");
  await dlg.getByLabel(/^Clave geoestadística/).fill("09003");
  await boton(dlg, "Guardar cambios").click();
  await hasta(async () => /Ya existe una alcaldía con ese nombre/.test(await textoDescrito(dlg.getByLabel(/^Nombre de la alcaldía/))));
  ver(/Ya existe una alcaldía con ese nombre/.test(await textoDescrito(dlg.getByLabel(/^Nombre de la alcaldía/))) && (await dialogoAbierto(pagina)), "MOD-11: un nombre repetido (sin acentos ni mayúsculas) da «Ya existe una alcaldía con ese nombre.» junto al campo", "MOD-11: no validó el nombre repetido");
  await dlg.getByLabel(/^Nombre de la alcaldía/).fill("Alcaldía de prueba");
  await boton(dlg, "Guardar cambios").click();
  await hasta(async () => /Esa clave ya está en uso/.test(await textoDescrito(dlg.getByLabel(/^Clave geoestadística/))));
  ver(/Esa clave ya está en uso/.test(await textoDescrito(dlg.getByLabel(/^Clave geoestadística/))), "MOD-11: una clave repetida da «Esa clave ya está en uso.» junto a la clave", "MOD-11: no validó la clave repetida");
  await dlg.getByLabel(/^Clave geoestadística/).fill("9018");
  await boton(dlg, "Guardar cambios").click();
  await hasta(async () => /5 dígitos y empezar con 09/.test(await textoDescrito(dlg.getByLabel(/^Clave geoestadística/))));
  ver(/5 dígitos y empezar con 09/.test(await textoDescrito(dlg.getByLabel(/^Clave geoestadística/))), "MOD-11: la clave debe tener 5 dígitos y empezar con 09", "MOD-11: no validó el formato de la clave");
  await pagina.keyboard.press("Escape");
  await viasDeCierre(pagina, abrirAlta, "Agregar alcaldía", "MOD-11", async () => /de 17 elementos/.test(await pagina.locator("main").innerText()));
  await abrirAlta.click();
  await dlg.getByLabel(/^Nombre de la alcaldía/).fill("Alcaldía de prueba");
  await dlg.getByLabel(/^Clave geoestadística/).fill("09018");
  await boton(dlg, "Guardar cambios").click();
  await hasta(async () => /de 18 elementos/.test(await pagina.locator("main").innerText()));
  ver(!(await dialogoAbierto(pagina)) && /de 18 elementos/.test(await pagina.locator("main").innerText()) && (await aviso(pagina, "Se agregó «Alcaldía de prueba»")), "MOD-11: «Guardar cambios» agrega la alcaldía (18 elementos) y se anuncia", "MOD-11: no agregó la alcaldía");
  // Un 409 de «ya cambió»: el elemento se desactiva por otra vía mientras el modal está abierto.
  await cambiarPagina(pagina, "Página 1");
  const dos = tarj(pagina, 2);
  await boton(dos, /^Desactivar/).click();
  await api("POST", "/api/admin/catalogos/alcaldias/2/desactivar");
  await boton(pagina.getByRole("dialog", { name: "Desactivar alcaldía" }), "Confirmar").click();
  await hasta(async () => (await dos.getByText("Inactiva", { exact: true }).count()) === 1);
  ver(!(await dialogoAbierto(pagina)) && (await dos.getByText("Inactiva", { exact: true }).isVisible()) && /ya había cambiado/i.test(await pagina.getByRole("status").innerText()), "409 «ya cambió»: si otra persona la desactivó antes, el modal se cierra, se muestra el mensaje amable y la pantalla se actualiza con su estado real", "409 ya cambió: sin mensaje amable o sin actualizar");
  await contexto.close();

  // Escritorio: tabla de alcaldías.
  ({ contexto, pagina } = await nuevaPagina(navegador, 1280));
  await irA(pagina, "/admin/alcaldias");
  const cab = await pagina.locator("table[data-tabla-compacta] thead th").allTextContents();
  ver(JSON.stringify(cab) === JSON.stringify(["Nombre", "Clave geoestadística", "Estatus", "Acciones"]) && (await pagina.locator("table[data-tabla-compacta]").getAttribute("data-excepcion-tactil")) === "compacto", "ADM-06 en escritorio: tabla con Nombre, Clave geoestadística, Estatus y Acciones, marcada como compacta", `ADM-06 escritorio: columnas ${cab}`);
  const altos = await pagina.locator("table[data-tabla-compacta] button").evaluateAll((bs) => bs.map((b) => Math.round(b.getBoundingClientRect().height)));
  ver(altos.length > 0 && altos.every((h) => h === 36), `ADM-06: los botones de la tabla son del tamaño compacto (${altos[0]} px)`, `ADM-06: alturas ${altos}`);
  await cambiarPagina(pagina, "Página 3");
  ver((await boton(fil(pagina, 17), /^Desactivar/).isDisabled()) && (await fil(pagina, 17).getByText("Valor protegido", { exact: true }).isVisible()) && /valor protegido/.test(await textoDescrito(boton(fil(pagina, 17), /^Desactivar/))), "ADM-06 en escritorio: «Fuera de la Ciudad de México» con «Valor protegido» y «Desactivar» deshabilitado con su motivo", "ADM-06 escritorio: valor protegido incorrecto");
  await contexto.close();

  // ADM-07 razas, ADM-08 motivos y ADM-09 estados del animal: la misma plantilla, parametrizada.
  await reiniciarDatos(base);
  ({ contexto, pagina } = await nuevaPagina(navegador, 390));
  await irA(pagina, "/admin/razas");
  ver(JSON.stringify(await visibles(pagina)) === "[1,2,3,4,5,6]" && (await pagina.getByRole("heading", { level: 1 }).innerText()) === "Catálogo de razas" && (await boton(pagina, "Agregar raza").isVisible()) && !/Clave geoestadística|Categoría/.test(await tarj(pagina, 1).innerText()), "ADM-07 razas: «Agregar raza», solo nombre y estatus (sin clave ni categoría), 6 por página", "ADM-07: pantalla incorrecta");
  ver((await boton(tarj(pagina, 1), /^Desactivar/).isDisabled()) && (await tarj(pagina, 1).getByText("Valor protegido", { exact: true }).isVisible()), "ADM-07: «Mestizo/No identificada» (id 1) es valor protegido y no se desactiva", "ADM-07: id 1 sin protección");
  await cambiarPagina(pagina, "Página 3");
  ver((await boton(tarj(pagina, 14), /^Desactivar/).isDisabled()) && (await boton(tarj(pagina, 13), /^Desactivar/).isEnabled()), "ADM-07: «Otra» (id 14) es valor protegido; «Calupoh» se puede desactivar", "ADM-07: id 14 sin protección");
  await cambiarPagina(pagina, "Página 1");
  await boton(pagina, "Agregar raza").click();
  dlg = pagina.getByRole("dialog", { name: "Agregar raza" });
  ver((await dlg.getByLabel(/^Nombre de la raza/).isVisible()) && (await dlg.getByLabel(/^Clave/).count()) === 0 && (await dlg.getByLabel(/^Categoría/).count()) === 0 && (await dlg.getByLabel(/^Descripción/).count()) === 0 && (await dlg.getByText("Estatus", { exact: true }).count()) === 0, "MOD-11 de razas: solo nombre", "MOD-11 de razas: campos de más");
  await dlg.getByLabel(/^Nombre de la raza/).fill("pug  (CARLINO)");
  await boton(dlg, "Guardar cambios").click();
  await hasta(async () => /Ya existe una raza con ese nombre/.test(await textoDescrito(dlg.getByLabel(/^Nombre de la raza/))));
  ver(/Ya existe una raza con ese nombre/.test(await textoDescrito(dlg.getByLabel(/^Nombre de la raza/))), "MOD-11 de razas: «pug  (CARLINO)» ya existe (sin acentos, mayúsculas ni espacios de más): el error queda junto al nombre", "MOD-11 de razas: no detectó el nombre repetido");
  await dlg.getByLabel(/^Nombre de la raza/).fill("<b>Raza</b> de prueba");
  await boton(dlg, "Guardar cambios").click();
  await hasta(async () => (await aviso(pagina, "Se agregó «Raza de prueba»")));
  ver(await aviso(pagina, "Se agregó «Raza de prueba»"), "R34: «<b>Raza</b> de prueba» se guarda como «Raza de prueba» (sin etiquetas)", "R34: no se saneó el nombre");
  await irA(pagina, "/admin/motivos");
  ver((await pagina.getByRole("heading", { level: 1 }).innerText()) === "Catálogo de motivos de extravío" && (await boton(pagina, "Agregar motivo").isVisible()) && /Categoría: Detonantes Emocionales y Ambientales/.test(await tarj(pagina, 1).innerText()) && /Pirotecnia, truenos/.test(await tarj(pagina, 1).innerText()), "ADM-08 motivos: «Agregar motivo», con categoría y descripción en cada tarjeta", "ADM-08: pantalla incorrecta");
  await cambiarPagina(pagina, "Página 3");
  ver((await boton(tarj(pagina, 14), /^Desactivar/).isDisabled()) && (await boton(tarj(pagina, 15), /^Desactivar/).isDisabled()) && (await tarj(pagina, 14).getByText("Valor protegido", { exact: true }).isVisible()), "ADM-08: «Circunstancia desconocida o no presenciada» y «Otro motivo» (ids 14 y 15) son valores protegidos", "ADM-08: ids 14 y 15 sin protección");
  await boton(pagina, "Agregar motivo").click();
  dlg = pagina.getByRole("dialog", { name: "Agregar motivo de extravío" });
  const cats = await dlg.getByLabel(/^Categoría/).locator("option").allTextContents();
  ver((await dlg.getByLabel(/^Nombre del motivo de extravío/).isVisible()) && JSON.stringify(cats) === JSON.stringify(["Elige una categoría", ...CATEGORIAS_MOTIVO.map((c) => c.nombre)]) && (await dlg.getByLabel(/^Descripción/).getAttribute("maxlength")) === "255", "MOD-11 de motivos: nombre, categoría (las 5 del sistema), descripción de hasta 255 caracteres", "MOD-11 de motivos: campos incorrectos");
  await boton(dlg, "Guardar cambios").click();
  await hasta(async () => /Elige una categoría/.test(await textoDescrito(dlg.getByLabel(/^Categoría/))));
  ver(/Elige una categoría/.test(await textoDescrito(dlg.getByLabel(/^Categoría/))) && /Escribe la descripción/.test(await textoDescrito(dlg.getByLabel(/^Descripción/))), "MOD-11 de motivos: categoría y descripción son obligatorias (errores del servidor junto a cada campo)", "MOD-11 de motivos: no exigió categoría y descripción");
  await dlg.getByLabel(/^Nombre del motivo de extravío/).fill("Motivo de prueba");
  await dlg.getByLabel(/^Categoría/).selectOption("3");
  await dlg.getByLabel(/^Descripción/).fill("Descripción de prueba.");
  await boton(dlg, "Guardar cambios").click();
  await hasta(async () => /de 16 elementos/.test(await pagina.locator("main").innerText()));
  ver(!(await dialogoAbierto(pagina)) && /de 16 elementos/.test(await pagina.locator("main").innerText()), "MOD-11 de motivos: guarda el nuevo motivo con su categoría y descripción (16 elementos)", "MOD-11 de motivos: no guardó");
  await irA(pagina, "/admin/estados-animal");
  ver((await pagina.getByRole("heading", { level: 1 }).innerText()) === "Catálogo de estados del animal" && (await boton(pagina, "Agregar estado").isVisible()) && /Categoría: Integridad física y salud/.test(await tarj(pagina, 1).innerText()), "ADM-09 estados del animal: «Agregar estado», con categoría y descripción", "ADM-09: pantalla incorrecta");
  const protegidos = [];
  for (const id of [1, 5]) protegidos.push((await boton(tarj(pagina, id), /^Desactivar/).isDisabled()) && (await tarj(pagina, id).getByText("Valor protegido", { exact: true }).isVisible()));
  protegidos.push(await boton(tarj(pagina, 6), /^Desactivar/).isDisabled());
  ver(protegidos.every(Boolean), "ADM-09: «Ileso / Buen estado», «Fallecido» y «No se puede determinar» (ids 1, 5 y 6) son valores protegidos", `ADM-09: protegidos ${protegidos}`);
  // Última opción activa de «Identificación visible»: se desactivan de verdad el 16 y el 17, y el 15 queda como la última.
  await cambiarPagina(pagina, "Página 3");
  for (const id of [16, 17]) {
    await boton(tarj(pagina, id), /^Desactivar/).click();
    await boton(pagina.getByRole("dialog", { name: "Desactivar estado del animal" }), "Confirmar").click();
    await hasta(async () => (await tarj(pagina, id).getByText("Inactivo", { exact: true }).count()) === 1);
  }
  const placa = tarj(pagina, 15);
  await hasta(async () => await boton(placa, /^Desactivar/).isDisabled());
  ver((await boton(placa, /^Desactivar/).isDisabled()) && /[Úú]ltima opción activa de «Identificación visible»: cada categoría conserva al menos una/.test(await textoDescrito(boton(placa, /^Desactivar/))) && (await placa.getByText(/[Úú]ltima opción activa/).isVisible()) && (await tarj(pagina, 16).getByText("Inactivo", { exact: true }).isVisible()), "ADM-09: tras desactivar 16 y 17, «Con placa y collar» es la última opción activa de «Identificación visible»: «Desactivar» deshabilitado con su razón", "ADM-09: la última opción activa no se bloqueó");
  await boton(placa, /^Editar/).click();
  let dlgE = pagina.getByRole("dialog", { name: "Editar estado del animal" });
  ver((await dlgE.getByText("Estatus", { exact: true }).count()) === 0, "MOD-11: editar la última opción activa no ofrece estatus (no hay cómo dejarla inactiva)", "MOD-11: ofrece estatus en una activa");
  await dlgE.getByLabel(/^Categoría/).selectOption("1");
  await boton(dlgE, "Guardar cambios").click();
  await hasta(async () => /última opción activa de/.test(await textoDescrito(dlgE.getByLabel(/^Categoría/))));
  ver((await dialogoAbierto(pagina)) && /última opción activa de «Identificación visible»/.test(await textoDescrito(dlgE.getByLabel(/^Categoría/))), "MOD-11: la última opción activa tampoco puede cambiarse de categoría (409 explicado junto al campo)", "MOD-11: dejó vacía una categoría");
  await pagina.keyboard.press("Escape");
  // Reactivar otra opción con Editar libera a la primera.
  await boton(tarj(pagina, 16), /^Editar/).click();
  dlgE = pagina.getByRole("dialog", { name: "Editar estado del animal" });
  await dlgE.getByText("Activo", { exact: true }).click();
  await boton(dlgE, "Guardar cambios").click();
  await hasta(async () => (await boton(placa, /^Desactivar/).isEnabled()));
  ver((await boton(tarj(pagina, 16), /^Desactivar/).isEnabled()) && (await boton(placa, /^Desactivar/).isEnabled()) && (await pagina.getByRole("button", { name: /^Activar/ }).count()) === 0, "reactivar «Con collar sin datos» con Editar libera la regla: «Con placa y collar» ya se puede desactivar", "reactivar con Editar: no liberó la regla");
  await boton(placa, /^Desactivar/).click();
  await boton(pagina.getByRole("dialog", { name: "Desactivar estado del animal" }), "Confirmar").click();
  await hasta(async () => (await boton(tarj(pagina, 16), /^Desactivar/).isDisabled()));
  ver((await placa.getByText("Inactivo", { exact: true }).isVisible()) && (await boton(tarj(pagina, 16), /^Desactivar/).isDisabled()) && /[Úú]ltima opción activa de «Identificación visible»/.test(await textoDescrito(boton(tarj(pagina, 16), /^Desactivar/))), "tras desactivar «Con placa y collar», la que queda activa pasa a ser la última y se bloquea", "la regla no pasó a la siguiente opción activa");
  await contexto.close();

  // Escritorio: catálogo con categoría y descripción (motivos).
  ({ contexto, pagina } = await nuevaPagina(navegador, 1280));
  await irA(pagina, "/admin/motivos");
  const cabM = await pagina.locator("table[data-tabla-compacta] thead th").allTextContents();
  ver(JSON.stringify(cabM) === JSON.stringify(["Nombre", "Categoría", "Descripción", "Estatus", "Acciones"]), "ADM-08 en escritorio: tabla con Nombre, Categoría, Descripción, Estatus y Acciones", `ADM-08 escritorio: columnas ${cabM}`);
  await irA(pagina, "/admin/estados-animal");
  const cabE = await pagina.locator("table[data-tabla-compacta] thead th").allTextContents();
  ver(JSON.stringify(cabE) === JSON.stringify(["Nombre", "Categoría", "Descripción", "Estatus", "Acciones"]), "ADM-09 en escritorio: tabla con Nombre, Categoría, Descripción, Estatus y Acciones", `ADM-09 escritorio: columnas ${cabE}`);
  await irA(pagina, "/admin/razas");
  const cabR = await pagina.locator("table[data-tabla-compacta] thead th").allTextContents();
  ver(JSON.stringify(cabR) === JSON.stringify(["Nombre", "Estatus", "Acciones"]), "ADM-07 en escritorio: tabla con Nombre, Estatus y Acciones", `ADM-07 escritorio: columnas ${cabR}`);
  // Páginas fuera de rango o inválidas se corrigen de forma controlada.
  await irA(pagina, "/admin/razas?pagina=999");
  const ultimaPagina = await pagina.locator("nav[aria-label='Paginación'] [aria-current='page']").getAttribute("aria-label");
  await irA(pagina, "/admin/razas?pagina=abc");
  const primera = await pagina.locator("nav[aria-label='Paginación'] [aria-current='page']").getAttribute("aria-label");
  ver(ultimaPagina === "Página 3" && primera === "Página 1", "?pagina= fuera de rango (999) muestra la última página y uno inválido (abc), la primera; sin error", `?pagina=: ${ultimaPagina} / ${primera}`);
  await contexto.close();
}

/** Los tipos de acción que ya trae la bitácora, vistos con el id de lo afectado (para comprobar que la acción de la pantalla quedó registrada). */
async function bitacora_tipo(tipo: string): Promise<string> {
  const r = await api("GET", `/api/admin/bitacora?tipo=${encodeURIComponent(tipo)}`);
  return (r.json?.items ?? []).map((i: { idAfectada: string }) => i.idAfectada).join(",");
}

// ---------- reglas de código ----------
function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const r = join(dir, n);
    return statSync(r).isDirectory() ? archivos(r) : /\.(tsx?|css)$/.test(n) ? [r] : [];
  });
}
function coloresFijos() {
  const hex = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![\w-])/g;
  const funciones = /\b(?:rgba?|hsla?|oklch)\(/;
  const tailwind = /\b(?:bg|text|border|fill|stroke|ring|from|to|via|outline|shadow|decoration|divide)-(?:black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?(?![\w-])/;
  const malos: string[] = [];
  for (const f of archivos("src").filter((x) => !x.endsWith("globals.css"))) {
    readFileSync(f, "utf8").split("\n").forEach((l, i) => {
      if (l.match(hex) || funciones.test(l) || tailwind.test(l)) malos.push(`${f}:${i + 1}`);
    });
  }
  ver(malos.length === 0, "colores: ningún hex, rgb() ni color fijo de Tailwind en src fuera de globals.css", `colores fijos en: ${malos.join(", ")}`);
}

async function sinDatosDeUsuarios() {
  const rutas = ["/", "/registro", "/acceso", "/ruta-que-no-existe"];
  for (const o of CASOS_ORIGEN.slice(0, 3)) rutas.push(`/ficha/${o.folio}`, `/ficha/${o.folio}?estado=localizado`);
  const datos = USUARIOS_INICIALES.flatMap((u) => [u.correo, u.nombreCompleto]).filter((v) => !/Rosa Hern|rosa\.ficticia/.test(v)); // Rosa es la persona tutora de los casos de ejemplo
  let fugas = 0;
  for (const r of rutas) {
    const html = await (await fetch(`${base}${r}`)).text();
    if (datos.some((d) => html.includes(d))) fugas++;
  }
  ver(fugas === 0, `los correos y nombres de ADM-03 no aparecen en ${rutas.length} respuestas públicas`, `${fugas} pantalla(s) pública(s) con datos de usuarios`);
}


// ---------- Bloque 5c: ADM-02 reportes, ADM-10 estados del caso, ADM-11 parámetros y ADM-12 bitácora ----------
const SECRETOS_TUTOR_5C = [...USUARIOS_INICIALES.filter((u) => u.rol === "Tutor").flatMap((u) => [u.nombreCompleto, u.correo]), CASOS_ORIGEN[0].tutor.nombreCompleto, CASOS_ORIGEN[0].tutor.correo, CASOS_ORIGEN[0].tutor.telefono, ...CASOS_ORIGEN.map((c) => c.tokenPublico)];
const filasDe = (p: Page, titulo: string) =>
  p.locator("figure", { has: p.getByRole("heading", { name: titulo, exact: true }) }).locator("tbody tr").evaluateAll((trs) => trs.map((tr) => [tr.querySelector("th")!.textContent!.trim(), tr.querySelector("td")!.textContent!.trim()]));
const comoFilas = (barras: { nombre: string; valor: number }[]) => barras.map((b) => [b.nombre, String(b.valor)]);

async function reportes(navegador: Browser) {
  // Cuadre de los cálculos con el tablero (mismo periodo, sin filtros opcionales): casos, localizados, por motivo y por estado. El oráculo es el del maquetado (por nombre); la pantalla lee del servidor (por id).
  const vacioF = { desde: PERIODO_BASE.desde, hasta: PERIODO_BASE.hasta, alcaldia: "", categoria: "", estadoCaso: "" };
  const rep = reporteOraculo(vacioF)!;
  const tab = tableroOraculo(PERIODO_BASE);
  // Las cifras del tablero no cambian con los mocks nuevos (alcaldía por caso, avistamiento → caso, movimientos del historial): valores fijos medidos en maquetado-b5b.
  const foto = { totalCasos: tab.totalCasos, casosActivos: tab.casosActivos, casosLocalizados: tab.casosLocalizados, totalAvistamientos: tab.totalAvistamientos, avistamientosOcultos: tab.avistamientosOcultos, porMotivo: tab.porMotivo.map((x) => x.valor), porEstadoCaso: tab.porEstadoCaso.map((x) => x.valor), cierres: tab.cierres.map((x) => x.valor) };
  ver(JSON.stringify(foto) === JSON.stringify({ totalCasos: 163, casosActivos: 141, casosLocalizados: 19, totalAvistamientos: 199, avistamientosOcultos: 6, porMotivo: [46, 40, 29, 38, 10], porEstadoCaso: [20, 58, 32, 31, 16, 6], cierres: [9, 6, 2] }), "cifras del oráculo (1 al 18 de octubre, sin filtros) idénticas a las de maquetado-b5b: 163 casos, 19 localizados, motivo, estado y cierres", `cifras del oráculo cambiaron: ${JSON.stringify(foto)}`);
  ver(rep.totalCasos === tab.totalCasos && rep.casosLocalizados === tab.casosLocalizados && JSON.stringify(rep.porMotivo) === JSON.stringify(tab.porMotivo) && JSON.stringify(rep.porEstadoCaso) === JSON.stringify(tab.porEstadoCaso), `reporte sin filtros opcionales cuadra con el tablero (${rep.totalCasos} casos, ${rep.casosLocalizados} localizados, motivo y estado iguales)`, "el reporte no cuadra con el tablero");
  const casosP = CASOS_TABLERO.filter((c) => c.fecha >= vacioF.desde && c.fecha <= vacioF.hasta);
  const contables = casosP.filter((c) => c.cierre !== "Cancelación" && c.cierre !== "Deshabilitación").length;
  ver(rep.tasaRecuperacion === Math.round((rep.casosLocalizados / contables) * 1000) / 10 && contables < rep.totalCasos, `tasa de recuperación = localizados / casos sin cancelados ni deshabilitados (${rep.casosLocalizados}/${contables} = ${rep.tasaRecuperacion} %, no ${rep.totalCasos})`, "la tasa de recuperación no excluye cancelados y deshabilitados");
  ver(rep.porEstadoCaso.reduce((s, b) => s + b.valor, 0) === rep.totalCasos && rep.porMotivo.reduce((s, b) => s + b.valor, 0) === rep.totalCasos && rep.cierres.reduce((s, b) => s + b.valor, 0) === rep.porEstadoCaso.find((b) => b.nombre === "Cerrado")!.valor, "los desgloses del reporte suman el total de casos y los cierres suman los casos «Cerrado»", "los desgloses del reporte no suman");
  ver(rep.porAlcaldiaAvistamiento.some((b) => b.nombre === FUERA_DE_LA_CIUDAD) && reporteOraculo({ ...vacioF, desde: "2026-10-19", hasta: "2026-10-31" }) === null, "avistamientos por alcaldía incluye «Fuera de la Ciudad de México»; un periodo sin casos no genera reporte", "alcaldía de avistamientos sin «Fuera de la Ciudad de México» o reporte sin datos");

  let { contexto, pagina } = await nuevaPagina(navegador, 1280);
  const descargas: string[] = [];
  pagina.on("download", (d) => descargas.push(d.suggestedFilename()));
  await irA(pagina, "/admin/reportes");
  const form = pagina.getByRole("form", { name: "Filtros del reporte" });
  const opcionesDe = (nombre: string) => form.getByLabel(nombre).locator("option").allInnerTexts();
  ver((await pagina.getByRole("heading", { level: 1 }).innerText()) === "Reportes" && (await form.getByText("Rango de fechas *").isVisible()) && (await opcionesDe("Alcaldía · opcional")).length === 17 && (await opcionesDe("Categoría de motivo · opcional")).length === 6 && JSON.stringify(await opcionesDe("Estado del caso · opcional")) === JSON.stringify(["Todos", ...ESTADOS_CASO]) && (await pagina.getByText("Filtros aplicados", { exact: true }).count()) === 0, "ADM-02: rango de fechas obligatorio (*) y filtros opcionales (16 alcaldías, 5 categorías, 6 estados, vacío = todos); sin resultados al abrir", "ADM-02: filtros incompletos");
  const valoresAlcaldia = await form.getByLabel("Alcaldía · opcional").locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  ver(valoresAlcaldia[0] === "" && valoresAlcaldia.slice(1).join() === Array.from({ length: 16 }, (_, i) => String(i + 1)).join() && !(await opcionesDe("Alcaldía · opcional")).includes(FUERA_DE_LA_CIUDAD), "ADM-02: las alcaldías se ofrecen POR ID (1 a 16, nombre vigente del catálogo) y «Fuera de la Ciudad de México» no está (no puede ser la alcaldía de un caso)", `ADM-02: valores de alcaldía ${valoresAlcaldia}`);
  await boton(form, "Generar reporte").click();
  const desde = pagina.locator("#reporte-desde");
  const hasta = pagina.locator("#reporte-hasta");
  ver(/obligatorio/.test(await textoDescrito(desde)) && /obligatorio/.test(await textoDescrito(hasta)) && (await desde.getAttribute("aria-invalid")) === "true" && (await foco(pagina)) === "INPUT" && (await pagina.evaluate(() => document.activeElement?.id)) === "reporte-desde" && (await pagina.getByText("Filtros aplicados", { exact: true }).count()) === 0, "ADM-02: sin fechas no se genera: error bajo «Desde» y «Hasta», el foco va a «Desde»", "ADM-02: sin fechas no mostró errores");
  await desde.fill("2026-10-18");
  await hasta.fill("2026-10-01");
  await boton(form, "Generar reporte").click();
  ver(/no puede ser anterior a «Desde»/.test(await textoDescrito(hasta)) && (await pagina.getByText("Filtros aplicados", { exact: true }).count()) === 0, "ADM-02: «Desde» posterior a «Hasta» da error bajo «Hasta» y no genera", "ADM-02: rango invertido sin error");
  await desde.fill(vacioF.desde);
  await hasta.fill(vacioF.hasta);
  await boton(form, "Generar reporte").click();
  await pagina.locator("section[aria-label='Resultados del reporte']").waitFor();
  const chips = await pagina.locator("section[aria-label='Resultados del reporte'] ul li").allInnerTexts();
  ver(JSON.stringify(chips) === JSON.stringify(["Periodo: 1 oct 2026 – 18 oct 2026", "Alcaldía: todas", "Categoría: todas", "Estado: todos"]) && (await pagina.getByText("El archivo exportado conserva estos filtros.").isVisible()), "ADM-02: «Filtros aplicados» (periodo, alcaldía, categoría y estado) y la nota de que la exportación los conserva", `ADM-02: filtros aplicados ${chips}`);
  const esperados = [["Número de casos", String(rep.totalCasos)], ["Casos localizados", String(rep.casosLocalizados)], ["Tasa de recuperación", `${rep.tasaRecuperacion!.toFixed(1)} %`], ["Avistamientos ocultos (aparte)", String(rep.avistamientosOcultos)]];
  const leidos: string[][] = [];
  for (const [t] of esperados) leidos.push([t, await valorDe(pagina, t)]);
  ver(JSON.stringify(leidos) === JSON.stringify(esperados), `ADM-02: indicadores ${esperados.map((e) => `${e[0]} ${e[1]}`).join(" · ")}`, `ADM-02: indicadores ${JSON.stringify(leidos)} ≠ ${JSON.stringify(esperados)}`);
  const cajas = await pagina.locator("article").evaluateAll((as) => as.map((a) => { const r = a.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.left)]; }));
  ver(cajas.length === 4 && new Set(cajas.map((c) => c[0])).size === 1 && new Set(cajas.map((c) => c[1])).size === 4, "ADM-02 (1280): los 4 indicadores en una sola fila", `ADM-02: indicadores ${JSON.stringify(cajas)}`);
  const figuras = await pagina.locator("figure").evaluateAll((fs) => fs.map((f) => Math.round(f.getBoundingClientRect().left)));
  ver(figuras.length === 5 && new Set(figuras).size === 2, "ADM-02 (1280): los desgloses en dos columnas", `ADM-02: columnas de desgloses ${JSON.stringify(figuras)}`);
  const fMotivo = await filasDe(pagina, "Casos por categoría de motivo");
  const fEstado = await filasDe(pagina, "Casos por estado del caso");
  const fCierre = await filasDe(pagina, "Casos cerrados por tipo de cierre");
  const fAnimal = await filasDe(pagina, "Avistamientos por estado del animal");
  const fAlcaldia = await filasDe(pagina, "Avistamientos por alcaldía del avistamiento");
  const animalEsperado = rep.porEstadoAnimal.flatMap((g) => g.barras.map((b) => [`${g.categoria}: ${b.nombre}`, String(b.valor)])).filter((f) => f[1] !== "0");
  ver(JSON.stringify(fMotivo) === JSON.stringify(comoFilas(rep.porMotivo)) && JSON.stringify(fEstado) === JSON.stringify(comoFilas(rep.porEstadoCaso)) && fEstado.length === 6 && JSON.stringify(fCierre) === JSON.stringify(comoFilas(rep.cierres)) && fCierre.map((f) => f[0]).join() === "Cierre confirmado,Cancelación,Deshabilitación", "ADM-02: casos por motivo (5), por estado (los 6) y cerrados por tipo de cierre (3) coinciden con el oráculo", "ADM-02: desgloses de casos distintos del oráculo");
  ver(JSON.stringify(fAnimal.map((f) => f[0])) === JSON.stringify(animalEsperado.map((f) => f[0])) && JSON.stringify(fAnimal) === JSON.stringify(animalEsperado) && rep.porEstadoAnimal.length === 4 && JSON.stringify(fAlcaldia) === JSON.stringify(comoFilas(rep.porAlcaldiaAvistamiento)) && fAlcaldia.some((f) => f[0] === FUERA_DE_LA_CIUDAD), "ADM-02: avistamientos por estado del animal (4 categorías) y por alcaldía del avistamiento (con «Fuera de la Ciudad de México») coinciden con el oráculo", "ADM-02: desgloses de avistamientos distintos del oráculo");
  const textoPagina = await pagina.locator("main").innerText();
  ver((await pagina.getByText("La tasa no cuenta casos cancelados ni deshabilitados. Las cuentas de avistamientos solo incluyen los visibles.").isVisible()) && (await pagina.getByText("Reporte generado en pantalla: no se almacena en el sistema.").isVisible()) && !textoPagina.includes("Datos ficticios") && (await boton(pagina, "Exportar a PDF").isEnabled()) && (await boton(pagina, "Exportar a Excel").isEnabled()), "ADM-02: notas (tasa, solo avistamientos visibles, no se almacena), sin «Datos ficticios» y exportaciones habilitadas", "ADM-02: faltan notas, queda «Datos ficticios» o las exportaciones no están habilitadas");

  // Las exportaciones DESCARGAN de verdad lo mismo que dice la pantalla: PDF decodificado (todas las páginas) y Excel leído celda por celda.
  const [dPdf] = await Promise.all([pagina.waitForEvent("download"), boton(pagina, "Exportar a PDF").click()]);
  const bytesPdf = new Uint8Array(readFileSync((await dPdf.path())!));
  const textoPdf = await textoDePdf(navegador, bytesPdf, true);
  ver(dPdf.suggestedFilename() === "reporte-rupe-2026-10-01_2026-10-18.pdf" && Buffer.from(bytesPdf.subarray(0, 5)).toString() === "%PDF-" && /Reporte estadístico de casos/.test(textoPdf) && /Periodo\s+1 oct 2026 – 18 oct 2026/.test(textoPdf) && new RegExp(`Número de casos\\s+${rep.totalCasos}\\b`).test(textoPdf) && new RegExp(`Tasa de recuperación \\(%\\)\\s+${rep.tasaRecuperacion!.toFixed(1)} %`).test(textoPdf), `ADM-02: «Exportar a PDF» descarga «${dPdf.suggestedFilename()}» (${bytesPdf.length} bytes) y su texto decodificado trae el periodo, ${rep.totalCasos} casos y la tasa ${rep.tasaRecuperacion} % de la pantalla`, `ADM-02: PDF descargado ${dPdf.suggestedFilename()}: ${textoPdf.slice(0, 200)}`);
  const [dXls] = await Promise.all([pagina.waitForEvent("download"), boton(pagina, "Exportar a Excel").click()]);
  const hojas = leerXlsx(new Uint8Array(readFileSync((await dXls.path())!)));
  const resumenXls = Object.fromEntries(filasDeHoja(hojas[0]).filter((f) => f.length >= 2 && typeof f[0] === "string").map((f) => [f[0] as string, f[1]]));
  const tablaXls = (nombre: string) => filasDeHoja(hojas.find((h) => h.nombre === nombre)!).slice(1).map((f) => [f[0], f[1]]);
  const nvO = (b: { nombre: string; valor: number }[]) => b.map((x) => [x.nombre, x.valor]);
  ver(dXls.suggestedFilename() === "reporte-rupe-2026-10-01_2026-10-18.xlsx" && resumenXls["Número de casos"] === rep.totalCasos && resumenXls["Casos localizados"] === rep.casosLocalizados && resumenXls["Tasa de recuperación (%)"] === rep.tasaRecuperacion && resumenXls["Avistamientos ocultos (aparte)"] === rep.avistamientosOcultos && JSON.stringify(tablaXls("Casos por motivo")) === JSON.stringify(nvO(rep.porMotivo)) && JSON.stringify(tablaXls("Casos por estado")) === JSON.stringify(nvO(rep.porEstadoCaso)) && JSON.stringify(tablaXls("Cierres por tipo")) === JSON.stringify(nvO(rep.cierres)) && JSON.stringify(tablaXls("Alcaldía del avistamiento")) === JSON.stringify(nvO(rep.porAlcaldiaAvistamiento)), `ADM-02: «Exportar a Excel» descarga «${dXls.suggestedFilename()}»; leído celda por celda trae las mismas cifras de la pantalla (${rep.totalCasos} casos, ${rep.casosLocalizados} localizados, ${rep.tasaRecuperacion} %, desgloses de motivo, estado, cierres y alcaldía) como NÚMEROS`, `ADM-02: Excel descargado ${dXls.suggestedFilename()}: ${JSON.stringify(resumenXls)}`);
  ver(descargas.length === 2 && (await pagina.getByRole("status").filter({ hasText: /Se descargó reporte-rupe-/ }).count()) >= 1, `ADM-02: las dos descargas anuncian «Se descargó …» (role="status"): ${descargas.join(", ")}`, `ADM-02: descargas ${descargas}`);

  // Un filtro de alcaldía cambia el reporte y la exportación conserva los filtros de la pantalla.
  await form.getByLabel("Alcaldía · opcional").selectOption({ label: "Coyoacán" });
  await form.getByLabel("Estado del caso · opcional").selectOption("Localizado");
  await boton(form, "Generar reporte").click();
  const repF = reporteOraculo({ ...vacioF, alcaldia: "Coyoacán", estadoCaso: "Localizado" })!;
  await pagina.locator("section[aria-label='Resultados del reporte'] ul li", { hasText: "Alcaldía: Coyoacán" }).waitFor();
  ver((await valorDe(pagina, "Número de casos")) === String(repF.totalCasos) && repF.totalCasos < rep.totalCasos && (await pagina.locator("section[aria-label='Resultados del reporte'] ul li").allInnerTexts()).join("|").includes("Alcaldía: Coyoacán|Categoría: todas|Estado: Localizado"), `ADM-02: filtros opcionales (Coyoacán, Localizado) → ${repF.totalCasos} casos y «Filtros aplicados» al día`, "ADM-02: los filtros opcionales no se aplican");
  const [dFiltrado] = await Promise.all([pagina.waitForEvent("download"), boton(pagina, "Exportar a Excel").click()]);
  const resFiltrado = filasDeHoja(leerXlsx(new Uint8Array(readFileSync((await dFiltrado.path())!)))[0]);
  ver(resFiltrado.some((f) => f[0] === "Alcaldía" && f[1] === "Coyoacán") && resFiltrado.some((f) => f[0] === "Estado del caso" && f[1] === "Localizado") && resFiltrado.some((f) => f[0] === "Número de casos" && f[1] === repF.totalCasos), `ADM-02: el Excel exportado conserva los filtros de la pantalla (Alcaldía Coyoacán, Estado Localizado, ${repF.totalCasos} casos)`, "ADM-02: el Excel exportado no conserva los filtros");
  await boton(form, "Limpiar filtros").click();
  ver((await desde.inputValue()) === "" && (await form.getByLabel("Alcaldía · opcional").inputValue()) === "" && (await pagina.getByText("Filtros aplicados", { exact: true }).count()) === 0, "ADM-02: «Limpiar filtros» vacía los campos y quita el resultado", "ADM-02: Limpiar filtros no limpió");
  await desde.fill("2026-10-01");
  await hasta.fill("2026-10-18");
  await boton(form, "Generar reporte").click();
  await pagina.locator("section[aria-label='Resultados del reporte']").waitFor();
  await pagina.reload({ waitUntil: "load" });
  ver((await pagina.getByText("Filtros aplicados", { exact: true }).count()) === 0 && (await desde.inputValue()) === "", "ADM-02: el reporte no se almacena: al recargar desaparece", "ADM-02: el reporte persiste tras recargar");
  // Sin datos REAL: un periodo posterior al 18 de octubre no tiene casos (sección con datos reiniciados).
  await desde.fill("2026-10-19");
  await hasta.fill("2026-10-31");
  await boton(form, "Generar reporte").click();
  await pagina.getByText("No hay datos en el periodo y filtros seleccionados; modifica los filtros e inténtalo de nuevo.").waitFor();
  ver((await boton(pagina, "Exportar a PDF").isDisabled()) && (await boton(pagina, "Exportar a Excel").isDisabled()) && (await pagina.locator("article").count()) === 0, "ADM-02 sin datos (real: 19 al 31 de octubre): mensaje y exportar a PDF y a Excel deshabilitados, sin indicadores", "ADM-02 sin datos: falta el mensaje o las exportaciones siguen activas");
  await contexto.close();
  ({ contexto, pagina } = await nuevaPagina(navegador, 390));
  await irA(pagina, "/admin/reportes");
  await pagina.locator("#reporte-desde").fill("2026-10-01");
  await pagina.locator("#reporte-hasta").fill("2026-10-18");
  await boton(pagina, "Generar reporte").click();
  await pagina.locator("section[aria-label='Resultados del reporte']").waitFor();
  const col = await pagina.locator("figure").evaluateAll((fs) => new Set(fs.map((f) => Math.round(f.getBoundingClientRect().left))).size);
  const filas390 = await pagina.locator("article").evaluateAll((as) => new Set(as.map((a) => Math.round(a.getBoundingClientRect().top))).size);
  ver(col === 1 && filas390 === 2, "ADM-02 (390): los desgloses en una columna y los indicadores en 2 × 2", `ADM-02 (390): columnas ${col}, filas de indicadores ${filas390}`);
  const htmlGenerado = await pagina.content();
  await contexto.close();
  const html = await (await fetchComo(base, "admin", "/admin/reportes")).text();
  ver(SECRETOS_TUTOR_5C.every((v) => !html.includes(v) && !htmlGenerado.includes(v)), "ADM-02: ningún dato de la persona tutora (nombre, correo, teléfono, token) en la página ni en el resultado generado", "ADM-02: hay datos de la persona tutora");
}

async function estadosDelCaso(navegador: Browser) {
  const esperados = ESTADOS_CASO.map((nombre, i) => ({ orden: i + 1, nombre }));
  let { contexto, pagina } = await nuevaPagina(navegador, 1280);
  await irA(pagina, "/admin/estados-caso");
  const filas = await pagina.locator("tbody tr").evaluateAll((trs) => trs.map((tr) => [tr.children[0].textContent!.trim(), tr.children[1].textContent!.trim()]));
  ver(JSON.stringify(filas) === JSON.stringify(esperados.map((e) => [String(e.orden), e.nombre])) && filas.map((f) => f[1]).join() === "Extraviado,En búsqueda,Avistamiento reportado,En seguimiento,Localizado,Cerrado", "ADM-10 (1280): tabla con los 6 estados fijos (leídos del almacén) en el orden 1 a 6", `ADM-10 (1280): filas ${JSON.stringify(filas)}`);
  const heads = await pagina.locator("thead th").allInnerTexts();
  ver(JSON.stringify(heads.map((h) => h.toLowerCase())) === JSON.stringify(["orden", "estado del caso"]), "ADM-10: columnas «Orden» y «Estado del caso»", `ADM-10: columnas ${heads}`);
  const controles = await pagina.locator("main").locator("button, input, select, textarea, [role=search], nav[aria-label='Paginación'], a[href]").count();
  ver(controles === 0, "ADM-10 de solo lectura: sin botones de agregar, editar o desactivar, ni búsqueda ni paginación", `ADM-10: ${controles} controles en el contenido`);
  const texto = await pagina.locator("main").innerText();
  ver(texto.includes("Estos 6 estados los define el sistema; solo consulta. No se pueden agregar, editar, desactivar ni eliminar.") && texto.includes("El orden solo determina cómo se presentan los estados en pantallas y reportes; no define las transiciones válidas."), "ADM-10: aviso del sistema y nota sobre el orden", "ADM-10: faltan los avisos");
  ver((await pagina.locator("ol").isHidden()) && (await pagina.locator("table").isVisible()), "ADM-10 (1280): la lista de tarjetas se oculta y se ve la tabla", "ADM-10 (1280): vista equivocada");
  await contexto.close();
  ({ contexto, pagina } = await nuevaPagina(navegador, 390));
  await irA(pagina, "/admin/estados-caso");
  const tarjetas = await pagina.locator("ol > li").allInnerTexts();
  ver(JSON.stringify(tarjetas.map((t) => t.replace(/\s+/g, " ").trim())) === JSON.stringify(esperados.map((e) => `Orden ${e.orden} ${e.nombre}`)) && (await pagina.locator("table").isHidden()), "ADM-10 (390): 6 tarjetas con el chip «Orden n» junto al nombre (el chip no sustituye al estado) y sin tabla", `ADM-10 (390): ${tarjetas}`);
  await contexto.close();
  // Solo consulta de verdad: el servidor no ofrece ninguna escritura sobre los estados del caso y la API devuelve los mismos 6.
  const lectura = await api("GET", "/api/admin/estados-caso");
  const escrituras = await Promise.all(["POST", "PUT", "PATCH", "DELETE"].map((m) => api(m, "/api/admin/estados-caso", { nombre: "Nuevo" })));
  const tutora = await api("GET", "/api/admin/estados-caso", undefined, "tutor1");
  ver(JSON.stringify(lectura.json?.items.map((e: { orden: number; nombre: string }) => [e.orden, e.nombre])) === JSON.stringify(esperados.map((e) => [e.orden, e.nombre])) && escrituras.every((r) => r.estado === 405) && tutora.estado === 403, "ADM-10 en el servidor: GET devuelve los 6 estados; POST, PUT, PATCH y DELETE dan 405; la persona tutora recibe 403", `ADM-10 API: ${lectura.estado} ${escrituras.map((r) => r.estado)} ${tutora.estado}`);
}

async function parametros(navegador: Browser) {
  const { contexto, pagina } = await nuevaPagina(navegador, 1280);
  await irA(pagina, "/admin/parametros");
  const formulario = pagina.getByRole("form", { name: "Parámetros del sistema" });
  const reaceptacion = formulario.getByText("deberán aceptarlo de nuevo");
  const campo = (n: string | RegExp) => pagina.getByLabel(n);
  const version = campo("Versión vigente del aviso de privacidad");
  const token = campo("Tiempo de expiración del token de recuperación · minutos");
  const tamano = campo("Tamaño máximo de archivo permitido · MB");
  const exito = pagina.getByRole("status").filter({ hasText: "Configuración guardada" });
  const valoresApi = async () => ((await api("GET", "/api/admin/parametros")).json?.parametros as { clave: string; valor: string }[]).map((p) => p.valor).join("|");
  ver((await version.inputValue()) === "1.0" && (await token.inputValue()) === "60" && (await tamano.inputValue()) === "4" && /Valor por defecto: 1\.0/.test(await textoDescrito(version)) && /Valor por defecto: 60/.test(await textoDescrito(token)) && /Valor por defecto: 4 · máximo 4\.5/.test(await textoDescrito(tamano)), "ADM-11: valores vigentes del almacén (1.0 · 60 · 4), cada uno con su valor por defecto (4 · máximo 4.5)", "ADM-11: valores iniciales incorrectos");
  ver(/se guarda, pero la recuperación de contraseña aún no está en el prototipo/i.test(await textoDescrito(token)), "ADM-11: la expiración del token declara en pantalla que se guarda pero la recuperación de contraseña no está en el prototipo", `ADM-11: ayuda del token «${await textoDescrito(token)}»`);
  ver((await reaceptacion.count()) === 0, "ADM-11: sin cambios en la versión no hay aviso de re-aceptación", "ADM-11: aviso de re-aceptación sin cambios");
  await version.fill("2.0");
  ver(await formulario.getByText("Al cambiar la versión del aviso de privacidad, todas las personas usuarias deberán aceptarlo de nuevo.").isVisible(), "ADM-11: al cambiar la versión del aviso aparece el aviso de re-aceptación (R22)", "ADM-11: falta el aviso de re-aceptación");
  await version.fill("1.0");
  ver((await reaceptacion.count()) === 0, "ADM-11: volver a la versión vigente quita el aviso", "ADM-11: el aviso no desaparece");
  // Validaciones, con el mensaje bajo cada campo y sin guardar.
  const casos: [string, string, string, RegExp][] = [
    ["token 0", "0", "4", /Debe ser un número entero mayor que cero\./],
    ["token vacío", "", "4", /Debe ser un número entero mayor que cero\./],
    ["token decimal", "1.5", "4", /Debe ser un número entero mayor que cero\./],
    ["token negativo", "-5", "4", /Debe ser un número entero mayor que cero\./],
  ];
  for (const [nombre, t, mb, re] of casos) {
    await token.fill(t);
    await tamano.fill(mb);
    await boton(pagina, "Guardar configuración").click();
    ver(re.test(await textoDescrito(token)) && (await token.getAttribute("aria-invalid")) === "true" && (await pagina.evaluate(() => document.activeElement?.id)) === "parametro-token" && (await exito.count()) === 0, `ADM-11: ${nombre} → «Debe ser un número entero mayor que cero.» bajo el campo, el foco va al campo y no se guarda`, `ADM-11: ${nombre} sin el error esperado`);
  }
  await token.fill("60");
  for (const [valor, re] of [["0", /Debe ser un número mayor que cero\./], ["", /Debe ser un número mayor que cero\./], ["4.6", /No puede superar el límite técnico de 4\.5 MB\./], ["6", /No puede superar el límite técnico de 4\.5 MB\./]] as [string, RegExp][]) {
    await tamano.fill(valor);
    await boton(pagina, "Guardar configuración").click();
    ver(re.test(await textoDescrito(tamano)) && (await tamano.getAttribute("aria-invalid")) === "true", `ADM-11: tamaño «${valor}» → ${re.source.replace(/\\/g, "")}`, `ADM-11: tamaño «${valor}» sin el error esperado`);
  }
  await version.fill("   ");
  await tamano.fill("4");
  await boton(pagina, "Guardar configuración").click();
  ver(/Escribe la versión vigente/.test(await textoDescrito(version)), "ADM-11: la versión vacía o de solo espacios no se acepta", "ADM-11: aceptó la versión vacía");
  for (const mala of ["abc", "1.", ".5", "2,1", "1.0 beta"]) {
    await version.fill(mala);
    await tamano.fill("4");
    await boton(pagina, "Guardar configuración").click();
    ver(/números separados por punto, como 1\.0 o 2\.1/.test(await textoDescrito(version)) && (await version.getAttribute("aria-invalid")) === "true", `ADM-11: la versión «${mala}» no tiene formato de versión (números separados por punto) y muestra el error bajo el campo`, `ADM-11: aceptó la versión «${mala}»`);
  }
  ver((await valoresApi()) === "1.0|60|4", "ADM-11: ningún intento inválido llegó al servidor (siguen 1.0 | 60 | 4)", `ADM-11: el servidor guardó ${await valoresApi()}`);
  // Guardar de verdad: el servidor lo tiene, la bitácora lo registra con «anterior → nuevo» y la pantalla lo conserva al recargar.
  await version.fill("2.0");
  await token.fill("45");
  await tamano.fill("4.5");
  await boton(pagina, "Guardar configuración").click();
  await hasta(async () => (await exito.count()) === 1);
  ver((await exito.filter({ hasText: "El cambio se registra en la bitácora con el valor anterior y el nuevo." }).filter({ hasText: "deberán aceptar la nueva versión del aviso" }).count()) === 1 && (await token.getAttribute("aria-invalid")) === null, "ADM-11: «Guardar configuración» (2.0 · 45 · 4.5) muestra «Configuración guardada», la bitácora y que habrá que re-aceptar el aviso", "ADM-11: no mostró el éxito");
  const bit = (await api("GET", "/api/admin/bitacora?tipo=modificar%20par%C3%A1metro")).json?.items as { idAfectada: string; detalle: string }[];
  ver((await valoresApi()) === "2.0|45|4.5" && bit.length >= 3 && ["version_aviso_privacidad:1.0 → 2.0", "expiracion_token_minutos:60 → 45", "tamano_maximo_archivo_mb:4 → 4.5"].every((s) => bit.some((b) => `${b.idAfectada}:${b.detalle}` === s)), "ADM-11: el cambio es REAL: el servidor guarda 2.0 | 45 | 4.5 y la bitácora tiene una entrada por parámetro con «anterior → nuevo»", `ADM-11: ${await valoresApi()} · ${JSON.stringify(bit.slice(0, 3))}`);
  await irA(pagina, "/admin/parametros");
  ver((await version.inputValue()) === "2.0" && (await token.inputValue()) === "45" && (await tamano.inputValue()) === "4.5" && (await reaceptacion.count()) === 0, "ADM-11: al recargar, la pantalla conserva lo guardado (2.0 · 45 · 4.5) y no muestra el aviso de re-aceptación", "ADM-11: al recargar no conserva lo guardado");
  await boton(pagina, "Guardar configuración").click();
  await hasta(async () => (await pagina.getByRole("status").filter({ hasText: "Sin cambios" }).count()) === 1);
  ver((await pagina.getByRole("status").filter({ hasText: "No hay cambios por guardar: los valores son los vigentes." }).count()) === 1 && (await api("GET", "/api/admin/bitacora?tipo=modificar%20par%C3%A1metro")).json?.items.length === bit.length, "ADM-11: guardar sin cambiar nada muestra «Sin cambios» y no escribe bitácora", "ADM-11: sin cambios incorrecto");
  await token.fill("46");
  ver((await pagina.getByRole("status").filter({ hasText: "Sin cambios" }).count()) === 0, "ADM-11: el mensaje se quita al editar un campo", "ADM-11: el mensaje no se quita");
  // Errores del servidor (422 por campo) se muestran junto al campo, aunque el navegador no los hubiera detectado.
  await pagina.route("**/api/admin/parametros", (ruta) => (ruta.request().method() === "PUT" ? ruta.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: { codigo: "VALIDACION", mensaje: "Revisa los campos marcados.", campos: { expiracion_token_minutos: "Debe ser un número entero mayor que cero." } } }) }) : ruta.continue()));
  await token.fill("30");
  await boton(pagina, "Guardar configuración").click();
  await hasta(async () => /entero mayor que cero/.test(await textoDescrito(token)));
  ver(/entero mayor que cero/.test(await textoDescrito(token)) && (await pagina.evaluate(() => document.activeElement?.id)) === "parametro-token", "ADM-11: un 422 del servidor por campo se muestra bajo el campo y le da el foco", "ADM-11: no mostró el error del servidor");
  await pagina.unroute("**/api/admin/parametros");
  // EXTENSIÓN OPCIONAL (MOD-12): restablecer con confirmación.
  const restablecer = boton(pagina, "Restablecer valores por defecto");
  await token.fill("30");
  await viasDeCierre(pagina, restablecer, "Restablecer valores por defecto", "MOD-12 (extensión opcional)", async () => (await token.inputValue()) === "30" && (await version.inputValue()) === "2.0", "Cancelar");
  await restablecer.click();
  await focoAtrapado(pagina, "MOD-12");
  const dlg = pagina.getByRole("dialog", { name: "Restablecer valores por defecto" });
  ver(/aviso 1\.0, token 60 minutos, archivo 4 MB/.test(await dlg.innerText()) && /deberán aceptarlo de nuevo/.test(await dlg.innerText()) && /bitácora/.test(await dlg.innerText()), "MOD-12: la advertencia nombra los tres valores por defecto (los del servidor), la re-aceptación y la bitácora", "MOD-12: advertencia incompleta");
  await boton(dlg, "Confirmar").click();
  await hasta(async () => (await version.inputValue()) === "1.0");
  ver(!(await dialogoAbierto(pagina)) && (await version.inputValue()) === "1.0" && (await token.inputValue()) === "60" && (await tamano.inputValue()) === "4" && (await pagina.getByRole("status").filter({ hasText: "Valores restablecidos" }).count()) === 1 && (await valoresApi()) === "1.0|60|4", "MOD-12: «Confirmar» devuelve los tres parámetros a 1.0 · 60 · 4, en pantalla y en el servidor, y lo anuncia", "MOD-12: no restableció");
  const fuente = readFileSync("src/components/features/parametros/ModalRestablecer.tsx", "utf8") + readFileSync("src/components/features/parametros/FormularioParametros.tsx", "utf8");
  ver((fuente.match(/EXTENSIÓN OPCIONAL a validar con Raúl/g) ?? []).length >= 3 && !readFileSync("src/lib/parametros.ts", "utf8").includes("EXTENSIÓN"), "MOD-12 aislado: marcado con «EXTENSIÓN OPCIONAL a validar con Raúl» en su archivo y en el botón, fuera de la lógica de validación", "MOD-12: no está aislado o marcado");
  await contexto.close();
  const html = await (await fetchComo(base, "admin", "/admin/parametros")).text();
  ver(SECRETOS_TUTOR_5C.every((v) => !html.includes(v)), "ADM-11: ningún dato de la persona tutora en la página", "ADM-11: hay datos de la persona tutora");
}

// ---------- flujos de punta a punta con la interfaz real ----------
const SIN_FECHAS = (t: string) => t.replace(/\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?/g, "FECHA").replace(/\b\d{1,2} de [a-záéíóú]+ de \d{4}(,? \d{1,2}:\d{2})?/gi, "FECHA").replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, "FECHA");
const huellaTexto = (t: string) => createHash("sha256").update(SIN_FECHAS(t)).digest("hex").slice(0, 12);
const FOLIO_LABRADOR = "RUPE-P3H8WD5N"; // Luna: raza «Labrador Retriever», alcaldía «Benito Juárez»

/** Lo que dicen, de un caso, la ficha pública, el estatus, el detalle del Administrador y el PDF de la ficha (texto decodificado). */
async function vistasDelCaso(navegador: Browser, folio: string) {
  const leerTexto = async (ruta: string, rol: RolPrueba | null) => {
    const { contexto, pagina } = await nuevaPagina(navegador, 1280, "light", rol);
    await irA(pagina, ruta);
    const t = await pagina.locator("main").innerText();
    await contexto.close();
    return t;
  };
  const pdf = await fetchComo(base, "tutor1", `/api/casos/${folio}/ficha?hoja=carta`);
  return {
    ficha: await leerTexto(`/ficha/${folio}`, null),
    estatus: await leerTexto(`/estatus/${folio}`, null),
    detalle: await leerTexto(`/admin/registros/${folio}`, "admin"),
    pdf: pdf.status === 200 ? await textoDePdf(navegador, new Uint8Array(await pdf.arrayBuffer())) : `HTTP ${pdf.status}`,
  };
}

async function flujoRazaDesactivada(navegador: Browser) {
  const opcionesDeRaza = async (): Promise<string[]> => {
    const { contexto, pagina } = await nuevaPagina(navegador, 1280, "light", "tutor1");
    await pagina.goto(`${base}/tutor/registrar`, { waitUntil: "load" });
    await pagina.waitForSelector("main h1");
    const o = await pagina.getByLabel(/^Raza/).locator("option").allTextContents();
    await contexto.close();
    return o;
  };
  const antes = await vistasDelCaso(navegador, FOLIO_LABRADOR);
  const opcionesAntes = await opcionesDeRaza();
  ver(opcionesAntes.includes("Labrador Retriever") && opcionesAntes.length === 15 && antes.ficha.includes("Labrador Retriever") && antes.detalle.includes("Labrador Retriever") && antes.pdf.includes("Labrador Retriever") && antes.ficha.includes("Benito Juárez") && antes.pdf.includes("Benito Juárez") && /En (seguimiento|búsqueda)|Avistamiento reportado/.test(antes.estatus), "punto de partida: /tutor/registrar ofrece las 14 razas; Luna muestra «Labrador Retriever» y «Benito Juárez» en la ficha pública, el detalle del Administrador y el PDF (texto decodificado); /estatus responde", `punto de partida: ${opcionesAntes.length} razas · pdf «${antes.pdf.slice(0, 80)}»`);
  // El Administrador desactiva la raza con la interfaz.
  let { contexto, pagina } = await nuevaPagina(navegador, 390);
  await irA(pagina, "/admin/razas");
  await cambiarPagina(pagina, "Página 1");
  await boton(pagina.locator('li[data-elemento="4"]'), /^Desactivar/).click();
  await boton(pagina.getByRole("dialog", { name: "Desactivar raza" }), "Confirmar").click();
  await hasta(async () => (await pagina.locator('li[data-elemento="4"]').getByText("Inactiva", { exact: true }).count()) === 1);
  ver(await pagina.locator('li[data-elemento="4"]').getByText("Inactiva", { exact: true }).isVisible(), "el Administrador desactiva «Labrador Retriever» en /admin/razas (queda «Inactiva»)", "no se desactivó la raza");
  const despues = await opcionesDeRaza();
  ver(!despues.includes("Labrador Retriever") && despues.length === opcionesAntes.length - 1, `/tutor/registrar ya no ofrece «Labrador Retriever» (${despues.length} opciones)`, `/tutor/registrar sigue ofreciendo la raza (${despues.length})`);
  const foto = new Blob([JPEG_REAL as BlobPart], { type: "image/jpeg" });
  const registrar = async (idRaza: number) => {
    const f = new FormData();
    f.set("datos", JSON.stringify({ nombre: "Pelusa", sexo: "Hembra", idRaza, edad: { valor: 0, unidad: "meses" }, tamano: "pequeño", color: "Blanco", fechaExtravio: new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10), momento: "tarde", alcaldia: "Coyoacán", colonia: "Del Carmen", idMotivo: 1 }));
    f.set("fotografia", foto, "fotografia.jpg");
    const r = await fetchComo(base, "tutor1", "/api/casos", { method: "POST", headers: { Origin: new URL(base).origin }, body: f });
    return { estado: r.status, json: (await r.json().catch(() => undefined)) as Record<string, any> | undefined }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const rechazado = await registrar(4);
  ver(rechazado.estado === 422 && rechazado.json?.error?.campos?.raza === "Elige la raza." && Object.keys(rechazado.json?.error?.campos ?? {}).length === 1, "el registro por API con esa raza (id 4) da 422 amable «Elige la raza.» y solo ese campo", `registro con raza desactivada: ${rechazado.estado} ${JSON.stringify(rechazado.json)}`);
  const durante = await vistasDelCaso(navegador, FOLIO_LABRADOR);
  ver(durante.ficha === antes.ficha && durante.detalle === antes.detalle && durante.pdf === antes.pdf && durante.estatus === antes.estatus, "con la raza desactivada, el caso existente sigue mostrando su nombre IDÉNTICO en la ficha pública, /estatus, el detalle del Administrador y el PDF (huella del contenido)", `con la raza desactivada cambió algo: ficha ${huellaTexto(antes.ficha)}→${huellaTexto(durante.ficha)} · detalle ${huellaTexto(antes.detalle)}→${huellaTexto(durante.detalle)} · pdf ${huellaTexto(antes.pdf)}→${huellaTexto(durante.pdf)}`);
  // Reactivar con Editar.
  await boton(pagina.locator('li[data-elemento="4"]'), /^Editar/).click();
  const dlg = pagina.getByRole("dialog", { name: "Editar raza" });
  await dlg.getByText("Activa", { exact: true }).click();
  await boton(dlg, "Guardar cambios").click();
  await hasta(async () => (await boton(pagina.locator('li[data-elemento="4"]'), /^Desactivar/).count()) === 1);
  await contexto.close();
  const reactivada = await opcionesDeRaza();
  const creado = await registrar(4);
  ver(reactivada.includes("Labrador Retriever") && reactivada.length === opcionesAntes.length && creado.estado === 201, "reactivada con Editar: /tutor/registrar vuelve a ofrecerla y el registro por API con ese id procede (201)", `reactivada: ${reactivada.length} opciones · registro ${creado.estado}`);
  const final = await vistasDelCaso(navegador, FOLIO_LABRADOR);
  ver(final.ficha === antes.ficha && final.detalle === antes.detalle && final.pdf === antes.pdf && final.estatus === antes.estatus, "tras desactivar y reactivar, todo vuelve a lo de antes (huella del contenido de ficha, estatus, detalle y PDF)", "tras reactivar, el contenido no volvió a lo de antes");
  // O3: el filtro de avistamientos de la tutora lista TODAS las alcaldías del almacén, también una desactivada (filtra avistamientos ya reportados en ella).
  await api("POST", "/api/admin/catalogos/alcaldias/3/desactivar");
  const { contexto: ctxFiltro, pagina: pagFiltro } = await nuevaPagina(navegador, 1280, "light", "tutor1");
  await irA(pagFiltro, `/tutor/casos/${FOLIO_LABRADOR}/avistamientos`);
  const opcionesAlcaldia = await pagFiltro.getByLabel(/^Alcaldía/).locator("option").allTextContents();
  await ctxFiltro.close();
  const f3 = (await filasDelCatalogo("alcaldias")).find((x) => x.id === 3)!;
  await api("PUT", "/api/admin/catalogos/alcaldias/3", { nombre: f3.nombre, clave: f3.clave, activo: true });
  ver(opcionesAlcaldia.includes("Benito Juárez") && opcionesAlcaldia.includes("Fuera de la Ciudad de México") && opcionesAlcaldia.length === 18, `el filtro de avistamientos de la tutora lista las 17 alcaldías del almacén (con «Benito Juárez» desactivada y «Fuera de la Ciudad de México»): ${opcionesAlcaldia.length - 1} opciones`, `filtro de la tutora: ${opcionesAlcaldia.length} opciones, «Benito Juárez» ${opcionesAlcaldia.includes("Benito Juárez")}`);
  // D7: renombrar cambia el nombre histórico, en los mismos cuatro lugares.
  ({ contexto, pagina } = await nuevaPagina(navegador, 390));
  await irA(pagina, "/admin/alcaldias");
  await boton(pagina.locator('li[data-elemento="3"]'), /^Editar/).click();
  const dlgA = pagina.getByRole("dialog", { name: "Editar alcaldía" });
  await dlgA.getByLabel(/^Nombre de la alcaldía/).fill("Benito Juárez (renombrada)");
  await boton(dlgA, "Guardar cambios").click();
  await hasta(async () => (await pagina.locator('li[data-elemento="3"] h2').innerText()) === "Benito Juárez (renombrada)");
  await contexto.close();
  const renombrada = await vistasDelCaso(navegador, FOLIO_LABRADOR);
  ver(renombrada.ficha.includes("Benito Juárez (renombrada)") && renombrada.detalle.includes("Benito Juárez (renombrada)") && renombrada.pdf.includes("Benito Juárez (renombrada)"), "D7: renombrar la alcaldía cambia su nombre en el caso existente: ficha pública, detalle del Administrador y PDF muestran «Benito Juárez (renombrada)»", `D7: ficha «${renombrada.ficha.slice(0, 120)}»`);
  ({ contexto, pagina } = await nuevaPagina(navegador, 390));
  await irA(pagina, "/admin/alcaldias");
  await boton(pagina.locator('li[data-elemento="3"]'), /^Editar/).click();
  const dlgB = pagina.getByRole("dialog", { name: "Editar alcaldía" });
  await dlgB.getByLabel(/^Nombre de la alcaldía/).fill("Benito Juárez");
  await boton(dlgB, "Guardar cambios").click();
  await hasta(async () => (await pagina.locator('li[data-elemento="3"] h2').innerText()) === "Benito Juárez");
  await contexto.close();
  const devuelta = await vistasDelCaso(navegador, FOLIO_LABRADOR);
  ver(devuelta.ficha === antes.ficha && devuelta.detalle === antes.detalle && devuelta.pdf === antes.pdf, "al devolverle su nombre, ficha, detalle y PDF vuelven a lo de antes (huella del contenido)", "tras devolver el nombre, el contenido no volvió a lo de antes");
}

async function flujoReaceptacionYTamano(navegador: Browser) {
  await valorDeSesion(base, "tutor1"); // la sesión de la tutora se abre ANTES de subir la versión (después, entrar exige aceptar el aviso: eso se prueba abajo, con el formulario)
  const admin = await nuevaPagina(navegador, 1280);
  await irA(admin.pagina, "/admin/parametros");
  const version = admin.pagina.getByLabel("Versión vigente del aviso de privacidad");
  const tamano = admin.pagina.getByLabel("Tamaño máximo de archivo permitido · MB");
  const etiquetas = async (ruta: string, ancho = 1280) => {
    const { contexto, pagina } = await nuevaPagina(navegador, ancho, "light", null);
    await irA(pagina, ruta);
    const pie = await pagina.locator("footer").getByRole("link", { name: /^Aviso de privacidad/ }).innerText();
    const titulo = ruta === "/" ? await pagina.locator("#titulo-aviso").innerText() : "";
    await contexto.close();
    return { pie, titulo };
  };
  const antes = await etiquetas("/");
  ver(antes.pie === "Aviso de privacidad v1.0" && antes.titulo === "Aviso de privacidad v1.0", "etiqueta del aviso con el parámetro vigente: pie y encabezado de la página principal dicen «v1.0»", `etiqueta inicial: ${antes.pie} / ${antes.titulo}`);
  await version.fill("2.0");
  await boton(admin.pagina, "Guardar configuración").click();
  await hasta(async () => (await admin.pagina.getByRole("status").filter({ hasText: "Configuración guardada" }).count()) === 1);
  const nueva = await etiquetas("/");
  const otraPagina = await etiquetas("/acceso");
  ver(nueva.pie === "Aviso de privacidad v2.0" && nueva.titulo === "Aviso de privacidad v2.0" && otraPagina.pie === "Aviso de privacidad v2.0", "tras subir la versión a 2.0 las etiquetas del pie y de la página principal dicen «v2.0» (también en /acceso)", `etiqueta nueva: ${nueva.pie} / ${nueva.titulo} / ${otraPagina.pie}`);
  const menu = await nuevaPagina(navegador, 390, "light", null);
  await irA(menu.pagina, "/");
  await boton(menu.pagina, "Menú").click();
  ver(await menu.pagina.getByRole("link", { name: "Aviso de privacidad v2.0" }).first().isVisible(), "el menú móvil de la plantilla pública también dice «Aviso de privacidad v2.0»", "el menú móvil no muestra v2.0");
  await menu.contexto.close();
  // La tutora entra: debe re-aceptar el aviso 2.0, lo acepta y ya no se lo piden.
  const c = credencial("tutor1");
  const tutora = await nuevaPagina(navegador, 390, "light", null);
  const entrar = async () => {
    await irA(tutora.pagina, "/acceso");
    await tutora.pagina.getByLabel("Correo electrónico").fill(c.correo);
    await tutora.pagina.getByLabel(/^Contraseña/).fill(c.contrasena);
    await boton(tutora.pagina, "Iniciar sesión").click();
  };
  await entrar();
  const modal = tutora.pagina.getByRole("dialog", { name: /Aviso de privacidad actualizado v2\.0/ });
  await modal.waitFor();
  ver((await modal.isVisible()) && /\/acceso/.test(tutora.pagina.url()), "R22 en pantalla: la tutora inicia sesión y ve el modal «Aviso de privacidad actualizado v2.0» (todavía en /acceso)", "R22: no apareció el modal con v2.0");
  await Promise.all([tutora.pagina.waitForURL(/\/tutor/), boton(modal, "Aceptar").click()]);
  ver(/\/tutor/.test(tutora.pagina.url()), "al aceptar, la tutora entra a su espacio", `al aceptar: ${tutora.pagina.url()}`);
  await tutora.contexto.clearCookies();
  await entrar();
  await tutora.pagina.waitForURL(/\/tutor/);
  ver(/\/tutor/.test(tutora.pagina.url()) && (await tutora.pagina.getByRole("dialog", { name: /Aviso de privacidad actualizado/ }).count()) === 0, "en el siguiente inicio de sesión ya no se lo vuelven a pedir", "se volvió a pedir el aviso");
  await tutora.contexto.close();
  // Restablecer devuelve la versión 1.0.
  await boton(admin.pagina, "Restablecer valores por defecto").click();
  await boton(admin.pagina.getByRole("dialog", { name: "Restablecer valores por defecto" }), "Confirmar").click();
  await hasta(async () => (await version.inputValue()) === "1.0");
  const vuelta = await etiquetas("/");
  ver(vuelta.pie === "Aviso de privacidad v1.0" && vuelta.titulo === "Aviso de privacidad v1.0", "«Restablecer» devuelve la versión 1.0 y las etiquetas dicen «v1.0» de nuevo", `tras restablecer: ${vuelta.pie}`);

  // Tamaño máximo de la foto: el Administrador baja el tope; el formulario lo refleja y rechaza una foto real mayor.
  await tamano.fill("0.2");
  await boton(admin.pagina, "Guardar configuración").click();
  await hasta(async () => (await admin.pagina.getByRole("status").filter({ hasText: "Configuración guardada" }).count()) === 1);
  const t = await nuevaPagina(navegador, 1280, "light", "tutor1");
  await t.pagina.goto(`${base}/tutor/registrar`, { waitUntil: "load" });
  await t.pagina.waitForSelector("main h1");
  ver(/JPG o PNG, máx\. 0\.2 MB/.test(await t.pagina.locator("main").innerText()), "con el tope en 0.2 MB, el texto de ayuda de la foto del registro dice «máx. 0.2 MB»", `ayuda de la foto: ${(await t.pagina.locator("main").innerText()).match(/JPG o PNG[^.]*\./)?.[0]}`);
  await elegirImagenGenerada(t.pagina, "ruido-grande");
  await hasta(async () => (await t.pagina.getByText(/La foto pesa más de 0\.2 MB/).count()) > 0, 30000);
  ver((await t.pagina.getByText(/La foto pesa más de 0\.2 MB/).first().isVisible()) && (await t.pagina.getByAltText("Vista previa de la fotografía").count()) === 0, "una foto real mayor al tope se RECHAZA en pantalla con «La foto pesa más de 0.2 MB» y no queda vista previa", `foto grande: ${(await t.pagina.locator("main").innerText()).slice(0, 200)}`);
  await t.contexto.close();
  await boton(admin.pagina, "Restablecer valores por defecto").click();
  await boton(admin.pagina.getByRole("dialog", { name: "Restablecer valores por defecto" }), "Confirmar").click();
  await hasta(async () => (await tamano.inputValue()) === "4");
  const t2 = await nuevaPagina(navegador, 1280, "light", "tutor1");
  await t2.pagina.goto(`${base}/tutor/registrar`, { waitUntil: "load" });
  await t2.pagina.waitForSelector("main h1");
  ver(/JPG o PNG, máx\. 4 MB/.test(await t2.pagina.locator("main").innerText()), "al restablecer, la ayuda de la foto vuelve a «máx. 4 MB»", "la ayuda de la foto no volvió a 4 MB");
  await t2.contexto.close();
  await admin.contexto.close();
}

/** Las cifras del tablero y de Reportes no se mueven por acciones de catálogo hechas con la interfaz y la API (huella del contenido). */
async function cifrasTrasCatalogos(navegador: Browser) {
  // Las cifras se cuentan por IDENTIFICADOR: renombrar, desactivar o crear valores en los catálogos cambia los RÓTULOS (nombre vigente), nunca las cifras ni parte una fila en dos.
  const HOY = hoyCDMX();
  const leer = async (ruta: string, generar = false) => {
    const { contexto, pagina } = await nuevaPagina(navegador, 1280);
    await irA(pagina, ruta);
    if (generar) {
      await pagina.locator("#reporte-desde").fill("2026-06-01");
      await pagina.locator("#reporte-hasta").fill(HOY);
      await boton(pagina, "Generar reporte").click();
      await pagina.locator("section[aria-label='Resultados del reporte']").waitFor();
    }
    const r = await pagina.evaluate(() => ({
      kpis: [...document.querySelectorAll("main article p.text-cifra")].map((p) => p.textContent!.trim()),
      filas: [...document.querySelectorAll("main figure div.sr-only table tbody tr")].map((tr) => [tr.querySelector("th")!.textContent!.trim(), tr.querySelector("td")!.textContent!.trim()]),
      opciones: [...document.querySelectorAll("main select option")].map((o) => o.textContent!.trim()),
    }));
    await contexto.close();
    return r;
  };
  const numeros = (r: Awaited<ReturnType<typeof leer>>) => JSON.stringify({ kpis: r.kpis, valores: r.filas.map((f) => f[1]).filter((v) => v !== "0") }); // un valor NUEVO del catálogo añade su fila con 0: no es una cifra que cambie
  const rutas: Array<[string, boolean]> = [["/admin", false], ["/admin/reportes", true]];
  const antes = await Promise.all(rutas.map(([r, g]) => leer(r, g)));
  const t0 = antes[0].kpis;
  ver(t0.join() === ["141", "19", "199", "4.9 días", "6"].join() && antes[1].kpis[0] === "1204", "el tablero muestra las cifras de siempre (141 activos, 19 localizados, 199 avistamientos, 4.9 días, 6 ocultos) y el reporte de toda la base 1 jun → hoy (1204 casos)", `cifras de partida: tablero ${t0} · reporte ${antes[1].kpis}`);
  const nuevo = [{ t: "alcaldias", c: { nombre: "Alcaldía de cifras", clave: "09019" } }, { t: "razas", c: { nombre: "Raza de cifras" } }, { t: "motivos", c: { nombre: "Motivo de cifras", idCategoria: 1, descripcion: "d" } }, { t: "estados-animal", c: { nombre: "Estado de cifras", idCategoria: 1, descripcion: "d" } }];
  for (const n of nuevo) await api("POST", `/api/admin/catalogos/${n.t}`, n.c);
  await api("PUT", "/api/admin/catalogos/alcaldias/4", { nombre: "Coyoacán renombrada", clave: "09003" });
  await api("PUT", "/api/admin/catalogos/motivos/1", { nombre: "Pánico renombrada", idCategoria: 1, descripcion: "d" });
  await api("PUT", "/api/admin/catalogos/estados-animal/2", { nombre: "Herido renombrado", idCategoria: 1, descripcion: "d" });
  for (const [t, id] of [["alcaldias", 5], ["razas", 6], ["motivos", 2], ["estados-animal", 16]] as const) await api("POST", `/api/admin/catalogos/${t}/${id}/desactivar`);
  const despues = await Promise.all(rutas.map(([r, g]) => leer(r, g)));
  const hc = (x: string) => createHash("sha256").update(x).digest("hex").slice(0, 8);
  ver(numeros(antes[0]) === numeros(despues[0]) && numeros(antes[1]) === numeros(despues[1]), `tras crear, renombrar y desactivar en los 4 catálogos, las CIFRAS del tablero (#${hc(numeros(antes[0]))}) y de Reportes (#${hc(numeros(antes[1]))}) son idénticas (los rótulos sí cambian)`, `las cifras cambiaron: tablero #${hc(numeros(antes[0]))}→#${hc(numeros(despues[0]))} · reportes #${hc(numeros(antes[1]))}→#${hc(numeros(despues[1]))}`);
  const rotulos = (r: Awaited<ReturnType<typeof leer>>) => r.filas.map((f) => f[0]);
  const antesRot = rotulos(antes[0]);
  const despuesRot = rotulos(despues[0]);
  const valorDeFila = (r: Awaited<ReturnType<typeof leer>>, nombre: string) => r.filas.find((f) => f[0] === nombre)?.[1];
  const ANIMAL = "Integridad física y salud: ";
  ver(antesRot.includes("Coyoacán") && !despuesRot.includes("Coyoacán") && valorDeFila(despues[0], "Coyoacán renombrada") === valorDeFila(antes[0], "Coyoacán") && despuesRot.filter((n) => n.startsWith("Coyoac")).length === 1 && !despuesRot.includes(`${ANIMAL}Herido / lesionado`) && despuesRot.includes(`${ANIMAL}Herido renombrado`) && valorDeFila(despues[0], `${ANIMAL}Herido renombrado`) === valorDeFila(antes[0], `${ANIMAL}Herido / lesionado`),
    `los rótulos son el nombre VIGENTE: «Coyoacán» → «Coyoacán renombrada» (misma cifra ${valorDeFila(despues[0], "Coyoacán renombrada")}, una sola fila) y «Herido / lesionado» → «Herido renombrado» (misma cifra ${valorDeFila(despues[0], `${ANIMAL}Herido renombrado`)})`, `rótulos tras renombrar: ${despuesRot.filter((n) => /Coyoac|Herido/.test(n))}`);
  const desactivada = valorDeFila(despues[0], "Cuajimalpa de Morelos");
  ver(desactivada !== undefined && desactivada === valorDeFila(antes[0], "Cuajimalpa de Morelos") && despues[1].opciones.includes("Cuajimalpa de Morelos") && despues[1].opciones.includes("Alcaldía de cifras") && despues[1].opciones.includes("Coyoacán renombrada"), `una alcaldía DESACTIVADA sigue con su conteo en el tablero (Cuajimalpa de Morelos: ${desactivada}) y las alcaldías inactivas y nuevas se ofrecen en el filtro de Reportes`, "la alcaldía desactivada desapareció del tablero o de los filtros");
}

/** Las 5 reactivaciones de catálogo que el seed agrega a las 25 del mock (posteriores a las desactivaciones del mismo elemento). */
const REACTIVACIONES_SEMBRADAS = [
  { fechaHora: "2026-10-18T11:05:00Z", idEntidad: "Alcaldías · 12", detalle: "Inactiva → Activa" },
  { fechaHora: "2026-10-18T11:10:00Z", idEntidad: "Razas · 6", detalle: "Inactivo → Activo" },
  { fechaHora: "2026-10-18T11:15:00Z", idEntidad: "Motivos · 2", detalle: "Inactivo → Activo" },
  { fechaHora: "2026-10-18T11:20:00Z", idEntidad: "Estados del animal · 16", detalle: "Inactivo → Activo" },
  { fechaHora: "2026-10-18T11:25:00Z", idEntidad: "Estados del animal · 17", detalle: "Inactivo → Activo" },
].map((r) => ({ ...r, tipo: "edición de catálogo" as const, entidad: "catálogo" as const, administrador: "Ricardo Vega Ficticio", motivo: undefined as string | undefined }));
/** Oráculo de la bitácora REAL: las 25 acciones del mock más las 5 reactivaciones, de la más reciente a la más antigua. */
const BITACORA_ESPERADA = [...BITACORA.map((a) => ({ fechaHora: a.fechaHora, tipo: a.tipo, entidad: a.entidad, idEntidad: a.idEntidad, motivo: a.motivo, detalle: a.detalle, administrador: a.administrador })), ...REACTIVACIONES_SEMBRADAS].sort((a, b) => b.fechaHora.localeCompare(a.fechaHora));
/** ¿La entidad que MUESTRA la pantalla corresponde a la del oráculo? (folio tal cual; «Avistamiento N · folio»; nombre (id) de usuario; «Catálogo · nombre (id)»; clave del parámetro). */
function entidadCorresponde(mostrada: string, e: { entidad: string; idEntidad: string }): boolean {
  if (e.entidad === "caso" || e.entidad === "parámetro") return mostrada === e.idEntidad;
  if (e.entidad === "avistamiento") return new RegExp(`^Avistamiento ${e.idEntidad} · RUPE-[A-Z0-9]{8}$`).test(mostrada) && mostrada.endsWith(AVISTAMIENTOS_MODERACION.find((a) => String(a.id) === e.idEntidad)?.folio ?? "?");
  if (e.entidad === "usuario") return new RegExp(`^.+ \\(${e.idEntidad}\\)$`).test(mostrada) && mostrada.startsWith(USUARIOS_INICIALES.find((u) => String(u.id) === e.idEntidad)?.nombreCompleto ?? "?");
  const [etiqueta, id] = e.idEntidad.split(" · ");
  return mostrada.startsWith(`${etiqueta} · `) && mostrada.endsWith(`(${id})`);
}
const filasDeBitacora = (p: Page) => p.locator("tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.children].map((c) => c.textContent!.trim())));
const POR_PAGINA_BITACORA = 8;

async function bitacora(navegador: Browser) {
  const tiposPresentes = new Set(BITACORA_ESPERADA.map((a) => a.tipo));
  ver(BITACORA_ESPERADA.length === 30 && TIPOS_ACCION.length === 11 && tiposPresentes.size === 11, "bitácora (oráculo): 25 acciones del mock + 5 reactivaciones sembradas = 30, con los 11 tipos de acción", "bitácora (oráculo): conteo o tipos incorrectos");
  const posteriores = REACTIVACIONES_SEMBRADAS.every((r) => BITACORA.some((a) => a.tipo === "desactivación de catálogo" && a.idEntidad === r.idEntidad && a.fechaHora < r.fechaHora));
  ver(posteriores, "cada reactivación sembrada es POSTERIOR a la desactivación del mismo elemento (el historial no se contradice)", "una reactivación sembrada es anterior a su desactivación");

  let { contexto, pagina } = await nuevaPagina(navegador, 1280);
  await irA(pagina, "/admin/bitacora");
  const form = () => pagina.getByRole("form", { name: "Filtrar la bitácora" });
  const tipo = () => form().getByLabel("Tipo de acción");
  const desde = () => form().getByLabel("Desde");
  const hasta = () => form().getByLabel("Hasta");
  ver((await pagina.getByText("La bitácora es de solo consulta: los registros no pueden editarse ni eliminarse.").isVisible()) && JSON.stringify(await tipo().locator("option").allInnerTexts()) === JSON.stringify(["Todos", ...TIPOS_ACCION]), "ADM-12: aviso de solo consulta y filtro «Tipo de acción» con los 11 tipos", "ADM-12: falta el aviso o los 11 tipos");
  const heads = await pagina.locator("thead th").allInnerTexts();
  ver(JSON.stringify(heads.map((h) => h.toLowerCase())) === JSON.stringify(["id", "fecha y hora", "tipo de acción", "entidad", "id de la entidad", "motivo", "detalle", "administrador"]), "ADM-12 (1280): tabla de 8 columnas (ID, fecha y hora, tipo, entidad, ID de la entidad, motivo, detalle, administrador)", `ADM-12: encabezados ${heads}`);
  const accionesMain = await pagina.locator("main").getByRole("button").allInnerTexts();
  ver(accionesMain.every((t) => /^(Aplicar filtros|Anterior|Siguiente)$/.test(t)) && (await pagina.locator("main tbody").getByRole("button").count()) === 0 && (await pagina.locator("main tbody a").count()) === 0, "ADM-12 inmutable: sin botones ni enlaces para editar o eliminar en las filas; solo filtros y paginación", "ADM-12: hay controles de edición");
  // Página 1: las 8 más recientes, con lo que muestra la pantalla igual al oráculo.
  const total = Math.ceil(BITACORA_ESPERADA.length / POR_PAGINA_BITACORA);
  const filas1 = await filasDeBitacora(pagina);
  const igualOraculo = (filas: string[][], desdeIdx: number) =>
    filas.every((f, i) => {
      const e = BITACORA_ESPERADA[desdeIdx + i];
      return f[1] === formatearFechaHora(e.fechaHora) && f[2] === e.tipo && f[3] === e.entidad && entidadCorresponde(f[4], e) && f[5] === (e.motivo ?? "—") && f[6] === (e.detalle ?? "—") && f[7] === e.administrador;
    });
  const idsDe = (filas: string[][]) => filas.map((f) => Number(f[0]));
  ver(filas1.length === 8 && igualOraculo(filas1, 0) && JSON.stringify(idsDe(filas1)) === JSON.stringify([30, 29, 28, 27, 26, 25, 24, 23]) && (await pagina.getByText(`Página 1 de ${total}`).isVisible()) && (await boton(pagina, "Anterior").isDisabled()) && (await boton(pagina, "Siguiente").isEnabled()), `ADM-12: 8 acciones por página del ALMACÉN (ids 30 a 23, las 5 reactivaciones primero), más reciente primero, «Página 1 de ${total}», «Anterior» deshabilitado`, `ADM-12: página 1 incorrecta (${idsDe(filas1)})`);
  const ultimaPag = BITACORA_ESPERADA.length - POR_PAGINA_BITACORA * (total - 1);
  await irA(pagina, `/admin/bitacora?pagina=${total}`);
  const filasU = await filasDeBitacora(pagina);
  ver(filasU.length === ultimaPag && igualOraculo(filasU, POR_PAGINA_BITACORA * (total - 1)) && (await boton(pagina, "Siguiente").isDisabled()) && (await boton(pagina, "Anterior").isEnabled()) && idsDe(filasU).at(-1) === 1, `ADM-12: la última página trae ${ultimaPag} acciones (hasta la id 1) y «Siguiente» se deshabilita`, `ADM-12: última página incorrecta (${filasU.length} filas)`);
  await boton(pagina, "Anterior").click();
  await hasta2(pagina, `Página ${total - 1} de ${total}`);
  ver((await pagina.getByText(`Página ${total - 1} de ${total}`).isVisible()) && (await pagina.locator("tbody tr").count()) === 8 && new RegExp(`pagina=${total - 1}`).test(pagina.url()), "ADM-12: «Anterior» retrocede una página y la URL lo refleja", "ADM-12: «Anterior» no funcionó");
  await irA(pagina, "/admin/bitacora?pagina=99");
  ver((await pagina.getByText(`Página ${total} de ${total}`).isVisible()) && (await pagina.locator("tbody tr").count()) === ultimaPag, "?pagina=99 (fuera de rango): el servidor lleva a la última página", "?pagina=99: no llevó a la última página");
  await irA(pagina, "/admin/bitacora?pagina=abc");
  ver(await pagina.getByText(`Página 1 de ${total}`).isVisible(), "?pagina=abc (no numérica): el servidor usa la página 1", "?pagina=abc: no usó la página 1");
  // Cada tipo de acción filtra sus registros (formulario GET): conteo y filas contra el oráculo.
  const malos: string[] = [];
  for (const t of TIPOS_ACCION) {
    await irA(pagina, "/admin/bitacora");
    await tipo().selectOption(t);
    await navegando(pagina, () => boton(form(), "Aplicar filtros").click());
    const esperadas = BITACORA_ESPERADA.filter((a) => a.tipo === t);
    const hay = await filasDeBitacora(pagina);
    const primeras = esperadas.slice(0, 8);
    const textoTotal = await pagina.getByText(/de \d+ acciones/).innerText();
    const ok = hay.length === primeras.length && textoTotal.includes(`de ${esperadas.length} acciones`) && igualOraculoLista(hay, primeras) && hay.every((f) => f[3] === ENTIDAD_DE_TIPO[t]) && new RegExp(`tipo=${encodeURIComponent(t).replace(/%20/g, "(?:%20|\\+)")}`).test(pagina.url());
    if (!ok) malos.push(`${t}: ${hay.length}/${primeras.length}`);
  }
  ver(malos.length === 0, "ADM-12: los 11 tipos de acción filtran bien (conteo, fila a fila contra el oráculo, entidad del tipo y filtro en la URL); motivo solo en caso y avistamiento, detalle en rol, parámetro y catálogos", `ADM-12: ${malos.join(" | ")}`);
  await irA(pagina, "/admin/bitacora?tipo=cambiar%20rol");
  await navegando(pagina, () => enlace(pagina, "Limpiar filtros").click());
  ver((await tipo().inputValue()) === "" && (await pagina.getByText("Página 1 de").isVisible()) && (await pagina.locator("tbody tr").count()) === 8, "ADM-12: «Limpiar filtros» vuelve a todas las acciones y vacía el formulario", "ADM-12: Limpiar filtros no funcionó");
  await desde().fill("2026-10-10");
  await hasta().fill("2026-10-04");
  await navegando(pagina, () => boton(form(), "Aplicar filtros").click());
  ver(/no puede ser anterior a «Desde»/.test(await textoDescrito(hasta())) && (await hasta().getAttribute("aria-invalid")) === "true" && (await desde().inputValue()) === "2026-10-10", "ADM-12: «Hasta» anterior a «Desde» da error bajo «Hasta» (validado en el servidor) y conserva lo escrito", "ADM-12: rango invertido sin error");
  await desde().fill("2026-10-10");
  await hasta().fill("2026-10-13");
  await navegando(pagina, () => boton(form(), "Aplicar filtros").click());
  const enRango = BITACORA_ESPERADA.filter((a) => fechaLocalISO(a.fechaHora) >= "2026-10-10" && fechaLocalISO(a.fechaHora) <= "2026-10-13");
  ver((await pagina.locator("tbody tr").count()) === Math.min(8, enRango.length) && (await pagina.getByText(`de ${enRango.length} acciones`).isVisible()) && enRango.length > 0 && enRango.length < BITACORA_ESPERADA.length, `ADM-12: el rango 10 a 13 oct (día de la Ciudad de México) filtra ${enRango.length} acciones`, "ADM-12: el rango de fechas no filtró bien");
  // Estado vacío REAL: un tipo y un rango sin acciones (reemplaza a ?estado=vacio).
  await irA(pagina, `/admin/bitacora?tipo=${encodeURIComponent(TIPOS_ACCION[7])}&desde=2026-10-17&hasta=2026-10-18`);
  ver((await pagina.getByRole("heading", { name: "Sin resultados" }).isVisible()) && (await pagina.getByText("No hay acciones registradas con los filtros seleccionados.").isVisible()) && (await pagina.locator("table").count()) === 0 && (await tipo().inputValue()) === TIPOS_ACCION[7], `ADM-12: sin acciones de «${TIPOS_ACCION[7]}» el 17 y 18 oct → «Sin resultados» (estado vacío real, filtros conservados)`, "ADM-12: el estado vacío real no apareció");
  await irA(pagina, "/admin/bitacora?tipo=inventado&desde=2026-13-45");
  ver((await pagina.locator("tbody tr").count()) === 8 && (await pagina.getByText("de 30 acciones").isVisible()) && (await hasta().getAttribute("aria-invalid")) !== "true" && (await desde().getAttribute("aria-invalid")) === "true", "?tipo=inventado&desde=2026-13-45: el servidor informa lo inválido (sin aplicarlo) y muestra las 30 acciones", "la URL inválida no se validó en el servidor");
  for (const v of ["?estado=cargando", "?estado=vacio"]) {
    await irA(pagina, `/admin/bitacora${v}`);
    ver((await pagina.locator("tbody tr").count()) === 8 && !/Cargando/.test(await pagina.locator("main").innerText()), `ADM-12 /admin/bitacora${v}: variante retirada, se ignora (tabla real de 8 filas, sin esqueletos)`, `ADM-12 ${v}: la variante sigue activa`);
  }
  await irA(pagina, "/admin/bitacora");
  const m = await pagina.evaluate(() => {
    const tabla = document.querySelector("table")!;
    const caja = tabla.parentElement!.getBoundingClientRect();
    const t = tabla.getBoundingClientRect();
    const malos: string[] = [];
    for (const f of document.querySelectorAll("tbody span.whitespace-nowrap")) if (f.getClientRects().length !== 1) malos.push(f.textContent!);
    return { dentro: t.left >= caja.left - 1 && t.right <= caja.right + 1 && tabla.scrollWidth <= tabla.clientWidth + 1, ancho: Math.round(t.width), rotos: malos, folios: document.querySelectorAll("tbody span.whitespace-nowrap").length };
  });
  ver(m.dentro && m.rotos.length === 0, `ADM-12 (1280): la tabla de 8 columnas cabe en su contenedor (${m.ancho} px) y los ${m.folios} identificadores con folio de la página no se cortan`, `ADM-12 (1280): tabla ${m.dentro ? "" : "desborda; "}rotos ${m.rotos}`);
  // Ninguna palabra de las columnas «Tipo de acción» y «Entidad» queda partida.
  const palabras = (p: Page) =>
    p.evaluate(() => {
      const partidas: string[] = [];
      let total = 0;
      for (const fila of document.querySelectorAll("tbody tr")) {
        for (const celda of [fila.children[2], fila.children[3]]) {
          const nodo = celda.firstChild;
          if (!nodo || nodo.nodeType !== 3) continue;
          const texto = nodo.textContent ?? "";
          for (const mm of texto.matchAll(/\S+/g)) {
            const rango = document.createRange();
            rango.setStart(nodo, mm.index!);
            rango.setEnd(nodo, mm.index! + mm[0].length);
            total++;
            if (rango.getClientRects().length > 1) partidas.push(mm[0]);
          }
        }
      }
      return { partidas, total, entidades: [...document.querySelectorAll("tbody tr")].map((f) => f.children[3].textContent!.trim()) };
    });
  const entidades = new Set<string>();
  let partidas: string[] = [];
  let totalPalabras = 0;
  for (let n = 1; n <= total; n++) {
    await irA(pagina, `/admin/bitacora?pagina=${n}`);
    const r = await palabras(pagina);
    partidas = partidas.concat(r.partidas);
    totalPalabras += r.total;
    r.entidades.forEach((e) => entidades.add(e));
  }
  ver(partidas.length === 0 && ["usuario", "caso", "avistamiento", "parámetro", "catálogo"].every((e) => entidades.has(e)), `ADM-12 (1280): «Entidad» (${[...entidades].join(", ")}) y «Tipo de acción» se ven enteras en una línea por palabra (${totalPalabras} palabras revisadas en las ${total} páginas)`, `ADM-12 (1280): palabras partidas → ${[...new Set(partidas)].join(", ")}`);
  await irA(pagina, "/admin/bitacora");
  await pagina.addStyleTag({ content: "tbody td:nth-child(4) { display: block; width: 3rem; white-space: normal !important; overflow-wrap: anywhere; }" });
  const roto = await palabras(pagina);
  ver(roto.partidas.length > 0, `autoprueba de palabras partidas: con la columna «Entidad» estrecha y sin nowrap se marca ${[...new Set(roto.partidas)].join(", ")}`, "autoprueba de palabras partidas: no detectó ninguna palabra partida");
  await contexto.close();
  ({ contexto, pagina } = await nuevaPagina(navegador, 390));
  await irA(pagina, "/admin/bitacora");
  const tarjetas = await pagina.locator("ul > li[data-accion]").allInnerTexts();
  const primera = BITACORA_ESPERADA[0];
  ver(tarjetas.length === 8 && (await pagina.locator("table").isHidden()) && tarjetas[0].includes("Acción 30") && tarjetas[0].includes(primera.tipo) && tarjetas[0].includes("Entidad afectada: catálogo") && tarjetas[0].includes("Estados del animal · Sin accesorios (17)") && tarjetas[0].includes(primera.administrador), "ADM-12 (390): 8 tarjetas del almacén con ID, tipo, fecha, administrador, entidad y su ID; la tabla no se muestra", "ADM-12 (390): tarjetas incorrectas");
  const ms = await pagina.evaluate(() => [...document.querySelectorAll("li[data-accion] span.whitespace-nowrap")].filter((f) => f.getClientRects().length !== 1).map((f) => f.textContent));
  ver(ms.length === 0, "ADM-12 (390): los identificadores con folio no se cortan en dos líneas", `ADM-12 (390): cortados ${ms}`);
  await irA(pagina, "/admin/bitacora?tipo=ocultar%20avistamiento");
  const conMotivo = BITACORA_ESPERADA.find((a) => a.tipo === "ocultar avistamiento" && a.motivo)!;
  ver((await pagina.locator("ul > li[data-accion]").first().innerText()).includes(`Motivo ${conMotivo.motivo}`), "ADM-12 (390): la tarjeta de «ocultar avistamiento» muestra el motivo", "ADM-12 (390): la tarjeta no muestra el motivo");
  await contexto.close();

  // La bitácora CRECE con cada acción real: se ejecutan 3 acciones por la API y aparecen arriba, con folio, «Avistamiento N · folio» y nombres.
  const orig = { Origin: ORIGEN_ADMIN, "Content-Type": "application/json" };
  const accion = (ruta: string, metodo: string, cuerpo: unknown) => fetchComo(base, "admin", ruta, { method: metodo, headers: orig, body: JSON.stringify(cuerpo) });
  const r1 = await accion("/api/admin/registros/RUPE-K7M4XQ9T/moderacion", "POST", { accion: "deshabilitar", motivo: "Prueba de la bitácora." });
  const r2 = await accion("/api/admin/avistamientos/101/moderacion", "POST", { accion: "ocultar", motivo: "Contiene un dato de contacto." });
  const r3 = await accion("/api/admin/usuarios/6/rol", "PUT", { rol: "Administrador" });
  ver([r1, r2, r3].every((r) => r.status === 200), "tres acciones reales del Administrador (deshabilitar caso, ocultar avistamiento, cambiar rol)", `acciones: ${[r1, r2, r3].map((r) => r.status)}`);
  ({ contexto, pagina } = await nuevaPagina(navegador, 1280));
  await irA(pagina, "/admin/bitacora");
  const filasN = await filasDeBitacora(pagina);
  ver(filasN.length === 8 && filasN[0][2] === "cambiar rol" && /\(6\)$/.test(filasN[0][4]) && filasN[0][6] === "Tutor → Administrador" && filasN[0][7] === "Ricardo Vega Ficticio" && filasN[1][2] === "ocultar avistamiento" && /^Avistamiento 101 · RUPE-[A-Z0-9]{8}$/.test(filasN[1][4]) && filasN[1][5] === "Contiene un dato de contacto." && filasN[2][2] === "deshabilitar caso" && filasN[2][4] === "RUPE-K7M4XQ9T" && filasN[2][5] === "Prueba de la bitácora." && (await pagina.getByText("de 33 acciones").isVisible()) && (await pagina.getByText("Página 1 de 5").isVisible()), "la bitácora creció: 33 acciones en 5 páginas y las 3 nuevas van arriba (folio como entidad del caso, «Avistamiento 101 · folio», nombre y id del usuario, motivo, «Tutor → Administrador» y quién la ejecutó)", `la bitácora no reflejó las acciones: ${JSON.stringify(filasN.slice(0, 3))}`);
  const htmlB = await (await fetchComo(base, "admin", "/admin/bitacora")).text();
  const correos = [...USUARIOS_INICIALES.map((u) => u.correo), credencial("tutor1").correo, credencial("tutor2").correo, CASOS_ORIGEN[0].tutor.telefono, ...CASOS_ORIGEN.map((c) => c.tokenPublico)];
  ver(correos.every((v) => !htmlB.includes(v)) && !htmlB.includes("@example.org") && !/vistoPorTutora|relevante|ubicacionSimulada/.test(htmlB), "ADM-12: ningún correo, teléfono ni token de la persona tutora, ni marcas internas, en la página (solo el nombre del usuario como entidad de la acción)", "ADM-12: hay datos de la persona tutora o marcas internas");
  await contexto.close();
}

/** Compara filas de la tabla con entradas del oráculo (todas las columnas menos el ID). */
function igualOraculoLista(filas: string[][], esperadas: typeof BITACORA_ESPERADA): boolean {
  return filas.length === esperadas.length && filas.every((f, i) => f[1] === formatearFechaHora(esperadas[i].fechaHora) && f[2] === esperadas[i].tipo && entidadCorresponde(f[4], esperadas[i]) && f[5] === (esperadas[i].motivo ?? "—") && f[6] === (esperadas[i].detalle ?? "—") && f[7] === esperadas[i].administrador);
}
const ORIGEN_ADMIN = new URL(base).origin;
/** Espera (hasta 8 s) a que el texto aparezca en la página (navegación del cliente). */
async function hasta2(pagina: Page, texto: string) {
  await hasta(() => pagina.getByText(texto).isVisible());
}


/**
 * Flujo COMPLETO con interfaz real y datos reales: el Administrador deshabilita un caso con motivo desde su pantalla; la dueña lo ve «Cerrado» (sin el motivo ni quién actuó); la ficha pública
 * y el estatus dan 404 idéntico a un folio inexistente; el Administrador lo restaura y todo vuelve a lo de antes; la bitácora muestra ambas entradas con el folio.
 */
async function flujoCompleto(navegador: Browser) {
  const FOLIO = "RUPE-K7M4XQ9T"; // Max, de Rosa (tutor1), «En búsqueda»
  const MOTIVO = "ZXQ motivo del flujo completo";
  // Huella del CONTENIDO ÍNTEGRO de cada canal público. Solo se normaliza lo que cambia por derecho propio al restaurar: el folio (para comparar contra otro folio) y la FECHA-HORA del último
  // cambio (R12: tras restaurar es la de la restauración), tanto en ISO (datos de Next y API) como ya formateada («9 oct 2026, 14:05»). Nada más se toca.
  const normalizarFecha = (t: string) => t.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, "FECHA").replace(/\d{1,2} [a-záéíóú]{3,4} \d{4}, \d{2}:\d{2}/g, "FECHA");
  const huellaPublica = async (folio: string) => {
    const rutas = [`/ficha/${folio}`, `/estatus/${folio}`, `/api/fichas/${folio}`, `/api/estatus/${folio}`];
    const salida: string[] = [];
    for (const r of rutas) {
      const t = await fetchComo(base, null, r);
      const cuerpo = normalizarFecha((await t.text()).split(folio).join("FOLIO"));
      salida.push(`${t.status}:${createHash("sha256").update(cuerpo).digest("hex").slice(0, 12)}`);
    }
    return salida;
  };
  const antes = await huellaPublica(FOLIO);
  const inexistente = await huellaPublica("RUPE-ZZZZZZZZ");
  ver(antes.every((x) => x.startsWith("200")) && inexistente.every((x) => x.startsWith("404")), `antes: la ficha y el estatus públicos de ${FOLIO} responden 200 (y un folio inexistente, 404)`, `antes del flujo: ${antes} / ${inexistente}`);

  const admin = await nuevaPagina(navegador, 1280);
  await irA(admin.pagina, `/admin/registros/${FOLIO}`);
  await boton(admin.pagina, "Deshabilitar registro").click();
  const dlg = admin.pagina.getByRole("dialog", { name: "Deshabilitar registro" });
  await dlg.getByLabel(/^Motivo \(obligatorio\)/).fill(MOTIVO);
  await boton(dlg, "Confirmar").click();
  await hasta(async () => (await boton(admin.pagina, "Restaurar registro").count()) > 0);
  ver(/Cerrado \(deshabilitado\)/.test(await admin.pagina.locator("main").innerText()) && (await admin.pagina.locator("section[aria-labelledby=historial-titulo]").innerText()).includes(`Motivo: ${MOTIVO}`), "el Administrador deshabilita el caso con motivo desde su pantalla: «Cerrado (deshabilitado)» y el motivo en su historial", "el Administrador no vio el caso deshabilitado");

  const tutora = await nuevaPagina(navegador, 390, "light", "tutor1");
  await irA(tutora.pagina, `/tutor/casos/${FOLIO}`);
  const textoT = await tutora.pagina.locator("main").innerText();
  const htmlT = await tutora.pagina.content();
  ver(/Cerrado/.test(textoT) && /Caso deshabilitado/.test(textoT) && !textoT.includes(MOTIVO) && !htmlT.includes(MOTIVO) && !/Ricardo|Vega Ficticio/.test(textoT), "la dueña lo ve «Cerrado» con el movimiento «Caso deshabilitado», SIN el motivo del Administrador ni su nombre (texto visible ni HTML)", "la dueña no ve «Cerrado», o se expone el motivo o el administrador");
  await irA(tutora.pagina, "/tutor");
  ver(await tutora.pagina.getByText(FOLIO).first().isVisible(), "y el caso sigue en su lista de registros", "el caso desapareció de la lista de la dueña");

  const durante = await huellaPublica(FOLIO);
  ver(JSON.stringify(durante) === JSON.stringify(inexistente), `la ficha pública y el estatus (página y API) dan 404 IDÉNTICO a un folio inexistente (${durante.join(", ")})`, `deshabilitado difiere de un folio inexistente: ${durante} vs ${inexistente}`);

  await boton(admin.pagina, "Restaurar registro").click();
  await hasta(async () => (await boton(admin.pagina, "Deshabilitar registro").count()) > 0);
  ver(!/Cerrado \(deshabilitado\)/.test(await admin.pagina.locator("main").innerText()) && /En búsqueda/.test(await admin.pagina.locator("main").innerText()), "el Administrador lo restaura: vuelve a «En búsqueda»", "la restauración no devolvió el caso a «En búsqueda»");
  const despues = await huellaPublica(FOLIO);
  ver(JSON.stringify(despues) === JSON.stringify(antes), `todo vuelve a lo de antes: la huella del contenido ÍNTEGRO de la ficha y el estatus públicos (página y API) es idéntica a la del inicio (${despues.join(", ")})`, `tras restaurar difiere de antes: ${despues} vs ${antes}`);
  await irA(tutora.pagina, `/tutor/casos/${FOLIO}`);
  ver(/En búsqueda/.test(await tutora.pagina.locator("main").innerText()) && /Caso restaurado/.test(await tutora.pagina.locator("main").innerText()), "la dueña vuelve a ver su caso «En búsqueda» con el movimiento «Caso restaurado»", "la dueña no ve el caso restaurado");

  await irA(admin.pagina, "/admin/bitacora");
  const filas = await filasDeBitacora(admin.pagina);
  ver(filas.length >= 2 && filas[0][2] === "restaurar caso" && filas[0][4] === FOLIO && filas[1][2] === "deshabilitar caso" && filas[1][4] === FOLIO && filas[1][5] === MOTIVO && filas[0][7] === "Ricardo Vega Ficticio", "la bitácora muestra las dos entradas (deshabilitar con su motivo y restaurar), con el folio como entidad y quién las ejecutó", `bitácora: ${JSON.stringify(filas.slice(0, 2))}`);
  await admin.contexto.close();
  await tutora.contexto.close();
}

// ---------- tablero y reportes con datos REALES, de punta a punta con la interfaz ----------
type FotoTablero = { activos: number; localizados: number; avistamientos: number; promedio: string; ocultos: number; casos: number; estado: number[]; filas: string[][] };
async function fotoTablero(navegador: Browser): Promise<FotoTablero> {
  const { contexto, pagina } = await nuevaPagina(navegador, 1280);
  await irA(pagina, "/admin");
  const filas = (titulo: string) => filasDe(pagina, titulo);
  const motivo = await filas("Casos por categoría de motivo");
  const leyenda = await pagina.locator("figure", { has: pagina.getByRole("heading", { name: "Casos por estado del caso" }) }).locator("ul li").allTextContents();
  const f = {
    activos: Number(await valorDe(pagina, "Casos activos")), localizados: Number(await valorDe(pagina, "Casos localizados")), avistamientos: Number(await valorDe(pagina, "Total de avistamientos")),
    promedio: await valorDe(pagina, "Promedio de tiempo de localización"), ocultos: Number(await valorDe(pagina, "Avistamientos ocultos")), casos: motivo.reduce((t, r) => t + Number(r[1]), 0),
    estado: leyenda.map((t) => Number(t.replace(/\D+/g, ""))), filas: await filas("Avistamientos por alcaldía"),
  };
  await contexto.close();
  return f;
}
const resumenFoto = (f: FotoTablero) => `${f.casos} casos · ${f.activos} activos · ${f.localizados} localizados · ${f.avistamientos} avist. · prom. ${f.promedio} · estado [${f.estado}]`;
const cifrasFoto = (f: FotoTablero) => JSON.stringify({ ...f, filas: f.filas.map((r) => r[1]) });

/** La persona tutora registra un caso por la interfaz → el tablero lo cuenta; lo localiza → se mueven las cifras; el Administrador genera el reporte, lo descarga (PDF y Excel) y comprueba la huella; renombrar una alcaldía solo cambia el rótulo. */
async function flujoTableroYReportes(navegador: Browser) {
  const HOY = hoyCDMX();
  const inicial = await fotoTablero(navegador);
  ver(inicial.casos === 163 && inicial.activos === 141 && inicial.localizados === 19 && inicial.avistamientos === 199 && inicial.ocultos === 6 && inicial.estado.join() === "20,58,32,31,16,6", `punto de partida (datos reiniciados): ${resumenFoto(inicial)}`, `punto de partida: ${resumenFoto(inicial)}`);

  const tutora = await nuevaPagina(navegador, 390, "light", "tutor1");
  await irA(tutora.pagina, "/tutor/registrar");
  const folio = await registrarPorLaInterfaz(tutora.pagina);
  const trasRegistro = await fotoTablero(navegador);
  ver(trasRegistro.casos === 164 && trasRegistro.activos === 142 && trasRegistro.estado.join() === "20,59,32,31,16,6" && trasRegistro.localizados === 19 && trasRegistro.avistamientos === 199, `la tutora registra ${folio} por la interfaz → el tablero pasa de ${inicial.casos} a ${trasRegistro.casos} casos: ${resumenFoto(inicial)} → ${resumenFoto(trasRegistro)}`, `tras registrar el caso: ${resumenFoto(trasRegistro)}`);

  await irA(tutora.pagina, `/tutor/casos/${folio}`);
  await boton(tutora.pagina, "Marcar como localizado").click();
  await boton(tutora.pagina.getByRole("dialog", { name: "¿Marcar el caso como localizado?" }), "Marcar como localizado").click();
  await tutora.pagina.getByText("El caso quedó como Localizado").first().waitFor();
  const trasLocalizar = await fotoTablero(navegador);
  ver(trasLocalizar.casos === 164 && trasLocalizar.activos === 141 && trasLocalizar.localizados === 20 && trasLocalizar.estado.join() === "20,58,32,31,17,6" && trasLocalizar.promedio !== trasRegistro.promedio, `la tutora lo localiza → localizados 19 → ${trasLocalizar.localizados}, activos ${trasRegistro.activos} → ${trasLocalizar.activos}, promedio ${trasRegistro.promedio} → ${trasLocalizar.promedio}: ${resumenFoto(trasLocalizar)}`, `tras localizar: ${resumenFoto(trasLocalizar)}`);
  await tutora.contexto.close();

  // El Administrador genera el reporte y lo descarga: PDF decodificado y Excel leído celda por celda con las mismas cifras de la pantalla.
  const admin = await nuevaPagina(navegador, 1280);
  const pag = admin.pagina;
  await irA(pag, "/admin/reportes");
  const generar = async () => {
    await pag.locator("#reporte-desde").fill("2026-10-01");
    await pag.locator("#reporte-hasta").fill(HOY);
    await boton(pag, "Generar reporte").click();
    await pag.locator("section[aria-label='Resultados del reporte']").waitFor();
  };
  await generar();
  const pantalla = { casos: await valorDe(pag, "Número de casos"), localizados: await valorDe(pag, "Casos localizados"), tasa: await valorDe(pag, "Tasa de recuperación"), ocultos: await valorDe(pag, "Avistamientos ocultos (aparte)") };
  ver(pantalla.casos === "164" && pantalla.localizados === "20" && pantalla.tasa === `${(Math.round((20 / 161) * 1000) / 10).toFixed(1)} %`, `reporte 1 oct → hoy: ${pantalla.casos} casos · ${pantalla.localizados} localizados · tasa ${pantalla.tasa} (20/161: el caso nuevo cuenta en el denominador) · ${pantalla.ocultos} ocultos`, `reporte tras el flujo: ${JSON.stringify(pantalla)}`);
  const nombre = (ext: string) => `reporte-rupe-2026-10-01_${HOY}.${ext}`;
  const [dPdf] = await Promise.all([pag.waitForEvent("download"), boton(pag, "Exportar a PDF").click()]);
  const textoPdf = await textoDePdf(navegador, new Uint8Array(readFileSync((await dPdf.path())!)), true);
  ver(dPdf.suggestedFilename() === nombre("pdf") && new RegExp(`Número de casos\\s+${pantalla.casos}\\b`).test(textoPdf) && new RegExp(`Casos localizados\\s+${pantalla.localizados}\\b`).test(textoPdf) && textoPdf.includes(`Tasa de recuperación (%) ${pantalla.tasa}`), `descarga «${dPdf.suggestedFilename()}»: el PDF decodificado dice ${pantalla.casos} casos, ${pantalla.localizados} localizados y ${pantalla.tasa}, como la pantalla`, `PDF del flujo: ${dPdf.suggestedFilename()} · ${textoPdf.slice(0, 160)}`);
  const [dXls] = await Promise.all([pag.waitForEvent("download"), boton(pag, "Exportar a Excel").click()]);
  const hojas = leerXlsx(new Uint8Array(readFileSync((await dXls.path())!)));
  const res = Object.fromEntries(filasDeHoja(hojas[0]).filter((f) => f.length >= 2 && typeof f[0] === "string").map((f) => [f[0] as string, f[1]]));
  const filasPantalla = await filasDe(pag, "Casos por estado del caso");
  const filasXls = filasDeHoja(hojas.find((h) => h.nombre === "Casos por estado")!).slice(1).map((f) => [String(f[0]), String(f[1])]);
  ver(dXls.suggestedFilename() === nombre("xlsx") && res["Número de casos"] === 164 && res["Casos localizados"] === 20 && res["Tasa de recuperación (%)"] === Math.round((20 / 161) * 1000) / 10 && JSON.stringify(filasXls) === JSON.stringify(filasPantalla), `descarga «${dXls.suggestedFilename()}»: el Excel (celda por celda, números) dice 164 casos, 20 localizados, ${res["Tasa de recuperación (%)"]} % y la hoja «Casos por estado» es igual a la de la pantalla`, `Excel del flujo: ${JSON.stringify(res)}`);

  // Huella (HU 057, regla 1): se genera, ocurre otro evento y se exporta → 409 con su mensaje; se regenera y se exporta.
  const otro = await crearCasoPorApi();
  const descargasAntes: string[] = [];
  pag.on("download", (d) => descargasAntes.push(d.suggestedFilename()));
  await boton(pag, "Exportar a PDF").click();
  const alerta = pag.getByRole("alert").filter({ hasText: "Los datos cambiaron; genera el reporte de nuevo." });
  await alerta.waitFor();
  await pag.waitForTimeout(300);
  ver((await alerta.isVisible()) && descargasAntes.length === 0 && (await boton(pag, "Exportar a PDF").isDisabled()) && (await boton(pag, "Exportar a Excel").isDisabled()) && (await valorDe(pag, "Número de casos")) === "164", `tras registrar ${otro} entre «Generar» y «Exportar»: aviso «Los datos cambiaron; genera el reporte de nuevo.» (role=alert), sin descarga y con las exportaciones deshabilitadas hasta regenerar`, `huella: alerta ${await alerta.count()}, descargas ${descargasAntes}`);
  await generar();
  const [dNuevo] = await Promise.all([pag.waitForEvent("download"), boton(pag, "Exportar a Excel").click()]);
  const nuevoRes = Object.fromEntries(filasDeHoja(leerXlsx(new Uint8Array(readFileSync((await dNuevo.path())!)))[0]).filter((f) => f.length >= 2 && typeof f[0] === "string").map((f) => [f[0] as string, f[1]]));
  ver((await valorDe(pag, "Número de casos")) === "165" && (await alerta.count()) === 0 && nuevoRes["Número de casos"] === 165, "al regenerar: 165 casos, el aviso desaparece y la exportación vuelve a funcionar (el Excel dice 165)", "al regenerar no se recuperó la exportación");
  await admin.contexto.close();

  // Renombrar una alcaldía cambia el rótulo en el tablero y en el reporte, no las cifras.
  const antes = await fotoTablero(navegador);
  const r = await api("PUT", "/api/admin/catalogos/alcaldias/4", { nombre: "Coyoacán renombrada", clave: "09003" });
  const despues = await fotoTablero(navegador);
  const { contexto: c2, pagina: p2 } = await nuevaPagina(navegador, 1280);
  await irA(p2, "/admin/reportes");
  const opciones = await p2.getByLabel("Alcaldía · opcional").locator("option").allInnerTexts();
  await p2.getByLabel("Alcaldía · opcional").selectOption({ label: "Coyoacán renombrada" });
  await p2.locator("#reporte-desde").fill("2026-10-01");
  await p2.locator("#reporte-hasta").fill(HOY);
  await boton(p2, "Generar reporte").click();
  await p2.locator("section[aria-label='Resultados del reporte']").waitFor();
  const chipAlcaldia = await p2.locator("section[aria-label='Resultados del reporte'] ul li").nth(1).innerText();
  await c2.close();
  ver(r.estado === 200 && cifrasFoto(antes) === cifrasFoto(despues) && antes.filas.some((f) => f[0] === "Coyoacán") && despues.filas.some((f) => f[0] === "Coyoacán renombrada") && !despues.filas.some((f) => f[0] === "Coyoacán") && opciones.includes("Coyoacán renombrada") && chipAlcaldia === "Alcaldía: Coyoacán renombrada", `renombrar la alcaldía 4: el tablero rotula «Coyoacán renombrada» con las MISMAS cifras (#${createHash("sha256").update(cifrasFoto(despues)).digest("hex").slice(0, 8)}), el filtro y los «Filtros aplicados» del reporte usan el nombre nuevo`, `renombrar: ${r.estado} ${chipAlcaldia}`);
}

/** Un avistamiento NUEVO sobre un caso SEMBRADO cuenta en las cifras de avistamientos del reporte cuando el periodo incluye otros casos; un periodo sin casos da «sin datos». */
async function avistamientoSobreSembrado(navegador: Browser) {
  const HOY = hoyCDMX();
  const leerReporte = async (desde: string, hasta: string) => {
    const { contexto, pagina } = await nuevaPagina(navegador, 1280);
    await irA(pagina, "/admin/reportes");
    await pagina.locator("#reporte-desde").fill(desde);
    await pagina.locator("#reporte-hasta").fill(hasta);
    await boton(pagina, "Generar reporte").click();
    await pagina.locator("section[aria-label='Resultados del reporte'], [role=status]:has-text('Sin datos')").first().waitFor();
    const sinDatos = (await pagina.getByText("No hay datos en el periodo y filtros seleccionados; modifica los filtros e inténtalo de nuevo.").count()) > 0;
    const sumaAlcaldia = sinDatos ? 0 : (await filasDe(pagina, "Avistamientos por alcaldía del avistamiento")).reduce((t, f) => t + Number(f[1]), 0);
    const casos = sinDatos ? "—" : await valorDe(pagina, "Número de casos");
    await contexto.close();
    return { sinDatos, sumaAlcaldia, casos };
  };
  const antes = await leerReporte("2026-10-01", HOY);
  const antesTablero = await fotoTablero(navegador);
  const f = new FormData();
  f.set("datos", JSON.stringify({ acceso: { canal: "folio", folio: "RUPE-K7M4XQ9T" }, fecha: hoyCDMX(-1), hora: "10:00", direccion: "Calle Reservada de avistamiento 1", idAlcaldia: 6, estadosAnimal: [1, 7] }));
  f.set("fotografia", new Blob([JPEG_REAL as BlobPart], { type: "image/jpeg" }), "fotografia.jpg");
  const alta = await fetch(`${base}/api/avistamientos`, { method: "POST", headers: { Origin: new URL(base).origin }, body: f, redirect: "manual" });
  const despues = await leerReporte("2026-10-01", HOY);
  const despuesTablero = await fotoTablero(navegador);
  ver(alta.status === 201 && despues.sumaAlcaldia === antes.sumaAlcaldia + 1 && despues.casos === antes.casos && despuesTablero.avistamientos === antesTablero.avistamientos + 1 && despuesTablero.casos === antesTablero.casos && despuesTablero.estado.join() === antesTablero.estado.join(), `avistamiento NUEVO sobre el caso sembrado Max (alta ${alta.status}): en el REPORTE de 1 oct → hoy los avistamientos por alcaldía pasan de ${antes.sumaAlcaldia} a ${despues.sumaAlcaldia} con los mismos ${despues.casos} casos, y en el tablero de ${antesTablero.avistamientos} a ${despuesTablero.avistamientos} sin mover los estados`, `avistamiento sobre sembrado: reporte ${JSON.stringify(antes)} → ${JSON.stringify(despues)} · tablero ${resumenFoto(antesTablero)} → ${resumenFoto(despuesTablero)}`);
  const vacio = await leerReporte("2026-10-19", HOY);
  ver(vacio.sinDatos, `un periodo SIN casos (19 oct → hoy) da «sin datos» aunque exista ese avistamiento nuevo (el reporte necesita casos que cuenten)`, "el periodo sin casos no dio «sin datos»");
}

/** Las exportaciones de «sin datos» están deshabilitadas de verdad (atributo, no clicables) y se ven distintas de las activas, en claro y en oscuro. */
async function exportacionDeshabilitada(navegador: Browser) {
  for (const tema of ["light", "dark"] as const) {
    const { contexto, pagina } = await nuevaPagina(navegador, 1280, tema);
    let descargas = 0;
    pagina.on("download", () => descargas++);
    const nombreTema = tema === "light" ? "claro" : "oscuro";
    const leer = () =>
      pagina.evaluate(() => {
        const sonda = document.createElement("span");
        document.body.append(sonda);
        sonda.style.color = "var(--disabled-text)";
        const deshabilitado = getComputedStyle(sonda).color;
        sonda.style.color = "var(--primary)";
        const primario = getComputedStyle(sonda).color;
        sonda.style.color = "var(--border-strong)";
        const bordeFuerte = getComputedStyle(sonda).color;
        sonda.remove();
        return {
          deshabilitado,
          primario,
          bordeFuerte,
          botones: [...document.querySelectorAll("button")].filter((b) => /^Exportar a (PDF|Excel)$/.test(b.textContent?.trim() ?? "")).map((b) => ({ nombre: b.textContent!.trim(), disabled: b.disabled, ariaDisabled: b.getAttribute("aria-disabled"), color: getComputedStyle(b).color, borde: getComputedStyle(b).borderTopColor, cursor: getComputedStyle(b).cursor })),
        };
      });
    const generarEn = async (desde: string, hasta: string, esperar: string | Locator) => {
      await irA(pagina, "/admin/reportes");
      await pagina.locator("#reporte-desde").fill(desde);
      await pagina.locator("#reporte-hasta").fill(hasta);
      await boton(pagina, "Generar reporte").click();
      await (typeof esperar === "string" ? pagina.getByText(esperar) : esperar).waitFor();
    };
    await generarEn("2026-10-19", "2026-10-31", "No hay datos en el periodo y filtros seleccionados; modifica los filtros e inténtalo de nuevo.");
    const d = await leer();
    ver(d.botones.length === 2 && d.botones.every((b) => b.disabled && b.color === d.deshabilitado && b.borde === d.bordeFuerte && b.cursor === "not-allowed"), `ADM-02 sin datos (${nombreTema}): «Exportar a PDF» y «Exportar a Excel» tienen el atributo disabled y usan el estilo de deshabilitado (texto --disabled-text, borde --border-strong, cursor no permitido)`, `ADM-02 sin datos (${nombreTema}): ${JSON.stringify(d.botones)}`);
    let clicables = 0;
    for (const b of ["Exportar a PDF", "Exportar a Excel"]) {
      await boton(pagina, b).click({ timeout: 1000 }).then(() => clicables++, () => undefined);
      await pagina.keyboard.press("Tab");
    }
    await pagina.waitForTimeout(300);
    ver(clicables === 0 && descargas === 0 && (await pagina.getByRole("status").filter({ hasText: /Se descargó/ }).count()) === 0, `ADM-02 sin datos (${nombreTema}): no se pueden pulsar (el clic no procede, no hay ninguna descarga ni aviso)`, `ADM-02 sin datos (${nombreTema}): ${clicables} botón(es) clicables, ${descargas} descarga(s)`);
    await generarEn("2026-10-01", "2026-10-18", pagina.locator("section[aria-label='Resultados del reporte']"));
    const a = await leer();
    ver(a.botones.length === 2 && a.botones.every((b) => !b.disabled && b.color === a.primario && b.color !== a.deshabilitado && b.cursor !== "not-allowed"), `ADM-02 con datos (${nombreTema}): las exportaciones activas se ven distintas (texto en color primario, sin cursor de no permitido)`, `ADM-02 con datos (${nombreTema}): ${JSON.stringify(a.botones)}`);
    await contexto.close();
  }
}

/** Esqueletos de carga de pantallas sin fotografías: sin el recuadro de la foto. */
async function esqueletosSinFoto(navegador: Browser) {
  // El estado de carga es REAL (ya no hay ?estado=cargando): mientras el servidor calcula el reporte se ven los esqueletos, sin recuadro de fotografía. La respuesta se retrasa con una ruta de Playwright.
  const { contexto, pagina } = await nuevaPagina(navegador, 390);
  let liberar: () => void = () => undefined;
  const retenida = new Promise<void>((r) => (liberar = r));
  await pagina.route("**/api/admin/reportes?*", async (ruta) => {
    await retenida;
    await ruta.continue();
  });
  await irA(pagina, "/admin/reportes");
  await pagina.locator("#reporte-desde").fill("2026-10-01");
  await pagina.locator("#reporte-hasta").fill("2026-10-18");
  await boton(pagina, "Generar reporte").click();
  const esqueletos = pagina.locator("[role=status][aria-busy=true]");
  await esqueletos.first().waitFor();
  const n = await esqueletos.count();
  const fotos = await pagina.locator("[role=status][aria-busy=true] > span.size-20").count();
  const sinVacio = (await pagina.getByText("Genera un reporte").count()) === 0 && (await pagina.locator("section[aria-label='Resultados del reporte']").count()) === 0;
  ver(n === 3 && fotos === 0 && sinVacio && (await boton(pagina, "Generar reporte").isDisabled()) && (await esqueletos.first().innerText()).includes("Generando el reporte…"), `/admin/reportes (generando): ${n} esqueletos de carga REALES sin recuadro de fotografía, anunciados como «Generando el reporte…», con «Generar reporte» deshabilitado y sin el estado vacío ni resultados a medias`, `/admin/reportes (generando): ${n} esqueleto(s), ${fotos} recuadro(s) de fotografía`);
  liberar();
  await pagina.locator("section[aria-label='Resultados del reporte']").waitFor();
  ver((await esqueletos.count()) === 0 && (await boton(pagina, "Generar reporte").isEnabled()), "/admin/reportes: al llegar la respuesta desaparecen los esqueletos y «Generar reporte» vuelve a estar disponible", "/admin/reportes: los esqueletos no desaparecieron al llegar el reporte");
  await contexto.close();
}

/** Celdas de tabla visibles cuyo contenido es más ancho que la celda (un texto largo que invade la columna vecina). */
const medirCeldas = (pagina: Page) =>
  pagina.evaluate(() => {
    const malos: string[] = [];
    let total = 0;
    for (const c of document.querySelectorAll<HTMLElement>("table th, table td")) {
      if (c.getClientRects().length === 0 || getComputedStyle(c).display === "none") continue;
      total++;
      if (c.scrollWidth > c.clientWidth + 1) malos.push(`«${(c.textContent ?? "").trim().slice(0, 30)}» ${c.scrollWidth}>${c.clientWidth}`);
    }
    return { malos, total };
  });

/** Ninguna celda de las tablas del Administrador desborda su ancho (a 1280 px). */
async function celdasSinDesborde(pagina: Page, etiqueta: string) {
  const r = await medirCeldas(pagina);
  if (r.total > 0) ver(r.malos.length === 0, `${etiqueta}: ${r.total} celdas de tabla sin desbordar su ancho`, `${etiqueta}: celdas desbordadas → ${r.malos.slice(0, 6).join(" | ")}`);
}

/** Autoprueba: con los identificadores largos sin ajuste de línea (el defecto de antes), la misma medición sí marca celdas. */
async function autopruebaCeldas(navegador: Browser) {
  const { contexto, pagina } = await nuevaPagina(navegador, 1280);
  await irA(pagina, "/admin/bitacora");
  const limpio = await medirCeldas(pagina);
  await pagina.addStyleTag({ content: "td span { white-space: nowrap !important; overflow-wrap: normal !important; }" });
  const roto = await medirCeldas(pagina);
  ver(limpio.malos.length === 0 && roto.malos.length > 0, `autoprueba de celdas: con el ajuste de línea quitado la bitácora marca ${roto.malos.length} celda(s) desbordadas (${roto.malos.slice(0, 2).join("; ")}); con la corrección, ninguna de ${limpio.total}`, `autoprueba de celdas: limpio ${limpio.malos.length}, roto ${roto.malos.length}`);
  await contexto.close();
}

/** Cada folio, ID, usuario, catálogo y parámetro de la bitácora existe en los mocks y su estado final coincide con la secuencia de acciones. */
function problemasDeBitacora(bit: typeof BITACORA): string[] {
  const ascendente = [...bit].sort((x, y) => x.fechaHora.localeCompare(y.fechaHora));
  const problemas: string[] = [];
  const fin = (l: typeof BITACORA, f: (a: (typeof BITACORA)[number]) => boolean) => l.filter(f).at(-1);
  // Casos: la deshabilitación y la restauración están en el historial (misma fecha y motivo) y el estado final cuadra.
  const folios = [...new Set(bit.filter((a) => a.entidad === "caso").map((a) => a.idEntidad))];
  for (const f of folios) {
    const c = CASOS_MODERACION.find((x) => x.folio === f);
    if (!c) {
      problemas.push(`caso ${f} no existe`);
      continue;
    }
    const mias = ascendente.filter((a) => a.idEntidad === f);
    for (const a of mias) {
      const m = c.historial.find((h) => h.fechaHora === a.fechaHora && h.tipo === (a.tipo === "deshabilitar caso" ? "deshabilitación" : "restauración"));
      if (!m || (a.tipo === "deshabilitar caso" && m.motivo !== a.motivo)) problemas.push(`caso ${f}: el historial no tiene «${a.tipo}» del ${a.fechaHora}`);
      if (a.fechaHora <= c.fechaRegistro) problemas.push(`caso ${f}: «${a.tipo}» anterior a su registro`);
    }
    const ultima = mias.at(-1)!;
    if (esDeshabilitado(c.historial) !== (ultima.tipo === "deshabilitar caso")) problemas.push(`caso ${f}: estado final incoherente con «${ultima.tipo}»`);
  }
  // Y al revés: toda deshabilitación o restauración del historial de un caso está en la bitácora.
  for (const c of CASOS_MODERACION) for (const h of c.historial.filter((x) => x.tipo === "deshabilitación" || x.tipo === "restauración")) if (!bit.some((a) => a.idEntidad === c.folio && a.fechaHora === h.fechaHora)) problemas.push(`caso ${c.folio}: «${h.tipo}» del ${h.fechaHora} no está en la bitácora`);
  // Avistamientos: ocultos con su motivo y fecha; visibles tras restaurar.
  for (const id of [...new Set(bit.filter((a) => a.entidad === "avistamiento").map((a) => a.idEntidad))]) {
    const v = AVISTAMIENTOS_MODERACION.find((x) => String(x.id) === id);
    if (!v) {
      problemas.push(`avistamiento ${id} no existe`);
      continue;
    }
    const mias = ascendente.filter((a) => a.idEntidad === id && a.entidad === "avistamiento");
    if (mias.some((a) => a.fechaHora <= v.fechaHora)) problemas.push(`avistamiento ${id}: acción anterior al avistamiento`);
    if (mias.some((a, i) => (i % 2 === 0) !== (a.tipo === "ocultar avistamiento"))) problemas.push(`avistamiento ${id}: ocultar y restaurar no se alternan`);
    const ultima = mias.at(-1)!;
    const oculto = ultima.tipo === "ocultar avistamiento";
    if (v.visible === oculto || (oculto && (v.motivoModeracion !== ultima.motivo || v.fechaModeracion !== ultima.fechaHora)) || (!oculto && (v.motivoModeracion || v.fechaModeracion))) problemas.push(`avistamiento ${id}: estado final incoherente con «${ultima.tipo}»`);
  }
  for (const v of AVISTAMIENTOS_MODERACION.filter((x) => !x.visible)) if (!bit.some((a) => a.tipo === "ocultar avistamiento" && a.idEntidad === String(v.id))) problemas.push(`avistamiento ${v.id} oculto sin registro en la bitácora`);
  // Usuarios: estatus y rol finales, y fecha de última modificación.
  for (const id of [...new Set(bit.filter((a) => a.entidad === "usuario").map((a) => a.idEntidad))]) {
    const u = USUARIOS_INICIALES.find((x) => String(x.id) === id);
    if (!u) {
      problemas.push(`usuario ${id} no existe`);
      continue;
    }
    const mias = ascendente.filter((a) => a.entidad === "usuario" && a.idEntidad === id);
    const estatus = fin(mias as typeof BITACORA, (a) => a.tipo === "habilitar usuario" || a.tipo === "deshabilitar usuario");
    if (estatus && (estatus.tipo === "habilitar usuario") !== u.activo) problemas.push(`usuario ${id}: estatus final incoherente`);
    if (mias.some((a, i, l) => (a.tipo === "habilitar usuario" || a.tipo === "deshabilitar usuario") && i > 0 && l.slice(0, i).filter((b) => b.tipo === "habilitar usuario" || b.tipo === "deshabilitar usuario").at(-1)?.tipo === a.tipo)) problemas.push(`usuario ${id}: habilitar y deshabilitar no se alternan`);
    const rol = fin(mias as typeof BITACORA, (a) => a.tipo === "cambiar rol");
    if (rol && rol.detalle!.split(" → ")[1] !== u.rol) problemas.push(`usuario ${id}: rol final incoherente`);
    if (mias.at(-1)!.fechaHora.slice(0, 16) > u.fechaUltimaModificacion.slice(0, 16)) problemas.push(`usuario ${id}: acción posterior a su última modificación`);
  }
  // Administradores que actúan: son administradores en ese momento (Carmen, desde que se le dio el rol y hasta que se deshabilitó).
  for (const a of bit) {
    const u = USUARIOS_INICIALES.find((x) => x.nombreCompleto === a.administrador);
    if (!u || u.rol !== "Administrador") {
      problemas.push(`administrador ${a.administrador} inexistente`);
      continue;
    }
    const acciones = ascendente.filter((b) => b.entidad === "usuario" && b.idEntidad === String(u.id));
    const desde = acciones.find((b) => b.tipo === "cambiar rol");
    const hasta = acciones.find((b) => b.tipo === "deshabilitar usuario");
    if ((desde && a.fechaHora < desde.fechaHora) || (!u.activo && hasta && a.fechaHora > hasta.fechaHora)) problemas.push(`acción ${a.id}: ${a.administrador} no era administrador activo en esa fecha`);
  }
  // Catálogos: existe el valor, y su estatus y nombre finales cuadran.
  // P6b: los catálogos del seed salen de los mocks de siempre y quedan TODOS ACTIVOS; la bitácora sembrada trae, además de las 25 del mock, las 5 reactivaciones (la última acción de estatus de cada uno).
  const nombresDe: Record<string, readonly { id: number; nombre: string }[]> = {
    Alcaldías: [...ALCALDIAS, FUERA_DE_LA_CIUDAD].map((nombre, i) => ({ id: nombre === FUERA_DE_LA_CIUDAD ? 17 : i + 1, nombre })), Razas: RAZAS, Motivos: MOTIVOS, "Estados del animal": ESTADOS_ANIMAL,
  };
  for (const clave of [...new Set(bit.filter((a) => a.entidad === "catálogo").map((a) => a.idEntidad))]) {
    const [nombre, id] = clave.split(" · ");
    const base = nombresDe[nombre]?.find((x) => String(x.id) === id);
    const el = base ? { ...base, activo: true } : undefined;
    if (!el) {
      problemas.push(`catálogo ${clave} no existe`);
      continue;
    }
    const mias = [...ascendente.filter((a) => a.entidad === "catálogo" && a.idEntidad === clave), ...REACTIVACIONES_SEMBRADAS.filter((r) => r.idEntidad === clave)];
    const estatus = fin(mias as typeof BITACORA, (a) => a.tipo === "desactivación de catálogo" || (a.tipo === "edición de catálogo" && /Inactiv\w+ → Activ/.test(a.detalle ?? "")));
    // El valor termina inactivo si su ÚLTIMA acción de estatus es una desactivación; una reactivación posterior (P6b: las 5 sembradas) lo deja activo. Todos los valores sembrados están activos.
    if ((estatus?.tipo === "desactivación de catálogo") === el.activo) problemas.push(`catálogo ${clave}: estatus final incoherente`);
    for (const a of mias) {
      if (a.tipo === "alta de catálogo" && (a.detalle !== el.nombre || a.detalle!.includes("→"))) problemas.push(`catálogo ${clave}: el alta debe mostrar solo el nombre «${el.nombre}»`);
      if (a.tipo === "desactivación de catálogo" && !/^Activ\w+ → Inactiv\w+$/.test(a.detalle ?? "")) problemas.push(`catálogo ${clave}: una desactivación pasa de Activo a Inactivo`);
      if (a.tipo === "edición de catálogo" && !/^(Nombre|Clave): .+ → .+$|^Inactiv\w+ → Activ\w+$/.test(a.detalle ?? "")) problemas.push(`catálogo ${clave}: una edición cambia nombre o clave, o reactiva`);
      if (a.tipo === "edición de catálogo" && a.detalle!.startsWith("Nombre:") && a.detalle!.split(" → ")[1] !== el.nombre) problemas.push(`catálogo ${clave}: nombre final distinto de «${el.nombre}»`);
    }
  }
  // Parámetros: el valor final de cada uno es el vigente.
  const finalDe: Record<string, string> = { version_aviso_privacidad: "1.0", expiracion_token_minutos: "60", tamano_maximo_archivo_mb: "4" }; // los valores sembrados (por defecto)
  for (const p of Object.keys(finalDe)) {
    const u = ascendente.filter((a) => a.tipo === "modificar parámetro" && a.idEntidad === p).at(-1);
    if (u && u.detalle!.split(" → ")[1] !== finalDe[p]) problemas.push(`parámetro ${p}: valor final ${u.detalle} ≠ ${finalDe[p]}`);
  }
  if (bit.some((a) => a.entidad === "parámetro" && !(a.idEntidad in finalDe))) problemas.push("parámetro inexistente");
  return problemas;
}

function bitacoraCoherente() {
  const problemas = problemasDeBitacora(BITACORA);
  ver(problemas.length === 0, `bitácora cruzada con los mocks (${BITACORA.length} acciones): folios, avistamientos, usuarios, catálogos y parámetros existen, sus estados finales cuadran con la secuencia y los historiales de los casos contienen cada deshabilitación y restauración`, `bitácora incoherente: ${problemas.join(" | ")}`);
}

/** Autoprueba de la comprobación cruzada: se provocan defectos en una copia de la bitácora (los datos reales no se tocan) y se exige que se marquen. */
function autopruebaBitacora() {
  const copia = () => BITACORA.map((a) => ({ ...a }));
  const idx = (f: (a: (typeof BITACORA)[number]) => boolean) => BITACORA.findIndex(f);
  const defectos: [string, typeof BITACORA, RegExp][] = [];
  const a = copia();
  a[idx((x) => x.tipo === "deshabilitar caso" && x.idEntidad === "RUPE-D5W2QK8X")] = { ...a[idx((x) => x.tipo === "deshabilitar caso" && x.idEntidad === "RUPE-D5W2QK8X")], idEntidad: "RUPE-ZZ99ZZ99" };
  defectos.push(["un folio de la bitácora que no existe en los mocks (RUPE-ZZ99ZZ99)", a, /caso RUPE-ZZ99ZZ99 no existe/]);
  const b = copia().filter((x) => !(x.tipo === "restaurar caso" && x.idEntidad === "RUPE-C2J9RK6Z"));
  defectos.push(["una deshabilitación de caso sin su restauración (el caso quedaría deshabilitado en la bitácora y no en su historial)", b, /RUPE-C2J9RK6Z: estado final incoherente con «deshabilitar caso»/]);
  const c = copia();
  const k = idx((x) => x.tipo === "ocultar avistamiento" && x.idEntidad === "303");
  c[k] = { ...c[k], administrador: "Carmen Ortiz Ejemplo" }; // Carmen estaba deshabilitada desde el 21 de agosto
  defectos.push(["una acción de un administrador inactivo en esa fecha (Carmen Ortiz el 13 de octubre)", c, /Carmen Ortiz Ejemplo no era administrador activo en esa fecha/]);
  const d = copia();
  const m = idx((x) => x.tipo === "ocultar avistamiento" && x.idEntidad === "201");
  d[m] = { ...d[m], fechaHora: "2026-10-02T17:15:00Z" }; // antes de que existiera el avistamiento
  defectos.push(["un avistamiento ocultado antes de existir", d, /avistamiento 201: acción anterior al avistamiento/]);
  for (const [nombre, datos, esperado] of defectos) {
    const p = problemasDeBitacora(datos);
    ver(p.some((x) => esperado.test(x)), `autoprueba de la bitácora cruzada: marca ${nombre} → «${p.find((x) => esperado.test(x))}»`, `autoprueba de la bitácora cruzada: NO marcó ${nombre} (${p.join(" | ") || "sin problemas"})`);
  }
  const limpio = problemasDeBitacora(BITACORA);
  ver(limpio.length === 0, "autoprueba de la bitácora cruzada: con los datos reales, sin defectos, vuelve a pasar (0 problemas)", `autoprueba de la bitácora cruzada: con los datos reales marca ${limpio.join(" | ")}`);
}

// ---------- enlaces y geometría ----------
async function enlacesYGeometria(navegador: Browser) {
  const rutas = ["/admin/usuarios", "/admin/usuarios?pagina=2", "/admin/usuarios?q=hector", "/admin/usuarios?estatus=inactivo", "/admin/usuarios?estatus=raro", "/admin/bitacora", "/admin/bitacora?pagina=2", "/admin/bitacora?tipo=cambiar%20rol", "/admin/bitacora?tipo=inventado&desde=2026-13-45", "/admin/registros", "/admin/registros?estado=Cerrado", "/admin/registros?alcaldia=999", `/admin/registros/${FOLIO_MODERACION_ACTIVO}`, `/admin/registros/${FOLIO_MODERACION_DESHABILITADO}`, `/admin/registros/${FOLIO_MODERACION_CANCELADO}`, "/admin/avistamientos", "/admin/avistamientos?pagina=2", "/admin/avistamientos?estatus=oculto", "/admin/avistamientos?desde=2026-10-10&hasta=2026-10-01", "/admin/avistamientos?detalle=101", "/admin/avistamientos?detalle=102", "/admin/avistamientos?detalle=102&foto=visible", "/admin/avistamientos?detalle=105", "/admin", `/admin?desde=2026-09-01&hasta=2026-09-30`, "/admin?desde=2026-10-10&hasta=2026-10-01", "/admin?desde=2026-10-19&hasta=2026-10-19", "/admin/reportes", "/admin/estados-caso", "/admin/parametros", ...["alcaldias", "razas", "motivos", "estados-animal"].flatMap((c) => [`/admin/${c}`, `/admin/${c}?pagina=2`, `/admin/${c}?pagina=999`, `/admin/${c}?q=a`, `/admin/${c}?q=zzzz`])];
  const vistos = new Set<string>();
  const { contexto, pagina } = await nuevaPagina(navegador, 1280);
  for (const r of rutas) {
    await irA(pagina, r);
    for (const h of await pagina.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")!))) if (h.startsWith("/")) vistos.add(h.split("#")[0] || "/");
  }
  await contexto.close();
  const malos: string[] = [];
  for (const h of vistos) {
    const s = (await fetchComo(base, rolDeRuta(h), h, { redirect: "follow" })).status;
    if (s === 404 || s >= 500) malos.push(`${h} → ${s}`);
  }
  ver(malos.length === 0, `enlaces internos de las pantallas del Administrador: ${vistos.size} rutas distintas, ninguna responde 404`, `enlaces rotos: ${malos.join(" | ")}`);
  for (const r of rutas) {
    for (const ancho of ANCHOS) {
      const p = await nuevaPagina(navegador, ancho);
      await irA(p.pagina, r);
      await desborde(p.pagina, `${r} ${ancho}px`);
      await areasTactiles(p.pagina, `${r} ${ancho}px`);
      if (ancho === 1280) await celdasSinDesborde(p.pagina, `${r} 1280px`);
      await p.contexto.close();
    }
  }
  // Los modales de moderación (ya no hay ?modal=) se abren con clics reales y se miden igual: sin desborde y con controles de 44 px.
  const modales: Array<[string, (p: Page) => Locator, string]> = [
    ["/admin/usuarios", (p) => boton(p, /^Cambiar rol de Rosa/), "Cambiar rol"],
    ["/admin/usuarios", (p) => boton(p, /^Deshabilitar a Rosa/), "Deshabilitar cuenta"],
    ["/admin/usuarios", (p) => boton(p, /^Habilitar a Mateo/), "Habilitar cuenta"],
    ["/admin/usuarios", (p) => boton(p, /^Deshabilitar a Luis/), "Deshabilitar cuenta"],
    ["/admin/registros", (p) => boton(p, /^Deshabilitar RUPE-K7M4XQ9T/), "Deshabilitar registro"],
    [`/admin/registros/${FOLIO_MODERACION_ACTIVO}`, (p) => boton(p, "Deshabilitar registro"), "Deshabilitar registro"],
    ["/admin/avistamientos", (p) => boton(p, /^Ocultar el avistamiento 201/), "Ocultar avistamiento"],
    ["/admin/alcaldias", (p) => boton(p, "Agregar alcaldía"), "Agregar alcaldía"],
    ["/admin/alcaldias", (p) => boton(p, /^Editar Álvaro Obregón/), "Editar alcaldía"],
    ["/admin/alcaldias", (p) => boton(p, /^Desactivar Álvaro Obregón/), "Desactivar alcaldía"],
    ["/admin/razas", (p) => boton(p, "Agregar raza"), "Agregar raza"],
    ["/admin/motivos", (p) => boton(p, "Agregar motivo"), "Agregar motivo de extravío"],
    ["/admin/estados-animal", (p) => boton(p, "Agregar estado"), "Agregar estado del animal"],
    ["/admin/parametros", (p) => boton(p, "Restablecer valores por defecto"), "Restablecer valores por defecto"],
  ];
  // Reportes: los estados que antes eran variantes (?estado=, ?generar=1) se alcanzan ahora con acciones reales: resultados, periodo sin datos y error de rango.
  const estadosDeReportes: Array<[string, string, string, (p: Page) => Promise<unknown>]> = [
    ["con resultados", "2026-10-01", "2026-10-18", (p) => p.locator("section[aria-label='Resultados del reporte']").waitFor()],
    ["sin datos", "2026-10-19", "2026-10-31", (p) => p.getByText("No hay datos en el periodo y filtros seleccionados; modifica los filtros e inténtalo de nuevo.").waitFor()],
    ["con error de rango", "2026-10-18", "2026-10-01", (p) => p.getByText("«Hasta» no puede ser anterior a «Desde».").waitFor()],
  ];
  for (const [nombre, d, h, esperar] of estadosDeReportes) {
    for (const ancho of ANCHOS) {
      const p = await nuevaPagina(navegador, ancho);
      await irA(p.pagina, "/admin/reportes");
      await p.pagina.locator("#reporte-desde").fill(d);
      await p.pagina.locator("#reporte-hasta").fill(h);
      await boton(p.pagina, "Generar reporte").click();
      await esperar(p.pagina);
      await desborde(p.pagina, `/admin/reportes ${nombre} ${ancho}px`);
      await areasTactiles(p.pagina, `/admin/reportes ${nombre} ${ancho}px`);
      await p.contexto.close();
    }
  }
  for (const [r, abrir, nombre] of modales) {
    for (const ancho of ANCHOS) {
      const p = await nuevaPagina(navegador, ancho);
      await irA(p.pagina, r);
      await abrir(p.pagina).click();
      await p.pagina.getByRole("dialog", { name: nombre }).waitFor();
      await desborde(p.pagina, `${r} con «${nombre}» abierto ${ancho}px`);
      await areasTactiles(p.pagina, `${r} con «${nombre}» abierto ${ancho}px`);
      await p.contexto.close();
    }
  }
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
    const solo = process.argv.find((a) => a.startsWith("--solo="))?.split("=")[1]?.split(",");
    // Cada sección corre con sus conteos; las que usan datos reales parten de datos REINICIADOS (cada una deja su rastro y la siguiente no lo hereda).
    const corre = async (nombre: string, f: () => unknown, { reiniciar = false }: { reiniciar?: boolean } = {}) => {
      if (solo && !solo.includes(nombre)) return;
      if (reiniciar) await reiniciarDatos(base);
      const antes = total;
      await f();
      console.log(`  ▸ ${nombre}: ${total - antes} comprobaciones`);
    };
    await corre("coloresFijos", () => coloresFijos());
    await corre("armazon", () => armazon(navegador!));
    await corre("menuEncabezados", () => menuEncabezados(navegador!));
    await corre("tablero", () => tablero(navegador!), { reiniciar: true });
    await corre("usuarios", () => usuarios(navegador!), { reiniciar: true });
    await corre("moderacionRegistros", () => moderacionRegistros(navegador!), { reiniciar: true });
    await corre("rotulosDelDetalle", () => rotulosDelDetalle(navegador!), { reiniciar: true });
    await corre("foliosEnUnaLinea", () => foliosEnUnaLinea(navegador!), { reiniciar: true });
    await corre("moderacionAvistamientos", () => moderacionAvistamientos(navegador!), { reiniciar: true });
    await corre("reglasDeCatalogos", () => reglasDeCatalogos(), { reiniciar: true });
    await corre("catalogos", () => catalogos(navegador!), { reiniciar: true });
    await corre("chipValorProtegido", () => chipValorProtegido(navegador!), { reiniciar: true });
    await corre("reportes", () => reportes(navegador!), { reiniciar: true });
    await corre("estadosDelCaso", () => estadosDelCaso(navegador!), { reiniciar: true });
    await corre("parametros", () => parametros(navegador!), { reiniciar: true });
    await corre("flujoRazaDesactivada", () => flujoRazaDesactivada(navegador!), { reiniciar: true });
    await corre("flujoReaceptacionYTamano", () => flujoReaceptacionYTamano(navegador!), { reiniciar: true });
    await corre("cifrasTrasCatalogos", () => cifrasTrasCatalogos(navegador!), { reiniciar: true });
    await corre("bitacora", () => bitacora(navegador!), { reiniciar: true });
    await corre("bitacoraCoherente", () => bitacoraCoherente());
    await corre("autopruebaBitacora", () => autopruebaBitacora());
    await corre("autopruebaCeldas", () => autopruebaCeldas(navegador!));
    await corre("exportacionDeshabilitada", () => exportacionDeshabilitada(navegador!), { reiniciar: true });
    await corre("esqueletosSinFoto", () => esqueletosSinFoto(navegador!), { reiniciar: true });
    await corre("sinDatosDeUsuarios", () => sinDatosDeUsuarios());
    await corre("flujoCompleto", () => flujoCompleto(navegador!), { reiniciar: true });
    await corre("flujoTableroYReportes", () => flujoTableroYReportes(navegador!), { reiniciar: true });
    await corre("avistamientoSobreSembrado", () => avistamientoSobreSembrado(navegador!), { reiniciar: true });
    await corre("enlacesYGeometria", () => enlacesYGeometria(navegador!), { reiniciar: true });
  } finally {
    await navegador?.close();
    apagar();
  }
  console.log(fallos === 0 ? "\nOK: pantallas del Administrador verificadas" : `\n${fallos} verificación(es) fallida(s)`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
