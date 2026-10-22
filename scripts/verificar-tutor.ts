// Verifica las pantallas de la persona tutora (ACC-01, TUT-01 a TUT-05 y TUT-07) con Playwright, sin abrir capturas:
//  (a) registro de dos pasos: conserva lo capturado, exige los obligatorios, raza «Otra» y longitudes del diccionario;
//  (b) las tres variantes de TUT-05 y la confirmación de las acciones definitivas;
//  (c) la ficha de búsqueda (vista previa, visor y hojas) y TUT-04 no filtran datos reservados ni de la persona tutora;
//  (d) modales de ACC-01 y TUT-07: abren y cierran con botón, Escape y clic fuera, y devuelven el foco;
//  (e) sin desplazamiento horizontal a 390, 768 y 1280 px y sin elementos interactivos de menos de 44 px.
// Opciones: --sin-build  reutiliza el build existente · --base=URL  usa un servidor que ya corre
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import { CASOS_ORIGEN, FOLIO_EN_CURSO, FOLIO_NUEVO, casosDeLaPersonaTutora, valoresReservados } from "../src/mocks/casos";
import { CLAVE_TEMA } from "../src/lib/tema";

const PUERTO = 3106;
const baseExterna = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1];
const base = baseExterna ?? `http://localhost:${PUERTO}`;
const ANCHOS = [390, 768, 1280];
const CASO = `/tutor/casos/${FOLIO_EN_CURSO}`;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

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

async function nuevaPagina(navegador: Browser, ancho = 390): Promise<{ contexto: BrowserContext; pagina: Page }> {
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: 900 }, colorScheme: "light", permissions: ["clipboard-read", "clipboard-write"] });
  await contexto.addInitScript(([k, v]) => localStorage.setItem(k, v), [CLAVE_TEMA, "light"]);
  // Se cuenta window.print sin abrir el cuadro de impresión.
  await contexto.addInitScript(() => {
    (window as unknown as { __impresiones: number }).__impresiones = 0;
    window.print = () => {
      (window as unknown as { __impresiones: number }).__impresiones++;
    };
  });
  return { contexto, pagina: await contexto.newPage() };
}

async function irA(pagina: Page, ruta: string) {
  await pagina.goto(`${base}${ruta}`, { waitUntil: "load" });
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForFunction(() => [...document.images].every((i) => i.complete || !i.checkVisibility()));
  await pagina.waitForSelector("main h1");
}

async function desborde(pagina: Page, etiqueta: string) {
  const d = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ver(d <= 0, `${etiqueta}: sin desplazamiento horizontal`, `${etiqueta}: se desborda ${d}px`);
}

async function areasTactiles(pagina: Page, etiqueta: string) {
  const r = await pagina.evaluate(() => {
    const malos: string[] = [];
    let total = 0;
    const selector = "button, a[href], input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea, label:has(input[type=checkbox]), label:has(input[type=radio]), [role=group][tabindex], [role=tab]";
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (el.closest("[hidden]") || el.closest("[inert]")) continue;
      const rect = el.getBoundingClientRect();
      if (getComputedStyle(el).display === "none" || (rect.width <= 2 && rect.height <= 2)) continue;
      if (el instanceof HTMLAnchorElement && el.closest("p")) continue; // enlaces dentro de texto corrido
      total++;
      if (rect.height < 43.5) malos.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 28)}" ${Math.round(rect.height * 10) / 10}px`);
    }
    return { malos, total };
  });
  ver(r.malos.length === 0, `${etiqueta}: ${r.total} elementos interactivos, ninguno de menos de 44 px de alto`, `${etiqueta}: áreas menores de 44 px → ${r.malos.join(" | ")}`);
}

const barra = (p: Page) => p.locator("main [role=progressbar]").getAttribute("aria-valuetext");
const textoDescrito = (l: Locator) =>
  l.evaluate((el) => (el.getAttribute("aria-describedby") ?? "").split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() ?? "").join(" | "));
const boton = (p: Page | Locator, nombre: string | RegExp) => p.getByRole("button", { name: nombre });
const enlace = (p: Page | Locator, nombre: string | RegExp) => p.getByRole("link", { name: nombre });
const foco = (p: Page) => p.evaluate(() => document.activeElement?.textContent?.trim() || document.activeElement?.getAttribute("aria-label") || document.activeElement?.tagName);
const dialogoAbierto = (p: Page) => p.evaluate(() => [...document.querySelectorAll("dialog")].some((d) => d.open));
const eIso = (p: Page, n: number) => p.locator(`[data-paso="${n}"]`);

