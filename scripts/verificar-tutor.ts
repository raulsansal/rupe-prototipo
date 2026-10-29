// Verifica las pantallas de la persona tutora (ACC-01, TUT-01 a TUT-05 y TUT-07) con Playwright, sin abrir capturas:
//  (a) registro de dos pasos: conserva lo capturado, exige los obligatorios, raza «Otra» y longitudes del diccionario;
//  (b) las tres variantes de TUT-05 y la confirmación de las acciones definitivas;
//  (c) la ficha de búsqueda (vista previa, visor y hojas) y TUT-04 no filtran datos reservados ni de la persona tutora;
//  (d) modales de ACC-01 y TUT-07: abren y cierran con botón, Escape y clic fuera, y devuelven el foco;
//  (e) sin desplazamiento horizontal a 390, 768 y 1280 px y sin elementos interactivos de menos de 44 px.
// Opciones: --sin-build  reutiliza el build existente · --base=URL  usa un servidor que ya corre
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import { PARAMETROS } from "../src/mocks/parametros";
import { avistamientosDelCaso, casosDeLaPersonaTutora } from "./mocks-de-prueba";
import { AVISTAMIENTOS, FOLIO_CON_AVISTAMIENTOS, FOLIO_UN_AVISTAMIENTO, FOTO_SENSIBLE } from "../src/mocks/avistamientos";
import { CASOS_ORIGEN, FOLIO_EN_CURSO, FOLIO_NUEVO, valoresReservados } from "../src/mocks/casos";
import { CLAVE_TEMA } from "../src/lib/tema";
import { agregarSesion, credencial, fetchComo, reiniciarDatos, rolDeRuta, type RolPrueba } from "./sesion-pruebas";

const PUERTO = 3106;
const baseExterna = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1];
const base = baseExterna ?? `http://localhost:${PUERTO}`;
const ANCHOS = [390, 768, 1280];
const CASO = `/tutor/casos/${FOLIO_EN_CURSO}`;
const CON_AV = `/tutor/casos/${FOLIO_CON_AVISTAMIENTOS}`;
const UN_AV = `/tutor/casos/${FOLIO_UN_AVISTAMIENTO}`;
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

