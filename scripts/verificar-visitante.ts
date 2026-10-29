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
import { CATALOGOS } from "../src/mocks/catalogosAdmin";
import { CASOS_ORIGEN, FOLIO_EN_CURSO, FOLIO_INEXISTENTE, valoresReservados } from "../src/mocks/casos";
import { CLAVE_TEMA } from "../src/lib/tema";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PORTADA_ALT, PORTADA_ARCHIVOS } from "../src/config/portada";

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

type Opciones = { ancho?: number; tema?: "light" | "dark"; geolocalizacion?: { latitude: number; longitude: number; accuracy: number } };
async function nuevaPagina(navegador: Browser, { ancho = 390, tema = "light", geolocalizacion }: Opciones = {}): Promise<{ contexto: BrowserContext; pagina: Page }> {
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: 900 },
    colorScheme: tema,
    ...(geolocalizacion && { geolocation: geolocalizacion, permissions: ["geolocation"] }),
  });
  await contexto.addInitScript(([k, v]) => localStorage.setItem(k, v), [CLAVE_TEMA, tema]);
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
  ver(vistas[0].estado === 404 && vistas[1].estado === 404 && vistas[0].html === vistas[1].html && vistas[2].html === vistas[0].html, `ficha C: folio inexistente y caso cerrado responden igual (HTTP ${vistas[0].estado} real) y con el mismo contenido que la variante ?estado=no-disponible`, "ficha C: las respuestas difieren, se revelaría que el caso existió");
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
  ver(new URL(p2.url()).pathname === `/ficha/${toby.folio}/avistamiento` && (await p2.getByRole("heading", { name: "Este caso ya no recibe avistamientos" }).isVisible()) && (await p2.getByRole("link", { name: "Volver a la ficha" }).getAttribute("href")) === `/ficha/${toby.folio}`, "el reporte de un caso «Localizado» muestra «Este caso ya no recibe avistamientos» con enlace a su ficha (R13)", `el reporte de un caso Localizado no avisó: ${p2.url()}`);
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
  await pagina.getByRole("button", { name: "Buscar" }).click();
  ver((await campo.getAttribute("aria-invalid")) === "true" && (await textoDescrito(campo)).includes("Escribe el folio"), "buscador: vacío → error asociado con aria-describedby", "buscador: sin error al enviar vacío");
  await campo.fill("RUPE-OOOO1111");
  await pagina.getByRole("button", { name: "Buscar" }).click();
  ver((await textoDescrito(campo)).includes("formato RUPE-XXXXXXXX") && new URL(pagina.url()).pathname === "/", "buscador: folio con formato inválido (O, 1) → error de formato y no navega", "buscador: aceptó un folio inválido");
  await campo.fill(" rupe-k7m4xq9t ");
  await pagina.getByRole("button", { name: "Buscar" }).click();
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
  await paso(pagina, 2).getByAltText("Vista previa de la fotografía").waitFor(); // la fotografía se reduce en el navegador (asíncrono)
  ver((await paso(pagina, 2).getByAltText("Vista previa de la fotografía").count()) === 1 && (await archivo.getAttribute("aria-invalid")) === null, "paso 2: con fotografía se ve la vista previa y desaparece el error", "paso 2: no hay vista previa o sigue el error");
  const vistaP2 = await pasoFoto.evaluate((cont) => {
    const img = cont.querySelector<HTMLImageElement>("img[alt='Vista previa de la fotografía']")!;
    const marco = img.parentElement!.getBoundingClientRect();
    const reemplazar = [...cont.querySelectorAll("button")].find((b) => b.textContent === "Reemplazar fotografía")!.getBoundingClientRect();
    return { ajuste: getComputedStyle(img).objectFit, marco: marco.width, reemplazar: reemplazar.width, alto: reemplazar.height };
  });
  ver(vistaP2.ajuste === "contain" && Math.abs(vistaP2.marco - vistaP2.reemplazar) < 2 && vistaP2.alto >= 43.5 && (await pasoFoto.getByRole("button", { name: "Tomar foto" }).count()) === 0, "paso 2 con foto: vista previa sin recorte (object-contain) y «Reemplazar fotografía» a todo el ancho y de 44 px", `paso 2 con foto: ${JSON.stringify(vistaP2)}`);
  await continuar(pagina).click();

  // Paso 3: dirección, alcaldía, colonia y referencias (mapa y GPS «Próximamente»; ubicación aproximada simulada).
  ver((await barra(pagina)) === "Paso 3 de 6: Ubicación", "flujo: con fotografía, Continuar lleva al paso 3", `flujo: ${await barra(pagina)}`);
  await continuar(pagina).click();
  ver((await barra(pagina)) === "Paso 3 de 6: Ubicación" && (await pagina.getByLabel(/Dirección aproximada/).getAttribute("aria-invalid")) === "true" && (await pagina.getByLabel(/Alcaldía/).getAttribute("aria-invalid")) === "true", "paso 3: sin dirección ni alcaldía no avanza y marca ambos errores", "paso 3: avanzó vacío");
  const p3 = paso(pagina, 3);
  ver((await p3.getByRole("button", { name: "Marcar en mapa" }).isDisabled()) && (await p3.getByRole("button", { name: "Usar mi ubicación" }).isDisabled()) && (await p3.getByText("Próximamente").count()) === 2 && (await p3.getByText("Ubicación aproximada simulada en el prototipo").isVisible()), "paso 3: «Marcar en mapa» y «Usar mi ubicación» están deshabilitados con «Próximamente» y la nota «Ubicación aproximada simulada en el prototipo»", "paso 3: faltan los controles «Próximamente» o la nota de ubicación simulada");
  await pagina.getByLabel(/Dirección aproximada/).fill("Av. Insurgentes y Chilpancingo");
  await pagina.getByLabel(/Alcaldía/).selectOption({ label: "Cuauhtémoc" });
  await pagina.getByLabel("Colonia o zona (opcional)").fill("Roma Sur");
  await continuar(pagina).click();

  // Paso 4: obligatorios y no futura.
  ver((await barra(pagina)) === "Paso 4 de 6: Fecha y estado", "flujo: con dirección y alcaldía, Continuar lleva al paso 4", `flujo: ${await barra(pagina)}`);
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
  const esperado = ["Av. Insurgentes y Chilpancingo", "Roma Sur", "18 oct 2026, 10:30", "Herido / lesionado", "Libre en vía pública", "Iba hacia el parque.", "Cuauhtémoc", FOLIO_EN_CURSO, "Ubicación aproximada simulada en el prototipo"];
  ver(esperado.every((t) => resumen.includes(t)) && /Tras el envío, la persona tutora recibe un aviso/.test(resumen), "paso 6: el resumen trae lo capturado y avisa que la persona tutora recibe un aviso", `paso 6: falta ${esperado.filter((t) => !resumen.includes(t)).join(", ")}`);

  // Regresar conserva lo capturado.
  for (let n = 5; n >= 2; n--) await regresar(pagina).click();
  ver((await barra(pagina)) === "Paso 2 de 6: Fotografía" && (await paso(pagina, 2).getByAltText("Vista previa de la fotografía").count()) === 1, "Regresar ×4: la fotografía sigue en el paso 2", "Regresar: se perdió la fotografía");
  await continuar(pagina).click();
  ver((await pagina.getByLabel(/Dirección aproximada/).inputValue()) === "Av. Insurgentes y Chilpancingo" && (await pagina.getByLabel(/Alcaldía/).evaluate((e) => (e as HTMLSelectElement).selectedOptions[0]?.textContent)) === "Cuauhtémoc" && (await pagina.getByLabel("Colonia o zona (opcional)").inputValue()) === "Roma Sur", "paso 3 al regresar: dirección, alcaldía y colonia se conservan", "paso 3 al regresar: se perdió lo capturado");
  await continuar(pagina).click();
  ver((await p4.locator("input[type=date]").inputValue()) === "2026-10-18" && (await p4.locator("input[type=time]").inputValue()) === "10:30" && (await casilla(p4, /Herido/).isChecked()) && (await radio(p4, /^Libre en vía pública/).isChecked()), "paso 4 al regresar: fecha, hora y estados se conservan", "paso 4 al regresar: se perdió lo capturado");
  await continuar(pagina).click();
  ver((await comentario.inputValue()) === "Iba hacia el parque.", "paso 5 al regresar: el comentario se conserva", "paso 5 al regresar: se perdió el comentario");
  await continuar(pagina).click();
  await continuar(pagina).click();
  await pagina.waitForURL((u) => u.pathname === `${FICHA}/avistamiento/enviado`);
  const idEnviado = new URL(pagina.url()).searchParams.get("id");
  ver(/^\d+$/.test(idEnviado ?? ""), `paso 6: «Enviar reporte» hace el envío REAL (POST /api/avistamientos) y lleva a «Reporte enviado» con el ID ${idEnviado} en la URL (PUB-06)`, `paso 6: el envío no devolvió un ID (${pagina.url()})`);
  const env = await pagina.locator("main").innerText();
  const hrefVer = await pagina.getByRole("link", { name: "Ver ficha" }).getAttribute("href");
  ver((await pagina.getByRole("heading", { level: 1, name: "Reporte enviado" }).isVisible()) && /persona tutora recibirá un aviso/.test(env) && /Gracias/.test(env) && new RegExp(`ID de tu reporte: ${idEnviado}`).test(env) && hrefVer === FICHA && (await pagina.getByRole("link", { name: "Ir al inicio" }).isVisible()), "PUB-06: título, agradecimiento, «ID de tu reporte», aviso a la persona tutora, «Ver ficha» e «Ir al inicio»", "PUB-06: contenido incorrecto");
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
  const { contexto, pagina } = await nuevaPagina(navegador);
  await irA(pagina, `${AVISTAMIENTO}?paso=3`);
  const sigueEn3 = async () => (await barra(pagina)) === "Paso 3 de 6: Ubicación";
  const dir = pagina.getByLabel(/Dirección aproximada/);
  const alc = pagina.getByLabel(/Alcaldía/);
  const opciones = await alc.locator("option").allTextContents();
  ver(opciones.length === 17 && !opciones.some((o) => /Fuera de la/.test(o)) && opciones.includes("Milpa Alta"), `paso 3: la alcaldía ofrece las ${opciones.length - 1} alcaldías del catálogo (todas activas en el Prototipo, incluida Milpa Alta; sin «Fuera de la Ciudad de México») más el marcador`, `paso 3: opciones ${opciones.join(", ")}`);
  await continuar(pagina).click();
  ver((await sigueEn3()) && (await dir.getAttribute("aria-invalid")) === "true" && (await alc.getAttribute("aria-invalid")) === "true", "paso 3: sin dirección ni alcaldía no avanza", "paso 3: avanzó vacío");
  await dir.fill("Av. Insurgentes y Chilpancingo");
  await continuar(pagina).click();
  ver((await sigueEn3()) && (await dir.getAttribute("aria-invalid")) === null && (await alc.getAttribute("aria-invalid")) === "true", "paso 3: con dirección pero sin alcaldía no avanza y solo marca la alcaldía", "paso 3: el error de alcaldía no se aisló");
  await alc.selectOption({ label: "Cuauhtémoc" });
  await continuar(pagina).click();
  ver((await barra(pagina)) === "Paso 4 de 6: Fecha y estado", "paso 3: con dirección y alcaldía avanza (colonia y referencias son opcionales)", "paso 3: no avanzó con dirección y alcaldía");
  await regresar(pagina).click();
  const limites = await Promise.all([dir.getAttribute("maxlength"), pagina.getByLabel("Colonia o zona (opcional)").getAttribute("maxlength"), pagina.getByLabel(/Referencias del lugar/).getAttribute("maxlength")]);
  ver(limites.join() === "200,100,500", `paso 3: los campos limitan la entrada a 200 (dirección), 100 (colonia) y 500 (referencias) caracteres: ${limites.join(", ")}`, `paso 3: límites ${limites.join(", ")}`);
  await contexto.close();

  // Sin mapa ni GPS en el Prototipo: ninguna forma de «marcar» ni de pedir el permiso de ubicación.
  const g = await nuevaPagina(navegador, { geolocalizacion: { latitude: 19.4062, longitude: -99.1716, accuracy: 15 } });
  await irA(g.pagina, `${AVISTAMIENTO}?paso=3`);
  const solicitudes = await g.pagina.evaluate(() => typeof navigator.geolocation !== "undefined");
  await g.pagina.getByRole("button", { name: "Usar mi ubicación" }).click({ force: true, timeout: 2000 }).catch(() => undefined);
  ver(solicitudes && (await barra(g.pagina)) === "Paso 3 de 6: Ubicación" && (await g.pagina.getByText(/Latitud|Punto confirmado|Permiso de ubicación/).count()) === 0, "paso 3: «Usar mi ubicación» deshabilitado no pide el permiso ni muestra coordenadas, aunque el navegador lo conceda", "paso 3: el botón de ubicación hizo algo");
  await g.contexto.close();

  // Las variantes de captura de la maqueta (?ubicacion=mapa|gps|denegado) se retiraron: el parámetro se ignora.
  const r = await nuevaPagina(navegador);
  const respuestas: string[] = [];
  for (const u of ["direccion", "mapa", "gps", "denegado"]) {
    await irA(r.pagina, `${AVISTAMIENTO}?paso=3&ubicacion=${u}`);
    respuestas.push(`${u}:${(await r.pagina.getByText(/Latitud|Permiso de ubicación denegado|Confirmar ubicación en mapa/).count()) === 0 ? "sin cambios" : "variante"}`);
  }
  ver(respuestas.every((x) => x.endsWith("sin cambios")), `?ubicacion=… ya no existe: las cuatro variantes abren el mismo paso 3 sin mapa, lectura ni permiso denegado (${respuestas.join(", ")})`, `?ubicacion=: ${respuestas.join(", ")}`);
  await r.contexto.close();
}