// ---------- ACC-01 ----------
async function acceso(navegador: Browser) {
  let { contexto, pagina } = await nuevaPagina(navegador);
  await irA(pagina, "/acceso");
  ver((await pagina.locator("header").count()) >= 1 && (await pagina.locator("main#contenido").count()) === 1 && (await pagina.getByRole("link", { name: "Iniciar sesión" }).count()) >= 0, "ACC-01: en la plantilla pública (encabezado, un solo <main id=\"contenido\">, pie)", "ACC-01: estructura incorrecta");
  const correo = pagina.getByLabel("Correo electrónico");
  const clave = pagina.getByLabel(/^Contraseña/);
  await boton(pagina, "Iniciar sesión").click();
  ver((await correo.getAttribute("aria-invalid")) === "true" && /Escribe tu correo/.test(await textoDescrito(correo)) && (await clave.getAttribute("aria-invalid")) === "true" && (await correo.evaluate((e) => e === document.activeElement)), "ACC-01: vacío → errores asociados con aria-describedby y el foco va al correo", "ACC-01: sin errores al enviar vacío");
  await correo.fill("persona-sin-arroba");
  await clave.fill("x");
  await boton(pagina, "Iniciar sesión").click();
  ver(/correo válido/.test(await textoDescrito(correo)) && new URL(pagina.url()).pathname === "/acceso", "ACC-01: correo con formato inválido no avanza", "ACC-01: aceptó un correo inválido");
  ver((await clave.getAttribute("type")) === "password", "ACC-01: la contraseña empieza oculta", "ACC-01: la contraseña empieza visible");
  const ojo = boton(pagina, "Mostrar contraseña");
  await ojo.click();
  ver((await clave.getAttribute("type")) === "text" && (await ojo.getAttribute("aria-pressed")) === "true", "ACC-01: «Mostrar contraseña» la muestra (aria-pressed)", "ACC-01: no mostró la contraseña");
  ver((await enlace(pagina, "Cancelar").getAttribute("href")) === "/" && (await enlace(pagina, "¿Olvidaste tu contraseña?").isVisible()) && (await enlace(pagina, "Crear cuenta de persona tutora").getAttribute("href")) === "/registro", "ACC-01: «Cancelar», «¿Olvidaste tu contraseña?» y «Crear cuenta de persona tutora»", "ACC-01: faltan enlaces");
  await correo.fill("persona@correo.com");
  await boton(pagina, "Iniciar sesión").click();
  await pagina.waitForURL("**/tutor");
  ver(true, "ACC-01: «Iniciar sesión» válido navega a /tutor (maqueta, sin autenticación)", "");
  await contexto.close();

  // Modales: abren por la variante y se cierran con botón, Escape y clic fuera.
  for (const [estado, titulo, mensaje] of [["bloqueo", "Acceso bloqueado temporalmente", "5 intentos fallidos; intenta de nuevo en 15 minutos"], ["deshabilitada", "Cuenta deshabilitada", "Tu cuenta está deshabilitada; contacta a quien administra RUPE"]] as const) {
    for (const via of ["botón «Entendido»", "Escape", "clic fuera"] as const) {
      ({ contexto, pagina } = await nuevaPagina(navegador));
      await irA(pagina, `/acceso?estado=${estado}`);
      const dlg = pagina.getByRole("dialog", { name: titulo });
      if (via === "botón «Entendido»") {
        ver((await dlg.isVisible()) && (await dlg.getByText(mensaje).isVisible()) && (await boton(dlg, "Entendido").isVisible()), `ACC-01 ?estado=${estado}: abre el modal «${titulo}» con su mensaje y «Entendido»`, `ACC-01 ?estado=${estado}: el modal no abrió o su contenido es incorrecto`);
      }
      if (via === "botón «Entendido»") await boton(dlg, "Entendido").click();
      else if (via === "Escape") await pagina.keyboard.press("Escape");
      else await pagina.mouse.click(4, 4);
      const cerrado = !(await dialogoAbierto(pagina));
      const enfocado = await pagina.waitForFunction(() => document.activeElement?.id === "acceso-correo", undefined, { timeout: 2000 }).then(() => true, () => false);
      ver(cerrado && enfocado, `ACC-01 ?estado=${estado}: ${via} cierra el modal y el foco pasa al primer campo`, `ACC-01 ?estado=${estado}: ${via} → cerrado=${cerrado}, foco en el correo=${enfocado}`);
      await contexto.close();
    }
  }
}

// ---------- TUT-01 ----------
async function misRegistros(navegador: Browser) {
  const { contexto, pagina } = await nuevaPagina(navegador);
  await irA(pagina, "/tutor");
  const orden = casosDeLaPersonaTutora();
  const folios = async () => pagina.locator("main [role=tabpanel] a[href^='/tutor/casos/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")!.split("/").pop()));
  const esperados = orden.map((c) => c.folio);
  const primera = await folios();
  ver(JSON.stringify(primera) === JSON.stringify(esperados.slice(0, 6)), "TUT-01: tarjetas por fecha de creación descendente (6 por página)", `TUT-01: orden ${primera.join(",")}`);
  const activos = orden.filter((c) => ["Extraviado", "En búsqueda", "Avistamiento reportado", "En seguimiento"].includes(c.estado)).length;
  const localizados = orden.filter((c) => c.estado === "Localizado").length;
  const nombres = await pagina.getByRole("tab").allInnerTexts();
  ver(nombres.length === 3 && nombres[0].startsWith("Activos") && nombres[0].includes(String(activos)) && nombres[1].startsWith("Localizados") && nombres[1].includes(String(localizados)) && nombres[2].startsWith("Todos") && nombres[2].includes(String(orden.length)), `TUT-01: pestañas Activos (${activos}), Localizados (${localizados}) y Todos (${orden.length}) con contador`, `TUT-01: pestañas ${nombres.join(" | ")}`);
  await boton(pagina, "Página siguiente").click();
  ver(JSON.stringify(await folios()) === JSON.stringify(esperados.slice(6)), "TUT-01: la paginación pasa a la página 2", "TUT-01: la página 2 no coincide");
  await pagina.getByRole("tab", { name: /^Activos/ }).click();
  const act = orden.filter((c) => ["Extraviado", "En búsqueda", "Avistamiento reportado", "En seguimiento"].includes(c.estado)).map((c) => c.folio);
  ver(JSON.stringify(await folios()) === JSON.stringify(act) && (await pagina.getByRole("tab", { name: /^Activos/ }).getAttribute("aria-selected")) === "true", "TUT-01: «Activos» muestra solo casos activos y empieza en la página 1", "TUT-01: «Activos» incorrecto");
  await pagina.getByRole("tab", { name: /^Localizados/ }).click();
  ver((await folios()).length === localizados, "TUT-01: «Localizados» muestra solo los localizados", "TUT-01: «Localizados» incorrecto");
  ver((await enlace(pagina, "Registrar extravío").first().getAttribute("href")) === "/tutor/registrar", "TUT-01: botón «Registrar extravío»", "TUT-01: falta «Registrar extravío»");
  await irA(pagina, "/tutor?estado=vacio");
  const t = await pagina.locator("main").innerText();
  ver(/¡Hola, Rosa!/.test(t) && (await pagina.locator("main ol > li").count()) === 4 && (await enlace(pagina, "Registrar mi primer extravío").isVisible()) && (await pagina.getByRole("tab").count()) === 0, "TUT-01 vacío: bienvenida, 4 pasos y «Registrar mi primer extravío»", "TUT-01 vacío: contenido incorrecto");
  await irA(pagina, "/tutor?estado=cargando");
  ver((await pagina.getByRole("status").count()) >= 3 && (await pagina.locator("main a[href^='/tutor/casos/']").count()) === 0, "TUT-01 cargando: esqueletos con role=\"status\" y sin tarjetas", "TUT-01 cargando: incorrecto");
  await contexto.close();
}