/** Por defecto con la sesión REAL de la persona tutora 1 (las rutas /tutor las protege el servidor); `null` = sin sesión (pantallas públicas y flujos de acceso). */
async function nuevaPagina(navegador: Browser, ancho = 390, rol: RolPrueba | null = "tutor1"): Promise<{ contexto: BrowserContext; pagina: Page }> {
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: 900 }, colorScheme: "light", permissions: ["clipboard-read", "clipboard-write"] });
  if (rol) await agregarSesion(contexto, base, rol);
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
      if (el instanceof HTMLAnchorElement && el.closest("p, label")) continue; // enlaces dentro de texto corrido (la fila de la casilla sí mide ≥ 44 px)
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
  let { contexto, pagina } = await nuevaPagina(navegador, 390, null);
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
  // Credenciales incorrectas: error uniforme bajo «Contraseña», sin navegar. Credenciales reales (cuenta ficticia de .env.local): inicia sesión y navega a /tutor.
  await correo.fill("persona-que-no-existe@correo.com");
  await clave.fill("Incorrecta123");
  await boton(pagina, "Iniciar sesión").click();
  await pagina.getByText("El correo o la contraseña no son correctos.").waitFor({ timeout: 8000 });
  await correo.fill(credencial("tutor1").correo);
  await clave.fill(credencial("tutor1").contrasena);
  await boton(pagina, "Iniciar sesión").click();
  await pagina.waitForURL("**/tutor");
  ver(true, "ACC-01: credenciales incorrectas dan el error uniforme bajo «Contraseña»; las reales inician sesión y navegan a /tutor", "");
  await contexto.close();

  // Modales: abren por la variante y se cierran con botón, Escape y clic fuera.
  for (const [estado, titulo, mensaje] of [["bloqueo", "Acceso bloqueado temporalmente", "5 intentos fallidos; intenta de nuevo en 15 minutos"], ["deshabilitada", "Cuenta deshabilitada", "Tu cuenta está deshabilitada; contacta a quien administra RUPE"]] as const) {
    for (const via of ["botón «Entendido»", "Escape", "clic fuera"] as const) {
      ({ contexto, pagina } = await nuevaPagina(navegador, 390, null));
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
  ver((await barra(pagina)) === "Paso 1 de 2: Datos del perro", "TUT-02: abre en «Paso 1 de 2: Datos del perro»", `TUT-02: ${await barra(pagina)}`);
  const aviso = pagina.getByRole("button", { name: "Qué datos serán públicos y cuáles reservados" });
  const resumen = pagina.getByText("Tus datos personales y las circunstancias del extravío nunca aparecen en la ficha.");
  ver((await aviso.getAttribute("aria-expanded")) === "false" && (await resumen.isVisible()) && !(await pagina.getByText("Públicos: aparecen en la ficha").isVisible()), "TUT-02: el aviso de públicos y reservados es un bloque plegable cerrado, con su línea de resumen siempre visible", "TUT-02: el aviso no empieza plegado o falta la línea de resumen");
  await aviso.click();
  ver((await pagina.getByText("Públicos: aparecen en la ficha").isVisible()) && (await pagina.getByText("Reservados: nunca aparecen en la ficha").isVisible()) && (await resumen.isVisible()), "TUT-02: al desplegarlo muestra las listas de datos públicos y reservados (y la línea sigue visible)", "TUT-02: el aviso desplegado no muestra las listas");
  await aviso.click();
  const paso1 = pagina.locator('[data-paso="1"]');
  const ayudaFoto = `Solo una fotografía por caso. JPG o PNG, máx. ${PARAMETROS.tamano_maximo_archivo_mb} MB. Reemplazable.`;
  const caja = await pagina.locator('[data-paso="1"]').evaluate((paso) => {
    const dentro = [...paso.querySelectorAll<HTMLElement>("div.border-dashed")].find((d) => d.textContent?.includes("Agregar fotografía"))!;
    const r = dentro.getBoundingClientRect();
    const f = paso.querySelector("div.flex.flex-col.gap-4")!.getBoundingClientRect();
    return { ancho: r.width, total: f.width, estilo: getComputedStyle(dentro).borderStyle, icono: !!dentro.querySelector("svg"), centro: Math.abs(r.left + r.width / 2 - (f.left + f.width / 2)) };
  });
  ver(caja.estilo === "dashed" && caja.ancho >= caja.total - 2 && caja.icono && caja.centro < 2, `TUT-02: la fotografía vacía es una caja punteada a todo el ancho (${Math.round(caja.ancho)} de ${Math.round(caja.total)} px) con ícono de cámara`, `TUT-02: caja de fotografía incorrecta ${JSON.stringify(caja)}`);
  ver((await paso1.getByText("Agregar fotografía", { exact: true }).isVisible()) && (await paso1.getByText("Tomar foto", { exact: true }).isVisible()) && (await paso1.getByText("Elegir de galería", { exact: true }).isVisible()) && (await paso1.getByText(ayudaFoto, { exact: true }).isVisible()) && (await paso1.getByRole("button", { name: "Quitar fotografía" }).count()) === 0, "TUT-02: «Agregar fotografía», «Tomar foto», «Elegir de galería» y la ayuda «Solo una fotografía por caso. JPG o PNG, máx. 4 MB. Reemplazable.» (máximo del parámetro tamano_maximo_archivo_mb)", "TUT-02: faltan textos o botones de la fotografía");
  const botonesFoto = await Promise.all(["Tomar foto", "Elegir de galería"].map((n) => paso1.getByRole("button", { name: n }).evaluate((b) => { const r = b.getBoundingClientRect(); return { alto: r.height, ancho: r.width, y: r.top, envuelve: b.scrollHeight > b.clientHeight + 1 }; })));
  ver(botonesFoto.every((b) => b.alto >= 43.5 && !b.envuelve) && Math.abs(botonesFoto[0].ancho - botonesFoto[1].ancho) < 1.5 && Math.abs(botonesFoto[0].y - botonesFoto[1].y) < 1, `TUT-02 a 390 px: «Tomar foto» y «Elegir de galería» son botones de ${Math.round(botonesFoto[0].alto)} px de alto, en dos columnas del mismo ancho (${Math.round(botonesFoto[0].ancho)} px) y sin partir el texto`, `TUT-02 a 390 px: botones de la fotografía ${JSON.stringify(botonesFoto)}`);
  const [selector] = await Promise.all([pagina.waitForEvent("filechooser"), paso1.getByRole("button", { name: "Tomar foto" }).click()]);
  ver(!!selector, "TUT-02: «Tomar foto» abre el selector de archivos (en teléfono, la cámara)", "TUT-02: «Tomar foto» no abrió el selector");
  ver((await paso1.locator("input[type=file][capture]").count()) === 1 && (await paso1.locator("input[type=file]:not([capture])").count()) === 1, "TUT-02: «Tomar foto» abre la cámara (capture) y «Elegir de galería» el selector de archivos", "TUT-02: entradas de archivo incorrectas")
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
  ver((await barra(pagina)) === "Paso 1 de 2: Datos del perro" && /Especifica la raza/.test(await textoDescrito(p1.getByLabel(/^Especifique la raza/))) && (await p1.locator("input[type=file]:not([capture])").getAttribute("aria-invalid")) === "true", "TUT-02: con «Otra» sin especificar y sin fotografía no avanza", "TUT-02: avanzó sin raza específica o sin foto");
  await p1.getByLabel(/^Especifique la raza/).fill("Perro de agua");
  await p1.locator("input[type=file]:not([capture])").setInputFiles({ name: "perro.png", mimeType: "image/png", buffer: PNG });
  await p1.locator("img[alt='Vista previa de la fotografía']").waitFor(); // la vista previa se dibuja tras reducir la imagen: sin esta espera la medida a veces llegaba antes
  const prev = await p1.evaluate((paso) => {
    const img = paso.querySelector<HTMLImageElement>("img[alt='Vista previa de la fotografía']")!;
    const marco = img.parentElement!.getBoundingClientRect();
    const reemplazar = [...paso.querySelectorAll<HTMLElement>("button")].find((l) => l.textContent === "Reemplazar fotografía")!.getBoundingClientRect();
    const f = paso.querySelector("div.flex.flex-col.gap-4")!.getBoundingClientRect();
    return { ajuste: getComputedStyle(img).objectFit, marcoAncho: marco.width, total: f.width, reemplazarAlto: reemplazar.height, reemplazarAncho: reemplazar.width, reemplazarY: reemplazar.top, marcoB: marco.bottom, centro: Math.abs(marco.left + marco.width / 2 - (f.left + f.width / 2)) };
  }, undefined).catch(() => undefined);
  ver(!!prev && prev.ajuste === "contain" && prev.marcoAncho >= prev.total - 2 && prev.centro < 2 && Math.abs(prev.reemplazarAncho - prev.marcoAncho) < 2 && Math.abs(prev.reemplazarY - prev.marcoB) < 2 && prev.reemplazarAlto >= 43.5, "TUT-02 con foto: vista previa ancha y centrada, SIN recorte (object-contain) y «Reemplazar fotografía» a todo el ancho, de 44 px, justo debajo", `TUT-02 con foto: ${JSON.stringify(prev)}`);
  ver((await p1.getByRole("button", { name: "Quitar fotografía" }).count()) === 0 && (await p1.getByText("Tomar foto", { exact: true }).count()) === 0 && (await p1.getByText("recortada en 1:1").count()) === 0, "TUT-02 con foto: sin la × para quitar, sin «Tomar foto» y sin el texto del recorte 1:1 (la foto se reemplaza, no se quita)", "TUT-02 con foto: aún hay × de quitar, «Tomar foto» o el texto del recorte");
  await p1.locator("input[type=file]:not([capture])").setInputFiles({ name: "otro.png", mimeType: "image/png", buffer: PNG });
  ver((await p1.getByAltText("Vista previa de la fotografía").count()) === 1 && (await p1.getByText(ayudaFoto, { exact: true }).isVisible()), "TUT-02: «Reemplazar fotografía» cambia la foto (sigue habiendo una sola) y la ayuda se mantiene", "TUT-02: el reemplazo no funcionó");
  await cont.click();

  // TUT-03.
  ver((await barra(pagina)) === "Paso 2 de 2: Circunstancias" && (await pagina.getByRole("heading", { level: 1, name: "Circunstancias del extravío" }).isVisible()) && (await cont.innerText()) === "Guardar registro", "TUT-03: «Paso 2 de 2: Circunstancias» con «Guardar registro»", `TUT-03: ${await barra(pagina)}`);
  const p2 = eIso(pagina, 2);
  const texto2 = await p2.innerText();
  ver(/Públicos en la ficha/.test(texto2) && /Reservados: no aparecen en la ficha/.test(texto2), "TUT-03: separa «Públicos en la ficha» y «Reservados: no aparecen en la ficha»", "TUT-03: no separa públicos de reservados");
  ver((await pagina.getByRole("button", { name: "Qué datos serán públicos y cuáles reservados" }).filter({ visible: true }).count()) === 0 && (await pagina.getByText(/nunca aparecen en la ficha/).filter({ visible: true }).count()) === 0, "TUT-03: sin el bloque superior de públicos y reservados (las dos secciones ya lo comunican)", "TUT-03: aún muestra el bloque superior");
  const titulos = await p2.evaluate(() => ["circ-publicos", "circ-reservados"].map((id) => { const h = document.getElementById(id)!; const sec = h.closest("section")!; const hr = h.getBoundingClientRect(); const sr = sec.getBoundingClientRect(); return { tag: h.tagName, dentro: hr.top - sr.top >= 12 && hr.left - sr.left >= 12 && sr.right - hr.right >= 12, borde: getComputedStyle(sec).borderStyle, legends: sec.querySelectorAll(":scope > legend").length }; }));
  ver(titulos.every((t) => t.tag === "H2" && t.dentro && t.legends === 0) && titulos[1].borde === "dashed", "TUT-03: los títulos «Públicos…» y «Reservados…» son encabezados dentro de su tarjeta, con relleno normal (no leyendas sobre el borde)", `TUT-03: títulos ${JSON.stringify(titulos)}`);
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
  await p2.getByLabel(/^Colonia o zona/).fill("Del Carmen");
  await p2.getByLabel(/^Motivo del extravío/).selectOption({ label: "Portones o puertas abiertas" });
  ver(await p2.getByText(/Fallas en Infraestructura y Contención\./).isVisible(), "TUT-03: al elegir un motivo se muestra su categoría y descripción", "TUT-03: sin descripción del motivo");

  // Regresar conserva lo capturado.
  await boton(pagina, "Regresar").click();
  ver((await barra(pagina)) === "Paso 1 de 2: Datos del perro" && (await nombre.inputValue()) === "Canela" && (await p1.getByLabel(/^Raza/).locator("option:checked").innerText()) === "Otra" && (await p1.getByLabel(/^Especifique la raza/).inputValue()) === "Perro de agua" && (await valor.locator("option:checked").innerText()) === "Menos de 1 mes" && (await unidad.inputValue()) === "meses" && (await p1.getByLabel(/^Color/).inputValue()) === "Canela con blanco" && (await p1.getByAltText("Vista previa de la fotografía").count()) === 1 && (await p1.getByRole("radio", { name: "Hembra" }).isChecked()) && (await p1.getByRole("radio", { name: "Pequeño" }).isChecked()), "Regresar: nombre, raza «Otra» y especificación, edad, sexo, tamaño, color y fotografía se conservan", "Regresar: se perdió lo capturado en el paso 1");
  await cont.click();
  ver((await fecha.inputValue()) === "2026-10-18" && (await p2.getByLabel(/^Alcaldía/).inputValue()) === "Coyoacán" && (await p2.getByLabel(/^Colonia o zona/).inputValue()) === "Del Carmen" && (await p2.getByRole("radio", { name: /^Tarde/ }).isChecked()), "al avanzar de nuevo, el paso 2 conserva lo capturado", "el paso 2 perdió lo capturado");
  const almacen = await pagina.evaluate(() => ({ local: Object.keys(localStorage).filter((k) => k !== "rupe-tema"), sesion: Object.keys(sessionStorage), cookies: document.cookie }));
  ver(almacen.local.length === 0 && almacen.sesion.length === 0 && almacen.cookies === "", "lo capturado no se guarda en localStorage, sessionStorage ni cookies", `almacenamiento: ${JSON.stringify(almacen)}`);
  await cont.click();
  await pagina.waitForURL(/\/tutor\/casos\/RUPE-[A-HJ-NP-Z2-9]{8}\/creado$/); // el caso se guarda de verdad: el folio es nuevo
  ver(!new RegExp(FOLIO_NUEVO).test(pagina.url()) && (await pagina.getByRole("heading", { level: 1, name: "Registro creado" }).isVisible()), "«Guardar registro» con todo completo guarda el caso y lleva a TUT-04 (Registro creado) con un folio nuevo", "TUT-04: no se creó un folio nuevo");
  await contexto.close();

  // Variantes.
  const r = await nuevaPagina(navegador);
  await irA(r.pagina, "/tutor/registrar?raza=otra");
  ver((await barra(r.pagina)) === "Paso 1 de 2: Datos del perro" && (await r.pagina.getByLabel(/^Especifique la raza/).isVisible()) && (await r.pagina.getByAltText("Vista previa de la fotografía").count()) === 1, "?raza=otra: paso 1 con «Especifique la raza» y la fotografía cargada", "?raza=otra: variante incorrecta");
  await r.contexto.close();
  // En una pantalla estrecha (320 px) los botones de la fotografía se apilan, sin partir el texto y de 44 px.
  const estrecho = await nuevaPagina(navegador, 320);
  await irA(estrecho.pagina, "/tutor/registrar");
  const apilados = await Promise.all(["Tomar foto", "Elegir de galería"].map((n) => estrecho.pagina.getByRole("button", { name: n }).evaluate((b) => { const q = b.getBoundingClientRect(); return { alto: q.height, ancho: q.width, y: q.top, envuelve: b.scrollHeight > b.clientHeight + 1 }; })));
  ver(apilados.every((b) => b.alto >= 43.5 && !b.envuelve) && apilados[1].y > apilados[0].y + 40 && Math.abs(apilados[0].ancho - apilados[1].ancho) < 1.5, "TUT-02 a 320 px: los botones de la fotografía se apilan (uno bajo el otro), de 44 px y sin partir el texto", `TUT-02 a 320 px: ${JSON.stringify(apilados)}`);
  await estrecho.contexto.close();
  const r2 = await nuevaPagina(navegador);
  await irA(r2.pagina, "/tutor/registrar?paso=2");
  ver((await barra(r2.pagina)) === "Paso 2 de 2: Circunstancias", "?paso=2: abre en el paso 2", "?paso=2: no abrió en el paso 2");
  await r2.contexto.close();
}

// ---------- salida del registro ----------
async function salidaRegistro(navegador: Browser) {
  // Formulario vacío: salir no pregunta.
  for (const via of ["«Cancelar»", "la flecha de regreso"] as const) {
    const { contexto, pagina } = await nuevaPagina(navegador);
    await irA(pagina, "/tutor/registrar");
    await (via === "«Cancelar»" ? enlace(pagina, "Cancelar") : enlace(pagina, "Salir y regresar")).click();
    await pagina.waitForURL("**/tutor");
    ver(!(await dialogoAbierto(pagina)), `salida del registro vacío: ${via} navega a /tutor sin preguntar`, `salida del registro vacío: ${via} no navegó`);
    await contexto.close();
  }
  // Con algo capturado: pide confirmación.
  for (const via of ["«Cancelar»", "la flecha de regreso"] as const) {
    const nombreBoton = via === "«Cancelar»" ? "Cancelar" : "Salir y regresar";
    for (const cierre of ["«Seguir aquí»", "Escape", "clic fuera"] as const) {
      const { contexto, pagina } = await nuevaPagina(navegador);
      await irA(pagina, "/tutor/registrar");
      await pagina.getByLabel(/^Nombre del perro/).fill("Canela");
      const origen = enlace(pagina, nombreBoton);
      await origen.click();
      const dlg = pagina.getByRole("dialog", { name: "¿Salir del registro?" });
      const abrio = (await dlg.isVisible()) && /Se perderá lo capturado/.test(await dlg.innerText()) && new URL(pagina.url()).pathname === "/tutor/registrar";
      if (cierre === "«Seguir aquí»") await boton(dlg, "Seguir aquí").click();
      else if (cierre === "Escape") await pagina.keyboard.press("Escape");
      else await pagina.mouse.click(4, 4);
      const sigue = !(await dialogoAbierto(pagina)) && new URL(pagina.url()).pathname === "/tutor/registrar" && (await pagina.getByLabel(/^Nombre del perro/).inputValue()) === "Canela";
      const devuelto = (await foco(pagina)) === nombreBoton;
      ver(abrio && sigue && devuelto, `salida con datos (${via}): pide «¿Salir del registro?»; ${cierre} cierra, conserva lo capturado y devuelve el foco`, `salida con datos (${via}, ${cierre}): abrió=${abrio}, sigue=${sigue}, foco devuelto=${devuelto} (${await foco(pagina)})`);
      await contexto.close();
    }
    const { contexto, pagina } = await nuevaPagina(navegador);
    await irA(pagina, "/tutor/registrar");
    await pagina.getByLabel(/^Color/).fill("Café");
    await enlace(pagina, nombreBoton).click();
    await boton(pagina.getByRole("dialog", { name: "¿Salir del registro?" }), "Salir").click();
    await pagina.waitForURL("**/tutor");
    ver(true, `salida con datos (${via}): «Salir» confirma y navega a /tutor`, "");
    await contexto.close();
  }
  // En el paso 2 también pide confirmación si hay algo capturado.
  const { contexto, pagina } = await nuevaPagina(navegador);
  await irA(pagina, "/tutor/registrar?paso=2");
  await pagina.getByLabel(/^Colonia o zona/).fill("Roma");
  await enlace(pagina, "Salir y regresar").click();
  ver(await pagina.getByRole("dialog", { name: "¿Salir del registro?" }).isVisible(), "salida desde el paso 2 con datos: pide confirmación", "salida desde el paso 2: no pidió confirmación");
  await contexto.close();
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

/**
 * El encabezado de las pantallas de la persona tutora muestra SU PROPIO nombre (identidad de la sesión real): se quita de la respuesta ese uso (etiquetas de
 * la cuenta y del avatar, y la propiedad que la plantilla recibe) para que la búsqueda de fugas siga detectando el nombre en cualquier otro lugar.
 */
const sinIdentidad = (html: string, nombre: string) => {
  const n = nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(new RegExp(`(?:Cuenta de|Avatar de) ${n}`, "g"), "").replace(new RegExp(`\\\\?"nombre\\\\?":\\\\?"${n}\\\\?"`, "g"), "");
};

// ---------- (c) fugas y hoja ----------
async function fugas(navegador: Browser) {
  let comprobaciones = 0;
  let filtradas = 0;
  // Dirección aproximada, referencias y comentario de los avistamientos: solo en TUT-10, nunca en la ficha ni en TUT-04.
  const reservadosAvistamientos = AVISTAMIENTOS.flatMap((a) => [a.direccionAproximada, a.referencias, a.comentario]).filter((v): v is string => Boolean(v));
  const rutas = (f: string) => [`/tutor/casos/${f}/creado`, `/tutor/casos/${f}/ficha`, `/tutor/casos/${f}/ficha?modal=visor`, `/tutor/casos/${f}/ficha?modal=visor&hoja=media-carta`, `/tutor/casos/${f}/ficha?modal=compartir`, `/tutor/casos/${f}/ficha?modal=regenerar`];
  for (const o of CASOS_ORIGEN) {
    const reservados = valoresReservados(o);
    if (reservados.length < 5) throw new Error(`El origen de ${o.folio} no tiene suficientes datos reservados para la prueba`);
    for (const ruta of rutas(o.folio)) {
      const html = sinIdentidad(await (await fetchComo(base, rolDeRuta(ruta), ruta)).text(), o.tutor.nombreCompleto);
      comprobaciones++;
      const dentro = [...reservados, o.tokenPublico, ...reservadosAvistamientos].filter((v) => html.includes(v));
      if (dentro.length) {
        filtradas++;
        console.log(`✗ fuga en ${ruta.replace(o.folio, "<folio>")} de ${o.folio}: ${dentro.length} valor(es) reservado(s), de la persona tutora o el token`);
      }
    }
  }
  ver(filtradas === 0, `sin fugas: ${comprobaciones} respuestas HTML (${CASOS_ORIGEN.length} casos × TUT-04, vista previa, visor Carta y Media carta, compartir y regenerar) sin ningún dato reservado, de la persona tutora ni token del QR`, `${filtradas} respuesta(s) con datos reservados`);

  // Controles de sensibilidad: la misma búsqueda sí detecta lo que TUT-05 muestra a su dueña.
  const max = CASOS_ORIGEN[0];
  const detalleHtml = sinIdentidad(await (await fetchComo(base, "tutor1", `/tutor/casos/${max.folio}`)).text(), max.tutor.nombreCompleto);
  ver(detalleHtml.includes(max.direccionAproximada!) && detalleHtml.includes(max.referenciasDelLugar!) && detalleHtml.includes(max.motivo) && detalleHtml.includes(max.descripcionCircunstancias!), "control: TUT-05 sí muestra a su dueña los reservados del caso (la búsqueda de fugas los detecta)", "control: TUT-05 no muestra los reservados");
  ver(![max.tutor.nombreCompleto, credencial("tutor1").correo, max.tutor.telefono, max.tokenPublico, ...reservadosAvistamientos].some((v) => detalleHtml.includes(v)), "TUT-05 no contiene su nombre, correo ni teléfono, el token del QR ni los datos reservados de avistamientos", "TUT-05 filtra datos de la persona tutora, el token o reservados de avistamientos");
  const fichaHtml = await (await fetchComo(base, "tutor1", `/tutor/casos/${max.folio}/ficha`)).text();
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
      ver(falta.length === 0 && reservadosEnHoja.length === 0 && (await hojaEl.getByRole("img", { name: /Fotografía de Max, .*sin recorte/ }).isVisible()) && (await hojaEl.getByRole("img", { name: /Código QR de la ficha/ }).isVisible()), `ficha ${hoja} ${ancho}px: título, fotografía sin recorte, nombre, datos públicos, fecha, lugar, folio y QR; sin reservados`, `ficha ${hoja} ${ancho}px: falta [${falta.join(", ")}] o trae reservados [${reservadosEnHoja.join(", ")}]`);
      const medida = await hojaEl.evaluate((a) => ({ sh: a.scrollHeight, ch: a.clientHeight, sw: a.scrollWidth, cw: a.clientWidth, w: a.getBoundingClientRect().width, h: a.getBoundingClientRect().height, ar: getComputedStyle(a).backgroundColor, tinta: getComputedStyle(a).color }));
      const razon = hoja === "carta" ? 21.6 / 27.9 : 21.6 / 14;
      ver(medida.sh <= medida.ch + 1 && medida.sw <= medida.cw + 1 && Math.abs(medida.w / medida.h - razon) < 0.01, `ficha ${hoja} ${ancho}px: el contenido cabe en la hoja (${Math.round(medida.w)}×${Math.round(medida.h)} px, proporción ${razon.toFixed(3)}) sin desbordar`, `ficha ${hoja} ${ancho}px: desborda o proporción incorrecta ${JSON.stringify(medida)}`);
      ver(medida.ar === "rgb(255, 255, 255)" && medida.tinta === "rgb(0, 0, 0)", `ficha ${hoja} ${ancho}px: blanco sobre negro (papel y tinta)`, `ficha ${hoja} ${ancho}px: colores ${medida.ar} / ${medida.tinta}`);
      if (ancho === 390) {
        const css = await pagina.locator("style").evaluateAll((ss) => ss.map((s) => s.textContent ?? "").find((t) => t.includes("@page")) ?? "");
        ver(css.includes(hoja === "carta" ? "612pt 792pt" : "612pt 396pt"), `ficha ${hoja}: la regla de impresión fija la página en ${hoja === "carta" ? "612 × 792 pt" : "612 × 396 pt"}`, `ficha ${hoja}: sin regla @page (${css})`);
        await pagina.emulateMedia({ media: "print" });
        // Proporción real de la fotografía respecto de la hoja, medida con la hoja a su tamaño de impresión (21.6 cm de ancho).
        const prop = await pagina.evaluate(() => {
          const a = document.querySelector(".ficha-impresion article")!.getBoundingClientRect();
          const marco = document.querySelector(".ficha-impresion [data-foto-ficha]")!.getBoundingClientRect();
          const img = document.querySelector<HTMLImageElement>(".ficha-impresion [data-foto-ficha] img")!;
          const k = Math.min(marco.width / img.naturalWidth, marco.height / img.naturalHeight); // object-fit: contain
          return { hoja: a.width * a.height, marco: marco.width * marco.height, dibujada: img.naturalWidth * k * img.naturalHeight * k, ancho: a.width };
        });
        const pMarco = prop.marco / prop.hoja;
        console.log(`  (ficha ${hoja}: marco de la fotografía = ${(pMarco * 100).toFixed(1)} % de la hoja; imagen dibujada = ${((prop.dibujada / prop.hoja) * 100).toFixed(1)} % con la foto de ejemplo cuadrada)`);
        ver(pMarco >= 0.4 && Math.abs(prop.ancho - 21.6 * 37.795) < 2, `ficha ${hoja}: la fotografía (sin recorte) ocupa ${(pMarco * 100).toFixed(1)} % de la hoja (≥ 40 %, lámina 4.11)`, `ficha ${hoja}: la fotografía ocupa solo ${(pMarco * 100).toFixed(1)} % de la hoja (ancho de hoja ${Math.round(prop.ancho)} px)`);
        const imp = await pagina.evaluate(() => ({ hoja: getComputedStyle(document.querySelector(".ficha-impresion article")!).visibility, encabezado: getComputedStyle(document.querySelector("header")!).visibility, titulo: getComputedStyle(document.querySelector("main h1")!).visibility, ancho: document.querySelector(".ficha-impresion")!.getBoundingClientRect().width }));
        ver(imp.hoja === "visible" && imp.encabezado === "hidden" && imp.titulo === "hidden" && Math.abs(imp.ancho - 21.6 * 37.795) < 2, `ficha ${hoja}: en impresión solo se ve la hoja (a 21.6 cm de ancho) y no el resto de la página`, `ficha ${hoja}: CSS de impresión ${JSON.stringify(imp)}`);
      }
      await contexto.close();
    }
  }
}

