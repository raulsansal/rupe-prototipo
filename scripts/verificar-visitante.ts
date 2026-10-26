// Verifica las pantallas del Visitante (PUB-01, PUB-03, PUB-05, TRA-01 y TRA-04) con Playwright, sin abrir capturas:
//  (a) tres variantes de la ficha y que ningún dato reservado ni de la persona tutora llegue a su HTML;
//  (b) el flujo de seis pasos: avanza, retrocede conservando lo capturado y exige los obligatorios;
//  (c) reglas del estado del animal; (d) el paso 3 exige confirmar un punto en las tres formas;
//  (e) sin desplazamiento horizontal a 390, 768 y 1280 px y sin elementos interactivos de menos de 44 px.
// Opciones: --sin-build  reutiliza el build existente · --base=URL  usa un servidor que ya corre (no compila ni arranca nada)
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { fetchComo } from "./sesion-pruebas";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import { AVISTAMIENTOS } from "../src/mocks/avistamientos";
import { PARAMETROS } from "../src/mocks/parametros";
import { CASOS_ORIGEN, FOLIO_EN_CURSO, FOLIO_INEXISTENTE, valoresReservados } from "../src/mocks/casos";
import { CLAVE_TEMA } from "../src/lib/tema";

const PUERTO = 3105;
const baseExterna = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1];
const base = baseExterna ?? `http://localhost:${PUERTO}`;
const ANCHOS = [390, 768, 1280];
const FICHA = `/ficha/${FOLIO_EN_CURSO}`;
const AVISTAMIENTO = `${FICHA}/avistamiento`;
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
    return await chromium.launch({ channel: "chrome" }); // sin Chromium de Playwright (p. ej. macOS 13)
  }
}

type Opciones = { ancho?: number; geolocalizacion?: { latitude: number; longitude: number; accuracy: number } };
async function nuevaPagina(navegador: Browser, { ancho = 390, geolocalizacion }: Opciones = {}): Promise<{ contexto: BrowserContext; pagina: Page }> {
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: 900 },
    colorScheme: "light",
    ...(geolocalizacion && { geolocation: geolocalizacion, permissions: ["geolocation"] }),
  });
  await contexto.addInitScript(([k, v]) => localStorage.setItem(k, v), [CLAVE_TEMA, "light"]);
  return { contexto, pagina: await contexto.newPage() };
}

async function irA(pagina: Page, ruta: string) {
  // Sin "networkidle": Next precarga enlaces a rutas que aún no existen y esas peticiones no terminan.
  await pagina.goto(`${base}${ruta}`, { waitUntil: "load" });
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForFunction(() => [...document.images].every((i) => i.complete || !i.checkVisibility())); // las de pasos ocultos no cargan
  await pagina.waitForFunction(() => document.querySelector("[data-paso], main h1") !== null);
}

async function desborde(pagina: Page, etiqueta: string) {
  const d = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ver(d <= 0, `${etiqueta}: sin desplazamiento horizontal`, `${etiqueta}: se desborda ${d}px`);
}

async function areasTactiles(pagina: Page, etiqueta: string) {
  const r = await pagina.evaluate(() => {
    const malos: string[] = [];
    let total = 0;
    const selector = "button, a[href], input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea, label:has(input[type=checkbox]), label:has(input[type=radio]), [role=group][tabindex]";
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (el.closest("[hidden]") || el.closest("[inert]")) continue;
      const rect = el.getBoundingClientRect();
      if (getComputedStyle(el).display === "none" || (rect.width <= 2 && rect.height <= 2)) continue; // ocultos o sr-only
      if (el instanceof HTMLAnchorElement && el.closest("p")) continue; // enlaces dentro de texto corrido
      total++;
      if (rect.height < 43.5) malos.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 28)}" ${Math.round(rect.height * 10) / 10}px`);
    }
    return { malos, total };
  });
  ver(r.malos.length === 0, `${etiqueta}: ${r.total} elementos interactivos, ninguno de menos de 44 px de alto`, `${etiqueta}: áreas menores de 44 px → ${r.malos.join(" | ")}`);
}

const paso = (pagina: Page, n: number) => pagina.locator(`[data-paso="${n}"]`);
const continuar = (pagina: Page) => pagina.getByRole("button", { name: /^(Continuar|Enviar reporte)$/ });
const regresar = (pagina: Page) => pagina.getByRole("button", { name: "Regresar" });
const barra = (pagina: Page) => pagina.locator("main [role=progressbar]").getAttribute("aria-valuetext");
const etiquetaOpcion = (ambito: Locator | Page, nombre: string) => ambito.locator("label").filter({ hasText: nombre });
const casilla = (ambito: Locator | Page, nombre: RegExp | string) => ambito.getByRole("checkbox", { name: nombre });
const radio = (ambito: Locator | Page, nombre: RegExp | string) => ambito.getByRole("radio", { name: nombre });
const textoDescrito = (l: Locator) =>
  l.evaluate((el) => (el.getAttribute("aria-describedby") ?? "").split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() ?? "").join(" | "));