// ---------- (a) registro ----------
async function registro(navegador: Browser) {
  const { contexto, pagina } = await nuevaPagina(navegador);
  await irA(pagina, "/tutor/registrar");
  ver((await barra(pagina)) === "Paso 1 de 2: Datos del perro" && (await pagina.locator("main").innerText()).includes("Públicos: aparecen en la ficha") && (await pagina.locator("main").innerText()).includes("Reservados: nunca aparecen en la ficha"), "TUT-02: abre en «Paso 1 de 2: Datos del perro» e indica qué datos son públicos y cuáles reservados", `TUT-02: ${await barra(pagina)}`);
  const p1 = eIso(pagina, 1);
  const cont = boton(pagina, /^(Guardar y continuar|Guardar registro)$/);
  ver((await enlace(pagina, "Cancelar").getAttribute("href")) === "/tutor" && (await pagina.locator("nav[aria-label='Navegación inferior']").count()) === 0, "TUT-02: «Cancelar» vuelve a /tutor y no hay barra inferior (plantilla de flujo)", "TUT-02: Cancelar o barra inferior incorrectos");
  // Longitudes del diccionario.
  const max = async (l: Locator) => l.getAttribute("maxlength");
  ver((await max(pagina.getByLabel(/^Nombre del perro/))) === "50" && (await max(pagina.getByLabel(/^Color/))) === "50" && (await max(pagina.getByLabel(/^Características distintivas/))) === "300", "TUT-02: longitudes del diccionario (nombre 50, color 50, características 300)", "TUT-02: longitudes incorrectas");
  await cont.click();
  const nombre = pagina.getByLabel(/^Nombre del perro/);
  ver((await barra(pagina)) === "Paso 1 de 2: Datos del perro" && (await nombre.getAttribute("aria-invalid")) === "true" && /nombre del perro/.test(await textoDescrito(nombre)), "TUT-02: sin datos no avanza y cada error queda asociado con aria-describedby", "TUT-02: avanzó vacío o sin errores asociados");
  const invalidos = await p1.locator('[aria-invalid="true"], [data-invalido="true"]').count();
  ver(invalidos >= 7 && (await nombre.evaluate((e) => e === document.activeElement)), `TUT-02: ${invalidos} campos obligatorios marcados (nombre, sexo, raza, edad, tamaño, color, fotografía) y el foco va al primero`, `TUT-02: solo ${invalidos} campos marcados`);
  // Raza «Otra».
  ver((await p1.getByLabel(/^Especifique la raza/).count()) === 0, "TUT-02: sin raza «Otra» no se pide «Especifique la raza»", "TUT-02: pide la raza específica sin «Otra»");
  await p1.getByLabel(/^Raza/).selectOption({ label: "Otra" });
  ver(await p1.getByLabel(/^Especifique la raza/).isVisible(), "TUT-02: con raza «Otra» aparece «Especifique la raza»", "TUT-02: no apareció «Especifique la raza»");
  await p1.getByLabel(/^Raza/).selectOption({ label: "Pastor Alemán" });
  ver((await p1.getByLabel(/^Especifique la raza/).count()) === 0, "TUT-02: con otra raza el campo desaparece", "TUT-02: el campo siguió visible");
  await p1.getByLabel(/^Raza/).selectOption({ label: "Otra" });
  // Edad.
  const valor = p1.getByLabel(/^Valor/);
  const unidad = p1.getByLabel("Unidad");
  const opts = async () => valor.locator("option").allTextContents();
  await unidad.selectOption("meses");
  const meses = await opts();
  await unidad.selectOption("años");
  const anios = await opts();
  ver(meses.length === 13 && meses[1] === "Menos de 1 mes" && meses[12] === "11 meses" && anios.length === 51 && anios[1] === "1 año" && anios[50] === "50 años", "TUT-02: edad en meses de 0 a 11 («Menos de 1 mes») y en años de 1 a 50", `TUT-02: edad ${meses.length}/${anios.length} opciones`);
  // Captura sin la especificación y sin foto: sigue bloqueado.
  await nombre.fill("Canela");
  await p1.locator("label", { hasText: "Hembra" }).click();
  await valor.selectOption("0").catch(() => undefined);
  await unidad.selectOption("meses");
  await valor.selectOption({ label: "Menos de 1 mes" });
  await p1.locator("label", { hasText: "Pequeño" }).click();
  await p1.getByLabel(/^Color/).fill("Canela con blanco");
  await p1.getByLabel(/^Características distintivas/).fill("Mancha en la pata.");
  ver(await p1.getByText("18/300").isVisible(), "TUT-02: el contador de características marca «18/300»", "TUT-02: contador incorrecto");
  await cont.click();
  ver((await barra(pagina)) === "Paso 1 de 2: Datos del perro" && /Especifica la raza/.test(await textoDescrito(p1.getByLabel(/^Especifique la raza/))) && (await p1.locator("input[type=file]").getAttribute("aria-invalid")) === "true", "TUT-02: con «Otra» sin especificar y sin fotografía no avanza", "TUT-02: avanzó sin raza específica o sin foto");
  await p1.getByLabel(/^Especifique la raza/).fill("Perro de agua");
  await p1.locator("input[type=file]").setInputFiles({ name: "perro.png", mimeType: "image/png", buffer: PNG });
  await cont.click();

  // TUT-03.
  ver((await barra(pagina)) === "Paso 2 de 2: Circunstancias" && (await pagina.getByRole("heading", { level: 1, name: "Circunstancias del extravío" }).isVisible()) && (await cont.innerText()) === "Guardar registro", "TUT-03: «Paso 2 de 2: Circunstancias» con «Guardar registro»", `TUT-03: ${await barra(pagina)}`);
  const p2 = eIso(pagina, 2);
  const texto2 = await p2.innerText();
  ver(/Públicos en la ficha/.test(texto2) && /Reservados: no aparecen en la ficha/.test(texto2), "TUT-03: separa «Públicos en la ficha» y «Reservados: no aparecen en la ficha»", "TUT-03: no separa públicos de reservados");
  ver((await max(p2.getByLabel(/^Calle o cruce/))) === "200" && (await max(p2.getByLabel(/^Colonia o zona/))) === "100" && (await max(p2.getByLabel(/^Referencias del lugar/))) === "500" && (await max(p2.getByLabel(/^Descripción de las circunstancias/))) === "1000", "TUT-03: longitudes del diccionario (calle 200, colonia 100, referencias 500, descripción 1000)", "TUT-03: longitudes incorrectas");
  ver((await p2.getByLabel(/^Alcaldía/).locator("option").count()) === 17 && !(await p2.getByLabel(/^Alcaldía/).locator("option").allTextContents()).includes("Fuera de la Ciudad de México") && (await p2.getByLabel(/^Motivo del extravío/).locator("option").count()) === 16 && (await p2.getByRole("radio").count()) === 5, "TUT-03: 16 alcaldías (sin «Fuera de la Ciudad de México»), 15 motivos y 5 momentos del día", "TUT-03: catálogos incorrectos");
  await cont.click();
  const fecha = p2.locator("input[type=date]");
  const errs = [await fecha.getAttribute("aria-invalid"), await p2.getByLabel(/^Alcaldía/).getAttribute("aria-invalid"), await p2.getByLabel(/^Colonia o zona/).getAttribute("aria-invalid"), await p2.getByLabel(/^Motivo del extravío/).getAttribute("aria-invalid")];
  ver((await barra(pagina)) === "Paso 2 de 2: Circunstancias" && errs.every((e) => e === "true") && (await p2.locator("fieldset[data-invalido]").count()) === 1, "TUT-03: sin fecha, momento, alcaldía, colonia ni motivo no guarda y marca cada error", `TUT-03: avanzó o faltan errores ${errs}`);
  const manana = new Date(Date.now() + 36 * 3600 * 1000);
  await fecha.fill(`${manana.getFullYear()}-${String(manana.getMonth() + 1).padStart(2, "0")}-${String(manana.getDate()).padStart(2, "0")}`);
  await cont.click();
  ver(/posterior a hoy/.test(await textoDescrito(fecha)), "TUT-03: una fecha futura no se acepta", "TUT-03: aceptó una fecha futura");
  await fecha.fill("2026-10-18");
  await p2.locator("label", { hasText: "Tarde" }).click();
  await p2.getByLabel(/^Alcaldía/).selectOption("Coyoacán");
  await p2.getByLabel(/^Colonia o zona/).fill("Narvarte Poniente");
  await p2.getByLabel(/^Motivo del extravío/).selectOption({ label: "Portones o puertas abiertas" });
  ver(await p2.getByText(/Fallas en Infraestructura y Contención\./).isVisible(), "TUT-03: al elegir un motivo se muestra su categoría y descripción", "TUT-03: sin descripción del motivo");

  // Regresar conserva lo capturado.
  await boton(pagina, "Regresar").click();
  ver((await barra(pagina)) === "Paso 1 de 2: Datos del perro" && (await nombre.inputValue()) === "Canela" && (await p1.getByLabel(/^Raza/).locator("option:checked").innerText()) === "Otra" && (await p1.getByLabel(/^Especifique la raza/).inputValue()) === "Perro de agua" && (await valor.locator("option:checked").innerText()) === "Menos de 1 mes" && (await unidad.inputValue()) === "meses" && (await p1.getByLabel(/^Color/).inputValue()) === "Canela con blanco" && (await p1.getByAltText("Vista previa de la fotografía").count()) === 1 && (await p1.getByRole("radio", { name: "Hembra" }).isChecked()) && (await p1.getByRole("radio", { name: "Pequeño" }).isChecked()), "Regresar: nombre, raza «Otra» y especificación, edad, sexo, tamaño, color y fotografía se conservan", "Regresar: se perdió lo capturado en el paso 1");
  await cont.click();
  ver((await fecha.inputValue()) === "2026-10-18" && (await p2.getByLabel(/^Alcaldía/).inputValue()) === "Coyoacán" && (await p2.getByLabel(/^Colonia o zona/).inputValue()) === "Narvarte Poniente" && (await p2.getByRole("radio", { name: /^Tarde/ }).isChecked()), "al avanzar de nuevo, el paso 2 conserva lo capturado", "el paso 2 perdió lo capturado");
  const almacen = await pagina.evaluate(() => ({ local: Object.keys(localStorage).filter((k) => k !== "rupe-tema"), sesion: Object.keys(sessionStorage), cookies: document.cookie }));
  ver(almacen.local.length === 0 && almacen.sesion.length === 0 && almacen.cookies === "", "lo capturado no se guarda en localStorage, sessionStorage ni cookies", `almacenamiento: ${JSON.stringify(almacen)}`);
  await cont.click();
  await pagina.waitForURL(`**/tutor/casos/${FOLIO_NUEVO}/creado`);
  ver(true, "«Guardar registro» con todo completo lleva a TUT-04 (Registro creado)", "");
  await contexto.close();

  // Variantes.
  const r = await nuevaPagina(navegador);
  await irA(r.pagina, "/tutor/registrar?raza=otra");
  ver((await barra(r.pagina)) === "Paso 1 de 2: Datos del perro" && (await r.pagina.getByLabel(/^Especifique la raza/).isVisible()) && (await r.pagina.getByAltText("Vista previa de la fotografía").count()) === 1, "?raza=otra: paso 1 con «Especifique la raza» y la fotografía cargada", "?raza=otra: variante incorrecta");
  await irA(r.pagina, "/tutor/registrar?paso=2");
  ver((await barra(r.pagina)) === "Paso 2 de 2: Circunstancias", "?paso=2: abre en el paso 2", "?paso=2: no abrió en el paso 2");
  await r.contexto.close();
}

