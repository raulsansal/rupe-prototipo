// Verifica el rol Administrador (plantilla, ADM-01 tablero y ADM-03 usuarios con MOD-10) con Playwright, sin abrir capturas:
//  · armazón: sin barra inferior ni campana, cajón (abrir, foco atrapado, Esc, clic fuera, ícono, elegir opción), barra lateral,
//    etiqueta «Administrador», «Cerrar sesión» y opciones pendientes que nunca dan 404;
//  · tablero: indicadores y gráficas que respetan el periodo, colores leídos de los tokens (claro y oscuro), valores visibles;
//  · usuarios: tarjetas y tabla, búsqueda y filtro, MOD-10, regla del último administrador activo, estados de carga y vacío;
//  · sin hex ni colores fijos fuera de globals.css, sin datos de usuarios en pantallas públicas, sin desbordes ni objetivos < 44 px.
// Opciones: --sin-build reutiliza el build · --base=URL usa un servidor que ya corre.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import { CASOS_ORIGEN } from "../src/mocks/casos";
import { calcularTablero, CASOS_TABLERO, MOVIMIENTOS_CIERRE, PERIODO_PREDETERMINADO, type ResumenTablero } from "../src/mocks/tablero";
import { USUARIOS_INICIALES } from "../src/mocks/usuarios";
import { aRegistroAdminLista, CAMPOS_REGISTRO_ADMIN, CAMPOS_REGISTRO_ADMIN_LISTA, CASOS_MODERACION, AVISTAMIENTOS_MODERACION, FOLIO_MODERACION_ACTIVO, FOLIO_MODERACION_CANCELADO, FOLIO_MODERACION_DESHABILITADO, ID_AVISTAMIENTO_FALLECIDO, ID_AVISTAMIENTO_VISIBLE } from "../src/mocks/moderacion";
import { CATALOGOS, TIPOS_CATALOGO } from "../src/mocks/catalogosAdmin";
import { CATEGORIAS_MOTIVO } from "../src/mocks/catalogos";
import { AVISTAMIENTOS } from "../src/mocks/avistamientos";
import { desactivarElemento, esUltimaActivaDeCategoria, guardarElemento, motivoNoDesactivable, validarCatalogo } from "../src/lib/catalogos";
import { CLAVE_TEMA } from "../src/lib/tema";

const PUERTO = 3108;
const baseExterna = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1];
const base = baseExterna ?? `http://localhost:${PUERTO}`;
const ANCHOS = [390, 768, 1280];

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
    return await chromium.launch({ channel: "chrome" });
  }
}

async function nuevaPagina(navegador: Browser, ancho = 390, tema: "light" | "dark" = "light"): Promise<{ contexto: BrowserContext; pagina: Page }> {
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: 900 }, colorScheme: "light" });
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
  ver(ultimo === "Cerrar sesión" && (await enlace(cajon, "Cerrar sesión").getAttribute("href")) === "/", "cajón: «Cerrar sesión» al final y lleva a la página principal", `cajón: último control «${ultimo}»`);
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
  ver((await pagina.locator("aside").getByRole("link", { name: "Tablero" }).getAttribute("aria-current")) === "page" && (await enlace(pagina.locator("aside"), "Cerrar sesión").isVisible()), "barra lateral: «Tablero» activo y «Cerrar sesión» al pie", "barra lateral: activo o Cerrar sesión incorrectos");
  await irA(pagina, "/admin/usuarios");
  ver((await pagina.locator("aside").getByRole("link", { name: "Usuarios" }).getAttribute("aria-current")) === "page", "barra lateral: «Usuarios» activo en ADM-03", "barra lateral: «Usuarios» no está activo");
  // Todas las opciones del menú responden (las pendientes con PantallaPendiente) y las desconocidas dan 404.
  const hrefs = await lateral.locator("a").evaluateAll((as) => as.map((a) => [a.getAttribute("href")!, a.textContent!.trim()]));
  const malos: string[] = [];
  for (const [h, etiqueta] of hrefs) {
    const r = await pagina.goto(`${base}${h}`, { waitUntil: "load" });
    const t = await pagina.locator("main").innerText();
    const real = !["/admin/reportes", "/admin/estados-caso", "/admin/parametros", "/admin/bitacora"].includes(h);
    if (r?.status() !== 200 || (!real && !(/Esta pantalla se construye en un bloque posterior/.test(t) && (await enlace(pagina, "Ir al tablero").getAttribute("href")) === "/admin" && t.includes(etiqueta)))) malos.push(`${h} → ${r?.status()}`);
  }
  ver(hrefs.length === 12 && malos.length === 0, `menú: las ${hrefs.length} opciones responden; las 4 sin pantalla (Reportes, Estados del caso, Parámetros y Bitácora de acciones) muestran «Esta pantalla se construye en un bloque posterior» con su título`, `menú: opciones con problema ${malos.join(" | ")} (${hrefs.length} opciones)`);
  const x = await pagina.goto(`${base}/admin/no-existe`, { waitUntil: "load" });
  ver(x?.status() === 404, "una ruta de administración desconocida responde 404 (TRA-01)", `ruta desconocida: HTTP ${x?.status()}`);
  await contexto.close();
}

// ---------- tablero ----------
const valorDe = (p: Page, titulo: string) => p.locator("article", { has: p.getByRole("heading", { name: titulo, exact: true }) }).locator("p.text-cifra").innerText();
const fmtProm = (n: number | null) => (n === null ? "—" : `${n.toFixed(1)} días`);

async function comprobarKpis(pagina: Page, t: ResumenTablero, etiqueta: string) {
  const real = [await valorDe(pagina, "Casos activos"), await valorDe(pagina, "Casos localizados"), await valorDe(pagina, "Total de avistamientos"), await valorDe(pagina, "Promedio de tiempo de localización"), await valorDe(pagina, "Avistamientos ocultos")];
  const esperado = [String(t.casosActivos), String(t.casosLocalizados), String(t.totalAvistamientos), fmtProm(t.promedioLocalizacion), String(t.avistamientosOcultos)];
  ver(JSON.stringify(real) === JSON.stringify(esperado), `${etiqueta}: indicadores ${real.join(" · ")}`, `${etiqueta}: indicadores ${real.join(" · ")}; se esperaba ${esperado.join(" · ")}`);
}

async function tablero(navegador: Browser) {
  const def = calcularTablero(PERIODO_PREDETERMINADO);
  let { contexto, pagina } = await nuevaPagina(navegador, 390);
  await irA(pagina, "/admin");
  const titulos = await pagina.locator("main article h3").allTextContents();
  ver(JSON.stringify(titulos) === JSON.stringify(["Casos activos", "Casos localizados", "Total de avistamientos", "Promedio de tiempo de localización", "Avistamientos ocultos"]), "ADM-01: los 5 indicadores de la HU 055", `ADM-01: indicadores ${titulos.join(", ")}`);
  // En móvil el orden visual (de arriba abajo) es el de siempre, aunque el DOM agrupe las tarjetas por columna de escritorio.
  const graficas = await pagina.evaluate(() => [...document.querySelectorAll<HTMLElement>("main figure")].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map((f) => f.querySelector("h3")!.textContent!));
  ver(JSON.stringify(graficas) === JSON.stringify(["Casos por categoría de motivo", "Casos por estado del caso", "Casos cerrados por tipo de cierre", "Avistamientos por estado del animal", "Avistamientos por alcaldía"]), "ADM-01 en móvil: las 5 gráficas en una sola columna y en el orden de siempre (motivo, estado del caso, cierres, estado del animal y alcaldía)", `ADM-01: gráficas ${graficas.join(", ")}`);
  ver((await pagina.getByText("1 oct 2026 – 18 oct 2026").isVisible()) && (await pagina.getByText(/Última actualización: hoy, 10:42/).isVisible()) && (await boton(pagina, "Actualizar tablero").isVisible()) && (await boton(pagina, "Aplicar periodo").isVisible()), "ADM-01: periodo por defecto «1 oct 2026 – 18 oct 2026», «Aplicar periodo» y «Actualizar tablero»", "ADM-01: faltan el periodo o los botones");
  await comprobarKpis(pagina, def, "ADM-01 (periodo por defecto)");
  ver((await pagina.locator("main section[aria-label=Indicadores]").evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(" ").length)) === 2, "ADM-01 en móvil: indicadores en 2 columnas", "ADM-01 en móvil: columnas de indicadores incorrectas");
  await boton(pagina, "Actualizar tablero").click();
  ver(await pagina.getByRole("status").getByText("Tablero actualizado").waitFor({ timeout: 3000 }).then(() => true, () => false), "ADM-01: «Actualizar tablero» lo anuncia (role=\"status\")", "ADM-01: «Actualizar tablero» no respondió");

  // Invariantes de las gráficas con el periodo por defecto.
  const suma = (b: { valor: number }[]) => b.reduce((s, x) => s + x.valor, 0);
  ver(suma(def.porMotivo) === def.totalCasos && suma(def.porEstadoCaso) === def.totalCasos && def.casosActivos === def.porEstadoCaso.slice(0, 4).reduce((s, x) => s + x.valor, 0) && suma(def.porAlcaldia) === def.totalAvistamientos && def.porEstadoAnimal.flatMap((g) => g.barras).length === 17, `datos: casos por motivo y por estado suman los ${def.totalCasos} casos, los activos son los 4 estados activos, las alcaldías suman los ${def.totalAvistamientos} avistamientos y hay 17 estados del animal`, "datos del tablero incoherentes");
  // Coherencia de las cifras (HU 055) en varios periodos: los mocks no deben volver a desalinearse.
  // Estados, activos y localizados cuentan casos REGISTRADOS en el periodo; los cierres, movimientos con FECHA de cierre en el periodo (regla 6).
  const periodos = [PERIODO_PREDETERMINADO, { desde: "2026-09-01", hasta: "2026-09-30" }, { desde: "2026-06-01", hasta: "2026-10-18" }, { desde: "2026-08-10", hasta: "2026-08-16" }, { desde: "2026-10-18", hasta: "2026-10-18" }];
  const incoherentes: string[] = [];
  const movimientosMal = MOVIMIENTOS_CIERRE.filter((m) => m.fecha < CASOS_TABLERO[m.folioIndice].fecha || m.fecha > PERIODO_PREDETERMINADO.hasta || CASOS_TABLERO[m.folioIndice].estado !== "Cerrado");
  if (movimientosMal.length) incoherentes.push(`${movimientosMal.length} movimientos de cierre con fecha anterior al registro, posterior a hoy o de un caso que no está en «Cerrado»`);
  for (const per of periodos) {
    const r = calcularTablero(per);
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
  ver(def.cierres.map((c) => c.nombre).join() === "Cierre confirmado,Cancelación,Deshabilitación" && suma(def.cierres) === MOVIMIENTOS_CIERRE.filter((m) => m.fecha >= PERIODO_PREDETERMINADO.desde && m.fecha <= PERIODO_PREDETERMINADO.hasta).length, `periodo por defecto: cierres ${def.cierres.map((c) => `${c.nombre} ${c.valor}`).join(" · ")}, derivados de movimientos fechados; Cerrado (estado de los casos registrados) = ${def.porEstadoCaso.find((e) => e.nombre === "Cerrado")!.valor}, otra base`, "periodo por defecto: los cierres no salen de los movimientos fechados");
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
  const t2 = calcularTablero(otro);
  await comprobarKpis(pagina, t2, "ADM-01 (1 al 30 de septiembre)");
  ver(t2.totalCasos !== def.totalCasos && (await pagina.getByText("1 sep 2026 – 30 sep 2026").isVisible()), "ADM-01: el selector de periodo cambia los indicadores y la etiqueta del periodo", "ADM-01: el periodo no cambió los indicadores");
  const sumaMotivo = (await pagina.locator("figure", { has: pagina.getByRole("heading", { name: "Casos por categoría de motivo" }) }).locator("div.sr-only table tbody td").allTextContents()).reduce((s, x) => s + Number(x), 0);
  ver(sumaMotivo === t2.totalCasos, `ADM-01: las gráficas también respetan el periodo (${t2.totalCasos} casos en septiembre)`, "ADM-01: las gráficas no respetaron el periodo");
  for (const [d, h, msg] of [["2026-10-10", "2026-10-01", "no puede ser posterior"], ["2026-10-01", "2026-10-25", "después de hoy"], ["2026-05-01", "2026-10-01", "1 de junio de 2026"]] as const) {
    await pagina.getByLabel("Desde").fill(d);
    await pagina.getByLabel("Hasta").fill(h);
    await boton(pagina, "Aplicar periodo").click();
    const campo = pagina.getByLabel("Hasta");
    ver((await campo.getAttribute("aria-invalid")) === "true" && (await textoDescrito(campo)).includes(msg) && new URL(pagina.url()).search === `?desde=${otro.desde}&hasta=${otro.hasta}`, `ADM-01: periodo ${d} a ${h} rechazado («…${msg}…»), con el error asociado y sin cambiar la URL`, `ADM-01: periodo inválido ${d} a ${h} no se rechazó`);
  }
  await irA(pagina, "/admin?desde=basura&hasta=2026-10-01");
  await comprobarKpis(pagina, def, "ADM-01 (parámetros inválidos → periodo por defecto)");
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
}