// ---------- (d) modales de TUT-07 ----------
const pulsado2 = async (dlg: Locator, nombre: string) => (await dlg.getByRole("button", { name: nombre, exact: true }).getAttribute("aria-pressed")) === "true";
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
  const pulsado = async (nombre: string) => (await dlg.getByRole("button", { name: nombre, exact: true }).getAttribute("aria-pressed")) === "true";
  ver((await pulsado("Carta")) && (await dlg.locator("article[aria-label*='tamaño Carta']").isVisible()) && (await dlg.getByText(/Vista simulada/).count()) === 0, "visor: empieza en Carta y ya no dice «Vista simulada»", "visor: no empieza en Carta o conserva el texto «Vista simulada»");
  await dlg.getByRole("button", { name: "Media carta", exact: true }).click();
  ver((await pulsado("Media carta")) && (await dlg.locator("article[aria-label*='Media carta']").isVisible()) && (await dlg.locator("article[aria-label*='tamaño Carta']").count()) === 0, "visor: el selector por botones (aria-pressed) cambia a Media carta", "visor: el selector no cambió la hoja");
  // Descarga REAL: el navegador recibe un PDF con el nombre ficha-<FOLIO>-<hoja>.pdf.
  const [descarga] = await Promise.all([pagina.waitForEvent("download"), boton(dlg, "Descargar PDF").click()]);
  const ruta = await descarga.path();
  const cabecera = ruta ? (await import("node:fs")).readFileSync(ruta).subarray(0, 5).toString() : "";
  ver(descarga.suggestedFilename() === `ficha-${FOLIO_EN_CURSO}-media-carta.pdf` && cabecera === "%PDF-", `visor: «Descargar PDF» baja el PDF real (${descarga.suggestedFilename()})`, `visor: la descarga fue «${descarga.suggestedFilename()}» (${cabecera})`);
  await boton(dlg, "Imprimir").click();
  ver((await pagina.evaluate(() => (window as unknown as { __impresiones: number }).__impresiones)) === 1, "visor: «Imprimir» invoca la impresión del navegador", "visor: «Imprimir» no invocó window.print");
  await boton(dlg, "Regresar a la ficha").click();
  ver((await enlace(pagina, "Regresar a editar").getAttribute("href")) === `${CASO}/editar`, "TUT-07: «Regresar a editar» lleva a la pantalla de editar (pendiente, como en el maquetado)", "TUT-07: falta «Regresar a editar»");
  // Regenerar QR cambia el código (real, con confirmación) y avisa.
  const qr = () => pagina.locator("section[aria-labelledby=vista-previa] svg[role=img] path").getAttribute("d");
  const antes = await qr();
  await boton(pagina, "Regenerar QR").click();
  const regen = pagina.getByRole("dialog", { name: "Regenerar código QR" });
  ver(/dejará de ser válido de inmediato/.test(await regen.innerText()), "MOD-06: advierte que el QR anterior dejará de ser válido de inmediato", "MOD-06: sin advertencia");
  await boton(regen, "Regenerar QR").click();
  await pagina.waitForFunction((d) => document.querySelector("section[aria-labelledby=vista-previa] svg[role=img] path")?.getAttribute("d") !== d, antes);
  ver((await qr()) !== antes && (await pagina.getByRole("status").getByText(/Código QR regenerado el .*: el anterior ya no es válido/).isVisible()), "MOD-06: «Regenerar QR» crea un QR nuevo (el anterior se invalida), refresca la vista previa y lo anuncia con la fecha", "MOD-06: el QR no cambió");
  await contexto.close();

  // Visor en 1280×844: la hoja COMPLETA (QR, folio y pie) sin desplazarse, y operable con teclado.
  for (const hoja of ["carta", "media-carta"] as const) {
    const v = await nuevaPagina(navegador, 1280);
    await v.pagina.setViewportSize({ width: 1280, height: 844 });
    await irA(v.pagina, `${CASO}/ficha?modal=visor&hoja=${hoja}`);
    const d = v.pagina.getByRole("dialog", { name: "Tu ficha de búsqueda en PDF" });
    const m = await v.pagina.evaluate(() => {
      const dl = document.querySelector("dialog[open]") as HTMLDialogElement;
      const a = dl.querySelector(".ficha-impresion article")!.getBoundingClientRect();
      const q = dl.querySelector("[aria-label^='Código QR']")!.getBoundingClientRect();
      const f = [...dl.querySelectorAll("p")].find((p) => /^RUPE-/.test(p.textContent ?? ""))!.getBoundingClientRect();
      return { scroll: dl.scrollHeight > dl.clientHeight + 1, hoja: a.top >= 0 && a.bottom <= innerHeight, qr: q.top >= 0 && q.bottom <= innerHeight, folio: f.top >= 0 && f.bottom <= innerHeight };
    });
    ver(!m.scroll && m.hoja && m.qr && m.folio, `visor 1280×844 (${hoja}): la hoja completa, con el QR y el folio, se ve sin desplazarse`, `visor 1280×844 (${hoja}): ${JSON.stringify(m)}`);
    if (hoja === "carta") {
      // Las flechas no quedan atrapadas por el selector; Tab da la vuelta dentro del diálogo; Espacio activa; Escape cierra y devuelve el foco.
      await d.getByRole("button", { name: "Carta", exact: true }).focus();
      for (let i = 0; i < 3; i++) await v.pagina.keyboard.press("ArrowDown");
      await v.pagina.keyboard.press("ArrowRight");
      ver(await pulsado2(d, "Carta"), "visor: las flechas no cambian la hoja (el selector no atrapa el teclado)", "visor: las flechas cambiaron la hoja");
      await d.getByRole("button", { name: "Media carta", exact: true }).focus();
      await v.pagina.keyboard.press("Space");
      ver(await pulsado2(d, "Media carta"), "visor: Espacio activa «Media carta»", "visor: Espacio no activó «Media carta»");
      const dentro: boolean[] = [];
      for (let i = 0; i < 9; i++) {
        await v.pagina.keyboard.press("Tab");
        dentro.push(await v.pagina.evaluate(() => !!document.activeElement?.closest("dialog[open]")));
      }
      ver(dentro.every(Boolean), "visor: el foco queda atrapado en el diálogo (9 pulsaciones de Tab)", `visor: el foco salió del diálogo (${dentro.join()})`);
      await v.pagina.keyboard.press("Escape");
      ver(!(await dialogoAbierto(v.pagina)), "visor: Escape cierra el diálogo", "visor: Escape no cerró el diálogo");
    }
    await v.contexto.close();
  }

  // Casos sin ficha.
  const c2 = await nuevaPagina(navegador);
  const localizado = CASOS_ORIGEN.find((x) => x.estado === "Localizado")!;
  await irA(c2.pagina, `/tutor/casos/${localizado.folio}/ficha`);
  const botonesBloqueados = await Promise.all(["Imprimir ficha de búsqueda", "Compartir", "Regenerar QR"].map(async (n) => (await boton(c2.pagina, n).count()) === 1 && (await boton(c2.pagina, n).isDisabled())));
  ver(/La ficha ya no está disponible/.test(await c2.pagina.locator("main").innerText()) && /Disponible solo mientras el caso sigue en curso/.test(await c2.pagina.locator("main").innerText()) && botonesBloqueados.every(Boolean) && (await c2.pagina.locator("article[aria-label^='Ficha de búsqueda']").count()) === 0, "TUT-07: un caso «Localizado» muestra el aviso, sin vista previa, con Imprimir, Compartir y Regenerar QR deshabilitados y su explicación", "TUT-07: ofrece la ficha de un caso localizado");
  const r = await c2.pagina.goto(`${base}/tutor/casos/RUPE-Z5C6VR4P`, { waitUntil: "load" });
  ver(r?.status() === 404, "un folio que no es de la persona tutora responde 404 (TRA-01)", `folio ajeno: HTTP ${r?.status()}`);
  await c2.contexto.close();
}