// ---------- TUT-04 ----------
async function creado(navegador: Browser) {
  const { contexto, pagina } = await nuevaPagina(navegador);
  await irA(pagina, `${CASO}/creado`);
  const t = await pagina.locator("main").innerText();
  ver(/Registro creado/.test(t) && t.includes(FOLIO_EN_CURSO) && t.includes("En búsqueda") && (await pagina.getByRole("img", { name: /Código QR ilustrativo/ }).isVisible()), "TUT-04: título, estado «En búsqueda», folio asignado y QR ilustrativo", "TUT-04: contenido incorrecto");
  ver((await enlace(pagina, "Ver ficha de búsqueda").getAttribute("href")) === `${CASO}/ficha` && (await enlace(pagina, "Ver detalle del caso").getAttribute("href")) === CASO && (await enlace(pagina, "Ir a mis registros").getAttribute("href")) === "/tutor" && (await pagina.locator("nav[aria-label='Navegación inferior']").isVisible()), "TUT-04: accesos a la ficha, al caso y a mis registros, con la barra inferior de la plantilla tutora", "TUT-04: accesos incorrectos");
  await boton(pagina, "Copiar folio").click();
  const avisoVisible = await pagina.getByRole("status").getByText("Folio copiado").waitFor({ timeout: 3000 }).then(() => true, () => false);
  const copiado = await pagina.evaluate(() => navigator.clipboard.readText()).catch((e) => `error: ${e}`);
  ver(avisoVisible && copiado === FOLIO_EN_CURSO, "TUT-04: «Copiar folio» copia el folio y lo anuncia (role=\"status\")", `TUT-04: aviso=${avisoVisible}, portapapeles=${copiado}`);
  await contexto.close();
}