// ---------- (a) ficha pública ----------
async function ficha(navegador: Browser) {
  const { contexto, pagina } = await nuevaPagina(navegador);
  {
    await irA(pagina, `${FICHA}?estado=en-curso`);
    const enlace = pagina.getByRole("link", { name: "Reportar avistamiento" });
    const href = await enlace.getAttribute("href");
    ver((await enlace.isVisible()) && href === AVISTAMIENTO, "ficha A (en curso): «Reportar avistamiento» es un enlace activo hacia el reporte", `ficha A: enlace ${href}`);
    const campos = ["Nombre", "Sexo", "Raza", "Edad aproximada", "Tamaño", "Color", "Características distintivas", "Fecha del extravío", "Alcaldía", "Colonia o zona"];
    const dt = await pagina.locator("main dt").allTextContents();
    ver(campos.every((c) => dt.includes(c)) && dt.length === campos.length, `ficha A: muestra solo los ${campos.length} campos públicos (${dt.join(", ")})`, `ficha A: campos ${dt.join(", ")}`);
    const texto = await pagina.locator("main").innerText();
    ver(texto.includes(FOLIO_EN_CURSO) && texto.includes("En búsqueda") && (await pagina.getByRole("img", { name: /^Fotografía de Max/ }).isVisible()), "ficha A: folio, estado (con texto) y fotografía visibles", "ficha A: falta folio, estado o fotografía");
    ver((await pagina.getByRole("button", { name: "Compartir" }).isVisible()) && (await pagina.getByRole("link", { name: "Consultar otro folio" }).isVisible()), "ficha A: «Compartir» y «Consultar otro folio»", "ficha A: faltan Compartir o Consultar otro folio");
  }

  await irA(pagina, `${FICHA}?estado=localizado`);
  const boton = pagina.getByRole("button", { name: "Reportar avistamiento" });
  const aviso = await pagina.locator("main").innerText();
  ver((await boton.isDisabled()) && (await pagina.getByRole("link", { name: "Reportar avistamiento" }).count()) === 0 && /ya no se reciben avistamientos/.test(aviso), "ficha B (localizado): botón deshabilitado y mensaje «ya no se reciben avistamientos»", "ficha B: botón no deshabilitado o sin mensaje");
  ver(aviso.includes("Localizado"), "ficha B: el estado «Localizado» se muestra con texto", "ficha B: no muestra «Localizado»");

  // Estado C: una sola pantalla con dos tarjetas; folio inexistente, caso cerrado y ?estado=no-disponible son IDÉNTICOS.
  const rocky0 = CASOS_ORIGEN.find((x) => x.estado === "Cerrado")!;
  const rutasC = [`/ficha/${FOLIO_INEXISTENTE}`, `/ficha/${rocky0.folio}`, `${FICHA}?estado=no-disponible`];
  const vistas: { estado: number; html: string; texto: string }[] = [];
  for (const ruta of rutasC) {
    const r = await pagina.goto(`${base}${ruta}`, { waitUntil: "load" });
    vistas.push({ estado: r!.status(), html: await pagina.locator("main").innerHTML(), texto: await pagina.locator("main").innerText() });
  }
  const t = vistas[0].texto;
  ver(/Folio no encontrado/.test(t) && /Gracias por ayudar/.test(t) && (await pagina.locator("main section").count()) === 2, "ficha C: una sola pantalla con dos tarjetas apiladas («Folio no encontrado» y la de agradecimiento)", "ficha C: no son dos tarjetas");
  ver((await pagina.getByRole("link", { name: "Buscar otro folio" }).isVisible()) && (await pagina.getByRole("link", { name: "Ir al inicio" }).isVisible()) && (await pagina.getByRole("img", { name: /^Fotografía de/ }).count()) === 0, "ficha C: «Buscar otro folio» e «Ir al inicio», sin fotografía ni ficha", "ficha C: faltan botones o muestra la ficha");
  ver(vistas.every((v) => v.estado === vistas[0].estado && v.html === vistas[0].html), `ficha C: folio inexistente, caso cerrado y ?estado=no-disponible responden igual (HTTP ${vistas[0].estado}) y con el mismo contenido`, "ficha C: las tres respuestas difieren, se revelaría que el caso existió");
  ver(!/cerrad|cancelad|deshabilitad/i.test(t) && !t.includes(rocky0.nombre) && !t.includes(rocky0.folio), "ficha C: no menciona cierre, cancelación, deshabilitación, nombre ni folio", "ficha C: revela algo del caso");
  await contexto.close();

  // Estados por defecto según el caso: Toby (Localizado) → B; Rocky (Cerrado) → C.
  const { contexto: c2, pagina: p2 } = await nuevaPagina(navegador);
  const toby = CASOS_ORIGEN.find((x) => x.estado === "Localizado")!;
  const rocky = CASOS_ORIGEN.find((x) => x.estado === "Cerrado")!;
  await irA(p2, `/ficha/${toby.folio}`);
  ver(await p2.getByRole("button", { name: "Reportar avistamiento" }).isDisabled(), "un caso «Localizado» abre en el estado B por sí solo (R13)", "un caso Localizado no abrió en el estado B");
  await irA(p2, `/ficha/${rocky.folio}`);
  ver(/Folio no encontrado/.test(await p2.locator("main").innerText()), "un caso «Cerrado» abre en el estado C por sí solo", "un caso Cerrado no abrió en el estado C");
  await irA(p2, `/ficha/${toby.folio}/avistamiento`);
  ver(new URL(p2.url()).pathname === `/ficha/${toby.folio}`, "el reporte de un caso «Localizado» vuelve a su ficha (no acepta avistamientos)", `el reporte de un caso Localizado no redirigió: ${p2.url()}`);
  await c2.close();

  // Sin fugas: el origen SÍ tiene reservados y datos de la persona tutora; ninguno debe aparecer en el HTML.
  let fugas = 0;
  let comprobaciones = 0;
  const palabras = ["Momento del día", "Motivo", "Descripción", "Referencias", "Dirección", "Calle", "Cruce", "Correo", "Teléfono", "Tutor"];
  for (const origen of CASOS_ORIGEN) {
    const reservados = valoresReservados(origen);
    if (reservados.length < 5) throw new Error(`El origen de ${origen.folio} no tiene suficientes datos reservados para la prueba`);
    for (const clave of [origen.folio, origen.tokenPublico]) {
      for (const q of ["", "?estado=en-curso", "?estado=localizado", "?estado=no-disponible"]) {
        const html = await (await fetch(`${base}/ficha/${clave}${q}`)).text();
        comprobaciones++;
        const filtrados = reservados.filter((v) => html.includes(v));
        if (filtrados.length) {
          fugas++;
          console.log(`✗ fuga en /ficha/<${clave === origen.folio ? "folio" : "token de 32 caracteres"}>${q} de ${origen.folio}: ${filtrados.length} valor(es) reservado(s) en el HTML`);
        }
      }
    }
  }
  ver(fugas === 0, `sin fugas: ${comprobaciones} respuestas HTML (5 casos × folio y token × 4 variantes) sin ningún valor reservado ni dato de la persona tutora del origen`, `${fugas} respuesta(s) con datos reservados`);

  // Controles de sensibilidad: la búsqueda sí detecta un valor presente, y el token resuelve la misma ficha.
  const max = CASOS_ORIGEN[0];
  const htmlMax = await (await fetch(`${base}/ficha/${max.folio}`)).text();
  const htmlToken = await (await fetch(`${base}/ficha/${max.tokenPublico}`)).text();
  ver(htmlMax.includes(max.color) && htmlMax.includes(max.coloniaZona) && !htmlMax.includes(max.direccionAproximada!), "control: el HTML sí contiene los campos públicos (color, colonia) y no la dirección reservada", "control: la prueba de fugas no distingue público de reservado");
  ver(htmlToken.includes(max.folio) && htmlToken.includes(max.coloniaZona), "la clave de 32 caracteres del QR resuelve la misma ficha que el folio", "la clave del QR no resolvió la ficha");

  const { contexto: c3, pagina: p3 } = await nuevaPagina(navegador);
  for (const q of ["", "?estado=en-curso", "?estado=localizado"]) {
    await irA(p3, `${FICHA}${q}`);
    const texto = await p3.locator("main").innerText();
    const halladas = palabras.filter((w) => texto.includes(w));
    ver(halladas.length === 0, `ficha ${q || "(sin parámetros)"}: ninguna etiqueta de campo reservado en el texto visible`, `ficha ${q}: aparecen ${halladas.join(", ")}`);
  }
  await c3.close();
}

