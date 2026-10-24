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
    const real = h === "/admin" || h === "/admin/usuarios";
    if (r?.status() !== 200 || (!real && !(/Esta pantalla se construye en un bloque posterior/.test(t) && (await enlace(pagina, "Ir al tablero").getAttribute("href")) === "/admin" && t.includes(etiqueta)))) malos.push(`${h} → ${r?.status()}`);
  }
  ver(hrefs.length === 12 && malos.length === 0, `menú: las ${hrefs.length} opciones responden; las 10 sin pantalla muestran «Esta pantalla se construye en un bloque posterior» con su título`, `menú: opciones con problema ${malos.join(" | ")} (${hrefs.length} opciones)`);
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
  const rutas = ["/admin", `/admin?desde=2026-09-01&hasta=2026-09-30`, "/admin/usuarios", "/admin/usuarios?modal=rol", "/admin/usuarios?modal=deshabilitar", "/admin/usuarios?modal=habilitar", "/admin/usuarios?estado=cargando", "/admin/usuarios?estado=vacio", "/admin/reportes", "/admin/bitacora"];
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