// ---------- (b) TUT-05 ----------
const ACCIONES = ["Ver ficha de búsqueda", "Ver avistamientos", "Ver mapa", "Editar registro", "Notificaciones del caso", "Compartir estatus", "Marcar como localizado", "Cancelar registro", "Reactivar caso", "Cerrar caso"];
async function visibles(p: Page) {
  const zona = p.locator("section[aria-labelledby=acciones-titulo]");
  const out: string[] = [];
  for (const a of ACCIONES) if ((await zona.getByRole("button", { name: a, exact: true }).count()) + (await zona.getByRole("link", { name: a, exact: true }).count()) > 0) out.push(a);
  return out;
}

async function detalle(navegador: Browser) {
  const esperado: Record<string, string[]> = {
    "en-curso": ["Ver ficha de búsqueda", "Ver avistamientos", "Ver mapa", "Editar registro", "Notificaciones del caso", "Compartir estatus", "Marcar como localizado", "Cancelar registro"],
    localizado: ["Ver avistamientos", "Ver mapa", "Compartir estatus", "Reactivar caso", "Cerrar caso"],
    cerrado: ["Ver avistamientos", "Ver mapa"],
  };
  for (const [v, acciones] of Object.entries(esperado)) {
    const { contexto, pagina } = await nuevaPagina(navegador);
    await irA(pagina, `${CASO}?estado=${v}`);
    const real = await visibles(pagina);
    ver(JSON.stringify(real) === JSON.stringify(acciones), `TUT-05 ?estado=${v}: acciones ${acciones.join(", ")}`, `TUT-05 ?estado=${v}: acciones ${real.join(", ")}; se esperaba ${acciones.join(", ")}`);
    const secciones = await pagina.evaluate(() => ["datos-perro", "datos-extravio", "datos-reservados"].map((id) => { const s = document.querySelector(`section[aria-labelledby=${id}]`)!; return [s.textContent!.slice(0, 60), getComputedStyle(s).borderStyle]; }));
    ver(secciones[2][1] === "dashed" && secciones[1][1] === "solid" && /públicos en la ficha/.test(secciones[1][0]) && /no aparecen en la ficha/.test(secciones[2][0]), "TUT-05: datos públicos y reservados en tarjetas separadas (la reservada con borde discontinuo y título)", "TUT-05: públicos y reservados no se distinguen");
    await contexto.close();
  }

  // Confirmaciones y cambios de estado.
  let { contexto, pagina } = await nuevaPagina(navegador);
  await irA(pagina, `${CASO}?estado=en-curso`);
  ver((await pagina.getByRole("heading", { level: 1 }).innerText()) === FOLIO_EN_CURSO && (await pagina.locator("main").innerText()).includes("En seguimiento"), "TUT-05 ?estado=en-curso: folio y estado «En seguimiento»", "TUT-05 en-curso: encabezado incorrecto");
  const abrir = boton(pagina, "Marcar como localizado");
  await abrir.click();
  let dlg = pagina.getByRole("dialog", { name: "¿Marcar el caso como localizado?" });
  ver(await dlg.isVisible(), "«Marcar como localizado» pide confirmación (modal)", "«Marcar como localizado» no pidió confirmación");
  await pagina.keyboard.press("Escape");
  ver(!(await dialogoAbierto(pagina)) && (await pagina.locator("main").innerText()).includes("En seguimiento") && (await foco(pagina)) === "Marcar como localizado", "Escape cierra la confirmación sin cambiar el estado y devuelve el foco al botón", "Escape: cambió el estado o no devolvió el foco");
  await abrir.click();
  await pagina.mouse.click(4, 4);
  ver(!(await dialogoAbierto(pagina)) && (await foco(pagina)) === "Marcar como localizado", "clic fuera cierra la confirmación y devuelve el foco", "clic fuera: no cerró o no devolvió el foco");
  await abrir.click();
  await boton(dlg, "Volver").click();
  ver(!(await dialogoAbierto(pagina)) && (await foco(pagina)) === "Marcar como localizado", "«Volver» cierra la confirmación y devuelve el foco", "«Volver»: no cerró o no devolvió el foco");
  await abrir.click();
  await boton(dlg, "Marcar como localizado").click();
  ver(!(await dialogoAbierto(pagina)) && (await pagina.locator("main").innerText()).includes("Localizado") && JSON.stringify(await visibles(pagina)) === JSON.stringify(esperado.localizado) && (await pagina.getByText("Marcado como localizado").isVisible()), "al confirmar, el caso queda «Localizado», cambian las acciones y el historial suma el movimiento", "confirmar «Marcar como localizado» no cambió el estado");
  ver((await pagina.getByRole("heading", { level: 1 }).evaluate((e) => e === document.activeElement)), "tras confirmar, el foco va al encabezado del caso", "tras confirmar, el foco se perdió");

  // Cerrar caso: definitivo.
  await boton(pagina, "Cerrar caso").click();
  dlg = pagina.getByRole("dialog", { name: "¿Cerrar el caso?" });
  ver((await dlg.isVisible()) && /definitivo/.test(await dlg.innerText()), "«Cerrar caso» pide confirmación y advierte que el cierre es definitivo", "«Cerrar caso» sin advertencia de cierre definitivo");
  await boton(dlg, "Cerrar caso").click();
  ver(JSON.stringify(await visibles(pagina)) === JSON.stringify(esperado.cerrado) && (await pagina.getByText("El cierre es definitivo", { exact: false }).first().isVisible()), "al confirmar, el caso queda «Cerrado» y ya no hay forma de reactivarlo ni cerrarlo", "el cierre dejó acciones disponibles");
  await contexto.close();

  // Reactivar con motivo obligatorio.
  ({ contexto, pagina } = await nuevaPagina(navegador));
  await irA(pagina, `${CASO}?estado=localizado`);
  await boton(pagina, "Reactivar caso").click();
  dlg = pagina.getByRole("dialog", { name: "¿Reactivar el caso?" });
  await boton(dlg, "Reactivar caso").click();
  const motivo = dlg.getByLabel(/^Motivo/);
  ver((await dialogoAbierto(pagina)) && (await motivo.getAttribute("aria-invalid")) === "true" && /Escribe el motivo/.test(await textoDescrito(motivo)) && (await motivo.evaluate((e) => e === document.activeElement)), "«Reactivar caso» sin motivo no se confirma y el error queda asociado (aria-describedby)", "«Reactivar caso»: aceptó un motivo vacío");
  await motivo.fill("Lo marqué por error.");
  await boton(dlg, "Reactivar caso").click();
  ver(JSON.stringify(await visibles(pagina)) === JSON.stringify(esperado["en-curso"]) && (await pagina.locator("main").innerText()).includes("En seguimiento") && (await pagina.getByText("Motivo: Lo marqué por error.").isVisible()), "con motivo, el caso vuelve a «En seguimiento», recupera sus acciones y el motivo queda en el historial", "reactivar con motivo falló");
  // Cancelar el registro.
  await boton(pagina, "Cancelar registro").click();
  dlg = pagina.getByRole("dialog", { name: "¿Cancelar el registro?" });
  await boton(dlg, "Cancelar registro").click();
  ver((await dialogoAbierto(pagina)) && (await dlg.getByLabel(/^Motivo/).getAttribute("aria-invalid")) === "true", "«Cancelar registro» exige el motivo (HU 017)", "«Cancelar registro» aceptó un motivo vacío");
  await dlg.getByLabel(/^Motivo/).fill("Lo registré por error.");
  await boton(dlg, "Cancelar registro").click();
  ver(JSON.stringify(await visibles(pagina)) === JSON.stringify(esperado.cerrado) && (await pagina.getByText("Registro cancelado").isVisible()) && (await pagina.getByText("Motivo: Lo registré por error.").isVisible()), "al cancelar, el caso queda «Cerrado» (solo consulta) y el historial registra la cancelación con su motivo", "cancelar el registro falló");
  await contexto.close();

  // Compartir estatus (MOD-07).
  ({ contexto, pagina } = await nuevaPagina(navegador));
  await irA(pagina, `${CASO}?estado=en-curso`);
  await boton(pagina, "Compartir estatus").click();
  const comp = pagina.getByRole("dialog", { name: "Compartir ficha" });
  const wa = await enlace(comp, /WhatsApp/).getAttribute("href");
  const fb = await enlace(comp, /Facebook/).getAttribute("href");
  ver(!!wa?.startsWith("https://wa.me/?text=") && decodeURIComponent(wa).includes(`/ficha/${FOLIO_EN_CURSO}`) && !!fb?.includes("sharer") && (await enlace(comp, /WhatsApp/).getAttribute("target")) === "_blank", "MOD-07 desde TUT-05: WhatsApp y Facebook apuntan a la ficha pública (/ficha/folio) en pestaña nueva", `MOD-07: ${wa} ${fb}`);
  await boton(comp, "Copiar enlace").click();
  ver(((await pagina.evaluate(() => navigator.clipboard.readText())) as string).endsWith(`/ficha/${FOLIO_EN_CURSO}`) && (await comp.getByRole("status").getByText("Enlace copiado").isVisible()), "MOD-07: «Copiar enlace» copia el enlace público y lo anuncia", "MOD-07: no copió el enlace");
  await boton(comp, "Cerrar").click();
  ver(!(await dialogoAbierto(pagina)) && (await foco(pagina)) === "Compartir estatus", "MOD-07: «Cerrar» cierra y devuelve el foco a «Compartir estatus»", "MOD-07: no devolvió el foco");
  await contexto.close();
}