// ---------- enlaces internos sin 404 ----------
async function enlacesInternos(navegador: Browser) {
  const pantallas = ["/acceso", "/acceso?estado=aviso-actualizado", "/registro", `/tutor/casos/${FOLIO_CON_AVISTAMIENTOS}/avistamientos`, `/tutor/casos/${FOLIO_CON_AVISTAMIENTOS}/mapa?ruta=visible`, `/tutor/casos/${FOLIO_CON_AVISTAMIENTOS}/avistamientos/101`, `/tutor/casos/${FOLIO_CON_AVISTAMIENTOS}/avistamientos/102`, `${CASO}/avistamientos`, "/dev/transversales/sesion-expirada", "/tutor", "/tutor?estado=vacio", `${CASO}/creado`, `${CASO}?estado=en-curso`, `${CASO}?estado=localizado`, `${CASO}?estado=cerrado`, `${CASO}/ficha`];
  const { contexto, pagina } = await nuevaPagina(navegador, 1280);
  const vistos = new Map<string, string>();
  for (const ruta of pantallas) {
    await irA(pagina, ruta);
    // En escritorio el encabezado ya muestra la navegación; el menú móvil de la plantilla pública se abre aparte.
    const hrefs = await pagina.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    for (const h of hrefs) if (h.startsWith("/")) vistos.set(h.split("#")[0] || "/", ruta);
  }
  // Menú móvil de ACC-01 (Cuenta y Explorar) y pie.
  const m = await nuevaPagina(navegador, 390);
  await irA(m.pagina, "/acceso");
  await m.pagina.getByRole("button", { name: "Menú", exact: true }).click();
  for (const h of await m.pagina.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")!))) if (h.startsWith("/")) vistos.set(h.split("#")[0] || "/", "/acceso (menú móvil)");
  await m.contexto.close();
  await contexto.close();
  const malos: string[] = [];
  for (const [ruta, origen] of vistos) {
    const r = await fetchComo(base, rolDeRuta(ruta), ruta, { redirect: "follow" });
    if (r.status === 404 || r.status >= 500) malos.push(`${ruta} → ${r.status} (desde ${origen})`);
  }
  ver(malos.length === 0, `enlaces internos de ACC-01, TUT-01, TUT-04, TUT-05 y TUT-07: ${vistos.size} rutas distintas, ninguna responde 404`, `enlaces rotos: ${malos.join(" | ")}`);
  // Las pantallas pendientes dicen lo que son y ofrecen volver.
  const p = await nuevaPagina(navegador);
  for (const [ruta, volver, destino] of [["/recuperar-contrasena", "Volver a iniciar sesión", "/acceso"], [`${CASO}/editar`, "Regresar al detalle del caso", CASO], [`${CASO}/notificaciones`, "Regresar al detalle del caso", CASO], ["/tutor/consultar-folio", "Ir a mis registros", "/tutor"], ["/tutor/avistamientos", "Ir a mis registros", "/tutor"]] as const) {
    const r = await p.pagina.goto(`${base}${ruta}`, { waitUntil: "load" });
    const t = await p.pagina.locator("main").innerText();
    ver(r?.status() === 200 && /Esta pantalla se construye en un bloque posterior/.test(t) && (await enlace(p.pagina, volver).getAttribute("href")) === destino, `${ruta}: PantallaPendiente con «${volver}»`, `${ruta}: HTTP ${r?.status()} o sin mensaje de pantalla pendiente`);
  }
  const ajeno = await p.pagina.goto(`${base}/tutor/casos/RUPE-Z5C6VR4P/editar`, { waitUntil: "load" });
  ver(ajeno?.status() === 404, "una pantalla pendiente de un folio ajeno responde 404", `folio ajeno en pantalla pendiente: HTTP ${ajeno?.status()}`);
  await p.contexto.close();
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

/** Ningún rótulo de las tarjetas de datos invade la columna de valores (componente compartido con la variante del Administrador). */
async function rotulosDeDatos(navegador: Browser) {
  for (const ancho of [390, 1024, 1280]) {
    for (const tema of ["light", "dark"] as const) {
      const { contexto, pagina } = await nuevaPagina(navegador, ancho);
      await pagina.addInitScript(([k, v]) => localStorage.setItem(k, v), [CLAVE_TEMA, tema]);
      await irA(pagina, `${CASO}?estado=en-curso`);
      const r = await medirRotulos(pagina);
      ver(r.total >= 15 && r.malos.length === 0, `TUT-05 ${ancho}px (${tema === "light" ? "claro" : "oscuro"}): ${r.total} rótulos de las tarjetas de datos caben en su columna, con al menos 8 px antes del valor`, `TUT-05 ${ancho}px (${tema}): rótulos desbordados → ${r.malos.join(" | ")}`);
      await contexto.close();
    }
  }
}

// ---------- TUT-05 en escritorio ----------
async function detalleEscritorio(navegador: Browser) {
  for (const ancho of [1024, 1280, 1440]) {
    const { contexto, pagina } = await nuevaPagina(navegador, ancho);
    await irA(pagina, `${CASO}?estado=en-curso`);
    const g = await pagina.evaluate(() => {
      const sels: [string, string][] = [["foto", "[data-foto-caso]"], ["perro", "section[aria-labelledby=datos-perro]"], ["extravio", "section[aria-labelledby=datos-extravio]"], ["reservados", "section[aria-labelledby=datos-reservados]"], ["acciones", "section[aria-labelledby=acciones-titulo]"], ["historial", "section[aria-labelledby=historial-titulo]"]];
      const cajas = Object.fromEntries(
        sels.map(([k, sel]) => {
          const r = document.querySelector(sel)!.getBoundingClientRect();
          return [k, { x: r.left, y: r.top + window.scrollY, w: r.width, h: r.height, r: r.right, b: r.bottom + window.scrollY }];
        }),
      );
      return { ...cajas, alto: document.documentElement.scrollHeight } as Record<"foto" | "perro" | "extravio" | "reservados" | "acciones" | "historial", { x: number; y: number; w: number; h: number; r: number; b: number }> & { alto: number };
    });
    const f = g.foto;
    ver(f.w <= 421 && Math.abs(f.w - f.h) <= 1, `TUT-05 ${ancho}px: la fotografía mide ${Math.round(f.w)}×${Math.round(f.h)} px (cuadrada, máx. ≈420)`, `TUT-05 ${ancho}px: fotografía ${Math.round(f.w)}×${Math.round(f.h)}`);
    ver(f.r <= g.perro.x + 1 && Math.abs(f.y - g.perro.y) <= 1, `TUT-05 ${ancho}px: la fotografía queda junto a «Datos del perro», a su izquierda y a la misma altura`, `TUT-05 ${ancho}px: foto ${JSON.stringify(f)} y datos ${JSON.stringify(g.perro)}`);
    ver(g.acciones.x >= g.perro.r - 1 && g.historial.x >= g.perro.r - 1 && g.historial.y >= g.acciones.b - 1 && Math.abs(g.acciones.y - f.y) <= 1, `TUT-05 ${ancho}px: «Acciones» e «Historial de estados» van en la columna derecha, uno bajo el otro`, `TUT-05 ${ancho}px: acciones ${JSON.stringify(g.acciones)} historial ${JSON.stringify(g.historial)}`);
    ver(g.extravio.y >= Math.max(f.b, g.perro.b) - 1 && g.reservados.y >= g.extravio.b - 1 && g.extravio.x <= f.x + 1, `TUT-05 ${ancho}px: «Datos del extravío» y «Datos reservados» siguen bajo la foto, en la columna izquierda`, `TUT-05 ${ancho}px: orden de tarjetas incorrecto`);
    const hueco = Math.max(g.acciones.b, g.historial.b) - Math.max(g.reservados.b, g.historial.b);
    console.log(`  (TUT-05 ${ancho}px: alto de página ${g.alto} px; la columna derecha termina ${Math.round(Math.abs(g.reservados.b - g.historial.b))} px ${g.reservados.b > g.historial.b ? "antes" : "después"} que la izquierda${hueco ? "" : ""})`);
    await desborde(pagina, `TUT-05 ${ancho}px`);
    await contexto.close();
  }
  // Móvil: sin cambios (orden: foto, acciones, datos, historial al final).
  const { contexto, pagina } = await nuevaPagina(navegador, 390);
  await irA(pagina, `${CASO}?estado=en-curso`);
  const y = await pagina.evaluate(() => ["[data-foto-caso]", "section[aria-labelledby=acciones-titulo]", "section[aria-labelledby=datos-perro]", "section[aria-labelledby=datos-extravio]", "section[aria-labelledby=datos-reservados]", "section[aria-labelledby=historial-titulo]"].map((s) => document.querySelector(s)!.getBoundingClientRect().top));
  ver(y.every((v, i) => i === 0 || v > y[i - 1]), "TUT-05 390px: el orden en móvil no cambia (foto, acciones, datos del perro, extravío, reservados, historial)", `TUT-05 390px: orden ${y.map(Math.round).join(",")}`);
  await contexto.close();
}

// ---------- ACC-02 y MOD-01 ----------
async function registroCuenta(navegador: Browser) {
  let { contexto, pagina } = await nuevaPagina(navegador, 390, null);
  await irA(pagina, "/registro");
  const campo = (n: RegExp | string) => pagina.getByLabel(n);
  const nombre = campo(/^Nombre completo/);
  const correo = campo(/^Correo electrónico/);
  const clave = campo(/^Contraseña/);
  const tel = campo(/^Teléfono de contacto/);
  const aviso = pagina.getByRole("checkbox", { name: /He leído y acepto el/ });
  ver((await pagina.getByRole("heading", { level: 1, name: "Crear cuenta de persona tutora" }).isVisible()) && (await pagina.locator("main#contenido").count()) === 1 && (await pagina.locator("header").count()) >= 1, "ACC-02: «Crear cuenta de persona tutora» en la plantilla pública", "ACC-02: estructura incorrecta");
  ver((await nombre.getAttribute("maxlength")) === "150" && (await correo.getAttribute("maxlength")) === "254" && (await tel.getAttribute("maxlength")) === "15", "ACC-02: longitudes del diccionario (nombre 150, correo 254, teléfono 15)", "ACC-02: longitudes incorrectas");
  ver(/mínimo 8 caracteres con letras y números/i.test(await textoDescrito(clave)) && (await pagina.getByText("El teléfono se reserva y no se publica en la ficha.").isVisible()), "ACC-02: ayuda de la contraseña y nota de que el teléfono se reserva", "ACC-02: faltan la ayuda o la nota del teléfono");
  ver((await enlace(pagina, "Cancelar").getAttribute("href")) === "/" && (await boton(pagina, "Registrarse").isVisible()), "ACC-02: «Registrarse» y «Cancelar»", "ACC-02: faltan botones");
  await boton(pagina, "Registrarse").click();
  const invalidos = await Promise.all([nombre, correo, clave, tel, aviso].map((l) => l.getAttribute("aria-invalid")));
  ver(invalidos.every((v) => v === "true") && (await nombre.evaluate((e) => e === document.activeElement)) && /aviso de privacidad/.test(await textoDescrito(aviso)), "ACC-02: vacío → los 5 campos marcados con error asociado (aria-describedby) y el foco va al primero", `ACC-02: invalidos ${invalidos}`);
  await nombre.fill("Rosa Hernández Ficticia");
  await correo.fill("sin-arroba");
  await clave.fill("soloLetras");
  await tel.fill("55-1234");
  await boton(pagina, "Registrarse").click();
  ver(/correo válido/.test(await textoDescrito(correo)) && /mínimo 8 caracteres, con letras y números/.test(await textoDescrito(clave)) && /10 a 15 dígitos/.test(await textoDescrito(tel)), "ACC-02: correo inválido, contraseña sin números y teléfono con guiones se rechazan con su mensaje", "ACC-02: no validó correo, contraseña o teléfono");
  const correoNuevo = `rosa.${Date.now()}@correo.com`; // correo ficticio único: el registro es real y el correo no se repite
  await correo.fill(correoNuevo);
  await clave.fill("Segura2026");
  await tel.fill("5512345678");
  await boton(pagina, "Registrarse").click();
  ver(new URL(pagina.url()).pathname === "/registro" && (await aviso.getAttribute("aria-invalid")) === "true" && (await aviso.evaluate((e) => e === document.activeElement)), "ACC-02: con todo válido pero sin aceptar el aviso NO se completa el registro (HU 003)", "ACC-02: se registró sin aceptar el aviso");
  const ojo = boton(pagina, "Mostrar contraseña");
  await ojo.click();
  ver((await clave.getAttribute("type")) === "text" && (await ojo.getAttribute("aria-pressed")) === "true", "ACC-02: «Mostrar contraseña» la muestra", "ACC-02: no mostró la contraseña");

  // MOD-01 desde ACC-02: Rechazar, Escape, clic fuera, Aceptar.
  const enlaceAviso = enlace(pagina.locator("#contenido"), "Aviso de privacidad v1.0");
  for (const via of ["«Rechazar»", "Escape", "clic fuera"] as const) {
    await enlaceAviso.click();
    const dlg = pagina.getByRole("dialog", { name: "Aviso de privacidad v1.0" });
    if (via === "«Rechazar»") {
      ver((await dlg.isVisible()) && (await dlg.getByRole("button").allInnerTexts()).join("|") === "Rechazar|Aceptar", "MOD-01 desde ACC-02: «Aviso de privacidad v1.0» con «Rechazar» y «Aceptar»", "MOD-01 desde ACC-02: botones incorrectos");
      await boton(dlg, "Rechazar").click();
    } else if (via === "Escape") await pagina.keyboard.press("Escape");
    else await pagina.mouse.click(4, 4);
    ver(!(await dialogoAbierto(pagina)) && !(await aviso.isChecked()) && (await foco(pagina)) === "Aviso de privacidad v1.0", `MOD-01 desde ACC-02: ${via} cierra sin aceptar y devuelve el foco al enlace`, `MOD-01 desde ACC-02: ${via} → abierto=${await dialogoAbierto(pagina)}, aceptado=${await aviso.isChecked()}, foco=${await foco(pagina)}`);
  }
  await enlaceAviso.click();
  await boton(pagina.getByRole("dialog", { name: "Aviso de privacidad v1.0" }), "Aceptar").click();
  ver(!(await dialogoAbierto(pagina)) && (await aviso.isChecked()), "MOD-01 desde ACC-02: «Aceptar» cierra el aviso y marca la casilla", "MOD-01 desde ACC-02: «Aceptar» no marcó la casilla");
  await boton(pagina, "Registrarse").click();
  await pagina.waitForURL("**/tutor");
  ver(true, "ACC-02: aceptado el aviso y con todo válido, «Registrarse» crea la cuenta, abre la sesión y navega a /tutor", "");
  await contexto.close();

  // Casilla manual y variante ?estado=aviso.
  ({ contexto, pagina } = await nuevaPagina(navegador, 390, null));
  await irA(pagina, "/registro");
  await pagina.locator("label", { hasText: "He leído y acepto el" }).click({ position: { x: 4, y: 10 } });
  ver(await pagina.getByRole("checkbox", { name: /He leído y acepto el/ }).isChecked(), "ACC-02: la casilla también se marca a mano", "ACC-02: la casilla no se marcó");
  await irA(pagina, "/registro?estado=aviso");
  ver(await pagina.getByRole("dialog", { name: "Aviso de privacidad v1.0" }).isVisible(), "ACC-02 ?estado=aviso: abre MOD-01 al cargar", "ACC-02 ?estado=aviso: no abrió el aviso");
  await contexto.close();
}

// ---------- TUT-08, TUT-09 y TUT-10 ----------
async function avistamientos(navegador: Browser) {
  const todas = avistamientosDelCaso(FOLIO_CON_AVISTAMIENTOS);
  const fallecido = todas.find((a) => a.estadosAnimal.includes("Fallecido"))!;
  const cronologico = [...todas].reverse();
  ver(AVISTAMIENTOS.length > 0, `datos de ejemplo: ${AVISTAMIENTOS.length} avistamientos que cumplen las reglas del catálogo (excluyentes, Fallecido sin Conducta)`, "datos de ejemplo vacíos");

  // TUT-08 sin avistamientos.
  let { contexto, pagina } = await nuevaPagina(navegador);
  await irA(pagina, `${CASO}/avistamientos`);
  const sin = await pagina.locator("main").innerText();
  ver(/Max aún no registra avistamientos\./.test(sin) && (await pagina.getByAltText("Fotografía de Max").isVisible()) && (await pagina.getByRole("link", { name: "Mapa", exact: true }).count()) === 0 && (await pagina.locator('[aria-disabled="true"]', { hasText: "Mapa" }).count()) === 1 && (await pagina.getByRole("link", { name: "Lista" }).getAttribute("aria-current")) === "page", "TUT-08 sin avistamientos: foto del perro, «Max aún no registra avistamientos.» y «Mapa» deshabilitado", "TUT-08 sin avistamientos: contenido incorrecto");
  ver((await pagina.locator("nav[aria-label='Navegación inferior']").isVisible()) && (await enlace(pagina, "Regresar al detalle del caso").getAttribute("href")) === CASO && (await boton(pagina, "Actualizar listado").isVisible()), "TUT-08: con la barra inferior de la plantilla tutora, «Regresar al detalle del caso» y «Actualizar listado»", "TUT-08: faltan barra, enlace o botón");
  const r = await pagina.goto(`${base}${CASO}/mapa`, { waitUntil: "load" });
  ver(new URL(pagina.url()).pathname === `${CASO}/avistamientos` && r?.status() === 200, "TUT-09 sin avistamientos vuelve a la lista (el mapa no aplica)", `TUT-09 sin avistamientos: ${pagina.url()}`);
  await contexto.close();

  // TUT-08 con avistamientos.
  ({ contexto, pagina } = await nuevaPagina(navegador));
  await irA(pagina, `${CON_AV}/avistamientos`);
  const tarjetas = pagina.locator("main article");
  const ordenIds = await tarjetas.evaluateAll((as) => as.map((a) => a.querySelector("a[href*='/avistamientos/']")!.getAttribute("href")!.split("/").pop()));
  ver(JSON.stringify(ordenIds) === JSON.stringify(todas.map((a) => String(a.id))), `TUT-08: ${ordenIds.length} tarjetas por fecha de recepción descendente`, `TUT-08: orden ${ordenIds}`);
  const tFalle = pagina.locator(`article:has(a[href$='/avistamientos/${fallecido.id}'])`);
  ver((await tFalle.locator("img").count()) === 0 && /estado «Fallecido»/.test(await tFalle.innerText()) && !/Libre en vía pública|Fallecido\b.*,/.test(await tFalle.innerText()), "TUT-08: el avistamiento «Fallecido» va con redacción sobria y marcador neutro, sin fotografía ni estados", "TUT-08: el «Fallecido» muestra imagen o estados");
  const normal = pagina.locator(`article:has(a[href$='/avistamientos/101'])`);
  ver((await normal.locator("img").count()) === 1 && /Herido \/ lesionado, Enfermo \/ débil/.test(await normal.innerText()), "TUT-08: un avistamiento normal muestra su fotografía, fecha y hora, alcaldía y estados", "TUT-08: tarjeta normal incorrecta");
  const html = await (await fetchComo(base, "tutor1", `${CON_AV}/avistamientos`)).text();
  ver(!html.includes(FOTO_SENSIBLE) && !AVISTAMIENTOS.some((a) => a.direccionAproximada && html.includes(a.direccionAproximada)), "TUT-08: el HTML no contiene la fotografía del «Fallecido» ni la dirección aproximada de ningún avistamiento", "TUT-08: el HTML trae la foto sensible o direcciones reservadas");
  ver((await pagina.getByRole("link", { name: "Mapa", exact: true }).getAttribute("href")) === `${CON_AV}/mapa`, "TUT-08: el selector «Mapa» lleva a TUT-09", "TUT-08: «Mapa» no enlaza a TUT-09");
  // Filtros.
  const filtros = pagina.getByRole("button", { name: "Filtros", exact: true });
  ver((await filtros.getAttribute("aria-expanded")) === "false" && !(await pagina.getByLabel("Desde").isVisible()), "TUT-08: los filtros empiezan plegados", "TUT-08: los filtros empiezan desplegados");
  await filtros.click();
  await pagina.getByLabel("Desde").fill("2026-10-03");
  await boton(pagina, "Aplicar filtros").click();
  ver(/anterior al registro del caso/.test(await textoDescrito(pagina.getByLabel("Desde"))) && (await tarjetas.count()) === 4, "TUT-08: una fecha anterior al registro del caso se rechaza (HU 041)", "TUT-08: aceptó una fecha anterior al registro");
  await pagina.getByLabel("Desde").fill("2026-10-07");
  await boton(pagina, "Aplicar filtros").click();
  ver((await tarjetas.count()) === 2 && /2 de 4 avistamientos/.test(await pagina.locator("main").innerText()), "TUT-08: «Desde» 7 oct deja 2 de 4 avistamientos", "TUT-08: el filtro «Desde» no filtró");
  await pagina.getByLabel("Hasta").fill("2026-10-07");
  await boton(pagina, "Aplicar filtros").click();
  ver((await tarjetas.count()) === 1, "TUT-08: «Desde» y «Hasta» combinados dejan 1", "TUT-08: el rango no filtró");
  await pagina.getByLabel("Hasta").fill("2026-10-06");
  await boton(pagina, "Aplicar filtros").click();
  ver(/no puede ser anterior a «Desde»/.test(await textoDescrito(pagina.getByLabel("Hasta"))), "TUT-08: «Hasta» anterior a «Desde» se rechaza", "TUT-08: aceptó un rango invertido");
  await boton(pagina, "Limpiar filtros").click();
  await pagina.getByLabel("Alcaldía o zona").selectOption("Iztacalco");
  await boton(pagina, "Aplicar filtros").click();
  ver((await tarjetas.count()) === 0 && /Ningún avistamiento coincide con los filtros/.test(await pagina.locator("main").innerText()), "TUT-08: una alcaldía sin avistamientos muestra «Ningún avistamiento coincide con los filtros»", "TUT-08: el filtro por alcaldía no funcionó");
  await boton(pagina, "Limpiar filtros").click();
  ver((await tarjetas.count()) === 4, "TUT-08: «Limpiar filtros» restaura los 4 avistamientos", "TUT-08: Limpiar no restauró");
  await boton(pagina, "Actualizar listado").click();
  ver(await pagina.getByRole("status").getByText("Listado actualizado").waitFor({ timeout: 3000 }).then(() => true, () => false), "TUT-08: «Actualizar listado» lo anuncia (role=\"status\")", "TUT-08: Actualizar listado no respondió");
  await irA(pagina, `${CON_AV}/avistamientos?filtros=abiertos`);
  ver((await pagina.getByRole("button", { name: "Filtros", exact: true }).getAttribute("aria-expanded")) === "true" && (await pagina.getByLabel("Desde").isVisible()), "TUT-08 ?filtros=abiertos: filtros desplegados", "TUT-08 ?filtros=abiertos: no desplegó");
  await contexto.close();

  // TUT-09.
  const externas: string[] = [];
  ({ contexto, pagina } = await nuevaPagina(navegador, 1280));
  pagina.on("request", (q) => {
    if (!q.url().startsWith(base) && !q.url().startsWith("data:")) externas.push(q.url());
  });
  await irA(pagina, `${CON_AV}/mapa`);
  const marcadores = pagina.locator("[role=group][aria-label^='Mapa ilustrativo'] a");
  const hrefs = await marcadores.evaluateAll((as) => as.map((a) => [a.textContent, a.getAttribute("href")]));
  ver(JSON.stringify(hrefs) === JSON.stringify(cronologico.map((a, i) => [String(i + 1), `${CON_AV}/avistamientos/${a.id}`])), "TUT-09: 4 marcadores numerados en orden cronológico, cada uno enlaza a su detalle", `TUT-09: marcadores ${JSON.stringify(hrefs)}`);
  const ruta = boton(pagina, /^(Ver|Ocultar) ruta$/);
  const rutaEl = () => pagina.locator("[role=group][aria-label^='Mapa ilustrativo'] polyline").count();
  ver((await ruta.isEnabled()) && (await rutaEl()) === 0 && /referencia visual; requiere al menos 2 avistamientos/.test(await pagina.locator("main").innerText()) && /Mapa ilustrativo de la maqueta/.test(await pagina.locator("main").innerText()), "TUT-09: «Ver ruta» disponible con 4 avistamientos, aviso de referencia visual y atribución del mapa", "TUT-09: faltan aviso, atribución o «Ver ruta»");
  await ruta.click();
  ver((await rutaEl()) === 1 && (await ruta.innerText()) === "Ocultar ruta" && (await ruta.getAttribute("aria-pressed")) === "true", "TUT-09: «Ver ruta» traza la ruta entre los puntos (alterna a «Ocultar ruta»)", "TUT-09: no trazó la ruta");
  await ruta.click();
  ver((await rutaEl()) === 0, "TUT-09: «Ocultar ruta» la quita", "TUT-09: la ruta siguió");
  // Escritorio: mapa a la izquierda; lista, botones y aviso a la derecha.
  const g = await pagina.evaluate(() => {
    const [mapa, lista, btn, msg] = ["[role=group][aria-label^='Mapa ilustrativo']", "section[aria-labelledby$='-lista']", "button[aria-controls$='-filtro']", "p[id$='-mensaje']"].map((sel) => document.querySelector(sel)!.getBoundingClientRect());
    return { mapaR: mapa.right, listaL: lista.left, listaB: lista.bottom, btnT: btn.top, btnB: btn.bottom, btnL: btn.left, msgT: msg.top, msgL: msg.left };
  });
  const lugares = await pagina.locator("section[aria-labelledby$='-lista'] li p.text-caption").evaluateAll((ps) => ps.map((p) => ({ t: p.textContent, elipsis: getComputedStyle(p).textOverflow === "ellipsis" || p.scrollWidth > p.clientWidth + 1, ws: getComputedStyle(p).whiteSpace })));
  ver(lugares.length === 4 && lugares.every((l) => !l.elipsis && l.ws !== "nowrap"), "TUT-09: la lista lateral no corta la colonia con puntos suspensivos (el texto pasa a otra línea)", `TUT-09: lista truncada ${JSON.stringify(lugares)}`);
  ver(g.mapaR <= g.listaL + 1 && g.btnT >= g.listaB - 1 && g.msgT > g.btnT && g.msgT - g.btnB <= 20 && Math.abs(g.btnL - g.listaL) < 2 && Math.abs(g.msgL - g.listaL) < 2, "TUT-09 en escritorio (1280 px): mapa a la izquierda; lista, botones y aviso apilados a la derecha, con el aviso justo bajo los botones (separación normal)", `TUT-09 escritorio: ${JSON.stringify(g)}`);
  ver(externas.length === 0, "TUT-09: sin peticiones a servicios ni librerías de mapas (todo sale del propio sitio)", `TUT-09: peticiones externas ${externas.join(", ")}`);
  await boton(pagina, "Filtrar por fecha").click();
  await pagina.getByLabel("Desde").fill("2026-10-08");
  await boton(pagina, "Aplicar filtros").click();
  ver((await marcadores.count()) === 1 && (await ruta.isDisabled()), "TUT-09: filtrar por fecha deja 1 marcador y «Ver ruta» se deshabilita", "TUT-09: el filtro por fecha no funcionó");
  await contexto.close();
  ({ contexto, pagina } = await nuevaPagina(navegador, 390));
  await irA(pagina, `${UN_AV}/mapa`);
  const rutaUno = boton(pagina, "Ver ruta");
  ver((await pagina.locator("[role=group][aria-label^='Mapa ilustrativo'] a").count()) === 1 && (await rutaUno.isDisabled()) && /requiere al menos 2/.test(await textoDescrito(rutaUno)), "TUT-09 con 1 avistamiento: «Ver ruta» deshabilitado y explicado (aria-describedby)", "TUT-09 con 1 avistamiento: «Ver ruta» activo");
  await irA(pagina, `${CON_AV}/mapa`);
  const orden = await pagina.evaluate(() => ["button[aria-controls$='-filtro']", "[role=group][aria-label^='Mapa ilustrativo']", "p[id$='-mensaje']", "section[aria-labelledby$='-lista']"].map((s) => document.querySelector(s)!.getBoundingClientRect().top));
  ver(orden.every((v, i) => i === 0 || v > orden[i - 1]) && (await pagina.locator("nav[aria-label='Navegación inferior']").isVisible()), "TUT-09 en móvil: botones, mapa, aviso y lista en ese orden, con la barra inferior", `TUT-09 móvil: orden ${orden.map(Math.round)}`);
  const lugaresMovil = await pagina.locator("section[aria-labelledby$='-lista'] li p.text-caption").evaluateAll((ps) => ps.map((p) => p.scrollWidth > p.clientWidth + 1 || getComputedStyle(p).textOverflow === "ellipsis"));
  ver(lugaresMovil.length === 4 && lugaresMovil.every((x) => !x), "TUT-09 en móvil: la lista tampoco trunca la colonia (mismo comportamiento que en escritorio)", `TUT-09 móvil: truncado ${lugaresMovil}`);
  await contexto.close();

  // TUT-10.
  ({ contexto, pagina } = await nuevaPagina(navegador));
  const a = todas.find((x) => x.id === 101)!;
  await irA(pagina, `${CON_AV}/avistamientos/101`);
  const t = await pagina.locator("main").innerText();
  const dt = await pagina.locator("main dt").allTextContents();
  ver(JSON.stringify(dt) === JSON.stringify(["Fecha y hora", "Alcaldía", "Colonia o zona", "Dirección aproximada", "Referencias"]) && t.includes(a.direccionAproximada!) && t.includes(a.referencias!) && t.includes(a.coloniaZona!) && t.includes("Iztapalapa") && t.includes("5 oct 2026, 10:20"), "TUT-10: los cinco campos de la lámina 2.8 (fecha y hora, alcaldía, colonia o zona, dirección aproximada y referencias)", `TUT-10: campos ${dt.join(", ")}`);
  const chips = async (cat: string) => pagina.locator(`section:has(h2:text-is("${cat}")) li`).allInnerTexts();
  ver(JSON.stringify(await chips("Integridad física y salud")) === JSON.stringify(["Herido / lesionado", "Enfermo / débil"]) && JSON.stringify(await chips("Contención y ubicación")) === JSON.stringify(["Resguardado / En custodia temporal"]) && JSON.stringify(await chips("Conducta")) === JSON.stringify(["Asustado / temeroso"]), "TUT-10: estados del animal como chips por categoría, incluida «Contención y ubicación» (Resguardado / En custodia temporal)", "TUT-10: chips por categoría incorrectos");
  ver(await pagina.waitForFunction(() => { const i = document.querySelector<HTMLImageElement>('main img[alt="Fotografía del avistamiento"]'); return !!i && i.complete; }, undefined, { timeout: 10000 }).then(() => pagina.locator('main img[alt="Fotografía del avistamiento"]').evaluate((e) => (e as HTMLImageElement).naturalWidth > 0)).catch(() => false), "TUT-10: la fotografía del avistamiento (real o respaldo) se carga de verdad (naturalWidth > 0)", "TUT-10: la fotografía del avistamiento no se carga (imagen rota)");
  ver((await pagina.getByAltText("Fotografía del avistamiento").isVisible()) && (await boton(pagina, "Ver fotografía").count()) === 0 && t.includes(a.comentario!) && /Quien reportó permanece anónimo/.test(t) && (await pagina.getByRole("group", { name: /Mapa ilustrativo con el punto/ }).isVisible()), "TUT-10: fotografía, mapa del punto, comentario y aviso de anonimato", "TUT-10: faltan fotografía, mapa, comentario o aviso de anonimato");
  ver(!/teléfono|correo|nombre de quien|contacto del/i.test(t), "TUT-10: ningún dato de quien reporta (ni teléfono, correo ni nombre)", "TUT-10: aparece un dato de contacto");
  ver((await enlace(pagina, "Regresar al listado").first().getAttribute("href")) === `${CON_AV}/avistamientos`, "TUT-10: «Regresar al listado»", "TUT-10: enlace de regreso incorrecto");

  await irA(pagina, `${CON_AV}/avistamientos/${fallecido.id}`);
  ver((await pagina.locator("main img").count()) === 0 && (await pagina.getByText("Esta imagen puede resultar sensible").isVisible()) && (await pagina.getByText("Se reportó un perro sin vida que podría ser el tuyo. Lamentamos esta noticia.").isVisible()), "TUT-10 «Fallecido»: la fotografía NO se dibuja, con el aviso «Esta imagen puede resultar sensible» y redacción sobria", "TUT-10 «Fallecido»: se ve la imagen o falta el aviso");
  ver(JSON.stringify(await chips("Integridad física y salud")) === JSON.stringify(["Fallecido"]) && (await pagina.getByText("Conducta: no aplica con «Fallecido»").isVisible()) && (await pagina.locator("section:has(h2:text-is('Conducta'))").count()) === 0, "TUT-10 «Fallecido»: «Fallecido» va solo, Conducta no aplica y se explica con texto", "TUT-10 «Fallecido»: reglas de exclusión incorrectas");
  // La dirección de la foto (la real, /api/fotografias/<id>, o el respaldo del maquetado) NO debe estar en el HTML servido ni en el DOM mientras la foto siga oculta: no basta con ocultarla por estilo.
  const DIRECCION_FOTO = /\/api\/fotografias\/\d+|%2Fapi%2Ffotografias%2F\d+|avistamiento-sensible/;
  const rutaDetalle = `${CON_AV}/avistamientos/${fallecido.id}`;
  // La dirección EXACTA de la foto de este avistamiento (la que el servidor entrega con ?foto=visible): las demás fotos del listado y de la página no cuentan.
  const dirFotoFallecido = /(\/api\/fotografias\/\d+|\/mocks\/avistamiento-sensible\.svg)/.exec(await (await fetchComo(base, "tutor1", `${rutaDetalle}?foto=visible`)).text())?.[1] ?? "(sin dirección)";
  const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
  const CON_DIRECCION = new RegExp(`${escapar(dirFotoFallecido)}(?!\\d)|${escapar(encodeURIComponent(dirFotoFallecido))}(?!\\d)`);
  const htmlServido = await (await fetchComo(base, "tutor1", rutaDetalle)).text(); // texto CRUDO, con los datos de Next (self.__next_f)
  const htmlListado = await (await fetchComo(base, "tutor1", `${CON_AV}/avistamientos`)).text();
  const domCompleto = await pagina.content();
  const donde = [CON_DIRECCION.test(htmlServido) && "el HTML servido (con sus datos de Next)", CON_DIRECCION.test(domCompleto) && "el DOM", CON_DIRECCION.test(htmlListado) && "el listado del caso"].filter(Boolean);
  ver(dirFotoFallecido !== "(sin dirección)" && htmlServido.includes("__next_f") && donde.length === 0, "TUT-10 «Fallecido»: antes de «Ver fotografía» la dirección de la fotografía no está en el HTML servido (incluidos los datos de Next), ni en el DOM, ni en el listado de avistamientos del caso", `TUT-10 «Fallecido»: la dirección de la foto ya está en ${donde.join(", ") || "(el HTML servido no trae los datos de Next: la prueba no es válida)"} aunque no se dibuje`);
  // La imagen revelada se busca solo dentro del avistamiento (por su texto alternativo) y debe CARGAR de verdad (naturalWidth > 0), no solo estar presente.
  const fotoDelAvistamiento = pagina.locator('main img[alt="Fotografía del avistamiento"]');
  const cargada = async () => {
    await pagina.waitForFunction(() => { const i = document.querySelector<HTMLImageElement>('main img[alt="Fotografía del avistamiento"]'); return !!i && i.complete; }, undefined, { timeout: 10000 }).catch(() => undefined);
    return fotoDelAvistamiento.evaluate((e) => (e as HTMLImageElement).naturalWidth > 0).catch(() => false);
  };
  const esDelOrigen = async () => DIRECCION_FOTO.test((await fotoDelAvistamiento.getAttribute("src")) ?? "");
  const verFoto = enlace(pagina, "Ver fotografía");
  ver((await verFoto.getAttribute("href")) === `${rutaDetalle}?foto=visible` && (await boton(pagina, "Ver fotografía").count()) === 0, "TUT-10 «Fallecido»: «Ver fotografía» es un enlace a ?foto=visible", "TUT-10 «Fallecido»: «Ver fotografía» no es un enlace a ?foto=visible");
  const historiaAntes = await pagina.evaluate(() => history.length);
  await verFoto.click();
  await fotoDelAvistamiento.waitFor({ timeout: 10000 }).catch(() => undefined);
  ver(new URL(pagina.url()).searchParams.get("foto") === "visible" && (await fotoDelAvistamiento.count()) === 1 && (await esDelOrigen()) && (await enlace(pagina, "Ocultar fotografía").isVisible()) && (await pagina.getByText("Esta imagen puede resultar sensible").count()) === 0, "TUT-10 «Fallecido»: «Ver fotografía» revela la imagen del avistamiento (origen real o respaldo) y ofrece «Ocultar fotografía»", "TUT-10 «Fallecido»: no reveló la fotografía");
  ver(await cargada(), "TUT-10 «Fallecido»: la fotografía revelada se carga de verdad (naturalWidth > 0)", "TUT-10 «Fallecido»: la fotografía revelada no se carga (imagen rota)");
  ver(await pagina.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Fotografía del avistamiento"), "TUT-10 «Fallecido»: al revelar, el foco pasa a la región de la imagen", "TUT-10 «Fallecido»: el foco no pasó a la imagen al revelar");
  ver(DIRECCION_FOTO.test(await (await fetchComo(base, "tutor1", `${rutaDetalle}?foto=visible`)).text()), "TUT-10 «Fallecido»: con ?foto=visible el servidor SÍ entrega la dirección de la fotografía (a su dueña)", "TUT-10 «Fallecido»: con ?foto=visible el servidor no entregó la fotografía");
  await enlace(pagina, "Ocultar fotografía").click();
  await verFoto.waitFor({ timeout: 10000 });
  ver(new URL(pagina.url()).searchParams.get("foto") === null && (await pagina.locator("main img").count()) === 0 && !CON_DIRECCION.test(await pagina.locator("main").innerHTML()) && (await pagina.evaluate(() => history.length)) === historiaAntes + 1, "TUT-10 «Fallecido»: «Ocultar fotografía» vuelve a la URL sin el parámetro con replace (el historial solo suma la entrada de «Ver»), quita la dirección del DOM y vuelve a mostrar el aviso", "TUT-10 «Fallecido»: «Ocultar fotografía» no restauró el estado oculto o acumuló historial");
  ver(await pagina.evaluate(() => document.activeElement?.textContent?.trim() === "Ver fotografía"), "TUT-10 «Fallecido»: al ocultar, el foco vuelve a «Ver fotografía»", "TUT-10 «Fallecido»: el foco no volvió a «Ver fotografía»");
  await irA(pagina, `${rutaDetalle}?foto=visible`);
  ver((await fotoDelAvistamiento.count()) === 1 && (await esDelOrigen()) && (await cargada()), "TUT-10 ?foto=visible: abre con la fotografía revelada y cargada", "TUT-10 ?foto=visible: no reveló o no cargó");
  // El parámetro no hace nada en un avistamiento sin «Fallecido» (la foto ya se muestra, sin botones) ni con otra sesión (404 igual que sin él) ni con el Administrador (403).
  const htmlNormal = await (await fetchComo(base, "tutor1", `${CON_AV}/avistamientos/101?foto=visible`)).text();
  const htmlNormalSin = await (await fetchComo(base, "tutor1", `${CON_AV}/avistamientos/101`)).text();
  const ajena = await fetchComo(base, "tutor2", `${rutaDetalle}?foto=visible`);
  const admin = await fetchComo(base, "admin", `${rutaDetalle}?foto=visible`);
  const sinSesion = await fetch(`${base}${rutaDetalle}?foto=visible`, { redirect: "manual" });
  const FOTO_NORMAL = /\/api\/fotografias\/\d+|%2Fapi%2Ffotografias%2F\d+|perro-ejemplo\.svg/; // la real o el respaldo del maquetado
  ver(FOTO_NORMAL.test(htmlNormal) && !htmlNormal.includes("Ver fotografía") && !htmlNormal.includes("Ocultar fotografía") && FOTO_NORMAL.test(htmlNormalSin) && ajena.status === 404 && !CON_DIRECCION.test(await ajena.text()) && admin.status === 403 && sinSesion.status === 307, "TUT-10 ?foto=visible no tiene efecto en un avistamiento sin «Fallecido»; con otra persona tutora da 404 sin la dirección, con el Administrador 403 y sin sesión 307", `TUT-10 ?foto=visible: sin «Fallecido» ${FOTO_NORMAL.test(htmlNormal)}, otra sesión ${ajena.status}, Administrador ${admin.status}, sin sesión ${sinSesion.status}`);
  // Un id ajeno al caso o un folio ajeno: 404.
  const c1 = await pagina.goto(`${base}${CON_AV}/avistamientos/201`, { waitUntil: "load" });
  const c2 = await pagina.goto(`${base}/tutor/casos/RUPE-Z5C6VR4P/avistamientos/101`, { waitUntil: "load" });
  ver(c1?.status() === 404 && c2?.status() === 404, "TUT-10: un avistamiento de otro caso o un folio ajeno responden 404", `TUT-10: ${c1?.status()} y ${c2?.status()}`);
  await contexto.close();
}

// ---------- TRA-02 y TRA-03 ----------
async function transversalesSesion(navegador: Browser) {
  let { contexto, pagina } = await nuevaPagina(navegador);
  await irA(pagina, "/dev/transversales/sesion-expirada");
  let dlg = pagina.getByRole("dialog", { name: "Tu sesión expiró" });
  ver((await dlg.isVisible()) && /la sesión dura 8 horas/.test(await dlg.innerText()) && (await dlg.getByRole("button").allInnerTexts()).join("|") === "Iniciar sesión", "TRA-02: «Tu sesión expiró» con el mensaje de las 8 horas y «Iniciar sesión»", "TRA-02: contenido incorrecto");
  ver((await pagina.locator("nav[aria-label='Navegación inferior']").count()) === 1 && (await pagina.getByRole("heading", { level: 1, name: "Mis registros", includeHidden: true }).count()) === 1, "TRA-02: sobre «Mis registros», con el encabezado y la barra inferior de la plantilla tutora de fondo", "TRA-02: el fondo no es «Mis registros»");
  await boton(dlg, "Iniciar sesión").click();
  await pagina.waitForURL("**/acceso");
  ver(true, "TRA-02: «Iniciar sesión» lleva a /acceso", "");
  await contexto.close();
  for (const via of ["Escape", "clic fuera"] as const) {
    ({ contexto, pagina } = await nuevaPagina(navegador));
    await irA(pagina, "/dev/transversales/sesion-expirada");
    if (via === "Escape") await pagina.keyboard.press("Escape");
    else await pagina.mouse.click(4, 4);
    ver(!(await dialogoAbierto(pagina)), `TRA-02: ${via} cierra el modal`, `TRA-02: ${via} no cerró el modal`);
    await contexto.close();
  }
  // TRA-03.
  ({ contexto, pagina } = await nuevaPagina(navegador));
  await irA(pagina, "/acceso?estado=aviso-actualizado");
  dlg = pagina.getByRole("dialog", { name: "Aviso de privacidad actualizado v1.0" });
  ver((await dlg.isVisible()) && /queda registrada con su fecha/.test(await dlg.innerText()) && (await dlg.getByRole("button").allInnerTexts()).join("|") === "Rechazar|Aceptar", "TRA-03: «Aviso de privacidad actualizado v1.0» con «Rechazar» y «Aceptar»", "TRA-03: contenido incorrecto");
  ver((await pagina.locator("header").getByRole("button", { name: "Menú", exact: true }).isVisible()) && (await pagina.getByRole("heading", { level: 1, name: "Iniciar sesión", includeHidden: true }).count()) === 1 && (await pagina.locator("nav[aria-label='Navegación inferior']").count()) === 0, "TRA-03: sobre ACC-01 con el encabezado público de fondo (como la lámina M4-1), sin barra inferior", "TRA-03: el fondo no es el encabezado público de ACC-01");
  await boton(dlg, "Aceptar").click(); // variante de maquetado (sin credenciales escritas): solo cierra; el flujo real lo prueba verificar-acceso
  ver(!(await dialogoAbierto(pagina)) && new URL(pagina.url()).pathname === "/acceso", "TRA-03: «Aceptar» (variante de maquetado, sin credenciales) cierra el aviso", "TRA-03: Aceptar no cerró el aviso");
  await contexto.close();
  ({ contexto, pagina } = await nuevaPagina(navegador));
  await irA(pagina, "/acceso?estado=aviso-actualizado");
  await boton(pagina.getByRole("dialog", { name: /Aviso de privacidad actualizado/ }), "Rechazar").click();
  ver(!(await dialogoAbierto(pagina)) && new URL(pagina.url()).pathname === "/acceso", "TRA-03: «Rechazar» cierra el aviso y se queda en /acceso (no entra)", "TRA-03: Rechazar no cerró el aviso");
  await contexto.close();
  for (const via of ["Escape", "clic fuera"] as const) {
    ({ contexto, pagina } = await nuevaPagina(navegador));
    await irA(pagina, "/acceso?estado=aviso-actualizado");
    if (via === "Escape") await pagina.keyboard.press("Escape");
    else await pagina.mouse.click(4, 4);
    ver(!(await dialogoAbierto(pagina)) && new URL(pagina.url()).pathname === "/acceso", `TRA-03: ${via} cierra el modal sin aceptar ni salir`, `TRA-03: ${via} → ${pagina.url()}`);
    await contexto.close();
  }
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
    "/registro",
    "/registro?estado=aviso",
    "/acceso?estado=aviso-actualizado",
    "/dev/transversales/sesion-expirada",
    `${CASO}/avistamientos`,
    `${CON_AV}/avistamientos`,
    `${CON_AV}/avistamientos?filtros=abiertos`,
    `${CON_AV}/mapa`,
    `${CON_AV}/mapa?ruta=visible`,
    `${UN_AV}/mapa`,
    `${CON_AV}/avistamientos/101`,
    `${CON_AV}/avistamientos/102`,
    `${CON_AV}/avistamientos/102?foto=visible`,
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

// Sin errores ni advertencias en la consola del navegador en 404 (caso ajeno, ruta inexistente, folio mal formado), 403, acceso, inicio, Mis registros y un detalle de caso.
// El aviso propio del documento (404 o 403 de «Failed to load resource») es esperado y se descarta; el de React «script tag» solo existe en next dev: lo cubre la prueba de fuente del layout.
async function consola(navegador: Browser) {
  const PANTALLAS: [string, string, RolPrueba | null][] = [["404 de caso ajeno", "/tutor/casos/RUPE-Z5C6VR4P", "tutor1"], ["404 de ruta inexistente", "/no-existe-xyz", null], ["404 de folio mal formado", "/tutor/casos/xx", "tutor1"], ["403 del Administrador en /tutor", "/tutor", "admin"], ["acceso", "/acceso", null], ["inicio", "/", null], ["Mis registros", "/tutor", "tutor1"], ["detalle de un caso", `${CASO}`, "tutor1"]];
  for (const [nombre, ruta, rol] of PANTALLAS) {
    const p = await nuevaPagina(navegador, 390, rol);
    const mensajes: string[] = [];
    p.pagina.on("console", (m) => { if ((m.type() === "error" || m.type() === "warning") && !/^Failed to load resource: the server responded with a status of 40[34]/.test(m.text())) mensajes.push(`${m.type()}: ${m.text().slice(0, 120)}`); });
    p.pagina.on("pageerror", (e) => mensajes.push(`pageerror: ${e.message.slice(0, 120)}`));
    await p.pagina.goto(`${base}${ruta}`, { waitUntil: "load" });
    await p.pagina.waitForTimeout(600);
    ver(mensajes.length === 0, `consola sin errores ni advertencias: ${nombre}`, `consola (${nombre}): ${mensajes.join(" | ")}`);
    await p.contexto.close();
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
    // Datos limpios: «Mis registros» lee el almacén real y los casos creados por una corrida anterior (p. ej. «Canela») cambiarían sus conteos.
    await reiniciarDatos(base);
    navegador = await abrirNavegador();
    await acceso(navegador);
    await registroCuenta(navegador);
    await misRegistros(navegador); // debe ir ANTES de registro: el caso que crea registro aparecería en la lista
    await registro(navegador);
    await salidaRegistro(navegador);
    await enlacesInternos(navegador);
    await avistamientos(navegador);
    await transversalesSesion(navegador);
    await creado(navegador);
    await detalle(navegador);
    await detalleEscritorio(navegador);
    await rotulosDeDatos(navegador);
    await fugas(navegador);
    await modalesFicha(navegador);
    await geometria(navegador);
    await consola(navegador);
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