// ---------- (f) recorrido real de cada opción ACTIVA del catálogo de estados del animal ----------
/** Estados del animal del catálogo sembrado. En el Prototipo el seed los deja TODOS activos (aunque las pantallas del Administrador conserven sus banderas); lo desactivado se prueba con un almacén de prueba en `probar`. */
const ESTADOS_DEL_CATALOGO = (CATALOGOS["estados-animal"].elementos as unknown as { id: number; nombre: string; idCategoria: number }[]).map((e) => ({ id: e.id, nombre: e.nombre, activo: true, idCategoria: e.idCategoria }));
const NOMBRES_CATEGORIA: Record<number, string> = { 1: "Integridad física y salud", 2: "Contención y ubicación", 3: "Conducta", 4: "Identificación visible" };

async function recorridoDeOpciones(navegador: Browser) {
  const activos = ESTADOS_DEL_CATALOGO.filter((e) => e.activo);
  const base = { 1: 1, 2: 7 } as Record<number, number>;
  // Combinación mínima válida para cada opción activa: ella sola en su categoría y las obligatorias restantes con «Ileso» y «Libre en vía pública».
  const combinacion = (e: { id: number; idCategoria: number }) => ({ ...base, [e.idCategoria]: e.id });
  const abrirCategoria = async (p4: Locator, idCategoria: number) => {
    const cabecera = p4.locator(`[data-categoria="${idCategoria}"]`).getByRole("button", { name: new RegExp(NOMBRES_CATEGORIA[idCategoria]) }).first();
    if ((await cabecera.getAttribute("aria-expanded")) === "false") await cabecera.click();
  };
  const fallas: string[] = [];
  let primeraVez = true;
  for (const opcion of activos) {
    const { contexto, pagina } = await nuevaPagina(navegador);
    await irA(pagina, AVISTAMIENTO);
    await continuar(pagina).click();
    await paso(pagina, 2).locator("input[type=file]:not([capture])").setInputFiles({ name: "avistamiento.png", mimeType: "image/png", buffer: PNG });
    await paso(pagina, 2).getByAltText("Vista previa de la fotografía").waitFor();
    await continuar(pagina).click();
    await pagina.getByLabel(/Dirección aproximada/).fill("Av. Insurgentes y Chilpancingo");
    await pagina.getByLabel(/Alcaldía/).selectOption({ label: "Cuauhtémoc" });
    await continuar(pagina).click();
    const p4 = paso(pagina, 4);
    await p4.locator("input[type=date]").fill("2026-10-18");
    await p4.locator("input[type=time]").fill("10:30");
    if (primeraVez) {
      // Ninguna opción DESACTIVADA del catálogo se ofrece, y las activas se ofrecen todas.
      for (const c of [1, 2, 3, 4]) await abrirCategoria(p4, c);
      const ofrecidas = await p4.locator("label").allInnerTexts();
      const faltan = activos.filter((a) => !ofrecidas.some((t) => t.includes(a.nombre)));
      ver(faltan.length === 0 && ofrecidas.length >= activos.length, `paso 4: se ofrecen las ${activos.length} opciones del catálogo sembrado (todas activas), cada una con su nombre`, `paso 4: falta alguna opción activa (${faltan.map((x) => x.nombre).join(", ")})`);
      primeraVez = false;
    }
    for (const [cat, id] of Object.entries(combinacion(opcion))) {
      const nombre = ESTADOS_DEL_CATALOGO.find((e) => e.id === id)!.nombre;
      await abrirCategoria(p4, Number(cat));
      await etiquetaOpcion(p4, nombre).first().click();
    }
    await continuar(pagina).click();
    await continuar(pagina).click();
    await continuar(pagina).click();
    let id: string | null = null;
    try {
      await pagina.waitForURL((u) => u.pathname === `${FICHA}/avistamiento/enviado`, { timeout: 8000 });
      id = new URL(pagina.url()).searchParams.get("id");
    } catch {
      id = null;
    }
    const mensaje = id ? "" : `paso ${await barra(pagina)}; ${(await pagina.locator('[role="alert"], [id^="error-"]').allInnerTexts()).join(" | ") || "sin mensaje"}`;
    ver(!!id && /^\d+$/.test(id), `opción activa «${opcion.nombre}» (id ${opcion.id}, ${NOMBRES_CATEGORIA[opcion.idCategoria]}): el envío real termina en «Reporte enviado» con ID ${id}`, `opción activa «${opcion.nombre}» (id ${opcion.id}): el envío NO terminó (${mensaje})`);
    if (!id) fallas.push(opcion.nombre);
    await contexto.close();
  }

  // Las categorías opcionales (Conducta e Identificación visible): se puede continuar sin elegir nada y una opción ya elegida se quita con «Quitar selección».
  const { contexto, pagina } = await nuevaPagina(navegador);
  await irA(pagina, `${AVISTAMIENTO}?paso=4&caso=libre`);
  const p4 = paso(pagina, 4);
  await p4.locator("input[type=date]").fill("2026-10-18");
  await p4.locator("input[type=time]").fill("10:30");
  await continuar(pagina).click();
  const sinElegir = (await barra(pagina)) === "Paso 5 de 6: Comentario";
  await regresar(pagina).click();
  const elegir = async (idCategoria: number, id: number) => {
    await abrirCategoria(p4, idCategoria);
    await etiquetaOpcion(p4, ESTADOS_DEL_CATALOGO.find((e) => e.id === id)!.nombre).first().click();
  };
  await elegir(3, 11);
  await elegir(4, 16);
  const marcadas = await p4.locator('[data-categoria="3"] input:checked, [data-categoria="4"] input:checked').count();
  for (const c of [3, 4]) await p4.locator(`[data-categoria="${c}"]`).getByRole("button", { name: "Quitar selección" }).click();
  const quedan = await p4.locator('[data-categoria="3"] input:checked, [data-categoria="4"] input:checked').count();
  await continuar(pagina).click();
  ver(sinElegir && marcadas === 2 && quedan === 0 && (await barra(pagina)) === "Paso 5 de 6: Comentario", "categorías opcionales (Conducta e Identificación visible): se continúa sin elegir nada, y una opción elegida (incluida «Con collar sin datos», id 16) se quita con «Quitar selección» y se sigue", `categorías opcionales: sin elegir ${sinElegir}, marcadas ${marcadas}, tras quitar ${quedan}`);
  await contexto.close();
}