// ---------- (c) fugas y hoja ----------
async function fugas(navegador: Browser) {
  let comprobaciones = 0;
  let filtradas = 0;
  const rutas = (f: string) => [`/tutor/casos/${f}/creado`, `/tutor/casos/${f}/ficha`, `/tutor/casos/${f}/ficha?modal=visor`, `/tutor/casos/${f}/ficha?modal=visor&hoja=media-carta`, `/tutor/casos/${f}/ficha?modal=compartir`, `/tutor/casos/${f}/ficha?modal=regenerar`];
  for (const o of CASOS_ORIGEN) {
    const reservados = valoresReservados(o);
    if (reservados.length < 5) throw new Error(`El origen de ${o.folio} no tiene suficientes datos reservados para la prueba`);
    for (const ruta of rutas(o.folio)) {
      const html = await (await fetch(`${base}${ruta}`)).text();
      comprobaciones++;
      const dentro = [...reservados, o.tokenPublico].filter((v) => html.includes(v));
      if (dentro.length) {
        filtradas++;
        console.log(`✗ fuga en ${ruta.replace(o.folio, "<folio>")} de ${o.folio}: ${dentro.length} valor(es) reservado(s), de la persona tutora o el token`);
      }
    }
  }
  ver(filtradas === 0, `sin fugas: ${comprobaciones} respuestas HTML (${CASOS_ORIGEN.length} casos × TUT-04, vista previa, visor Carta y Media carta, compartir y regenerar) sin ningún dato reservado, de la persona tutora ni token del QR`, `${filtradas} respuesta(s) con datos reservados`);

  // Controles de sensibilidad: la misma búsqueda sí detecta lo que TUT-05 muestra a su dueña.
  const max = CASOS_ORIGEN[0];
  const detalleHtml = await (await fetch(`${base}/tutor/casos/${max.folio}`)).text();
  ver(detalleHtml.includes(max.direccionAproximada!) && detalleHtml.includes(max.referenciasDelLugar!) && detalleHtml.includes(max.motivo) && detalleHtml.includes(max.descripcionCircunstancias!), "control: TUT-05 sí muestra a su dueña los reservados del caso (la búsqueda de fugas los detecta)", "control: TUT-05 no muestra los reservados");
  ver(![max.tutor.nombreCompleto, max.tutor.correo, max.tutor.telefono, max.tokenPublico].some((v) => detalleHtml.includes(v)), "TUT-05 no contiene su nombre, correo ni teléfono ni el token del QR", "TUT-05 filtra datos de la persona tutora o el token");
  const fichaHtml = await (await fetch(`${base}/tutor/casos/${max.folio}/ficha`)).text();
  ver(fichaHtml.includes(max.folio) && fichaHtml.includes(max.coloniaZona), "control: la vista previa sí contiene los campos públicos (folio, colonia)", "control: la vista previa no trae los campos públicos");

  // La hoja renderizada: contenido, sin desbordar y CSS de impresión.
  for (const ancho of [390, 1280]) {
    for (const hoja of ["carta", "media-carta"] as const) {
      const { contexto, pagina } = await nuevaPagina(navegador, ancho);
      await irA(pagina, `${CASO}/ficha?modal=visor&hoja=${hoja}`);
      const dlg = pagina.getByRole("dialog", { name: "Tu ficha de búsqueda en PDF" });
      const hojaEl = dlg.locator("article[aria-label^='Ficha de búsqueda']");
      const texto = (await hojaEl.innerText()).toLowerCase();
      const incluye = ["¡ayúdame a regresar a casa!", max.nombre.toLowerCase(), max.folio.toLowerCase(), "se extravió el 18 de octubre de 2026", `col. ${max.coloniaZona}, alcaldía ${max.alcaldia}`.toLowerCase(), "¿lo viste?", max.color.toLowerCase()];
      const falta = incluye.filter((t) => !texto.includes(t));
      const reservadosEnHoja = valoresReservados(max).filter((v) => texto.includes(v.toLowerCase()));
      ver(falta.length === 0 && reservadosEnHoja.length === 0 && (await hojaEl.getByRole("img", { name: /Fotografía de Max, sin recorte/ }).isVisible()) && (await hojaEl.getByRole("img", { name: /Código QR ilustrativo/ }).isVisible()), `ficha ${hoja} ${ancho}px: título, fotografía sin recorte, nombre, datos públicos, fecha, lugar, folio y QR; sin reservados`, `ficha ${hoja} ${ancho}px: falta [${falta.join(", ")}] o trae reservados [${reservadosEnHoja.join(", ")}]`);
      const medida = await hojaEl.evaluate((a) => ({ sh: a.scrollHeight, ch: a.clientHeight, sw: a.scrollWidth, cw: a.clientWidth, w: a.getBoundingClientRect().width, h: a.getBoundingClientRect().height, ar: getComputedStyle(a).backgroundColor, tinta: getComputedStyle(a).color }));
      const razon = hoja === "carta" ? 21.6 / 27.9 : 21.6 / 14;
      ver(medida.sh <= medida.ch + 1 && medida.sw <= medida.cw + 1 && Math.abs(medida.w / medida.h - razon) < 0.01, `ficha ${hoja} ${ancho}px: el contenido cabe en la hoja (${Math.round(medida.w)}×${Math.round(medida.h)} px, proporción ${razon.toFixed(3)}) sin desbordar`, `ficha ${hoja} ${ancho}px: desborda o proporción incorrecta ${JSON.stringify(medida)}`);
      ver(medida.ar === "rgb(255, 255, 255)" && medida.tinta === "rgb(0, 0, 0)", `ficha ${hoja} ${ancho}px: blanco sobre negro (papel y tinta)`, `ficha ${hoja} ${ancho}px: colores ${medida.ar} / ${medida.tinta}`);
      if (ancho === 390) {
        const css = await pagina.locator("style").evaluateAll((ss) => ss.map((s) => s.textContent ?? "").find((t) => t.includes("@page")) ?? "");
        ver(css.includes(hoja === "carta" ? "21.6cm 27.9cm" : "21.6cm 14cm"), `ficha ${hoja}: la regla de impresión fija la página en ${hoja === "carta" ? "21.6 × 27.9 cm" : "21.6 × 14 cm"}`, `ficha ${hoja}: sin regla @page (${css})`);
        await pagina.emulateMedia({ media: "print" });
        const imp = await pagina.evaluate(() => ({ hoja: getComputedStyle(document.querySelector(".ficha-impresion article")!).visibility, encabezado: getComputedStyle(document.querySelector("header")!).visibility, titulo: getComputedStyle(document.querySelector("main h1")!).visibility, ancho: document.querySelector(".ficha-impresion")!.getBoundingClientRect().width }));
        ver(imp.hoja === "visible" && imp.encabezado === "hidden" && imp.titulo === "hidden" && Math.abs(imp.ancho - 21.6 * 37.795) < 2, `ficha ${hoja}: en impresión solo se ve la hoja (a 21.6 cm de ancho) y no el resto de la página`, `ficha ${hoja}: CSS de impresión ${JSON.stringify(imp)}`);
      }
      await contexto.close();
    }
  }
}