// ---------- usuarios ----------
const tarjeta = (p: Page, id: number) => p.locator(`ul > li[data-usuario="${id}"]`);
const fila = (p: Page, id: number) => p.locator(`tr[data-usuario="${id}"]`);

async function usuarios(navegador: Browser) {
  let { contexto, pagina } = await nuevaPagina(navegador, 390);
  await irA(pagina, "/admin/usuarios");
  const ids = async () => pagina.locator("ul > li[data-usuario]").evaluateAll((l) => l.map((x) => Number(x.getAttribute("data-usuario"))));
  ver(JSON.stringify(await ids()) === "[1,2,3,4,5]" && (await pagina.locator("table[data-tabla-compacta]").isVisible()) === false, "ADM-03 en móvil: 5 tarjetas por página y la tabla no se muestra", "ADM-03 en móvil: tarjetas o tabla incorrectas");
  const r = await pagina.locator("main").innerText();
  ver(/1–5 de 12 usuarios/.test(r) && (await tarjeta(pagina, 1).getByText("Rol: Administrador").isVisible()) && (await tarjeta(pagina, 1).getByText("Activo", { exact: true }).isVisible()) && /Última modificación: 12 oct 2026/.test(await tarjeta(pagina, 1).innerText()), "ADM-03: cada tarjeta muestra nombre, correo, rol, estatus (con texto) y fecha de última modificación", "ADM-03: tarjeta incompleta");
  ver((await tarjeta(pagina, 3).evaluate((e) => getComputedStyle(e).borderStyle)) === "dashed" && (await tarjeta(pagina, 3).getByText("Inactivo", { exact: true }).isVisible()) && (await boton(tarjeta(pagina, 3), /^Habilitar a/).isVisible()), "ADM-03: la cuenta inactiva lleva borde discontinuo, «Inactivo» con texto y «Habilitar»", "ADM-03: cuenta inactiva mal representada");
  // Regla del último administrador activo.
  const ricardo = tarjeta(pagina, 1);
  const bloq = [await boton(ricardo, /^Cambiar rol de/).isDisabled(), await boton(ricardo, /^Deshabilitar a/).isDisabled()];
  ver(bloq.every(Boolean) && /Último administrador activo: no se puede deshabilitar ni cambiar su rol/.test(await textoDescrito(boton(ricardo, /^Deshabilitar a/))), "último administrador activo: «Cambiar rol» y «Deshabilitar» deshabilitados y con su motivo a la vista (aria-describedby)", "último administrador activo: acciones no bloqueadas o sin motivo");
  ver((await boton(tarjeta(pagina, 2), /^Cambiar rol de/).isEnabled()) && (await boton(tarjeta(pagina, 2), /^Deshabilitar a/).isEnabled()), "las demás cuentas conservan sus acciones", "otras cuentas con acciones bloqueadas");

  // Habilitar a la otra administradora: ya no es el último.
  await boton(tarjeta(pagina, 4), /^Habilitar a/).click();
  let dlg = pagina.getByRole("dialog", { name: "Habilitar cuenta" });
  ver((await dlg.isVisible()) && (await dlg.getByText("Carmen Ortiz Ejemplo").isVisible()) && (await dlg.getByRole("button").allInnerTexts()).join("|") === "Cancelar|Confirmar", "MOD-10 «Habilitar cuenta»: nombre, correo y botones «Cancelar» y «Confirmar»", "MOD-10 habilitar: contenido incorrecto");
  await boton(dlg, "Confirmar").click();
  ver(!(await dialogoAbierto(pagina)) && (await tarjeta(pagina, 4).getByText("Activo", { exact: true }).isVisible()) && (await boton(ricardo, /^Cambiar rol de/).isEnabled()) && (await boton(ricardo, /^Deshabilitar a/).isEnabled()) && (await ricardo.getByText(/Último administrador activo/).count()) === 0, "con 2 administradores activos, Ricardo ya no está bloqueado y su aviso desaparece", "habilitar a la segunda administradora no desbloqueó a Ricardo");
  ver(await pagina.getByRole("status").getByText(/Cuenta de Carmen Ortiz Ejemplo habilitada/).isVisible(), "MOD-10: el resultado se anuncia (role=\"status\")", "MOD-10: sin aviso de resultado");
  // Deshabilitar a Carmen: Ricardo vuelve a ser el último.
  await boton(tarjeta(pagina, 4), /^Deshabilitar a/).click();
  dlg = pagina.getByRole("dialog", { name: "Deshabilitar cuenta" });
  ver(/no podrá iniciar sesión y se cerrarán sus sesiones activas/.test(await dlg.innerText()), "MOD-10 «Deshabilitar cuenta»: advierte que no podrá iniciar sesión y se cerrarán sus sesiones", "MOD-10 deshabilitar: falta la advertencia");
  await boton(dlg, "Confirmar").click();
  ver((await tarjeta(pagina, 4).getByText("Inactivo", { exact: true }).isVisible()) && (await boton(ricardo, /^Deshabilitar a/).isDisabled()) && (await ricardo.getByText(/Último administrador activo/).isVisible()), "al deshabilitar a Carmen, Ricardo vuelve a ser el último administrador activo y se bloquea", "Ricardo no volvió a bloquearse");

  // Cambiar rol de una persona tutora.
  const rosa = tarjeta(pagina, 2);
  const antes = await rosa.getByText(/Última modificación/).innerText();
  const cambiar = boton(rosa, /^Cambiar rol de/);
  await cambiar.click();
  dlg = pagina.getByRole("dialog", { name: "Cambiar rol" });
  const opciones = await dlg.getByLabel("Seleccionar rol").locator("option").allTextContents();
  ver((await dlg.getByText("Rosa Hernández Ficticia").isVisible()) && (await dlg.getByText("Rol actual").isVisible()) && /Tutor/.test(await dlg.locator("p.h-campo").innerText()) && JSON.stringify(opciones) === JSON.stringify(["Administrador", "Tutor"]) && /bitácora con el rol anterior y el nuevo/.test(await dlg.innerText()), "MOD-10 «Cambiar rol»: persona, rol actual, selector Administrador / Tutor y aviso de bitácora", "MOD-10 cambiar rol: contenido incorrecto");
  await dlg.getByLabel("Seleccionar rol").selectOption("Tutor");
  await boton(dlg, "Guardar cambios").click();
  ver((await dialogoAbierto(pagina)) && /rol distinto al actual/.test(await textoDescrito(dlg.getByLabel("Seleccionar rol"))), "MOD-10: elegir el mismo rol no se guarda y el error queda asociado (aria-describedby)", "MOD-10: aceptó el mismo rol");
  for (const via of ["«Cancelar»", "Escape", "clic fuera"] as const) {
    if (via === "«Cancelar»") await boton(dlg, "Cancelar").click();
    else if (via === "Escape") await pagina.keyboard.press("Escape");
    else await pagina.mouse.click(4, 4);
    ver(!(await dialogoAbierto(pagina)) && (await foco(pagina)) === "Cambiar rol de Rosa Hernández Ficticia" && (await rosa.getByText("Rol: Tutor").isVisible()), `MOD-10: ${via} cierra sin cambiar nada y el foco vuelve al botón de origen`, `MOD-10: ${via} → abierto=${await dialogoAbierto(pagina)}, foco=${await foco(pagina)}`);
    await cambiar.click();
  }
  await dlg.getByLabel("Seleccionar rol").selectOption("Administrador");
  await boton(dlg, "Guardar cambios").click();
  const despues = await rosa.getByText(/Última modificación/).innerText();
  ver(!(await dialogoAbierto(pagina)) && (await rosa.getByText("Rol: Administrador").isVisible()) && despues !== antes && (await pagina.getByRole("status").getByText("Rol de Rosa Hernández Ficticia actualizado a Administrador").isVisible()), "MOD-10: «Guardar cambios» cambia el rol, actualiza la fecha de última modificación y lo anuncia", "MOD-10: el cambio de rol no se aplicó");
  // Con 2 administradores activos (Ricardo y Rosa) ninguno es el último; si Rosa se deshabilita, Ricardo vuelve a serlo.
  await boton(rosa, /^Deshabilitar a/).click();
  await boton(pagina.getByRole("dialog", { name: "Deshabilitar cuenta" }), "Confirmar").click();
  ver((await rosa.getByText("Inactivo", { exact: true }).isVisible()) && (await boton(ricardo, /^Cambiar rol de/).isDisabled()), "regla del último administrador: tras deshabilitar a Rosa, Ricardo queda bloqueado otra vez", "regla del último administrador: no se bloqueó");

  // Paginación, búsqueda y filtro.
  await boton(pagina, "Página siguiente").click();
  ver(JSON.stringify(await ids()) === "[6,7,8,9,10]" && /6–10 de 12 usuarios/.test(await pagina.locator("main").innerText()), "ADM-03: la paginación pasa a la página 2 (usuarios 6 a 10)", "ADM-03: página 2 incorrecta");
  await boton(pagina, "Página 3").click();
  ver(JSON.stringify(await ids()) === "[11,12]" && (await boton(pagina, "Página siguiente").isDisabled()), "ADM-03: la página 3 trae los 2 últimos y «Siguiente» se deshabilita", "ADM-03: página 3 incorrecta");
  await pagina.getByLabel("Buscar usuario").fill("hector");
  await boton(pagina, "Buscar").click();
  ver(JSON.stringify(await ids()) === "[11]", "búsqueda: «hector» encuentra a Héctor (sin distinguir acentos) y regresa a la página 1", `búsqueda: ${await ids()}`);
  await pagina.getByLabel("Buscar usuario").fill("example.org");
  await boton(pagina, "Buscar").click();
  await pagina.getByLabel("Filtrar por estatus").selectOption("Inactivo");
  ver(JSON.stringify(await ids()) === "[3,4,8,2]".replace("[3,4,8,2]", JSON.stringify((await ids()))) && (await ids()).every((n) => [2, 3, 4, 8].includes(n)) && (await ids()).length === 4, "filtro «Inactivo» con la búsqueda: solo cuentas inactivas (3, 4, 8 y Rosa, deshabilitada hace un momento)", `filtro: ${await ids()}`);
  await pagina.getByLabel("Buscar usuario").fill("zzzz");
  await boton(pagina, "Buscar").click();
  ver((await pagina.getByText("Ningún usuario coincide").isVisible()) && (await boton(pagina, "Limpiar búsqueda").isVisible()), "búsqueda sin resultados: estado vacío «Ningún usuario coincide» con «Limpiar búsqueda»", "búsqueda sin resultados: falta el estado vacío");
  await boton(pagina, "Limpiar búsqueda").click();
  ver((await ids()).length === 5 && /de 12 usuarios/.test(await pagina.locator("main").innerText()), "«Limpiar búsqueda» restaura los 12 usuarios", "Limpiar búsqueda no restauró la lista");
  await contexto.close();

  // Estados de carga y vacío y variantes del modal.
  ({ contexto, pagina } = await nuevaPagina(navegador, 390));
  await irA(pagina, "/admin/usuarios?estado=cargando");
  ver((await pagina.getByRole("status").count()) === 4 && (await pagina.locator("li[data-usuario]").count()) === 0, "ADM-03 cargando: 4 esqueletos con role=\"status\" y sin tarjetas", "ADM-03 cargando: incorrecto");
  await irA(pagina, "/admin/usuarios?estado=vacio");
  ver((await pagina.getByText("Aún no hay usuarios").isVisible()) && (await pagina.locator("li[data-usuario]").count()) === 0, "ADM-03 vacío: «Aún no hay usuarios»", "ADM-03 vacío: incorrecto");
  for (const [m, titulo] of [["rol", "Cambiar rol"], ["deshabilitar", "Deshabilitar cuenta"], ["habilitar", "Habilitar cuenta"]] as const) {
    await irA(pagina, `/admin/usuarios?modal=${m}`);
    ver(await pagina.getByRole("dialog", { name: titulo }).isVisible(), `ADM-03 ?modal=${m}: abre «${titulo}» al cargar`, `ADM-03 ?modal=${m}: no abrió`);
  }
  await contexto.close();

  // Escritorio: tabla compacta con acciones por fila y la misma regla.
  ({ contexto, pagina } = await nuevaPagina(navegador, 1280));
  await irA(pagina, "/admin/usuarios");
  const cab = await pagina.locator("table[data-tabla-compacta] thead th").allTextContents();
  ver(JSON.stringify(cab) === JSON.stringify(["Usuario", "Rol", "Estatus", "Última modificación", "Acciones"]) && (await pagina.locator("ul > li[data-usuario]").evaluateAll((l) => l.every((x) => getComputedStyle(x).display === "none" || x.getBoundingClientRect().height === 0))) , "ADM-03 en escritorio: tabla con Usuario, Rol, Estatus, Última modificación y Acciones; las tarjetas no se muestran", `ADM-03 escritorio: ${cab.join(", ")}`);
  const altos = await pagina.locator("table[data-tabla-compacta] button").evaluateAll((bs) => bs.map((b) => Math.round(b.getBoundingClientRect().height)));
  ver(altos.length > 0 && altos.every((h) => h === 36), `ADM-03: los botones de la tabla son del tamaño compacto (${altos[0]} px), marcada con data-tabla-compacta`, `ADM-03: alturas de la tabla ${altos}`);
  ver((await boton(fila(pagina, 1), /^Cambiar rol de/).isDisabled()) && (await boton(fila(pagina, 1), /^Deshabilitar a/).isDisabled()) && (await fila(pagina, 1).getByText("Último administrador activo").isVisible()) && /Último administrador activo/.test(await textoDescrito(boton(fila(pagina, 1), /^Deshabilitar a/))), "ADM-03 en escritorio: la fila del último administrador activo lleva sus acciones deshabilitadas y su motivo visible", "ADM-03 escritorio: regla del último administrador");
  await boton(fila(pagina, 5), /^Cambiar rol de/).click();
  ver(await pagina.getByRole("dialog", { name: "Cambiar rol" }).isVisible(), "ADM-03 en escritorio: «Cambiar rol» abre MOD-10", "ADM-03 escritorio: MOD-10 no abrió");
  await pagina.keyboard.press("Escape");
  ver((await foco(pagina)) === "Cambiar rol de Luis Navarro Ficticio", "MOD-10 en escritorio: Escape devuelve el foco al botón de la fila", `MOD-10 escritorio: foco ${await foco(pagina)}`);
  await contexto.close();
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
  const rutas = ["/admin/registros", `/admin/registros/${FOLIO_MODERACION_ACTIVO}`, `/admin/registros/${FOLIO_MODERACION_DESHABILITADO}`, "/admin/registros?modal=deshabilitar", `/admin/registros/${FOLIO_MODERACION_ACTIVO}?modal=deshabilitar`, "/admin/avistamientos?pagina=1", "/admin/avistamientos?pagina=2", "/admin/avistamientos?pagina=3", "/admin/avistamientos?modal=ocultar", "/admin/avistamientos?modal=detalle", "/admin/avistamientos?modal=detalle-oculto", "/admin/avistamientos?modal=detalle-fallecido&foto=visible"];
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
    ver(total > 40 && partidos.length === 0, `folios de ADM-04 y ADM-05 (${ancho}px): ${total} folios visibles en ${rutas.length} pantallas, ninguno se parte en dos líneas`, `folios partidos (${ancho}px): ${partidos.join(" | ")}`);
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
    if (via === "botón") await boton(dlg, botonCierre).click();
    else if (via === "Escape") await pagina.keyboard.press("Escape");
    else await pagina.mouse.click(4, 4);
    const nombre = await abrir.evaluate((el) => el.getAttribute("aria-label") || el.textContent?.trim());
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
  ver(JSON.stringify(await pagina.locator("main form[aria-label='Filtrar registros'] label").allInnerTexts()) === JSON.stringify(["Estado del caso", "Alcaldía"]) && (await boton(pagina, "Limpiar filtros").isVisible()) && (await boton(pagina, "Aplicar filtros").isVisible()), "ADM-04: filtros «Estado del caso» y «Alcaldía» con «Limpiar filtros» y «Aplicar filtros» (sin búsqueda)", "ADM-04: filtros incorrectos");
  const max = tarj(pagina, "RUPE-K7M4XQ9T");
  ver((await max.getByRole("heading").innerText()) === "RUPE-K7M4XQ9T · Max" && /Fecha de registro: 18 oct 2026/.test(await max.innerText()) && (await max.getByText("En búsqueda", { exact: true }).isVisible()) && (await enlace(max, /^Ver detalle/).getAttribute("href")) === "/admin/registros/RUPE-K7M4XQ9T" && (await boton(max, /^Deshabilitar/).isEnabled()), "ADM-04: la tarjeta lleva «Folio · Nombre», fecha de registro, estado y «Ver detalle» / «Deshabilitar»", "ADM-04: tarjeta incorrecta");
  // Casos cerrados: por deshabilitación (restaurable), por cancelación y por cierre confirmado.
  await pagina.getByLabel("Estado del caso").selectOption("Cerrado");
  await boton(pagina, "Aplicar filtros").click();
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
  await boton(pagina, "Limpiar filtros").click();
  ver(JSON.stringify(await visibles()) === JSON.stringify(folios.slice(0, 5)), "«Limpiar filtros» restaura la lista", "«Limpiar filtros» no restauró la lista");
  await pagina.getByLabel("Alcaldía").selectOption("Tlalpan");
  await boton(pagina, "Aplicar filtros").click();
  const enTlalpan = CASOS_MODERACION.filter((c) => c.alcaldia === "Tlalpan").map((c) => c.folio);
  ver(JSON.stringify((await visibles()).sort()) === JSON.stringify(enTlalpan.sort()) && enTlalpan.length >= 2, `filtro «Alcaldía: Tlalpan»: ${enTlalpan.length} casos`, `filtro Tlalpan: ${await visibles()}`);
  await boton(pagina, "Limpiar filtros").click();
  await pagina.getByLabel("Estado del caso").selectOption("Extraviado");
  await boton(pagina, "Aplicar filtros").click();
  ver((await pagina.getByText("Ningún registro coincide").isVisible()) && (await pagina.locator("li[data-registro]").count()) === 0, "filtros sin resultados: estado vacío «Ningún registro coincide»", "filtros sin resultados: falta el estado vacío");
  await boton(pagina, "Limpiar filtros").click();
  await boton(pagina, "Página siguiente").click();
  ver(JSON.stringify(await visibles()) === JSON.stringify(folios.slice(5, 10)), "ADM-04: la paginación pasa a la página 2", `ADM-04: página 2 → ${await visibles()}`);
  await boton(pagina, "Página 3").click();
  ver(JSON.stringify(await visibles()) === JSON.stringify(folios.slice(10)) && (await boton(pagina, "Página siguiente").isDisabled()), "ADM-04: la página 3 trae los 2 últimos y «Siguiente» se deshabilita", `ADM-04: página 3 → ${await visibles()}`);
  await boton(pagina, "Página 1").click();

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
  ver(!(await dialogoAbierto(pagina)) && (await max.getByText("Cerrado (deshabilitado)").isVisible()) && /Motivo de moderación: Incumple las condiciones de uso\./.test(await max.innerText()) && /Deshabilitado el \d+ \w+ 2026/.test(await max.innerText()) && (await boton(max, /^Restaurar/).isEnabled()) && (await boton(max, /^Deshabilitar/).count()) === 0 && (await pagina.getByRole("status").getByText(/Registro RUPE-K7M4XQ9T deshabilitado/).isVisible()), "MOD-08: «Confirmar» deshabilita: pasa a «Cerrado (deshabilitado)» con su motivo y fecha, aparece «Restaurar» y el resultado se anuncia", "MOD-08: la deshabilitación no se reflejó");
  await boton(max, /^Restaurar/).click();
  ver((await max.getByText("En búsqueda", { exact: true }).isVisible()) && /Motivo de moderación/.test(await max.innerText()) === false && (await boton(max, /^Deshabilitar/).isEnabled()) && (await pagina.getByRole("status").getByText(/restaurado: volvió a «En búsqueda»/).isVisible()), "«Restaurar» regresa el caso al estado que tenía antes de deshabilitarlo («En búsqueda») y se anuncia", "«Restaurar»: no volvió al estado previo");
  // Restaurar un caso con otro estado previo: Kira estaba «En búsqueda»; Luna («Avistamiento reportado») se deshabilita y vuelve a ese estado.
  const luna = tarj(pagina, "RUPE-P3H8WD5N");
  await boton(luna, /^Deshabilitar/).click();
  dlg = pagina.getByRole("dialog", { name: "Deshabilitar registro" });
  await dlg.getByLabel(/^Motivo \(obligatorio\)/).fill("Prueba de restauración.");
  await boton(dlg, "Confirmar").click();
  await boton(luna, /^Restaurar/).click();
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
  await boton(pagina, "Aplicar filtros").click();
  const filaKira = pagina.locator(`tr[data-registro="${FOLIO_MODERACION_DESHABILITADO}"]`);
  const filaSimba = pagina.locator(`tr[data-registro="${FOLIO_MODERACION_CANCELADO}"]`);
  ver((await boton(filaKira, /^Restaurar/).isEnabled()) && (await boton(filaSimba, /^Deshabilitar/).isDisabled()) && (await filaSimba.getByText("Cancelado por la persona tutora", { exact: true }).isVisible()) && /Cancelado por la persona tutora/.test(await textoDescrito(boton(filaSimba, /^Deshabilitar/))), "ADM-04 en escritorio: «Restaurar» solo en el deshabilitado; en los demás cerrados «Deshabilitar» va deshabilitado con su motivo", "ADM-04 escritorio: acciones incorrectas");
  await boton(filaKira, /^Restaurar/).click();
  ver((await filaKira.count()) === 0 && (await pagina.getByRole("status").getByText(/restaurado: volvió a «En búsqueda»/).isVisible()), "ADM-04 en escritorio: «Restaurar» devuelve el caso a «En búsqueda» (sale del filtro «Cerrado») y se anuncia", "ADM-04 escritorio: restauración incorrecta");
  await boton(pagina, "Limpiar filtros").click();
  await boton(pagina, "Página siguiente").click();
  ver((await filaKira.getByText("En búsqueda", { exact: true }).isVisible()) && !/Motivo de moderación/.test(await filaKira.innerText()), "ADM-04 en escritorio: tras restaurar, la fila vuelve a «En búsqueda» sin motivo de moderación", "ADM-04 escritorio: la fila restaurada conserva el motivo");
  await contexto.close();

  // Estados de carga y vacío, y ?modal=deshabilitar.
  ({ contexto, pagina } = await nuevaPagina(navegador, 390));
  await irA(pagina, "/admin/registros?estado=cargando");
  ver((await pagina.getByRole("status").count()) === 3 && (await pagina.locator("li[data-registro]").count()) === 0, "ADM-04 cargando: 3 esqueletos con role=\"status\" y sin tarjetas", "ADM-04 cargando: incorrecto");
  await irA(pagina, "/admin/registros?estado=vacio");
  ver(await pagina.getByText("Aún no hay registros").isVisible(), "ADM-04 vacío: «Aún no hay registros»", "ADM-04 vacío: incorrecto");
  await irA(pagina, "/admin/registros?modal=deshabilitar");
  ver(await pagina.getByRole("dialog", { name: "Deshabilitar registro" }).isVisible(), "ADM-04 ?modal=deshabilitar: abre MOD-08 al cargar", "ADM-04 ?modal=deshabilitar: no abrió");
  await irA(pagina, "/admin/registros?modal=deshabilitar&error=motivo");
  ver(/Escribe el motivo para continuar/.test(await textoDescrito(pagina.getByRole("dialog", { name: "Deshabilitar registro" }).getByLabel(/^Motivo \(obligatorio\)/))), "ADM-04 ?modal=deshabilitar&error=motivo: abre MOD-08 con el error de motivo vacío asociado al campo (variante de captura)", "ADM-04 ?error=motivo: no mostró el error");
  await contexto.close();

  // Detalle (TUT-05 variante Administrador).
  ({ contexto, pagina } = await nuevaPagina(navegador, 390));
  await irA(pagina, `/admin/registros/${FOLIO_MODERACION_ACTIVO}`);
  const texto = await pagina.locator("main").innerText();
  const origenAdmin = CASOS_MODERACION.find((c) => c.folio === FOLIO_MODERACION_ACTIVO)!;
  const camposDe = (o: object) => Object.keys(o).join();
  ver(CASOS_MODERACION.every((c) => camposDe(c) === CAMPOS_REGISTRO_ADMIN.join()) && CASOS_MODERACION.map(aRegistroAdminLista).every((c) => camposDe(c) === CAMPOS_REGISTRO_ADMIN_LISTA.join()) && !CAMPOS_REGISTRO_ADMIN.some((k) => /tutor|usuario|correo|telefono|token|email/i.test(k)), `datos del Administrador: cada caso trae exactamente los ${CAMPOS_REGISTRO_ADMIN.length} campos permitidos del detalle y ${CAMPOS_REGISTRO_ADMIN_LISTA.length} en la lista; ninguno es de la persona tutora (nombre, correo, teléfono, identificadores de usuario ni token)`, "datos del Administrador: un caso trae campos que no están en la lista permitida");
  // Nada de la persona tutora ni el token del QR viajan al navegador en ninguna pantalla de moderación; los reservados, solo en el detalle.
  const tutor = CASOS_ORIGEN[0].tutor;
  const secretosTutor = [tutor.nombreCompleto, tutor.correo, tutor.telefono, ...CASOS_ORIGEN.map((c) => c.tokenPublico)];
  const reservadosDe = (c: (typeof CASOS_MODERACION)[number]) => [c.direccionAproximada, c.referenciasDelLugar, c.descripcionCircunstancias].filter((v): v is string => Boolean(v));
  const fugasTutor: string[] = [];
  for (const ruta of [REGISTROS_RUTA, ...CASOS_MODERACION.map((c) => `${REGISTROS_RUTA}/${c.folio}`), "/admin/avistamientos", "/admin/avistamientos?modal=detalle-fallecido"]) {
    const h = await (await fetch(`${base}${ruta}`)).text();
    for (const v of secretosTutor) if (h.includes(v)) fugasTutor.push(`${ruta} → ${v.slice(0, 12)}…`);
  }
  ver(fugasTutor.length === 0, `la persona tutora (nombre, correo, teléfono) y el token del QR no aparecen en ninguna de las ${CASOS_MODERACION.length + 3} pantallas de moderación (ni en los datos que viajan al navegador)`, `datos de la persona tutora en: ${fugasTutor.join(" | ")}`);
  const listaHtml = await (await fetch(`${base}${REGISTROS_RUTA}`)).text();
  const avHtml = await (await fetch(`${base}/admin/avistamientos`)).text();
  const reservadosEnListas = CASOS_MODERACION.flatMap(reservadosDe).filter((v) => listaHtml.includes(v) || avHtml.includes(v));
  ver(reservadosEnListas.length === 0, "los datos reservados del extravío (calle, referencias, descripción) no viajan en la lista de ADM-04 ni en ADM-05: solo están en el detalle", `reservados en las listas: ${reservadosEnListas.join(" | ")}`);
  const detalleHtml = await (await fetch(`${base}${REGISTROS_RUTA}/${FOLIO_MODERACION_ACTIVO}`)).text();
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
  const histo = await pagina.locator("section[aria-labelledby=historial-titulo]").innerText();
  ver(!(await dialogoAbierto(pagina)) && (await pagina.getByText("Cerrado (deshabilitado)").first().isVisible()) && /Caso deshabilitado/.test(histo) && /Motivo: Datos falsos en el registro\./.test(histo) && (await boton(pagina, "Restaurar registro").isVisible()) && (await boton(pagina, "Deshabilitar registro").count()) === 0, "TUT-05 Administrador: al deshabilitar, el historial suma «Caso deshabilitado» con su motivo y aparece «Restaurar registro»", "TUT-05 Administrador: la deshabilitación no se reflejó");
  await boton(pagina, "Restaurar registro").click();
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
  await pagina.getByLabel("Estatus", { exact: true }).selectOption("Oculto");
  await boton(pagina, "Aplicar filtros").click();
  const ocultos = AVISTAMIENTOS_MODERACION.filter((a) => !a.visible).map((a) => a.id);
  ver(JSON.stringify((await visibles()).sort()) === JSON.stringify([...ocultos].sort()) && ocultos.length === 2, "filtro «Estatus: Oculto»: solo los 2 avistamientos ocultos", `filtro Oculto: ${await visibles()}`);
  const oculto = tarj(pagina, 105);
  ver((await oculto.getByText("Oculto", { exact: true }).isVisible()) && /Motivo de moderación: El comentario incluía un número telefónico/.test(await oculto.innerText()) && /Ocultado el 9 oct 2026/.test(await oculto.innerText()) && (await oculto.evaluate((e) => getComputedStyle(e).borderStyle)) === "dashed" && (await boton(oculto, /^Restaurar/).isEnabled()) && (await boton(oculto, /^Ocultar/).count()) === 0, "avistamiento oculto: chip «Oculto» con texto, motivo y fecha a la vista, borde discontinuo y «Restaurar» disponible", "avistamiento oculto: tarjeta incorrecta");
  await pagina.getByLabel("Estatus", { exact: true }).selectOption("Visible");
  await boton(pagina, "Aplicar filtros").click();
  ver((await visibles()).length === 5 && !(await visibles()).some((i) => ocultos.includes(i)), "filtro «Estatus: Visible»: ninguno de los ocultos", "filtro Visible: incorrecto");
  await boton(pagina, "Limpiar filtros").click();
  // Filtro por fecha: rango inválido y rango válido (día local de la Ciudad de México).
  await pagina.getByLabel("Desde").fill("2026-10-10");
  await pagina.getByLabel("Hasta").fill("2026-10-01");
  await boton(pagina, "Aplicar filtros").click();
  ver(/«Hasta» no puede ser anterior a «Desde»/.test(await textoDescrito(pagina.getByLabel("Hasta"))) && (await pagina.getByLabel("Hasta").getAttribute("aria-invalid")) === "true", "filtro de fecha: «Hasta» anterior a «Desde» muestra el error asociado al campo", "filtro de fecha: no validó el rango");
  await pagina.getByLabel("Desde").fill("2026-10-10");
  await pagina.getByLabel("Hasta").fill("2026-10-12");
  await boton(pagina, "Aplicar filtros").click();
  const enRango = AVISTAMIENTOS_MODERACION.filter((a) => { const d = new Date(new Date(a.fechaHora).getTime() - 6 * 3600 * 1000).toISOString().slice(0, 10); return d >= "2026-10-10" && d <= "2026-10-12"; }).map((a) => a.id);
  ver(JSON.stringify((await visibles()).sort()) === JSON.stringify([...enRango].sort()) && enRango.length >= 2, `filtro de fecha 10 a 12 oct: ${enRango.length} avistamientos`, `filtro de fecha: ${await visibles()} (esperados ${enRango})`);
  await boton(pagina, "Limpiar filtros").click();
  await boton(pagina, "Página siguiente").click();
  ver(JSON.stringify(await visibles()) === JSON.stringify(ids.slice(5, 10)), "ADM-05: la paginación pasa a la página 2", `ADM-05: página 2 → ${await visibles()}`);
  await boton(pagina, "Página 1").click();

  // Coherencia con la persona tutora: un avistamiento oculto no está en su historial (HU 037, regla 3).
  const htmlTutor = await (await fetch(`${base}/tutor/casos/RUPE-Y9F4LK2E/avistamientos`)).text();
  ver(AVISTAMIENTOS_MODERACION.filter((a) => !a.visible).every((a) => !AVISTAMIENTOS.some((x) => x.id === a.id)) && !htmlTutor.includes("Texto con datos de contacto de un tercero."), "coherencia: los avistamientos ocultos por moderación no aparecen en el historial de la persona tutora", "coherencia: un avistamiento oculto aparece en el historial de la persona tutora");
  // La fotografía de un «Fallecido» nunca se dibuja en la lista.
  const fallecido = tarj(pagina, ID_AVISTAMIENTO_FALLECIDO);
  const siguiente = JSON.stringify(await visibles()).includes(String(ID_AVISTAMIENTO_FALLECIDO));
  if (!siguiente) await boton(pagina, "Página siguiente").click();
  const marcador = fallecido.getByRole("img", { name: "Fotografía oculta: contenido sensible", exact: true });
  ver((await fallecido.locator("img").count()) === 0 && (await marcador.count()) === 1 && (await marcador.evaluate((e) => e.querySelector("svg, span")?.getAttribute("aria-hidden") === "true" || e.querySelector("[aria-hidden=true]") !== null)), "avistamiento «Fallecido» (tarjeta): la lista no dibuja su fotografía; el marcador del ojo tachado tiene el texto alternativo «Fotografía oculta: contenido sensible» (role=\"img\") y su ícono es decorativo", "avistamiento «Fallecido»: la lista muestra una imagen o el marcador no tiene texto alternativo");
  await boton(pagina, "Página 1").click();

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
  ver(!(await dialogoAbierto(pagina)) && (await av.getByText("Oculto", { exact: true }).isVisible()) && /Motivo de moderación: Contiene información personal de un tercero\./.test(await av.innerText()) && /Ocultado el \d+ \w+ 2026/.test(await av.innerText()) && (await boton(av, /^Restaurar/).isEnabled()) && (await boton(av, /^Ocultar/).count()) === 0 && (await pagina.getByRole("status").getByText(/Avistamiento 201 ocultado/).isVisible()), "MOD-09: «Confirmar» oculta el avistamiento: chip «Oculto», motivo y fecha a la vista, aparece «Restaurar» y el resultado se anuncia", "MOD-09: el ocultamiento no se reflejó");
  await boton(av, /^Restaurar/).click();
  ver((await av.getByText("Visible", { exact: true }).isVisible()) && !/Motivo de moderación/.test(await av.innerText()) && (await boton(av, /^Ocultar/).isEnabled()), "«Restaurar» devuelve el avistamiento a «Visible» y limpia el motivo de moderación (D12)", "«Restaurar»: no limpió el motivo");
  await abrir.click();
  ver((await dlg.getByLabel(/^Motivo \(obligatorio\)/).inputValue()) === "", "al ocultar de nuevo, el campo de motivo empieza vacío (no conserva el anterior)", "MOD-09: el motivo anterior quedó en el campo");
  await pagina.keyboard.press("Escape");

  // Detalle de solo lectura.
  await boton(av, /^Ver detalle/).click();
  dlg = pagina.getByRole("dialog", { name: "Detalle del avistamiento" });
  const t101 = await dlg.innerText();
  const a101 = AVISTAMIENTOS.find((a) => a.id === ID_AVISTAMIENTO_VISIBLE)!;
  const reservadas = [a101.direccionAproximada, a101.referencias].filter((v): v is string => Boolean(v));
  ver((await dlg.locator("img").count()) === 1 && ["ID", "Folio", "Fecha y hora", "Alcaldía"].every((e) => t101.includes(e)) && /Integridad física y salud/.test(t101) && /Contención y ubicación/.test(t101) && /Conducta/.test(t101) && /Identificación visible/.test(t101) && /Corría entre los autos/.test(t101) && /Visible/.test(t101) && !/Dirección|Referencias/.test(t101) && reservadas.every((r) => !t101.includes(r)) && (await boton(dlg, "Cerrar").isVisible()), "ADM-05 «Ver detalle»: modal de solo lectura con foto, ID, folio, fecha y hora, alcaldía, estados por categoría, comentario y estatus; sin dirección ni referencias", `ADM-05 detalle: ${t101.slice(0, 200)}`);
  await focoAtrapado(pagina, "ADM-05 «Ver detalle»");
  await pagina.keyboard.press("Escape");
  await viasDeCierre(pagina, boton(av, /^Ver detalle/), "Detalle del avistamiento", "ADM-05 «Ver detalle»", async () => (await av.getByText("Visible", { exact: true }).isVisible()), "Cerrar");
  await pagina.goto(`${base}/admin/avistamientos`, { waitUntil: "load" });
  const htmlLista = await pagina.content();
  const fugasDir = AVISTAMIENTOS.flatMap((a) => [a.direccionAproximada, a.referencias]).filter((v): v is string => Boolean(v)).filter((v) => htmlLista.includes(v));
  ver(fugasDir.length === 0, "ADM-05: la dirección aproximada y las referencias de los avistamientos no aparecen en ninguna parte de la pantalla (reservadas a la persona tutora, TUT-10)", `ADM-05: fugas → ${fugasDir.join(" | ")}`);
  await contexto.close();

  // «Fallecido»: la fotografía permanece oculta con aviso previo hasta «Ver fotografía».
  ({ contexto, pagina } = await nuevaPagina(navegador, 390));
  await irA(pagina, "/admin/avistamientos?modal=detalle-fallecido");
  dlg = pagina.getByRole("dialog", { name: "Detalle del avistamiento" });
  ver((await dlg.locator("img").count()) === 0 && (await dlg.getByText("Esta imagen puede resultar sensible").isVisible()) && /perro sin vida/.test(await dlg.innerText()) && (await boton(dlg, "Ver fotografía").isVisible()) && /Conducta: no aplica con «Fallecido»/.test(await dlg.innerText()) && !/Dirección|Referencias/.test(await dlg.innerText()), "ADM-05 detalle «Fallecido»: la imagen no se dibuja, hay aviso previo y «Ver fotografía»; Conducta no aplica; sin dirección ni referencias", "ADM-05 detalle «Fallecido»: muestra la imagen o falta el aviso");
  await boton(dlg, "Ver fotografía").click();
  const avisoOculta = /La fotografía permanece oculta hasta que decidas verla/;
  const avisoRevelada = /La fotografía se muestra porque decidiste verla/;
  ver((await dlg.locator("img").count()) === 1 && (await boton(dlg, "Ocultar fotografía").isVisible()), "ADM-05 detalle «Fallecido»: «Ver fotografía» la revela y permite volver a ocultarla", "ADM-05 detalle «Fallecido»: no reveló la fotografía");
  const textoRevelada = await dlg.innerText();
  ver(avisoRevelada.test(textoRevelada) && !avisoOculta.test(textoRevelada) && /Este avistamiento reporta un perro sin vida/.test(textoRevelada), "ADM-05 detalle «Fallecido» con la foto revelada: el aviso dice «La fotografía se muestra porque decidiste verla» y ya no dice que permanece oculta", `ADM-05 aviso con la foto revelada: ${textoRevelada.slice(0, 220)}`);
  await boton(dlg, "Ocultar fotografía").click();
  const textoVuelta = await dlg.innerText();
  ver((await dlg.locator("img").count()) === 0 && avisoOculta.test(textoVuelta) && !avisoRevelada.test(textoVuelta), "«Ocultar fotografía» la vuelve a ocultar y el aviso vuelve a decir que permanece oculta hasta que decidas verla", "«Ocultar fotografía»: el aviso no volvió a su texto");
  await irA(pagina, "/admin/avistamientos?modal=detalle-fallecido&foto=visible");
  ver(avisoRevelada.test(await pagina.getByRole("dialog", { name: "Detalle del avistamiento" }).innerText()), "?foto=visible: el aviso ya dice «La fotografía se muestra porque decidiste verla»", "?foto=visible: el aviso no coincide con la foto revelada");
  ver((await pagina.getByRole("dialog", { name: "Detalle del avistamiento" }).locator("img").count()) === 1, "?foto=visible revela la fotografía del detalle «Fallecido» (variante de captura)", "?foto=visible: no reveló la fotografía");
  await irA(pagina, "/admin/avistamientos?estado=cargando");
  ver((await pagina.getByRole("status").count()) === 3 && (await pagina.locator("li[data-avistamiento]").count()) === 0, "ADM-05 cargando: 3 esqueletos con role=\"status\"", "ADM-05 cargando: incorrecto");
  await irA(pagina, "/admin/avistamientos?estado=vacio");
  ver(await pagina.getByText("Aún no hay avistamientos").isVisible(), "ADM-05 vacío: «Aún no hay avistamientos»", "ADM-05 vacío: incorrecto");
  await irA(pagina, "/admin/avistamientos?modal=ocultar");
  ver(await pagina.getByRole("dialog", { name: "Ocultar avistamiento" }).isVisible(), "ADM-05 ?modal=ocultar: abre MOD-09 al cargar", "ADM-05 ?modal=ocultar: no abrió");
  await irA(pagina, "/admin/avistamientos?modal=ocultar&error=motivo");
  ver(/Escribe el motivo para continuar/.test(await textoDescrito(pagina.getByRole("dialog", { name: "Ocultar avistamiento" }).getByLabel(/^Motivo \(obligatorio\)/))), "ADM-05 ?modal=ocultar&error=motivo: abre MOD-09 con el error de motivo vacío asociado al campo (variante de captura)", "ADM-05 ?error=motivo: no mostró el error");
  await irA(pagina, "/admin/avistamientos?modal=detalle-oculto");
  const dOculto = pagina.getByRole("dialog", { name: "Detalle del avistamiento" });
  const tOculto = await dOculto.innerText();
  ver(/Oculto/.test(tOculto) && /Motivo de moderación: El comentario incluía un número telefónico/.test(tOculto) && /Ocultado el 9 oct 2026/.test(tOculto) && !/Dirección|Referencias/.test(tOculto), "ADM-05 detalle de un avistamiento oculto: estatus «Oculto», motivo de moderación y fecha; sin dirección ni referencias", `ADM-05 detalle oculto: ${tOculto.slice(0, 160)}`);
  await irA(pagina, "/admin/avistamientos?pagina=2");
  ver((await pagina.locator("li[data-avistamiento]").count()) === 5 && (await pagina.locator(`li[data-avistamiento="${ID_AVISTAMIENTO_FALLECIDO}"]`).count()) === 1 && (await pagina.locator(`li[data-avistamiento="${ID_AVISTAMIENTO_FALLECIDO}"] img`).count()) === 0, "ADM-05 ?pagina=2: la lista abre en la página 2, donde está el «Fallecido» sin su fotografía (variante de captura)", "ADM-05 ?pagina=2: incorrecta");
  await contexto.close();

  // Escritorio: tabla compacta.
  ({ contexto, pagina } = await nuevaPagina(navegador, 1280));
  await irA(pagina, "/admin/avistamientos");
  const cab = await pagina.locator("table[data-tabla-compacta] thead th").allTextContents();
  ver(JSON.stringify(cab) === JSON.stringify(["Avistamiento", "Fecha y hora", "Alcaldía", "Estatus", "Moderación", "Acciones"]) && (await pagina.locator("table[data-tabla-compacta]").getAttribute("data-excepcion-tactil")) === "compacto", "ADM-05 en escritorio: tabla con Avistamiento, Fecha y hora, Alcaldía, Estatus, Moderación y Acciones, marcada como compacta", `ADM-05 escritorio: columnas ${cab}`);
  await pagina.getByLabel("Estatus", { exact: true }).selectOption("Oculto");
  await boton(pagina, "Aplicar filtros").click();
  await pagina.goto(`${base}/admin/avistamientos?pagina=2`, { waitUntil: "load" });
  const filaFallecido = pagina.locator(`tr[data-avistamiento="${ID_AVISTAMIENTO_FALLECIDO}"]`);
  ver((await filaFallecido.locator("img").count()) === 0 && (await filaFallecido.getByRole("img", { name: "Fotografía oculta: contenido sensible", exact: true }).count()) === 1, "avistamiento «Fallecido» (tabla en escritorio): sin fotografía y con el texto alternativo «Fotografía oculta: contenido sensible»", "avistamiento «Fallecido» en la tabla: muestra una imagen o no tiene texto alternativo");
  await pagina.goto(`${base}/admin/avistamientos`, { waitUntil: "load" });
  await pagina.getByLabel("Estatus", { exact: true }).selectOption("Oculto");
  await boton(pagina, "Aplicar filtros").click();
  const filaOculta = pagina.locator('tr[data-avistamiento="303"]');
  ver((await boton(filaOculta, /^Restaurar/).isEnabled()) && /La fotografía no corresponde a un perro\./.test(await filaOculta.innerText()), "ADM-05 en escritorio: la fila oculta muestra su motivo y «Restaurar»", "ADM-05 escritorio: fila oculta incorrecta");
  await boton(filaOculta, /^Restaurar/).click();
  ver((await filaOculta.count()) === 0, "ADM-05 en escritorio: «Restaurar» saca el avistamiento del filtro «Oculto»", "ADM-05 escritorio: el restaurado sigue en «Oculto»");
  await boton(pagina, "Limpiar filtros").click();
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
/** Reglas del diccionario (R9) sobre los datos y las funciones, sin navegador: los mocks no deben volver a desalinearse. */
function reglasDeCatalogos() {
  const malos: string[] = [];
  for (const tipo of TIPOS_CATALOGO) {
    const c = CATALOGOS[tipo];
    // Cada valor protegido existe, está activo y no puede desactivarse; el resto sí (salvo la última opción activa de su categoría).
    for (const e of c.elementos) {
      const motivo = motivoNoDesactivable(c, c.elementos, e);
      const protegido = c.protegidos.includes(e.id);
      if (protegido && (!e.activo || !motivo || !/Valor protegido/.test(motivo))) malos.push(`${tipo}:${e.id} protegido sin bloqueo`);
      if (!protegido && e.activo && motivo && !esUltimaActivaDeCategoria(c, c.elementos, e)) malos.push(`${tipo}:${e.id} bloqueado sin razón`);
      if (!e.activo && motivo) malos.push(`${tipo}:${e.id} inactivo con bloqueo`);
    }
    if (c.conservaUnaActivaPorCategoria) for (const cat of c.categorias) if (!c.elementos.some((e) => e.idCategoria === cat.id && e.activo)) malos.push(`${tipo}: categoría ${cat.id} sin opciones activas`);
  }
  ver(malos.length === 0, "mocks de catálogos: los valores protegidos (alcaldía 17; razas 1 y 14; motivos 14 y 15; estados 1, 5 y 6) existen, están activos y no se desactivan; ninguna categoría de estados queda sin opción activa", `mocks de catálogos: ${malos.join(" | ")}`);
  // Última opción activa de una categoría (R9): se simula desactivar una a una las opciones de «Contención y ubicación».
  const ea = CATALOGOS["estados-animal"];
  let lista = [...ea.elementos];
  const seguidas: string[] = [];
  for (const id of [7, 8, 9]) {
    const bloqueo = motivoNoDesactivable(ea, lista, lista.find((e) => e.id === id)!);
    seguidas.push(bloqueo ? "bloqueada" : "libre");
    if (!bloqueo) lista = desactivarElemento(ea, lista, id);
  }
  const ultima = motivoNoDesactivable(ea, lista, lista.find((e) => e.id === 10)!);
  let lanzo = false;
  try {
    desactivarElemento(ea, lista, 10);
  } catch {
    lanzo = true;
  }
  const reactivada = guardarElemento(ea, lista, { nombre: "Libre en vía pública (suelto o en movimiento)", clave: "", idCategoria: "2", descripcion: "Texto.", activo: true }, lista.find((e) => e.id === 7)!);
  ver(seguidas.join() === "libre,libre,libre" && /Última opción activa de «Contención y ubicación»/.test(ultima ?? "") && lanzo && motivoNoDesactivable(ea, reactivada, reactivada.find((e) => e.id === 10)!) === undefined, "R9: tras desactivar 3 de las 4 opciones de «Contención y ubicación», la última queda bloqueada («Última opción activa…», y desactivarla lanza error); reactivar otra con «Editar» la libera", `R9: ${seguidas} · ${ultima}`);
  // Alta y edición: nombre único, clave de 5 caracteres (09 + 3 dígitos) única, «Fuera de la Ciudad de México» sin clave, reactivar con Editar.
  const al = CATALOGOS.alcaldias;
  const base = { nombre: "Nueva alcaldía", clave: "09018", idCategoria: "", descripcion: "", activo: true };
  const errores = [
    validarCatalogo(al, al.elementos, { ...base, nombre: "" }).nombre,
    validarCatalogo(al, al.elementos, { ...base, nombre: "  coyoacan " }).nombre,
    validarCatalogo(al, al.elementos, { ...base, clave: "" }).clave,
    validarCatalogo(al, al.elementos, { ...base, clave: "9018" }).clave,
    validarCatalogo(al, al.elementos, { ...base, clave: "10018" }).clave,
    validarCatalogo(al, al.elementos, { ...base, clave: "09003" }).clave,
  ];
  const fuera = al.elementos.find((e) => e.id === 17)!;
  const inactiva = al.elementos.find((e) => !e.activo)!;
  const reactivadaAl = guardarElemento(al, al.elementos, { nombre: inactiva.nombre, clave: inactiva.clave!, idCategoria: "", descripcion: "", activo: true }, inactiva).find((e) => e.id === inactiva.id)!;
  ver(errores.every(Boolean) && Object.keys(validarCatalogo(al, al.elementos, base)).length === 0 && Object.keys(validarCatalogo(al, al.elementos, { nombre: fuera.nombre, clave: "", idCategoria: "", descripcion: "", activo: true }, fuera)).length === 0 && validarCatalogo(al, al.elementos, { nombre: fuera.nombre, clave: "", idCategoria: "", descripcion: "", activo: false }, fuera).activo !== undefined && reactivadaAl.activo === true, "HU 049: nombre único (sin distinguir acentos ni mayúsculas), clave obligatoria de 5 caracteres (09 y 3 dígitos) y única; «Fuera de la Ciudad de México» sin clave y sin poder desactivarse; Editar reactiva", `HU 049: ${errores}`);
  const mo = CATALOGOS.motivos;
  const em = validarCatalogo(mo, mo.elementos, { nombre: "Otro nuevo", clave: "", idCategoria: "", descripcion: "", activo: true });
  const er = CATALOGOS.razas;
  ver(em.idCategoria !== undefined && em.descripcion !== undefined && em.clave === undefined && Object.keys(validarCatalogo(er, er.elementos, { nombre: "Raza nueva", clave: "", idCategoria: "", descripcion: "", activo: true })).length === 0, "HU 050 y 051: las razas solo piden nombre; los motivos, además, categoría y descripción obligatorias", "HU 050/051: validación incorrecta");
}

async function catalogos(navegador: Browser) {
  const tarj = (p: Page, id: number) => p.locator(`li[data-elemento="${id}"]`);
  const fil = (p: Page, id: number) => p.locator(`tr[data-elemento="${id}"]`);
  const visibles = (p: Page) => p.locator("li[data-elemento]").evaluateAll((l) => l.map((x) => Number(x.getAttribute("data-elemento"))));
  let { contexto, pagina } = await nuevaPagina(navegador, 390);

  // ADM-06 alcaldías, móvil.
  await irA(pagina, "/admin/alcaldias");
  ver(JSON.stringify(await visibles(pagina)) === "[1,2,3,4,5,6]" && /1–6 de 17 elementos/.test(await pagina.locator("main").innerText()) && (await boton(pagina, "Agregar alcaldía").isVisible()) && (await pagina.getByLabel("Buscar", { exact: true }).isVisible()) && (await pagina.locator("table[data-tabla-compacta]").isVisible()) === false, "ADM-06 en móvil: «Agregar alcaldía», búsqueda por nombre, 6 tarjetas por página (17 alcaldías) y la tabla no se muestra", `ADM-06 en móvil: ${await visibles(pagina)}`);
  const a1 = tarj(pagina, 1);
  ver((await a1.getByRole("heading").innerText()) === "Álvaro Obregón" && /Clave geoestadística: 09010/.test(await a1.innerText()) && (await a1.getByText("Activa", { exact: true }).isVisible()) && (await boton(a1, /^Editar/).isEnabled()) && (await boton(a1, /^Desactivar/).isEnabled()), "ADM-06: la tarjeta lleva nombre, clave geoestadística, estatus «Activa», «Editar» y «Desactivar»", "ADM-06: tarjeta incorrecta");
  // Inactiva: se identifica con texto y borde discontinuo; sin botón «Activar» (reactivar se hace con Editar, R9).
  await boton(pagina, "Página 2").click();
  const milpa = tarj(pagina, 12);
  const sinActivar = (await pagina.getByRole("button", { name: /^Activar/ }).count()) === 0;
  ver((await milpa.getByText("Inactiva", { exact: true }).isVisible()) && (await milpa.evaluate((e) => getComputedStyle(e).borderStyle)) === "dashed" && (await boton(milpa, /^Editar/).isEnabled()) && (await boton(milpa, /^Desactivar/).count()) === 0 && sinActivar, "alcaldía inactiva: chip «Inactiva» con texto, borde discontinuo, «Editar» y sin botón «Activar» (reactivar se hace con Editar, R9)", "alcaldía inactiva: incorrecta");
  await boton(pagina, "Página 3").click();
  const fuera = tarj(pagina, 17);
  ver((await fuera.getByText("Valor protegido", { exact: true }).isVisible()) && /sin clave/.test(await fuera.innerText()) && (await boton(fuera, /^Desactivar/).isDisabled()) && /Valor protegido: no puede desactivarse ni eliminarse/.test(await textoDescrito(boton(fuera, /^Desactivar/))) && (await boton(fuera, /^Editar/).isEnabled()), "«Fuera de la Ciudad de México»: «Valor protegido», sin clave, «Desactivar» deshabilitado con su motivo a la vista y «Editar» disponible", "«Fuera de la Ciudad de México»: incorrecta");
  // MOD-11 sobre el valor protegido: sin clave y sin poder quedar inactiva.
  await boton(fuera, /^Editar/).click();
  let dlg = pagina.getByRole("dialog", { name: "Editar alcaldía" });
  ver((await dlg.getByLabel(/^Clave geoestadística/).isDisabled()) && (await dlg.getByLabel("Inactiva", { exact: true }).isDisabled()) && (await dlg.getByLabel("Activa", { exact: true }).isChecked()) && /Valor protegido/.test(await dlg.innerText()), "MOD-11 sobre «Fuera de la Ciudad de México»: la clave no aplica y «Inactiva» está deshabilitada con su razón", "MOD-11 sobre el valor protegido: permite desactivar");
  await pagina.keyboard.press("Escape");
  // Búsqueda.
  await pagina.getByLabel("Buscar", { exact: true }).fill("xochi");
  await boton(pagina, "Buscar").click();
  ver(JSON.stringify(await visibles(pagina)) === "[16]", "búsqueda: «xochi» encuentra a Xochimilco y regresa a la página 1", `búsqueda: ${await visibles(pagina)}`);
  await pagina.getByLabel("Buscar", { exact: true }).fill("zzzz");
  await boton(pagina, "Buscar").click();
  ver((await pagina.getByText("Ningún elemento coincide").isVisible()) && (await boton(pagina, "Limpiar búsqueda").isVisible()), "búsqueda sin resultados: estado vacío con «Limpiar búsqueda»", "búsqueda sin resultados: falta el estado vacío");
  await boton(pagina, "Limpiar búsqueda").click();

  // MOD-11: alta con validaciones.
  const abrirAlta = boton(pagina, "Agregar alcaldía");
  await abrirAlta.click();
  dlg = pagina.getByRole("dialog", { name: "Agregar alcaldía" });
  ver((await dlg.getByLabel(/^Nombre de la alcaldía/).isVisible()) && (await dlg.getByLabel(/^Clave geoestadística/).getAttribute("placeholder")) === "5 caracteres" && (await dlg.getByLabel("Activa", { exact: true }).isChecked()) && (await dlg.getByRole("button").allInnerTexts()).join("|").endsWith("Cancelar|Guardar cambios") && (await dlg.getByLabel(/^Categoría/).count()) === 0, "MOD-11 «Agregar alcaldía»: nombre, clave de 5 caracteres, estatus Activa/Inactiva, «Cancelar» y «Guardar cambios» (sin categoría ni descripción)", "MOD-11 alcaldías: campos incorrectos");
  await focoAtrapado(pagina, "MOD-11");
  await boton(dlg, "Guardar cambios").click();
  ver((await dialogoAbierto(pagina)) && /Escribe el nombre/.test(await textoDescrito(dlg.getByLabel(/^Nombre de la alcaldía/))) && /Escribe la clave geoestadística/.test(await textoDescrito(dlg.getByLabel(/^Clave geoestadística/))) && (await foco(pagina)) === (await dlg.getByLabel(/^Nombre de la alcaldía/).evaluate((e) => e.tagName)), "MOD-11: sin nombre ni clave no se guarda; cada error queda asociado a su campo y el foco va al primero", "MOD-11: aceptó el formulario vacío");
  await dlg.getByLabel(/^Nombre de la alcaldía/).fill("coyoacán");
  await dlg.getByLabel(/^Clave geoestadística/).fill("09003");
  await boton(dlg, "Guardar cambios").click();
  ver(/Ya existe una alcaldía con ese nombre/.test(await textoDescrito(dlg.getByLabel(/^Nombre de la alcaldía/))) && /Esa clave ya está en uso/.test(await textoDescrito(dlg.getByLabel(/^Clave geoestadística/))), "MOD-11: el nombre y la clave deben ser únicos (mensajes asociados a cada campo)", "MOD-11: no validó la unicidad");
  await dlg.getByLabel(/^Clave geoestadística/).fill("9018");
  await boton(dlg, "Guardar cambios").click();
  ver(/5 dígitos y empezar con 09/.test(await textoDescrito(dlg.getByLabel(/^Clave geoestadística/))), "MOD-11: la clave debe tener 5 dígitos y empezar con 09", "MOD-11: no validó el formato de la clave");
  await pagina.keyboard.press("Escape");
  await viasDeCierre(pagina, abrirAlta, "Agregar alcaldía", "MOD-11", async () => /1–6 de 17 elementos/.test(await pagina.locator("main").innerText()));
  await abrirAlta.click();
  await dlg.getByLabel(/^Nombre de la alcaldía/).fill("Alcaldía de prueba");
  await dlg.getByLabel(/^Clave geoestadística/).fill("09018");
  await boton(dlg, "Guardar cambios").click();
  ver(!(await dialogoAbierto(pagina)) && /de 18 elementos/.test(await pagina.locator("main").innerText()) && (await pagina.getByRole("status").getByText("Se agregó «Alcaldía de prueba»").isVisible()), "MOD-11: «Guardar cambios» agrega la alcaldía (18 elementos) y se anuncia", "MOD-11: no agregó la alcaldía");

  // Editar reactiva una inactiva; desactivar pide confirmación sin motivo y conserva el registro.
  await boton(pagina, "Página 2").click();
  await boton(milpa, /^Editar/).click();
  dlg = pagina.getByRole("dialog", { name: "Editar alcaldía" });
  ver((await dlg.getByLabel(/^Nombre de la alcaldía/).inputValue()) === "Milpa Alta" && (await dlg.getByLabel(/^Clave geoestadística/).inputValue()) === "09009" && (await dlg.getByLabel("Inactiva", { exact: true }).isChecked()) && /Elige «Activa» y guarda para reactivarlo/.test(await dlg.innerText()), "MOD-11 «Editar alcaldía»: trae los datos del elemento inactivo e indica cómo reactivarlo", "MOD-11 editar: datos incorrectos");
  await dlg.getByText("Activa", { exact: true }).click();
  await boton(dlg, "Guardar cambios").click();
  ver((await milpa.getByText("Activa", { exact: true }).isVisible()) && (await milpa.evaluate((e) => getComputedStyle(e).borderStyle)) === "solid" && (await boton(milpa, /^Desactivar/).isEnabled()) && (await pagina.getByRole("status").getByText("«Milpa Alta» quedó reactivada").isVisible()), "Editar con «Activa» reactiva la alcaldía inactiva: vuelve a «Activa» y recupera «Desactivar»", "reactivar con Editar: no se reflejó");
  const abrirDesactivar = boton(milpa, /^Desactivar/);
  await abrirDesactivar.click();
  dlg = pagina.getByRole("dialog", { name: "Desactivar alcaldía" });
  ver((await dlg.getByText("Milpa Alta").isVisible()) && (await dlg.getByText("Dejará de ofrecerse en los formularios; los registros existentes se conservan.").isVisible()) && (await dlg.getByLabel(/Motivo/).count()) === 0 && (await dlg.getByRole("button").allInnerTexts()).join("|") === "Cancelar|Confirmar", "confirmación «Desactivar alcaldía»: advierte que dejará de ofrecerse y los registros se conservan, sin motivo", "confirmación de desactivar: contenido incorrecto");
  await pagina.keyboard.press("Escape");
  await viasDeCierre(pagina, abrirDesactivar, "Desactivar alcaldía", "confirmación de desactivar", async () => (await milpa.getByText("Activa", { exact: true }).isVisible()));
  await abrirDesactivar.click();
  await boton(dlg, "Confirmar").click();
  ver((await milpa.getByText("Inactiva", { exact: true }).isVisible()) && (await tarj(pagina, 12).count()) === 1 && (await pagina.getByRole("button", { name: /^Activar/ }).count()) === 0, "desactivar no elimina: «Milpa Alta» sigue en la lista como «Inactiva», sin botón «Activar»", "desactivar: se eliminó o apareció «Activar»");
  await contexto.close();

  // Escritorio: tabla de alcaldías.
  ({ contexto, pagina } = await nuevaPagina(navegador, 1280));
  await irA(pagina, "/admin/alcaldias");
  const cab = await pagina.locator("table[data-tabla-compacta] thead th").allTextContents();
  ver(JSON.stringify(cab) === JSON.stringify(["Nombre", "Clave geoestadística", "Estatus", "Acciones"]) && (await pagina.locator("table[data-tabla-compacta]").getAttribute("data-excepcion-tactil")) === "compacto", "ADM-06 en escritorio: tabla con Nombre, Clave geoestadística, Estatus y Acciones, marcada como compacta", `ADM-06 escritorio: columnas ${cab}`);
  const altos = await pagina.locator("table[data-tabla-compacta] button").evaluateAll((bs) => bs.map((b) => Math.round(b.getBoundingClientRect().height)));
  ver(altos.length > 0 && altos.every((h) => h === 36), `ADM-06: los botones de la tabla son del tamaño compacto (${altos[0]} px)`, `ADM-06: alturas ${altos}`);
  await boton(pagina, "Página 3").click();
  ver((await boton(fil(pagina, 17), /^Desactivar/).isDisabled()) && (await fil(pagina, 17).getByText("Valor protegido", { exact: true }).isVisible()) && /Valor protegido/.test(await textoDescrito(boton(fil(pagina, 17), /^Desactivar/))), "ADM-06 en escritorio: «Fuera de la Ciudad de México» con «Valor protegido» y «Desactivar» deshabilitado con su motivo", "ADM-06 escritorio: valor protegido incorrecto");
  await contexto.close();

  // ADM-07 razas, ADM-08 motivos y ADM-09 estados del animal: la misma plantilla, parametrizada.
  ({ contexto, pagina } = await nuevaPagina(navegador, 390));
  await irA(pagina, "/admin/razas");
  ver(JSON.stringify(await visibles(pagina)) === "[1,2,3,4,5,6]" && (await pagina.getByRole("heading", { level: 1 }).innerText()) === "Catálogo de razas" && (await boton(pagina, "Agregar raza").isVisible()) && !/Clave geoestadística|Categoría/.test(await tarj(pagina, 1).innerText()), "ADM-07 razas: «Agregar raza», solo nombre y estatus (sin clave ni categoría), 6 por página", "ADM-07: pantalla incorrecta");
  ver((await boton(tarj(pagina, 1), /^Desactivar/).isDisabled()) && (await tarj(pagina, 1).getByText("Valor protegido", { exact: true }).isVisible()), "ADM-07: «Mestizo/No identificada» (id 1) es valor protegido y no se desactiva", "ADM-07: id 1 sin protección");
  await boton(pagina, "Página 3").click();
  ver((await boton(tarj(pagina, 14), /^Desactivar/).isDisabled()) && (await boton(tarj(pagina, 13), /^Desactivar/).isEnabled()), "ADM-07: «Otra» (id 14) es valor protegido; «Calupoh» se puede desactivar", "ADM-07: id 14 sin protección");
  await boton(pagina, "Página 1").click();
  await boton(pagina, "Agregar raza").click();
  dlg = pagina.getByRole("dialog", { name: "Agregar raza" });
  ver((await dlg.getByLabel(/^Nombre de la raza/).isVisible()) && (await dlg.getByLabel(/^Clave/).count()) === 0 && (await dlg.getByLabel(/^Categoría/).count()) === 0 && (await dlg.getByLabel(/^Descripción/).count()) === 0 && (await dlg.getByLabel("Activa", { exact: true }).isChecked()), "MOD-11 de razas: solo nombre y estatus", "MOD-11 de razas: campos de más");
  await pagina.keyboard.press("Escape");
  await irA(pagina, "/admin/motivos");
  ver((await pagina.getByRole("heading", { level: 1 }).innerText()) === "Catálogo de motivos de extravío" && (await boton(pagina, "Agregar motivo").isVisible()) && /Categoría: Detonantes Emocionales y Ambientales/.test(await tarj(pagina, 1).innerText()) && /Pirotecnia, truenos/.test(await tarj(pagina, 1).innerText()), "ADM-08 motivos: «Agregar motivo», con categoría y descripción en cada tarjeta", "ADM-08: pantalla incorrecta");
  await boton(pagina, "Página 3").click();
  ver((await boton(tarj(pagina, 14), /^Desactivar/).isDisabled()) && (await boton(tarj(pagina, 15), /^Desactivar/).isDisabled()) && (await tarj(pagina, 14).getByText("Valor protegido", { exact: true }).isVisible()), "ADM-08: «Circunstancia desconocida o no presenciada» y «Otro motivo» (ids 14 y 15) son valores protegidos", "ADM-08: ids 14 y 15 sin protección");
  await boton(pagina, "Agregar motivo").click();
  dlg = pagina.getByRole("dialog", { name: "Agregar motivo de extravío" });
  const cats = await dlg.getByLabel(/^Categoría/).locator("option").allTextContents();
  ver((await dlg.getByLabel(/^Nombre del motivo de extravío/).isVisible()) && JSON.stringify(cats) === JSON.stringify(["Elige una categoría", ...CATEGORIAS_MOTIVO.map((c) => c.nombre)]) && (await dlg.getByLabel(/^Descripción/).getAttribute("maxlength")) === "255", "MOD-11 de motivos: nombre, categoría (las 5 del sistema), descripción de hasta 255 caracteres y estatus Activo/Inactivo", "MOD-11 de motivos: campos incorrectos");
  await boton(dlg, "Guardar cambios").click();
  ver(/Elige una categoría/.test(await textoDescrito(dlg.getByLabel(/^Categoría/))) && /Escribe la descripción/.test(await textoDescrito(dlg.getByLabel(/^Descripción/))) && (await dlg.getByText("Activo", { exact: true }).isVisible()), "MOD-11 de motivos: categoría y descripción son obligatorias (errores asociados a cada campo)", "MOD-11 de motivos: no exigió categoría y descripción");
  await dlg.getByLabel(/^Nombre del motivo de extravío/).fill("Motivo de prueba");
  await dlg.getByLabel(/^Categoría/).selectOption("3");
  await dlg.getByLabel(/^Descripción/).fill("Descripción de prueba.");
  await boton(dlg, "Guardar cambios").click();
  ver(!(await dialogoAbierto(pagina)) && /de 16 elementos/.test(await pagina.locator("main").innerText()), "MOD-11 de motivos: guarda el nuevo motivo con su categoría y descripción (16 elementos)", "MOD-11 de motivos: no guardó");
  await irA(pagina, "/admin/estados-animal");
  ver((await pagina.getByRole("heading", { level: 1 }).innerText()) === "Catálogo de estados del animal" && (await boton(pagina, "Agregar estado").isVisible()) && /Categoría: Integridad física y salud/.test(await tarj(pagina, 1).innerText()), "ADM-09 estados del animal: «Agregar estado», con categoría y descripción", "ADM-09: pantalla incorrecta");
  const protegidos = [];
  for (const id of [1, 5]) protegidos.push((await boton(tarj(pagina, id), /^Desactivar/).isDisabled()) && (await tarj(pagina, id).getByText("Valor protegido", { exact: true }).isVisible()));
  protegidos.push(await boton(tarj(pagina, 6), /^Desactivar/).isDisabled());
  ver(protegidos.every(Boolean), "ADM-09: «Ileso / Buen estado», «Fallecido» y «No se puede determinar» (ids 1, 5 y 6) son valores protegidos", `ADM-09: protegidos ${protegidos}`);
  // Última opción activa de «Identificación visible»: en los datos de la maqueta solo queda «Con placa y collar».
  await boton(pagina, "Página 3").click();
  const placa = tarj(pagina, 15);
  ver((await boton(placa, /^Desactivar/).isDisabled()) && /Última opción activa de «Identificación visible»: cada categoría conserva al menos una/.test(await textoDescrito(boton(placa, /^Desactivar/))) && (await placa.getByText(/Última opción activa/).isVisible()) && (await tarj(pagina, 16).getByText("Inactivo", { exact: true }).isVisible()), "ADM-09: «Con placa y collar» es la última opción activa de «Identificación visible»: «Desactivar» deshabilitado con su motivo a la vista", "ADM-09: la última opción activa no se bloqueó");
  await boton(placa, /^Editar/).click();
  dlg = pagina.getByRole("dialog", { name: "Editar estado del animal" });
  ver((await dlg.getByLabel("Inactivo", { exact: true }).isDisabled()) && /Última opción activa de «Identificación visible»/.test(await dlg.innerText()), "MOD-11: en la última opción activa, «Inactivo» está deshabilitado con su razón", "MOD-11: permite desactivar la última opción activa");
  await dlg.getByLabel(/^Categoría/).selectOption("1");
  await boton(dlg, "Guardar cambios").click();
  ver((await dialogoAbierto(pagina)) && /última opción activa de su categoría/.test(await textoDescrito(dlg.getByLabel(/^Categoría/))), "MOD-11: la última opción activa tampoco puede cambiarse de categoría", "MOD-11: dejó vacía una categoría");
  await pagina.keyboard.press("Escape");
  // Reactivar otra opción con Editar libera a la primera.
  await boton(tarj(pagina, 16), /^Editar/).click();
  dlg = pagina.getByRole("dialog", { name: "Editar estado del animal" });
  await dlg.getByText("Activo", { exact: true }).click();
  await boton(dlg, "Guardar cambios").click();
  ver((await boton(tarj(pagina, 16), /^Desactivar/).isEnabled()) && (await boton(placa, /^Desactivar/).isEnabled()) && (await pagina.getByRole("button", { name: /^Activar/ }).count()) === 0, "reactivar «Con collar sin datos» con Editar libera la regla: «Con placa y collar» ya se puede desactivar", "reactivar con Editar: no liberó la regla");
  await boton(placa, /^Desactivar/).click();
  await boton(pagina.getByRole("dialog", { name: "Desactivar estado del animal" }), "Confirmar").click();
  ver((await placa.getByText("Inactivo", { exact: true }).isVisible()) && (await boton(tarj(pagina, 16), /^Desactivar/).isDisabled()) && /Última opción activa de «Identificación visible»/.test(await textoDescrito(boton(tarj(pagina, 16), /^Desactivar/))), "tras desactivar «Con placa y collar», la que queda activa pasa a ser la última y se bloquea", "la regla no pasó a la siguiente opción activa");
  await irA(pagina, "/admin/estados-animal?modal=editar");
  ver(await pagina.getByRole("dialog", { name: "Editar estado del animal" }).isVisible(), "ADM-09 ?modal=editar: abre MOD-11 al cargar", "ADM-09 ?modal=editar: no abrió");
  await irA(pagina, "/admin/alcaldias?estado=cargando");
  ver((await pagina.getByRole("status").count()) === 4 && (await pagina.locator("li[data-elemento]").count()) === 0, "ADM-06 cargando: 4 esqueletos con role=\"status\"", "ADM-06 cargando: incorrecto");
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
  await contexto.close();
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

// ---------- enlaces y geometría ----------
async function enlacesYGeometria(navegador: Browser) {
  const rutas = ["/admin", `/admin?desde=2026-09-01&hasta=2026-09-30`, "/admin/usuarios", "/admin/usuarios?modal=rol", "/admin/usuarios?modal=deshabilitar", "/admin/usuarios?modal=habilitar", "/admin/usuarios?estado=cargando", "/admin/usuarios?estado=vacio", "/admin/reportes", "/admin/bitacora", "/admin/registros", "/admin/registros?modal=deshabilitar", "/admin/registros?estado=cargando", "/admin/registros?estado=vacio", `/admin/registros/${FOLIO_MODERACION_ACTIVO}`, `/admin/registros/${FOLIO_MODERACION_ACTIVO}?modal=deshabilitar`, `/admin/registros/${FOLIO_MODERACION_DESHABILITADO}`, `/admin/registros/${FOLIO_MODERACION_CANCELADO}`, "/admin/avistamientos", "/admin/avistamientos?modal=ocultar", "/admin/avistamientos?modal=detalle", "/admin/avistamientos?modal=detalle-fallecido", "/admin/avistamientos?modal=detalle-fallecido&foto=visible", "/admin/avistamientos?estado=cargando", "/admin/avistamientos?estado=vacio", ...["alcaldias", "razas", "motivos", "estados-animal"].flatMap((c) => [`/admin/${c}`, `/admin/${c}?modal=nuevo`, `/admin/${c}?modal=editar`, `/admin/${c}?modal=desactivar`]), "/admin/alcaldias?estado=cargando"];
  const vistos = new Set<string>();
  const { contexto, pagina } = await nuevaPagina(navegador, 1280);
  for (const r of rutas) {
    await irA(pagina, r);
    for (const h of await pagina.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")!))) if (h.startsWith("/")) vistos.add(h.split("#")[0] || "/");
  }
  await contexto.close();
  const malos: string[] = [];
  for (const h of vistos) {
    const s = (await fetch(`${base}${h}`, { redirect: "follow" })).status;
    if (s === 404 || s >= 500) malos.push(`${h} → ${s}`);
  }
  ver(malos.length === 0, `enlaces internos de las pantallas del Administrador: ${vistos.size} rutas distintas, ninguna responde 404`, `enlaces rotos: ${malos.join(" | ")}`);
  for (const r of rutas) {
    for (const ancho of ANCHOS) {
      const p = await nuevaPagina(navegador, ancho);
      await irA(p.pagina, r);
      await desborde(p.pagina, `${r} ${ancho}px`);
      await areasTactiles(p.pagina, `${r} ${ancho}px`);
      await p.contexto.close();
    }
  }
}

async function main() {
  let servidor: ChildProcess | undefined;
  if (!baseExterna) {
    if (!process.argv.includes("--sin-build") && spawnSync("npx", ["next", "build"], { stdio: "inherit" }).status !== 0) throw new Error("Falló next build");
    servidor = spawn("npx", ["next", "start", "-p", String(PUERTO)], { stdio: "ignore", detached: true });
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
    coloresFijos();
    await armazon(navegador);
    await tablero(navegador);
    await usuarios(navegador);
    await moderacionRegistros(navegador);
    await rotulosDelDetalle(navegador);
    await foliosEnUnaLinea(navegador);
    await moderacionAvistamientos(navegador);
    reglasDeCatalogos();
    await catalogos(navegador);
    await chipValorProtegido(navegador);
    await sinDatosDeUsuarios();
    await enlacesYGeometria(navegador);
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