// ---------- (g) paso 5: invitación a dejar un correo cuando el animal está bajo resguardo ----------
const PLACEHOLDER_RESGUARDO = "Dado que tienes al animal en resguardo, te invitamos a agregar un correo electrónico para que la persona tutora se ponga en contacto contigo. Gracias por tu ayuda.";
const NOTA_CORREO = "Este comentario lo verá la persona tutora. Si decides compartir un correo electrónico, será visible para ella; no incluyas otros datos personales.";

async function comentarioConCorreo(navegador: Browser) {
  const nombreDe = (id: number) => ESTADOS_DEL_CATALOGO.find((e) => e.id === id)!.nombre;
  /** Abre el paso 4 con «Ileso» (o lo indicado en Integridad) y la opción de Contención indicada, y avanza al paso 5. */
  async function hastaComentario(pagina: Page, integridad: number, contencion: number) {
    await irA(pagina, `${AVISTAMIENTO}?paso=4`);
    const p4 = paso(pagina, 4);
    await p4.locator("input[type=date]").fill("2026-10-18");
    await p4.locator("input[type=time]").fill("10:30");
    await etiquetaOpcion(p4, nombreDe(integridad)).first().click();
    await etiquetaOpcion(p4, nombreDe(contencion)).first().click();
    await continuar(pagina).click();
  }
  const campo = (pagina: Page) => paso(pagina, 5).getByLabel(/Comentario adicional/);
  const nota = (pagina: Page) => paso(pagina, 5).getByText(NOTA_CORREO, { exact: true });
  const describe = async (pagina: Page) => (await campo(pagina).getAttribute("aria-describedby")) ?? "";

  // Con cada una de las tres opciones de resguardo (y con «Fallecido» + resguardo): placeholder exacto, nota permanente y aria-describedby.
  for (const [integridad, contencion] of [[1, 8], [1, 9], [1, 10], [5, 8], [5, 9], [5, 10]] as const) {
    const { contexto, pagina } = await nuevaPagina(navegador);
    await hastaComentario(pagina, integridad, contencion);
    const ph = await campo(pagina).getAttribute("placeholder");
    const idNota = await paso(pagina, 5).getByText(NOTA_CORREO, { exact: true }).getAttribute("id");
    ver(ph === PLACEHOLDER_RESGUARDO && (await nota(pagina).isVisible()) && !!idNota && (await describe(pagina)).split(/\s+/).includes(idNota), `paso 5 con «${nombreDe(integridad)}» + «${nombreDe(contencion)}»: placeholder exacto de resguardo y nota visible enlazada por aria-describedby`, `paso 5 con ${integridad}+${contencion}: placeholder «${ph}», nota ${await nota(pagina).count()}, describedby «${await describe(pagina)}»`);
    await contexto.close();
  }
  // Sin resguardo («Libre en vía pública», también con «Fallecido»): se conserva el placeholder actual y no hay nota.
  for (const integridad of [1, 5]) {
    const { contexto, pagina } = await nuevaPagina(navegador);
    await hastaComentario(pagina, integridad, 7);
    ver(((await campo(pagina).getAttribute("placeholder")) ?? "") === "" && (await nota(pagina).count()) === 0 && !(await describe(pagina)).includes("nota-correo"), `paso 5 con «${nombreDe(integridad)}» + «Libre en vía pública»: sin placeholder de resguardo ni nota`, `paso 5 con ${integridad}+7: aparece la invitación al correo`);
    await contexto.close();
  }
  // Cambiar la elección al volver: se actualiza y el texto escrito se conserva.
  {
    const { contexto, pagina } = await nuevaPagina(navegador);
    await hastaComentario(pagina, 1, 8);
    await campo(pagina).fill("Lo tengo en mi casa: persona@example.com");
    await regresar(pagina).click();
    const p4 = paso(pagina, 4);
    await etiquetaOpcion(p4, nombreDe(7)).first().click();
    await continuar(pagina).click();
    const sin = ((await campo(pagina).getAttribute("placeholder")) ?? "") === "" && (await nota(pagina).count()) === 0;
    const texto = await campo(pagina).inputValue();
    await regresar(pagina).click();
    await etiquetaOpcion(p4, nombreDe(9)).first().click();
    await continuar(pagina).click();
    const con = (await campo(pagina).getAttribute("placeholder")) === PLACEHOLDER_RESGUARDO && (await nota(pagina).isVisible());
    ver(sin && con && texto === "Lo tengo en mi casa: persona@example.com" && (await campo(pagina).inputValue()) === texto, "paso 5: al volver y cambiar «Contención y ubicación» la invitación aparece y desaparece según la elección, y el texto escrito se conserva", `paso 5 al volver: sin=${sin} con=${con} texto=«${texto}»`);
    await continuar(pagina).click();
    const resumen = paso(pagina, 6);
    ver((await pagina.locator('a[href^="mailto:" i]').count()) === 0 && (await resumen.innerText()).includes("persona@example.com"), "el correo escrito es texto del comentario: el resumen lo muestra como texto y ninguna pantalla lo convierte en enlace mailto", "el correo se convirtió en enlace o no se muestra");
    await contexto.close();
  }
  // Geometría del paso 5 en claro y oscuro, con y sin invitación, a 390, 768 y 1280 px.
  for (const tema of ["light", "dark"] as const) {
    for (const ancho of ANCHOS) {
      for (const [ruta, etiqueta] of [[`${AVISTAMIENTO}?paso=5&datos=ejemplo`, "con invitación"], [`${AVISTAMIENTO}?paso=5`, "sin invitación"]] as const) {
        const { contexto, pagina } = await nuevaPagina(navegador, { ancho, tema });
        await irA(pagina, ruta);
        const e = `paso 5 ${etiqueta} ${ancho}px ${tema === "light" ? "claro" : "oscuro"}`;
        await desborde(pagina, e);
        await areasTactiles(pagina, e);
        await contexto.close();
      }
    }
  }
}