// ---------- (d) modales de TUT-07 ----------
async function modalesFicha(navegador: Browser) {
  const casos: { boton: string; modal: string }[] = [
    { boton: "Imprimir ficha de búsqueda", modal: "Tu ficha de búsqueda en PDF" },
    { boton: "Compartir", modal: "Compartir ficha" },
    { boton: "Regenerar QR", modal: "Regenerar código QR" },
  ];
  for (const c of casos) {
    for (const via of ["botón", "Escape", "clic fuera"] as const) {
      const { contexto, pagina } = await nuevaPagina(navegador);
      await irA(pagina, `${CASO}/ficha`);
      const abrir = boton(pagina, c.boton).first();
      await abrir.click();
      const dlg = pagina.getByRole("dialog", { name: c.modal });
      const abrio = await dlg.isVisible();
      if (via === "botón") {
        const cierre = c.modal === "Tu ficha de búsqueda en PDF" ? "Regresar a la ficha" : c.modal === "Compartir ficha" ? "Cerrar" : "Regresar";
        await boton(dlg, cierre).click();
      } else if (via === "Escape") await pagina.keyboard.press("Escape");
      else await pagina.mouse.click(4, 4);
      const cerrado = !(await dialogoAbierto(pagina));
      const devuelto = (await foco(pagina)) === c.boton;
      ver(abrio && cerrado && devuelto, `TUT-07 «${c.modal}»: abre, ${via === "botón" ? "su botón" : via} lo cierra y el foco vuelve a «${c.boton}»`, `TUT-07 «${c.modal}» (${via}): abrió=${abrio}, cerrado=${cerrado}, foco devuelto=${devuelto} (${await foco(pagina)})`);
      await contexto.close();
    }
  }
  // Contenido y acciones del visor y de los demás modales.
  const { contexto, pagina } = await nuevaPagina(navegador);
  await irA(pagina, `${CASO}/ficha`);
  const texto = await pagina.locator("main").innerText();
  ver(/no incluye tus datos personales ni la calle, las referencias, el motivo o la descripción/.test(texto) && (await enlace(pagina, "Regresar al detalle del caso").getAttribute("href")) === CASO, "TUT-07: mensaje de lo que no incluye la ficha y «Regresar al detalle del caso»", "TUT-07: contenido incorrecto");
  await boton(pagina, "Imprimir ficha de búsqueda").click();
  const dlg = pagina.getByRole("dialog", { name: "Tu ficha de búsqueda en PDF" });
  ver((await dlg.getByRole("radio", { name: "Carta", exact: true }).isChecked()) && (await dlg.locator("article[aria-label*='tamaño Carta']").isVisible()), "visor: empieza en Carta", "visor: no empieza en Carta");
  await dlg.locator("label", { hasText: "Media carta" }).click();
  ver((await dlg.locator("article[aria-label*='Media carta']").isVisible()) && (await dlg.locator("article[aria-label*='tamaño Carta']").count()) === 0, "visor: el selector cambia a Media carta", "visor: el selector no cambió la hoja");
  await boton(dlg, "Descargar PDF").click();
  ver(await dlg.getByRole("status").getByText(/Descarga simulada/).isVisible(), "visor: «Descargar PDF» avisa que la descarga es simulada (no hay PDF real)", "visor: «Descargar PDF» no respondió");
  await boton(dlg, "Imprimir").click();
  ver((await pagina.evaluate(() => (window as unknown as { __impresiones: number }).__impresiones)) === 1, "visor: «Imprimir» invoca la impresión del navegador", "visor: «Imprimir» no invocó window.print");
  await boton(dlg, "Regresar a la ficha").click();
  // Regenerar QR cambia el código y avisa.
  const qr = () => pagina.locator("section[aria-labelledby=vista-previa] svg[role=img] path").getAttribute("d");
  const antes = await qr();
  await boton(pagina, "Regenerar QR").click();
  const regen = pagina.getByRole("dialog", { name: "Regenerar código QR" });
  ver(/dejará de ser válido de inmediato/.test(await regen.innerText()), "MOD-06: advierte que el QR anterior dejará de ser válido de inmediato", "MOD-06: sin advertencia");
  await boton(regen, "Regenerar QR").click();
  ver((await qr()) !== antes && (await pagina.getByRole("status").getByText(/Código QR regenerado/).isVisible()), "MOD-06: «Regenerar QR» cambia el código de la vista previa y lo anuncia", "MOD-06: el QR no cambió");
  await contexto.close();

  // Casos sin ficha.
  const c2 = await nuevaPagina(navegador);
  const localizado = CASOS_ORIGEN.find((x) => x.estado === "Localizado")!;
  await irA(c2.pagina, `/tutor/casos/${localizado.folio}/ficha`);
  ver(/La ficha ya no está disponible/.test(await c2.pagina.locator("main").innerText()) && (await c2.pagina.getByRole("button", { name: "Imprimir ficha de búsqueda" }).count()) === 0, "TUT-07: un caso «Localizado» no ofrece imprimir ni compartir la ficha", "TUT-07: ofrece la ficha de un caso localizado");
  const r = await c2.pagina.goto(`${base}/tutor/casos/RUPE-Z5C6VR4P`, { waitUntil: "load" });
  ver(r?.status() === 404, "un folio que no es de la persona tutora responde 404 (TRA-01)", `folio ajeno: HTTP ${r?.status()}`);
  await c2.contexto.close();
}