// ---------- PUB-01 ----------
async function principal(navegador: Browser) {
  const { contexto, pagina } = await nuevaPagina(navegador);
  await irA(pagina, "/");
  for (const id of ["buscar-folio", "como-funciona", "preguntas-frecuentes", "aviso-de-privacidad", "contacto"]) {
    ver((await pagina.locator(`section#${id}`).count()) === 1, `PUB-01: existe la sección #${id}`, `PUB-01: falta la sección #${id}`);
  }
  const campo = pagina.getByRole("textbox", { name: "Folio" });
  await pagina.getByRole("button", { name: "Consultar" }).click();
  ver((await campo.getAttribute("aria-invalid")) === "true" && (await textoDescrito(campo)).includes("Escribe el folio"), "buscador: vacío → error asociado con aria-describedby", "buscador: sin error al enviar vacío");
  await campo.fill("RUPE-OOOO1111");
  await pagina.getByRole("button", { name: "Consultar" }).click();
  ver((await textoDescrito(campo)).includes("formato RUPE-XXXXXXXX") && new URL(pagina.url()).pathname === "/", "buscador: folio con formato inválido (O, 1) → error de formato y no navega", "buscador: aceptó un folio inválido");
  await campo.fill(" rupe-k7m4xq9t ");
  await pagina.getByRole("button", { name: "Consultar" }).click();
  await pagina.waitForURL(`**/ficha/${FOLIO_EN_CURSO}`);
  ver(true, "buscador: folio válido (en minúsculas y con espacios) → lleva a su ficha", "");
  await irA(pagina, "/");
  const faq = pagina.getByRole("button", { name: /Necesito una cuenta/ });
  ver((await faq.getAttribute("aria-expanded")) === "false", "preguntas frecuentes: cerradas al inicio", "preguntas frecuentes: abiertas al inicio");
  await faq.click();
  ver((await faq.getAttribute("aria-expanded")) === "true" && (await pagina.getByText(/no pide registro ni datos personales/).first().isVisible()), "preguntas frecuentes: el acordeón abre su respuesta", "preguntas frecuentes: no abrió");
  // Anclas del menú y del pie.
  const hrefs = await pagina.locator("footer a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  ver(["/#aviso-de-privacidad", "/#preguntas-frecuentes", "/#contacto"].every((h) => hrefs.includes(h)), "el pie enlaza a las anclas de la página principal", `pie: ${hrefs.join(", ")}`);

  // MOD-01 desde PUB-01: aviso completo de solo lectura.
  const abrir = pagina.getByRole("button", { name: "Leer aviso completo" });
  for (const via of ["«Cerrar»", "Escape", "clic fuera"] as const) {
    await abrir.click();
    const dlg = pagina.getByRole("dialog", { name: "Aviso de privacidad v1.0" });
    if (via === "«Cerrar»") {
      ver((await dlg.isVisible()) && (await dlg.getByRole("button").allInnerTexts()).join("|") === "Cerrar" && (await dlg.getByRole("button", { name: /Aceptar|Rechazar/ }).count()) === 0, "MOD-01 desde PUB-01: «Aviso de privacidad v1.0», solo lectura (único botón «Cerrar», sin Aceptar ni Rechazar)", "MOD-01 desde PUB-01: contenido o botones incorrectos");
      await dlg.getByRole("button", { name: "Cerrar" }).click();
    } else if (via === "Escape") await pagina.keyboard.press("Escape");
    else await pagina.mouse.click(4, 4);
    ver(!(await pagina.evaluate(() => [...document.querySelectorAll("dialog")].some((d) => d.open))) && (await abrir.evaluate((e) => e === document.activeElement)), `MOD-01 desde PUB-01: ${via} cierra el aviso y el foco vuelve a «Leer aviso completo»`, `MOD-01 desde PUB-01: ${via} no cerró o no devolvió el foco`);
  }
  await irA(pagina, "/?aviso=abierto");
  ver(await pagina.getByRole("dialog", { name: "Aviso de privacidad v1.0" }).isVisible(), "PUB-01 ?aviso=abierto: abre el aviso completo al cargar", "PUB-01 ?aviso=abierto: no abrió el aviso");
  await contexto.close();
}

// ---------- (b) flujo de seis pasos ----------
async function flujo(navegador: Browser) {
  const { contexto, pagina } = await nuevaPagina(navegador);
  await irA(pagina, AVISTAMIENTO);
  ver((await barra(pagina)) === "Paso 1 de 6: Inicio", "flujo: abre en «Paso 1 de 6: Inicio»", `flujo: ${await barra(pagina)}`);
  ver((await regresar(pagina).count()) === 0 && (await pagina.locator("main").innerText()).includes("No se pide registro ni datos personales"), "flujo: el paso 1 no tiene «Regresar» y dice que no se pide registro ni datos personales", "flujo: paso 1 incorrecto");
  await continuar(pagina).click();

  // Paso 2: fotografía obligatoria.
  ver((await barra(pagina)) === "Paso 2 de 6: Fotografía", "flujo: Continuar lleva al paso 2", `flujo: ${await barra(pagina)}`);
  await continuar(pagina).click();
  const archivo = paso(pagina, 2).locator("input[type=file]:not([capture])");
  ver((await barra(pagina)) === "Paso 2 de 6: Fotografía" && (await archivo.getAttribute("aria-invalid")) === "true" && (await textoDescrito(archivo)).includes("obligatoria"), "paso 2: sin fotografía no avanza y el error queda asociado al control (aria-describedby)", "paso 2: avanzó sin fotografía o sin error asociado");
  ver(await archivo.evaluate((e) => e === document.activeElement), "paso 2: el foco pasa al control con error", "paso 2: el foco no pasó al error");
  // Variante ancha (lámina 1.3): caja punteada, «Tomar foto» (cámara) y «Elegir de galería» como botones estándar de 44 px.
  const pasoFoto = paso(pagina, 2);
  const medidas = await Promise.all(["Tomar foto", "Elegir de galería"].map((n) => pasoFoto.getByRole("button", { name: n }).evaluate((b) => { const r = b.getBoundingClientRect(); return { alto: r.height, ancho: r.width, y: r.top, envuelve: b.scrollHeight > b.clientHeight + 1 }; })));
  ver(medidas.every((m) => m.alto >= 43.5 && !m.envuelve) && Math.abs(medidas[0].ancho - medidas[1].ancho) < 1.5, `paso 2: «Tomar foto» y «Elegir de galería» miden ${Math.round(medidas[0].alto)} px de alto, del mismo ancho (${Math.round(medidas[0].ancho)} px) y sin partir el texto`, `paso 2: botones de la fotografía ${JSON.stringify(medidas)}`);
  ver((await pasoFoto.locator("input[type=file][capture]").count()) === 1 && (await pasoFoto.getByText(`Una sola fotografía del avistamiento. JPG o PNG, máx. ${PARAMETROS.tamano_maximo_archivo_mb} MB. Puedes reemplazarla.`).isVisible()) && (await pasoFoto.getByRole("button", { name: "Quitar fotografía" }).count()) === 0, "paso 2: «Tomar foto» usa la cámara (capture), con la ayuda de formato y tamaño máximo del parámetro y sin × de quitar", "paso 2: faltan la cámara, la ayuda o sobra la ×");
  const [selector] = await Promise.all([pagina.waitForEvent("filechooser"), pasoFoto.getByRole("button", { name: "Elegir de galería" }).click()]);
  ver(!!selector, "paso 2: «Elegir de galería» abre el selector de archivos", "paso 2: «Elegir de galería» no abrió el selector");
  await archivo.setInputFiles({ name: "avistamiento.png", mimeType: "image/png", buffer: PNG });
  ver((await paso(pagina, 2).getByAltText("Vista previa de la fotografía").count()) === 1 && (await archivo.getAttribute("aria-invalid")) === null, "paso 2: con fotografía se ve la vista previa y desaparece el error", "paso 2: no hay vista previa o sigue el error");
  const vistaP2 = await pasoFoto.evaluate((cont) => {
    const img = cont.querySelector<HTMLImageElement>("img[alt='Vista previa de la fotografía']")!;
    const marco = img.parentElement!.getBoundingClientRect();
    const reemplazar = [...cont.querySelectorAll("button")].find((b) => b.textContent === "Reemplazar fotografía")!.getBoundingClientRect();
    return { ajuste: getComputedStyle(img).objectFit, marco: marco.width, reemplazar: reemplazar.width, alto: reemplazar.height };
  });
  ver(vistaP2.ajuste === "contain" && Math.abs(vistaP2.marco - vistaP2.reemplazar) < 2 && vistaP2.alto >= 43.5 && (await pasoFoto.getByRole("button", { name: "Tomar foto" }).count()) === 0, "paso 2 con foto: vista previa sin recorte (object-contain) y «Reemplazar fotografía» a todo el ancho y de 44 px", `paso 2 con foto: ${JSON.stringify(vistaP2)}`);
  await continuar(pagina).click();

  // Paso 3: dirección + punto confirmado.
  ver((await barra(pagina)) === "Paso 3 de 6: Ubicación", "flujo: con fotografía, Continuar lleva al paso 3", `flujo: ${await barra(pagina)}`);
  await continuar(pagina).click();
  ver((await barra(pagina)) === "Paso 3 de 6: Ubicación" && (await pagina.getByLabel(/Dirección aproximada/).getAttribute("aria-invalid")) === "true", "paso 3: sin dirección ni punto no avanza", "paso 3: avanzó vacío");
  await pagina.getByLabel(/Dirección aproximada/).fill("Av. Insurgentes y Chilpancingo");
  await pagina.getByLabel(/Alcaldía/).selectOption("Cuauhtémoc");
  await pagina.getByLabel("Colonia o zona (opcional)").fill("Roma Sur");
  await pagina.getByRole("button", { name: "Ubicar en el mapa" }).click();
  await pagina.getByRole("button", { name: "Confirmar punto en el mapa" }).click();
  await continuar(pagina).click();

  // Paso 4: obligatorios y no futura.
  ver((await barra(pagina)) === "Paso 4 de 6: Fecha y estado", "flujo: con el punto confirmado, Continuar lleva al paso 4", `flujo: ${await barra(pagina)}`);
  await continuar(pagina).click();
  const p4 = paso(pagina, 4);
  const faltan = [await p4.locator("input[type=date]").getAttribute("aria-invalid"), await p4.locator("input[type=time]").getAttribute("aria-invalid")];
  const e1 = await textoDescrito(p4.locator("fieldset[data-invalido]").first());
  ver((await barra(pagina)) === "Paso 4 de 6: Fecha y estado" && faltan.every((x) => x === "true") && /al menos una opción/.test(e1) && (await p4.getByText(/Elige una opción de contención y ubicación/).isVisible()), "paso 4: sin fecha, hora ni estados obligatorios no avanza y muestra cada error", `paso 4: avanzó o faltan errores (${faltan}, ${e1})`);
  const manana = new Date(Date.now() + 36 * 3600 * 1000);
  const fechaFutura = `${manana.getFullYear()}-${String(manana.getMonth() + 1).padStart(2, "0")}-${String(manana.getDate()).padStart(2, "0")}`;
  await p4.locator("input[type=date]").fill(fechaFutura);
  await p4.locator("input[type=time]").fill("10:30");
  await etiquetaOpcion(p4, "Herido / lesionado").click();
  await etiquetaOpcion(p4, "Libre en vía pública").click();
  await continuar(pagina).click();
  ver((await barra(pagina)) === "Paso 4 de 6: Fecha y estado" && /posteriores/.test(await textoDescrito(p4.locator("input[type=time]"))), "paso 4: una fecha futura no deja avanzar", "paso 4: aceptó una fecha futura");
  await p4.locator("input[type=date]").fill("2026-10-18");
  await continuar(pagina).click();

  // Paso 5 y 6.
  ver((await barra(pagina)) === "Paso 5 de 6: Comentario", "flujo: completo el paso 4, Continuar lleva al paso 5", `flujo: ${await barra(pagina)}`);
  const comentario = paso(pagina, 5).getByLabel(/Comentario adicional/);
  await comentario.fill("Iba hacia el parque.");
  ver((await paso(pagina, 5).getByText("20/300").isVisible()), "paso 5: el contador muestra «20/300»", "paso 5: contador incorrecto");
  await continuar(pagina).click();
  ver((await barra(pagina)) === "Paso 6 de 6: Confirmar" && (await continuar(pagina).innerText()) === "Enviar reporte", "flujo: paso 6 con el botón «Enviar reporte»", `flujo: ${await barra(pagina)}`);
  const resumen = await paso(pagina, 6).innerText();
  const esperado = ["Av. Insurgentes y Chilpancingo", "Roma Sur", "18 oct 2026, 10:30", "Herido / lesionado", "Libre en vía pública", "Iba hacia el parque.", "Cuauhtémoc", FOLIO_EN_CURSO];
  ver(esperado.every((t) => resumen.includes(t)) && /Tras el envío, la persona tutora recibe un aviso/.test(resumen), "paso 6: el resumen trae lo capturado y avisa que la persona tutora recibe un aviso", `paso 6: falta ${esperado.filter((t) => !resumen.includes(t)).join(", ")}`);

  // Regresar conserva lo capturado.
  for (let n = 5; n >= 2; n--) await regresar(pagina).click();
  ver((await barra(pagina)) === "Paso 2 de 6: Fotografía" && (await paso(pagina, 2).getByAltText("Vista previa de la fotografía").count()) === 1, "Regresar ×4: la fotografía sigue en el paso 2", "Regresar: se perdió la fotografía");
  await continuar(pagina).click();
  ver((await pagina.getByLabel(/Dirección aproximada/).inputValue()) === "Av. Insurgentes y Chilpancingo" && (await pagina.getByLabel(/Alcaldía/).inputValue()) === "Cuauhtémoc" && (await pagina.locator("[data-paso]:not([hidden])").getByText("Punto confirmado").isVisible()), "paso 3 al regresar: dirección, alcaldía y punto confirmado se conservan", "paso 3 al regresar: se perdió lo capturado");
  await continuar(pagina).click();
  ver((await p4.locator("input[type=date]").inputValue()) === "2026-10-18" && (await p4.locator("input[type=time]").inputValue()) === "10:30" && (await casilla(p4, /Herido/).isChecked()) && (await radio(p4, /^Libre en vía pública/).isChecked()), "paso 4 al regresar: fecha, hora y estados se conservan", "paso 4 al regresar: se perdió lo capturado");
  await continuar(pagina).click();
  ver((await comentario.inputValue()) === "Iba hacia el parque.", "paso 5 al regresar: el comentario se conserva", "paso 5 al regresar: se perdió el comentario");
  await continuar(pagina).click();
  await continuar(pagina).click();
  await pagina.waitForURL(`**${FICHA}/avistamiento/enviado`);
  ver(true, "paso 6: «Enviar reporte» con todo completo lleva a «Reporte enviado» (PUB-06)", "");
  const env = await pagina.locator("main").innerText();
  const hrefVer = await pagina.getByRole("link", { name: "Ver ficha" }).getAttribute("href");
  ver((await pagina.getByRole("heading", { level: 1, name: "Reporte enviado" }).isVisible()) && /persona tutora recibirá un aviso/.test(env) && /Gracias/.test(env) && hrefVer === FICHA && (await pagina.getByRole("link", { name: "Ir al inicio" }).isVisible()), "PUB-06: título, agradecimiento, aviso a la persona tutora, «Ver ficha» e «Ir al inicio»", "PUB-06: contenido incorrecto");
  ver(!/Av\. Insurgentes|Roma Sur|Iba hacia el parque|18 oct/.test(env), "PUB-06: no repite lo capturado ni muestra datos personales", "PUB-06: muestra datos capturados");
  // Nada se guarda en el navegador.
  const almacen = await pagina.evaluate(() => ({ local: Object.keys(localStorage).filter((k) => k !== "rupe-tema"), sesion: Object.keys(sessionStorage), cookies: document.cookie }));
  ver(almacen.local.length === 0 && almacen.sesion.length === 0 && almacen.cookies === "", "lo capturado no se guarda en localStorage, sessionStorage ni cookies", `almacenamiento: ${JSON.stringify(almacen)}`);
  await contexto.close();

  // Enviar con pasos incompletos regresa al primero que falta.
  const { contexto: c2, pagina: p2 } = await nuevaPagina(navegador);
  await irA(p2, `${AVISTAMIENTO}?paso=6`);
  await continuar(p2).click();
  ver((await barra(p2)) === "Paso 2 de 6: Fotografía" && (await paso(p2, 2).locator("input[type=file]:not([capture])").getAttribute("aria-invalid")) === "true", "«Enviar reporte» sin datos regresa al primer paso incompleto, con su error", `«Enviar reporte» incompleto: ${await barra(p2)}`);
  await c2.close();
}

// ---------- (c) estado del animal ----------
async function estadoAnimal(navegador: Browser) {
  const { contexto, pagina } = await nuevaPagina(navegador);
  await irA(pagina, `${AVISTAMIENTO}?caso=vacio`);
  const p4 = paso(pagina, 4);
  const cats = await p4.locator("[data-categoria]").count();
  const casillas = await p4.getByRole("checkbox").count();
  const radios = await p4.getByRole("radio").count();
  ver(cats === 4 && casillas + radios === 17 && casillas === 6, `catálogo: 4 categorías y 17 opciones (${casillas} casillas + ${radios} radios)`, `catálogo: ${cats} categorías, ${casillas} casillas, ${radios} radios`);
  const nombres = ["Ileso", "Herido", "Enfermo", "Desnutrido", "Fallecido", "No se puede determinar"];
  const estado = async () => Promise.all(nombres.map(async (n) => ({ n, marcada: await casilla(p4, new RegExp(`^${n}`)).isChecked(), apagada: await casilla(p4, new RegExp(`^${n}`)).isDisabled() })));
  const resumenEstado = async () => (await estado()).map((e) => `${e.n}:${e.marcada ? "✔" : ""}${e.apagada ? "✖" : ""}`).join(" ");

  ver((await estado()).every((e) => !e.marcada && !e.apagada), "sin selección: las 6 casillas de integridad están libres", `sin selección: ${await resumenEstado()}`);
  ver((await p4.getByText("Solo puede elegirse sola").count()) === 3, "«Solo puede elegirse sola» aparece en las 3 opciones excluyentes (con texto, no solo con color)", "etiqueta de excluyentes incorrecta");

  await etiquetaOpcion(p4, "Ileso / Buen estado").click();
  let e = await estado();
  ver(e[0].marcada && e.slice(1).every((x) => x.apagada && !x.marcada), "«Ileso» elegida sola: las otras 5 se deshabilitan", `Ileso: ${await resumenEstado()}`);
  await etiquetaOpcion(p4, "Ileso / Buen estado").click();
  ver((await estado()).every((x) => !x.marcada && !x.apagada), "al quitar «Ileso» todo vuelve a estar libre", `quitar Ileso: ${await resumenEstado()}`);

  await etiquetaOpcion(p4, "Herido / lesionado").click();
  await etiquetaOpcion(p4, "Enfermo / débil").click();
  e = await estado();
  const m = Object.fromEntries(e.map((x) => [x.n, x]));
  ver(m.Herido.marcada && m.Enfermo.marcada && !m.Desnutrido.apagada && m.Ileso.apagada && m.Fallecido.apagada && m["No se puede determinar"].apagada, "combinables: «Herido» + «Enfermo» juntas; «Desnutrido» sigue libre y las 3 excluyentes se deshabilitan", `combinables: ${await resumenEstado()}`);
  await etiquetaOpcion(p4, "Desnutrido / deshidratado").click();
  ver(await casilla(p4, /^Desnutrido/).isChecked(), "se pueden combinar tres opciones", "no combinó tres opciones");
  await etiquetaOpcion(p4, "Herido / lesionado").click();
  await etiquetaOpcion(p4, "Enfermo / débil").click();
  await etiquetaOpcion(p4, "Desnutrido / deshidratado").click();
  ver((await estado()).every((x) => !x.marcada && !x.apagada), "al quitar las combinables las excluyentes se habilitan", `quitar combinables: ${await resumenEstado()}`);

  // Radios de una sola opción y «Quitar selección».
  await etiquetaOpcion(p4, "Libre en vía pública").click();
  await etiquetaOpcion(p4, "Resguardado / En custodia temporal").click();
  const c2 = p4.locator('[data-categoria="2"]');
  ver((await radio(c2, /^Resguardado/).isChecked()) && !(await radio(c2, /^Libre/).isChecked()) && (await c2.getByRole("radio", { checked: true }).count()) === 1, "contención y ubicación: una sola opción a la vez", "contención y ubicación: quedó más de una opción");
  ver((await c2.getByRole("button", { name: "Quitar selección" }).count()) === 0, "contención y ubicación (obligatoria): sin «Quitar selección»", "contención y ubicación tiene «Quitar selección»");
  for (const [id, a, b] of [[3, "Dócil", "Asustado"], [4, "Con placa y collar", "Sin accesorios"]] as const) {
    const c = p4.locator(`[data-categoria="${id}"]`);
    await etiquetaOpcion(c, a).click();
    await etiquetaOpcion(c, b).click();
    const una = (await c.getByRole("radio", { checked: true }).count()) === 1 && (await radio(c, new RegExp(`^${b}`)).isChecked());
    const quitar = c.getByRole("button", { name: "Quitar selección" });
    await quitar.click();
    const ninguna = (await c.getByRole("radio", { checked: true }).count()) === 0 && (await quitar.isDisabled());
    ver(una && ninguna, `categoría ${id} (opcional): una sola opción y «Quitar selección» la deja vacía`, `categoría ${id}: una=${una}, vacía tras quitar=${ninguna}`);
  }

  // «Fallecido» deshabilita Conducta y la vacía.
  const c3 = p4.locator('[data-categoria="3"]');
  await etiquetaOpcion(c3, "Dócil").click();
  await etiquetaOpcion(p4, "Fallecido").click();
  e = await estado();
  const radiosC3 = c3.getByRole("radio");
  const todosApagados = (await radiosC3.evaluateAll((rs) => rs.every((r) => (r as HTMLInputElement).disabled))) && (await radiosC3.count()) === 4;
  const vacia = (await c3.getByRole("radio", { checked: true }).count()) === 0;
  ver(e[4].marcada && e.filter((x) => x.n !== "Fallecido").every((x) => x.apagada) && todosApagados && vacia && (await c3.getByRole("button", { name: "Quitar selección" }).isDisabled()), "«Fallecido»: se deshabilitan las otras de integridad y Conducta (sus 4 opciones y «Quitar selección»), y la opción que tenía se vacía", `Fallecido: ${await resumenEstado()}, conducta apagada=${todosApagados}, vacía=${vacia}`);
  ver(await c3.getByText("Categoría deshabilitada con «Fallecido»").isVisible(), "Conducta explica con texto por qué está deshabilitada", "Conducta no explica por qué está deshabilitada");
  const c4 = p4.locator('[data-categoria="4"]');
  ver(!(await radio(c4, /^Sin accesorios/).isDisabled()) && !(await radio(c2, /^Libre/).isDisabled()), "«Fallecido» no afecta a Contención ni a Identificación visible", "«Fallecido» deshabilitó otras categorías");
  await etiquetaOpcion(p4, "Fallecido").click();
  ver((await radio(c3, /^Dócil/).isEnabled()) && (await c3.getByRole("radio", { checked: true }).count()) === 0, "al quitar «Fallecido» Conducta vuelve a estar disponible y vacía", "Conducta no volvió a estar disponible");

  // Categorías plegables con resumen.
  const botonC3 = c3.getByRole("button", { name: /^Conducta/ });
  await etiquetaOpcion(c3, "Asustado").click();
  await botonC3.click();
  ver((await botonC3.getAttribute("aria-expanded")) === "false" && (await c3.getByText("Resumen: Asustado / temeroso").isVisible()), "categoría plegada: muestra «Resumen: Asustado / temeroso»", "categoría plegada: sin resumen");
  await botonC3.click();
  ver((await radio(c3, /^Asustado/).isChecked()), "al desplegar de nuevo, la selección se conserva", "al desplegar se perdió la selección");
  ver((await c3.getByText("Opcional").isVisible()) && (await p4.locator('[data-categoria="1"]').getByText("Obligatoria").isVisible()), "cada categoría dice «Obligatoria» u «Opcional» con texto", "faltan los rótulos Obligatoria/Opcional");

  // Variante ?caso=fallecido (capturas).
  await irA(pagina, `${AVISTAMIENTO}?caso=fallecido`);
  const p4b = paso(pagina, 4);
  ver((await casilla(p4b, /^Fallecido/).isChecked()) && (await p4b.locator('[data-categoria="3"]').getByRole("radio").first().isDisabled()) && (await barra(pagina)) === "Paso 4 de 6: Fecha y estado", "?caso=fallecido: abre en el paso 4 con «Fallecido» elegido y Conducta deshabilitada", "?caso=fallecido: estado inicial incorrecto");
  await contexto.close();
}

// ---------- (d) paso 3 ----------
async function ubicacion(navegador: Browser) {
  const nueva = async (opciones?: Opciones) => {
    const r = await nuevaPagina(navegador, opciones);
    await irA(r.pagina, `${AVISTAMIENTO}?paso=3`);
    return r;
  };
  const sigueEn3 = async (p: Page) => (await barra(p)) === "Paso 3 de 6: Ubicación";
  const errorPunto = async (p: Page) => (await p.locator("#error-punto").count()) === 1 && (await p.locator("#error-punto").isVisible());
  const mapa = (p: Page) => p.getByRole("group", { name: /^Mapa ilustrativo/ });

  // A · dirección
  let { contexto, pagina } = await nueva();
  ver((await radio(pagina, "Escribir dirección").isChecked()), "paso 3: la forma inicial es «Escribir dirección»", "paso 3: forma inicial incorrecta");
  await pagina.getByLabel(/Dirección aproximada/).fill("Av. Insurgentes y Chilpancingo");
  await pagina.getByLabel(/Alcaldía/).selectOption("Cuauhtémoc");
  await continuar(pagina).click();
  ver((await sigueEn3(pagina)) && (await errorPunto(pagina)), "forma A: con dirección y alcaldía pero sin punto confirmado no avanza («Confirma el punto en el mapa para continuar»)", "forma A: avanzó sin confirmar el punto");
  await pagina.getByRole("button", { name: "Ubicar en el mapa" }).click();
  ver(await pagina.getByText(/Latitud/).isVisible(), "forma A: «Ubicar en el mapa» coloca un punto sugerido con latitud y longitud", "forma A: sin punto sugerido");
  await continuar(pagina).click();
  ver((await sigueEn3(pagina)) && (await pagina.getByText("Confirma el punto en el mapa para continuar").first().isVisible()), "forma A: con el punto sugerido sin confirmar tampoco avanza", "forma A: avanzó con el punto sin confirmar");
  await mapa(pagina).focus();
  for (let i = 0; i < 18; i++) await pagina.keyboard.press("ArrowRight");
  await pagina.getByRole("button", { name: "Confirmar punto en el mapa" }).click();
  ver(await pagina.getByText("La alcaldía cambió").isVisible(), "forma A: si el punto confirmado cae en otra alcaldía se avisa que se guardará la del punto (R14)", "forma A: no avisó del cambio de alcaldía");
  await mapa(pagina).focus();
  await pagina.keyboard.press("ArrowLeft");
  ver((await pagina.getByRole("button", { name: "Confirmar punto en el mapa" }).isVisible()) && (await pagina.locator("[data-paso]:not([hidden])").getByText("Punto confirmado").count()) === 0, "forma A: mover el marcador después de confirmar pide confirmar otra vez", "forma A: mover el marcador conservó la confirmación");
  await pagina.getByRole("button", { name: "Confirmar punto en el mapa" }).click();
  await continuar(pagina).click();
  ver((await barra(pagina)) === "Paso 4 de 6: Fecha y estado", "forma A: con el punto confirmado avanza al paso 4", "forma A: no avanzó con el punto confirmado");
  await contexto.close();

  // A · campos obligatorios al ubicar
  ({ contexto, pagina } = await nueva());
  await pagina.getByRole("button", { name: "Ubicar en el mapa" }).click();
  ver((await pagina.getByLabel(/Dirección aproximada/).getAttribute("aria-invalid")) === "true" && (await pagina.getByLabel(/Alcaldía/).getAttribute("aria-invalid")) === "true", "forma A: «Ubicar en el mapa» sin dirección ni alcaldía marca ambos errores", "forma A: no marcó errores al ubicar vacío");
  await contexto.close();

  // B · mapa
  ({ contexto, pagina } = await nueva());
  await pagina.locator("label", { hasText: "Marcar en mapa" }).click();
  await continuar(pagina).click();
  ver((await sigueEn3(pagina)) && (await errorPunto(pagina)), "forma B: sin marcar el mapa no avanza", "forma B: avanzó sin punto");
  ver(await pagina.getByText("La alcaldía se determina a partir del punto").isVisible(), "forma B: avisa que la alcaldía sale del punto", "forma B: sin aviso de la alcaldía");
  await pagina.getByRole("button", { name: "Confirmar ubicación en mapa" }).click();
  ver((await sigueEn3(pagina)) && (await errorPunto(pagina)) && (await pagina.getByText(/Latitud/).count()) === 0, "forma B: «Confirmar ubicación en mapa» sin punto no confirma nada", "forma B: confirmó sin punto");
  await mapa(pagina).click({ position: { x: 120, y: 60 } });
  const coord = await pagina.locator("p", { hasText: /Latitud/ }).first().innerText();
  ver(/Latitud\s+19\.\d{6}.*Longitud\s+−99\.\d{6}/.test(coord), `forma B: tocar el mapa coloca el marcador con latitud y longitud de 6 decimales (${coord})`, `forma B: coordenadas ${coord}`);
  await continuar(pagina).click();
  ver(await sigueEn3(pagina), "forma B: con el marcador pero sin confirmar no avanza", "forma B: avanzó sin confirmar");
  await pagina.getByRole("button", { name: "Confirmar ubicación en mapa" }).click();
  ver(await pagina.locator("[data-paso]:not([hidden])").getByText("Punto confirmado").isVisible(), "forma B: confirmar muestra «Punto confirmado» con la alcaldía", "forma B: no confirmó");
  await continuar(pagina).click();
  ver((await barra(pagina)) === "Paso 4 de 6: Fecha y estado", "forma B: con el punto confirmado avanza", "forma B: no avanzó");
  await contexto.close();

  // C · usar mi ubicación (permiso concedido)
  ({ contexto, pagina } = await nueva({ geolocalizacion: { latitude: 19.4062, longitude: -99.1716, accuracy: 15 } }));
  await pagina.locator("label", { hasText: "Usar mi ubicación" }).click();
  await continuar(pagina).click();
  ver((await sigueEn3(pagina)) && (await errorPunto(pagina)), "forma C: sin usar la ubicación no avanza", "forma C: avanzó sin ubicación");
  await pagina.getByRole("button", { name: "Usar mi ubicación actual" }).click();
  await pagina.locator("[data-paso]:not([hidden])").getByText("Punto confirmado").waitFor();
  const gps = await pagina.locator("main").innerText();
  ver(/Latitud\s+19\.406200/.test(gps) && /Longitud\s+−99\.171600/.test(gps) && /Precisión de la lectura:\s*±\s*15\s*m/.test(gps), "forma C: la lectura trae latitud, longitud y precisión (± 15 m) y queda confirmada", `forma C: ${gps.slice(0, 200)}`);
  await continuar(pagina).click();
  ver((await barra(pagina)) === "Paso 4 de 6: Fecha y estado", "forma C: con la lectura confirmada avanza", "forma C: no avanzó");
  await contexto.close();

  // C · permiso denegado
  ({ contexto, pagina } = await nueva());
  await pagina.locator("label", { hasText: "Usar mi ubicación" }).click();
  await pagina.getByRole("button", { name: "Usar mi ubicación actual" }).click();
  await pagina.getByText("Permiso de ubicación denegado").waitFor();
  ver((await pagina.getByRole("button", { name: "Escribir dirección" }).isVisible()) && (await pagina.getByRole("button", { name: "Marcar en mapa" }).isVisible()), "forma C: con el permiso denegado se ofrece escribir la dirección o marcar en el mapa", "forma C denegada: faltan alternativas");
  await continuar(pagina).click();
  ver(await sigueEn3(pagina), "forma C denegada: Continuar sin punto no avanza", "forma C denegada: avanzó");
  await pagina.getByRole("button", { name: "Marcar en mapa" }).click();
  ver((await radio(pagina, "Marcar en mapa").isChecked()) && (await mapa(pagina).isVisible()), "forma C denegada: «Marcar en mapa» cambia a esa forma", "forma C denegada: no cambió de forma");
  await contexto.close();

  // Variantes de las capturas.
  for (const [u, texto] of [["direccion", "Confirma el punto en el mapa para continuar"], ["mapa", "La alcaldía se determina a partir del punto"], ["gps", "Precisión de la lectura"], ["denegado", "Permiso de ubicación denegado"]] as const) {
    const r = await nuevaPagina(navegador);
    await irA(r.pagina, `${AVISTAMIENTO}?ubicacion=${u}`);
    ver((await barra(r.pagina)) === "Paso 3 de 6: Ubicación" && (await r.pagina.getByText(texto).first().isVisible()), `?ubicacion=${u}: abre en el paso 3 mostrando «${texto}»`, `?ubicacion=${u}: variante incorrecta`);
    await r.contexto.close();
  }
}

// ---------- (e) desbordes y áreas táctiles ----------
async function geometria(navegador: Browser) {
  const rutas = [
    "/",
    `${FICHA}?estado=en-curso`,
    `${FICHA}?estado=localizado`,
    `${FICHA}?estado=no-disponible`,
    `${FICHA}/avistamiento/enviado`,
    `/ficha/${FOLIO_INEXISTENTE}`,
    ...[1, 2, 3, 4, 5, 6].map((n) => `${AVISTAMIENTO}?paso=${n}&datos=ejemplo`),
    ...["direccion", "mapa", "gps", "denegado"].map((u) => `${AVISTAMIENTO}?ubicacion=${u}`),
    ...["vacio", "combinadas", "fallecido"].map((c) => `${AVISTAMIENTO}?caso=${c}`),
    "/ruta-que-no-existe",
    "/dev/transversales/error",
  ];
  for (const ruta of rutas) {
    for (const ancho of ANCHOS) {
      const { contexto, pagina } = await nuevaPagina(navegador, { ancho });
      await irA(pagina, ruta);
      const etiqueta = `${ruta} ${ancho}px`;
      await desborde(pagina, etiqueta);
      await areasTactiles(pagina, etiqueta);
      await contexto.close();
    }
  }
}

// ---------- reservados de los avistamientos fuera de las pantallas públicas ----------
async function sinReservadosDeAvistamientos() {
  // Dirección aproximada, referencias y comentario de los avistamientos solo los ve la persona tutora dueña (TUT-10).
  const reservados = AVISTAMIENTOS.flatMap((a) => [a.direccionAproximada, a.referencias, a.comentario]).filter((v): v is string => Boolean(v));
  const rutas = ["/", "/registro", "/registro?estado=aviso", "/acceso", "/acceso?estado=aviso-actualizado", "/ruta-que-no-existe", "/dev/transversales/error", "/dev/visitante"];
  for (const o of CASOS_ORIGEN) {
    for (const clave of [o.folio, o.tokenPublico]) rutas.push(`/ficha/${clave}`, `/ficha/${clave}?estado=localizado`, `/ficha/${clave}?estado=no-disponible`);
    rutas.push(`/ficha/${o.folio}/avistamiento?paso=6&datos=ejemplo`, `/ficha/${o.folio}/avistamiento/enviado`);
  }
  let fugas = 0;
  for (const ruta of rutas) {
    const html = await (await fetch(`${base}${ruta}`)).text();
    const dentro = reservados.filter((v) => html.includes(v));
    if (dentro.length) {
      fugas++;
      console.log(`✗ ${ruta.replace(/RUPE-[A-Z0-9]{8}|\/ficha\/[A-Za-z0-9]{32}/, "<clave>")} muestra ${dentro.length} dato(s) reservado(s) de avistamientos`);
    }
  }
  ver(fugas === 0, `sin dirección aproximada, referencias ni comentarios de avistamientos en ${rutas.length} respuestas públicas (PUB-01, PUB-03 en todos sus estados, PUB-05, PUB-06, ACC, TRA-01 y TRA-04)`, `${fugas} pantalla(s) pública(s) con datos reservados de avistamientos`);
  const control = await (await fetchComo(base, "tutor1", `/tutor/casos/${AVISTAMIENTOS[0].folio}/avistamientos/${AVISTAMIENTOS[0].id}`)).text(); // la ruta de la persona tutora exige su sesión
  ver(control.includes(AVISTAMIENTOS[0].direccionAproximada!), "control: TUT-10 sí muestra esos datos a la persona tutora dueña (la búsqueda de fugas los detecta)", "control: TUT-10 no muestra la dirección aproximada");
}

// ---------- enlaces internos sin 404 ----------
async function enlacesInternos(navegador: Browser) {
  const pantallas = ["/", "/registro", "/acceso", FICHA, `${FICHA}?estado=localizado`, `${FICHA}?estado=no-disponible`, `${AVISTAMIENTO}?paso=1`, `${AVISTAMIENTO}?paso=3`, `${AVISTAMIENTO}?paso=6&datos=ejemplo`, `${FICHA}/avistamiento/enviado`, "/ruta-que-no-existe", "/dev/transversales/error"];
  const { contexto, pagina } = await nuevaPagina(navegador, { ancho: 1280 });
  const vistos = new Map<string, string>();
  for (const ruta of pantallas) {
    await pagina.goto(`${base}${ruta}`, { waitUntil: "load" });
    for (const h of await pagina.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")!))) if (h.startsWith("/")) vistos.set(h.split("#")[0] || "/", ruta);
  }
  await contexto.close();
  const m = await nuevaPagina(navegador, { ancho: 390 });
  await m.pagina.goto(`${base}/`, { waitUntil: "load" });
  await m.pagina.getByRole("button", { name: "Menú", exact: true }).click();
  for (const h of await m.pagina.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")!))) if (h.startsWith("/")) vistos.set(h.split("#")[0] || "/", "/ (menú móvil)");
  await m.contexto.close();
  const malos: string[] = [];
  for (const [ruta, origen] of vistos) {
    const r = await fetch(`${base}${ruta}`, { redirect: "follow" });
    if (r.status === 404 || r.status >= 500) malos.push(`${ruta} → ${r.status} (desde ${origen})`);
  }
  ver(malos.length === 0, `enlaces internos de las pantallas del Visitante: ${vistos.size} rutas distintas, ninguna responde 404`, `enlaces rotos: ${malos.join(" | ")}`);
}

// ---------- TRA-01 y TRA-04 ----------
async function transversales(navegador: Browser) {
  const { contexto, pagina } = await nuevaPagina(navegador);
  const r = await pagina.goto(`${base}/ruta-que-no-existe`, { waitUntil: "load" });
  ver(r?.status() === 404, "TRA-01: una ruta inexistente responde 404", `TRA-01: estado ${r?.status()}`);
  ver((await pagina.getByRole("heading", { level: 1, name: "Página no encontrada" }).isVisible()) && (await pagina.getByRole("link", { name: "Ir al inicio" }).isVisible()) && (await pagina.getByRole("link", { name: "Consultar un folio" }).isVisible()), "TRA-01: título, «Ir al inicio» y «Consultar un folio» dentro de la plantilla pública", "TRA-01: contenido incorrecto");
  ver((await pagina.locator("main#contenido").count()) === 1 && (await pagina.locator("header").count()) >= 1 && (await pagina.locator("footer").count()) === 1, "TRA-01: un solo <main id=\"contenido\"> con encabezado y pie", "TRA-01: estructura incorrecta");
  await irA(pagina, "/dev/transversales/error");
  ver((await pagina.getByRole("heading", { level: 1, name: "Algo salió mal" }).isVisible()) && (await pagina.getByRole("button", { name: "Reintentar" }).isVisible()) && !/datos capturados se conservan/.test(await pagina.locator("main").innerText()) && (await pagina.getByRole("link", { name: "Ir al inicio" }).isVisible()), "TRA-04: título, texto neutral (sin «Tus datos capturados se conservan»), «Reintentar» e «Ir al inicio»", "TRA-04: contenido incorrecto");
  await contexto.close();
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
    await principal(navegador);
    await ficha(navegador);
    await flujo(navegador);
    await estadoAnimal(navegador);
    await ubicacion(navegador);
    await transversales(navegador);
    await sinReservadosDeAvistamientos();
    await enlacesInternos(navegador);
    await geometria(navegador);
  } finally {
    await navegador?.close();
    apagar();
  }
  console.log(fallos === 0 ? "\nOK: pantallas del Visitante verificadas" : `\n${fallos} verificación(es) fallida(s)`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