// ---------- (h) el servidor rechaza una opción que ya no está disponible: mensaje amable en su categoría o al inicio del paso ----------
async function opcionNoDisponible(navegador: Browser) {
  const AMABLE = "Una de las opciones elegidas ya no está disponible. Revisa tus selecciones.";
  /** Desde el paso 4 (con lo que traiga la variante) completa fecha, hora, foto y ubicación y pulsa «Enviar reporte». */
  async function enviarCompleto(pagina: Page) {
    const p4 = paso(pagina, 4);
    await p4.locator("input[type=date]").fill("2026-10-18");
    await p4.locator("input[type=time]").fill("10:30");
    await continuar(pagina).click(); // → 5
    await continuar(pagina).click(); // → 6
    await continuar(pagina).click(); // Enviar: sin foto ni ubicación regresa al paso 2
    await paso(pagina, 2).locator("input[type=file]:not([capture])").setInputFiles({ name: "avistamiento.png", mimeType: "image/png", buffer: PNG });
    await paso(pagina, 2).getByAltText("Vista previa de la fotografía").waitFor();
    await continuar(pagina).click();
    await pagina.getByLabel(/Dirección aproximada/).fill("Av. Insurgentes y Chilpancingo");
    await pagina.getByLabel(/Alcaldía/).selectOption({ label: "Cuauhtémoc" });
    await continuar(pagina).click(); // → 4
    await continuar(pagina).click(); // → 5
    await continuar(pagina).click(); // → 6
    await continuar(pagina).click(); // Enviar de verdad
  }
  // A · Una opción desactivada (id 16, que ya no se ofrece) llegó al servidor: el mensaje queda en SU categoría, con foco, y la opción se quita de la selección.
  {
    const { contexto, pagina } = await nuevaPagina(navegador);
    // El servidor responde lo que respondería con un valor desactivado (se prueba en `probar` con un almacén de prueba); aquí se verifica cómo lo pinta la pantalla.
    await pagina.route("**/api/avistamientos", (ruta) => ruta.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: { codigo: "VALIDACION", mensaje: "Revisa los campos marcados.", campos: { estadosAnimal: AMABLE } } }) }));
    await irA(pagina, `${AVISTAMIENTO}?caso=no-disponible`);
    await enviarCompleto(pagina);
    await paso(pagina, 4).getByText(AMABLE).first().waitFor();
    const p4 = paso(pagina, 4);
    const categoria4 = p4.locator('[data-categoria="4"]');
    const textoError = await categoria4.innerText();
    const cuerpoPagina = await pagina.locator("main").innerText();
    const dentro = await pagina.evaluate(() => !!document.activeElement?.closest('[data-categoria="4"]'));
    const marcados = await categoria4.locator("input:checked").count();
    ver((await barra(pagina)) === "Paso 4 de 6: Fecha y estado" && textoError.includes(AMABLE) && !/\b99\b/.test(cuerpoPagina) && dentro && marcados === 0, "rechazo de una opción desactivada: vuelve al paso 4, el mensaje amable («Una de las opciones elegidas ya no está disponible…») aparece en la categoría que la contiene, sin identificadores, con el foco en ella y la opción quitada de la selección", `rechazo: paso ${await barra(pagina)}, mensaje en categoría ${textoError.includes(AMABLE)}, foco dentro ${dentro}, marcados ${marcados}`);
    await contexto.close();
  }
  // B · No se puede saber qué opción fue (todas las enviadas están activas en la pantalla): el mensaje va al inicio del paso, con foco.
  {
    const { contexto, pagina } = await nuevaPagina(navegador);
    await pagina.route("**/api/avistamientos", (ruta) => ruta.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: { codigo: "VALIDACION", mensaje: "Revisa los campos marcados.", campos: { estadosAnimal: AMABLE } } }) }));
    await irA(pagina, `${AVISTAMIENTO}?caso=combinadas`);
    await enviarCompleto(pagina);
    const aviso = pagina.locator("#error-estados");
    await aviso.waitFor();
    const enfocado = await aviso.evaluate((e) => e === document.activeElement);
    ver((await barra(pagina)) === "Paso 4 de 6: Fecha y estado" && (await aviso.innerText()).includes(AMABLE) && enfocado, "rechazo sin opción identificable: el mensaje amable aparece al inicio del paso 4 y recibe el foco", `rechazo sin categoría: paso ${await barra(pagina)}, foco ${enfocado}`);
    await contexto.close();
  }
}