// ---------- (e) geometría ----------
async function geometria(navegador: Browser) {
  const rutas = [
    "/acceso",
    "/acceso?estado=bloqueo",
    "/acceso?estado=deshabilitada",
    "/tutor",
    "/tutor?estado=vacio",
    "/tutor?estado=cargando",
    "/tutor/registrar",
    "/tutor/registrar?raza=otra",
    "/tutor/registrar?paso=2",
    `${CASO}/creado`,
    `${CASO}?estado=en-curso`,
    `${CASO}?estado=localizado`,
    `${CASO}?estado=cerrado`,
    `${CASO}/ficha`,
    `${CASO}/ficha?modal=visor`,
    `${CASO}/ficha?modal=visor&hoja=media-carta`,
    `${CASO}/ficha?modal=compartir`,
    `${CASO}/ficha?modal=regenerar`,
    "/admin",
  ];
  for (const ruta of rutas) {
    for (const ancho of ANCHOS) {
      const { contexto, pagina } = await nuevaPagina(navegador, ancho);
      await irA(pagina, ruta);
      const etiqueta = `${ruta} ${ancho}px`;
      await desborde(pagina, etiqueta);
      await areasTactiles(pagina, etiqueta);
      await contexto.close();
    }
  }
}

async function main() {
  let servidor: ChildProcess | undefined;
  if (!baseExterna) {
    if (!process.argv.includes("--sin-build")) {
      if (spawnSync("npx", ["next", "build"], { stdio: "inherit" }).status !== 0) throw new Error("Falló next build");
    }
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
    await acceso(navegador);
    await misRegistros(navegador);
    await registro(navegador);
    await creado(navegador);
    await detalle(navegador);
    await fugas(navegador);
    await modalesFicha(navegador);
    await geometria(navegador);
  } finally {
    await navegador?.close();
    apagar();
  }
  console.log(fallos === 0 ? "\nOK: pantallas de la persona tutora verificadas" : `\n${fallos} verificación(es) fallida(s)`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