// ---------- (i) HU 038: consulta pública del estatus ----------
async function estatusPublico(navegador: Browser) {
  const { contexto, pagina } = await nuevaPagina(navegador);
  await irA(pagina, "/");
  const enlaceEstatus = pagina.getByRole("link", { name: /Consultar su estatus/ });
  ver((await enlaceEstatus.getAttribute("href")) === "/estatus", "PUB-01: la sección «Buscar por folio» enlaza a /estatus", "PUB-01: sin enlace a /estatus");
  await enlaceEstatus.click();
  await pagina.waitForURL("**/estatus");
  ver((await pagina.getByRole("heading", { level: 1, name: "Consultar estatus de un caso" }).isVisible()) && (await pagina.getByRole("button", { name: "Consultar folio" }).isVisible()) && (await pagina.getByRole("button", { name: "Limpiar" }).isVisible()), "/estatus: buscador público con «Consultar folio» y «Limpiar»", "/estatus: faltan el título o los botones");
  const campo = pagina.getByRole("textbox", { name: "Folio" });
  await pagina.getByRole("button", { name: "Consultar folio" }).click();
  ver((await campo.getAttribute("aria-invalid")) === "true" && (await textoDescrito(campo)).includes("Escribe el folio"), "/estatus: vacío → error asociado con aria-describedby", "/estatus: sin error al enviar vacío");
  await campo.fill("RUPE-OOOO1111");
  await pagina.getByRole("button", { name: "Consultar folio" }).click();
  ver((await textoDescrito(campo)).includes("formato RUPE-XXXXXXXX") && new URL(pagina.url()).pathname === "/estatus", "/estatus: folio con formato inválido → error de formato y no navega", "/estatus: aceptó un folio inválido");
  await campo.fill(" rupe-h4tq7v2m ");
  await pagina.getByRole("button", { name: "Consultar folio" }).click();
  await pagina.waitForURL(`**/estatus/RUPE-H4TQ7V2M`);
  const texto = await pagina.locator("main").innerText();
  ver((await pagina.getByRole("heading", { level: 1, name: "Estatus del caso" }).isVisible()) && texto.includes("RUPE-H4TQ7V2M") && /En búsqueda/.test(texto) && /Último cambio/.test(texto) && !/Rosa|Hern|@example|Mestizo|Max\b/.test(texto), "/estatus/<folio>: muestra solo el folio, el estatus «En búsqueda» y «Último cambio»", `/estatus/<folio>: ${texto.slice(0, 160)}`);
  const meta = await pagina.locator('meta[name="robots"]').getAttribute("content");
  ver(/noindex/.test(meta ?? ""), "/estatus/<folio>: noindex", "/estatus/<folio>: sin noindex");
  const noEncontrado = await pagina.goto(`${base}/estatus/${FOLIO_INEXISTENTE}`, { waitUntil: "load" });
  ver(noEncontrado?.status() === 404 && (await pagina.getByRole("heading", { level: 1, name: "Folio no encontrado" }).isVisible()) && (await pagina.getByRole("link", { name: "Consultar otro folio" }).getAttribute("href")) === "/estatus", "/estatus/<folio inexistente>: 404 real con «Folio no encontrado» y «Consultar otro folio»", "/estatus/<inexistente>: no es 404 o falta la pantalla");
  const rCerrado = await pagina.goto(`${base}/estatus/RUPE-3HN8WD2B`, { waitUntil: "load" });
  ver(rCerrado?.status() === 200 && /Cerrado/.test(await pagina.locator("main").innerText()), "/estatus/<folio>: un caso cerrado por cierre confirmado (Rocky) se muestra «Cerrado»", `/estatus de un cierre confirmado: ${rCerrado?.status()}`);
  await contexto.close();
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
    "/estatus",
    `/estatus/${FOLIO_EN_CURSO}`,
    "/estatus/RUPE-3HN8WD2B",
    `/estatus/${FOLIO_INEXISTENTE}`,
    ...[1, 2, 3, 4, 5, 6].map((n) => `${AVISTAMIENTO}?paso=${n}&datos=ejemplo`),
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
  const pantallas = ["/", "/estatus", `/estatus/${FOLIO_EN_CURSO}`, "/registro", "/acceso", FICHA, `${FICHA}?estado=localizado`, `${FICHA}?estado=no-disponible`, `${AVISTAMIENTO}?paso=1`, `${AVISTAMIENTO}?paso=3`, `${AVISTAMIENTO}?paso=6&datos=ejemplo`, `${FICHA}/avistamiento/enviado`, "/ruta-que-no-existe", "/dev/transversales/error"];
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

// Portada de inicio (P2c): una imagen por tema, sin descargar la del otro tema hasta que se cambia; sin saltos de diseño ni errores de consola. Sin los archivos de public/portada/
// (no van en git) debe verse la ilustración SVG de respaldo, sin errores.
async function portada(navegador: Browser) {
  const hay = Object.values(PORTADA_ARCHIVOS).every((r) => existsSync(join(process.cwd(), "public", r)));
  const ESC: [string, "light" | "dark" | null, "light" | "dark"][] = [["tema claro guardado (SO oscuro)", "light", "dark"], ["tema oscuro guardado (SO claro)", "dark", "light"], ["sin tema guardado, SO claro", null, "light"], ["sin tema guardado, SO oscuro", null, "dark"]];
  const malos: string[] = [];
  const cambios: string[] = [];
  const consola: string[] = [];
  let proporciones = "";
  let accesibilidad = "";
  for (const [ancho, esperado, nombreAncho] of [[390, 16 / 9, "16:9"], [1280, 21 / 8, "21:8"]] as const) {
    for (const [nombre, guardado, so] of ESC) {
      const contexto = await navegador.newContext({ viewport: { width: ancho, height: 900 }, colorScheme: so });
      if (guardado) await contexto.addInitScript(([k, v]) => localStorage.setItem(k, v), [CLAVE_TEMA, guardado]);
      const pagina = await contexto.newPage();
      const pedidas: string[] = [];
      pagina.on("request", (r) => { const m = /portada-(claro|oscuro)/.exec(decodeURIComponent(r.url())); if (m) pedidas.push(m[1]); });
      pagina.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") consola.push(`${nombre} ${ancho}px: ${m.text().slice(0, 90)}`); });
      pagina.on("pageerror", (e) => consola.push(`pageerror ${e.message.slice(0, 90)}`));
      await pagina.addInitScript("window.__cls=0;new PerformanceObserver(function(l){l.getEntries().forEach(function(e){if(!e.hadRecentInput)window.__cls+=e.value})}).observe({type:'layout-shift',buffered:true});");
      await pagina.goto(`${base}/`, { waitUntil: "load" });
      await pagina.waitForTimeout(900);
      const activo = (guardado ?? so) === "dark" ? "oscuro" : "claro";
      const otro = activo === "claro" ? "oscuro" : "claro";
      const d = JSON.parse(await pagina.evaluate(`(function(){var imgs=[].slice.call(document.querySelectorAll('img[data-portada]'));var vis=imgs.filter(function(i){return getComputedStyle(i).display!=='none'});var c=vis[0]&&vis[0].parentElement.getBoundingClientRect();return JSON.stringify({total:imgs.length,visibles:vis.map(function(i){return i.dataset.portada+'/'+i.getAttribute('loading')+'/'+i.getAttribute('fetchpriority')+'/'+i.complete}),proporcion:c?c.width/c.height:0,cls:window.__cls,svg:!!document.querySelector('main svg[aria-hidden=true].rounded-tarjeta, svg[aria-hidden=true].rounded-tarjeta')})})()`)) as { total: number; visibles: string[]; proporcion: number; cls: number; svg: boolean };
      if (hay) {
        if (d.total !== 2 || d.visibles.join() !== `${activo}/eager/high/true`) malos.push(`${nombre} ${ancho}px: visibles ${d.visibles.join() || "ninguna"}`);
        if (pedidas.length !== 1 || pedidas[0] !== activo) malos.push(`${nombre} ${ancho}px: peticiones ${pedidas.join() || "ninguna"} (debía ser solo «${activo}»)`);
        if (ancho === 390 || nombre === ESC[0][0]) {
          proporciones += `${ancho}px ${nombreAncho}=${d.proporcion.toFixed(3)} CLS=${d.cls.toFixed(3)}; `;
          if (Math.abs(d.proporcion - esperado) > 0.02 || d.cls > 0) malos.push(`${nombre} ${ancho}px: proporción ${d.proporcion.toFixed(3)} (esperada ${esperado.toFixed(3)}) o CLS ${d.cls}`);
        }
        const leidas = await pagina.getByRole("img", { name: PORTADA_ALT }).count();
        if (leidas !== 1) accesibilidad += `${nombre} ${ancho}px: ${leidas} imágenes con el texto alternativo; `;
        const antes = pedidas.length;
        await pagina.getByRole("button", { name: "Modo oscuro" }).click();
        await pagina.waitForTimeout(900);
        const nuevas = pedidas.slice(antes);
        const ahora = await pagina.evaluate("[].slice.call(document.querySelectorAll('img[data-portada]')).filter(function(i){return getComputedStyle(i).display!=='none'}).map(function(i){return i.dataset.portada}).join()");
        if (nuevas.length !== 1 || nuevas[0] !== otro || ahora !== otro) cambios.push(`${nombre} ${ancho}px: tras el cambio de tema pidió «${nuevas.join()}» y muestra «${ahora}» (esperado: una sola, «${otro}»)`);
      } else if (!d.svg || d.total !== 0 || pedidas.length !== 0) malos.push(`${nombre} ${ancho}px: sin archivos debía verse solo la ilustración SVG`);
      await contexto.close();
    }
  }
  const modo = hay ? "con portada real" : "sin archivos: ilustración SVG de respaldo";
  ver(malos.length === 0, `portada (${modo}): en los 4 escenarios (tema guardado y del sistema) a 390 y 1280 px se pide y se ve SOLO la del tema activo (eager, fetchpriority high); la otra no se descarga`, malos.join(" | "));
  ver(cambios.length === 0, `portada (${modo}): al cambiar el tema a mano se pide una sola imagen nueva, la del otro tema, y es la que se ve`, cambios.join(" | "));
  ver(!hay || proporciones.includes("16:9") && proporciones.includes("21:8"), `portada (${modo}): proporción 16:9 en móvil y 21:8 en escritorio, sin salto de diseño (CLS 0)`, `sin medidas de proporción: ${proporciones}`);
  ver(accesibilidad === "", `portada (${modo}): el texto alternativo se anuncia UNA sola vez (la imagen del otro tema está oculta)`, accesibilidad);
  ver(consola.length === 0, `portada (${modo}): sin errores ni advertencias de consola en la carga y el cambio de tema`, consola.slice(0, 3).join(" | "));
}

async function main() {
  let servidor: ChildProcess | undefined;
  if (!baseExterna) {
    if (!process.argv.includes("--sin-build")) {
      if (spawnSync("npx", ["next", "build"], { stdio: "inherit" }).status !== 0) throw new Error("Falló next build");
    }
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
    const nav = navegador;
    const solo = process.argv.find((a) => a.startsWith("--solo="))?.split("=")[1];
    const seccion = async (nombre: string, f: () => Promise<void>) => {
      if (solo && !nombre.includes(solo)) return;
      try {
        await f();
      } catch (e) {
        fallos++;
        console.log(`✗ la sección «${nombre}» se interrumpió: ${String(e).split("\n")[0]} ${String((e as Error).stack).split("\n").find((l) => l.includes("verificar-visitante.ts")) ?? ""}`);
      }
    };
    await seccion("PUB-01", () => principal(nav));
    await seccion("portada", () => portada(nav));
    await seccion("ficha", () => ficha(nav));
    await seccion("flujo", () => flujo(nav));
    await seccion("estados del animal", () => estadoAnimal(nav));
    await seccion("ubicación", () => ubicacion(nav));
    await seccion("transversales", () => transversales(nav));
    await seccion("avistamientos sin reservados", () => sinReservadosDeAvistamientos());
    await seccion("enlaces internos", () => enlacesInternos(nav));
    await seccion("estatus público", () => estatusPublico(nav));
    await seccion("geometría", () => geometria(nav));
    await seccion("recorrido de opciones", () => recorridoDeOpciones(nav));
    await seccion("comentario con correo", () => comentarioConCorreo(nav));
    await seccion("opción no disponible", () => opcionNoDisponible(nav));
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
