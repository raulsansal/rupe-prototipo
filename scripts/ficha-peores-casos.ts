// Ficha de búsqueda con los PEORES casos reales que permiten las validaciones (nombre 50, raza especificada 50, color 50, colonia 100, características 300, la alcaldía y la raza
// más largas del catálogo, y variantes sin espacios): registra cada caso por la API con la sesión de tutor1, abre la hoja a su tamaño de impresión y mide qué porción ocupa la
// fotografía y si algo desborda o queda recortado. Lo usa `npm run verificar-ficha` (scripts/verificar-ficha.ts).
import type { Browser, Page } from "playwright";
import { CLAVE_TEMA } from "../src/lib/tema";
import { agregarSesion, fetchComo } from "./sesion-pruebas";

// JPEG válido de 1×1 px (gris): sirve para que la hoja cargue la imagen, pero se ve como un recuadro liso. Para MIRAR la hoja (capturas) se usa `usarImagenDePrueba`.
let JPEG = Uint8Array.from(Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64"));
// Imagen 4:5 (800×1000) dibujada en un canvas del navegador: fondo con degradado, una silueta de perro y la leyenda «FOTO DE PRUEBA»; no es la foto de ningún caso.
const DIBUJO = `(() => {
  var c = document.createElement("canvas"); c.width = 800; c.height = 1000; var x = c.getContext("2d");
  var g = x.createLinearGradient(0, 0, 0, 1000); g.addColorStop(0, "#9ad0e8"); g.addColorStop(1, "#d9c28f"); x.fillStyle = g; x.fillRect(0, 0, 800, 1000);
  x.fillStyle = "#8a5a2b"; x.beginPath(); x.ellipse(400, 700, 230, 150, 0, 0, 7); x.fill();
  x.fillRect(230, 780, 60, 160); x.fillRect(350, 800, 60, 140); x.fillRect(470, 800, 60, 140); x.fillRect(560, 780, 60, 160);
  x.beginPath(); x.arc(400, 470, 150, 0, 7); x.fill();
  x.fillStyle = "#5c3a18"; x.beginPath(); x.ellipse(270, 400, 55, 120, 0.4, 0, 7); x.fill(); x.beginPath(); x.ellipse(530, 400, 55, 120, -0.4, 0, 7); x.fill();
  x.fillStyle = "#fff"; x.beginPath(); x.arc(350, 450, 28, 0, 7); x.fill(); x.beginPath(); x.arc(450, 450, 28, 0, 7); x.fill();
  x.fillStyle = "#111"; x.beginPath(); x.arc(350, 454, 14, 0, 7); x.fill(); x.beginPath(); x.arc(450, 454, 14, 0, 7); x.fill(); x.beginPath(); x.ellipse(400, 520, 36, 26, 0, 0, 7); x.fill();
  x.strokeStyle = "#111"; x.lineWidth = 10; x.strokeRect(5, 5, 790, 990);
  x.fillStyle = "#111"; x.font = "bold 54px sans-serif"; x.textAlign = "center"; x.fillText("FOTO DE PRUEBA", 400, 90);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
})()`;
/** Sustituye la imagen de los casos que registran estos escenarios por una imagen de prueba bien visible. */
export async function usarImagenDePrueba(pagina: Page): Promise<void> {
  JPEG = Uint8Array.from(Buffer.from(await pagina.evaluate<string>(DIBUJO), "base64"));
}
const palabras = (n: number, base: string) => base.repeat(Math.ceil(n / base.length)).slice(0, n).trim();
const ANCHAS = "Wolfgang Wilhelmina Wenceslao Wellington Winston ";
const L = { nombre: 50, color: 50, colonia: 100, carac: 300, raza: 50 };
const peor = { nombre: palabras(L.nombre, ANCHAS), color: palabras(L.color, "Marrón Chocolate Oscuro Con Manchas Blancas Y Grises "), colonia: palabras(L.colonia, "Unidad Habitacional Vicente Guerrero Super Manzana Cuatro Sección Norte Oriente "), carac: palabras(L.carac, "Mancha blanca en el pecho, oreja izquierda caída, cola corta y rizada, cicatriz pequeña en la pata trasera derecha, collar rojo con una placa metálica, muy amigable con los niños pero miedoso con los ruidos fuertes y las motocicletas. ") };
const sinEspacios = (n: number) => "W".repeat(n);

type Escenario = { tipo: "normal" | "peor"; nombre: string; idRaza: number; razaEspecificada?: string; datos: Record<string, unknown> };
export const ESCENARIOS: Escenario[] = [
  { tipo: "normal", nombre: "caso normal", idRaza: 1, datos: { nombre: "Max", color: "Café con blanco", colonia: "Del Valle Centro", caracteristicas: "Mancha blanca en el pecho y collar rojo", alcaldia: "Benito Juárez" } },
  { tipo: "normal", nombre: "normal con la raza más larga del catálogo", idRaza: 5, datos: { nombre: "Max", color: "Café con blanco", colonia: "Del Valle Centro", caracteristicas: "Mancha blanca en el pecho y collar rojo", alcaldia: "Benito Juárez" } },
  { tipo: "peor", nombre: "Otra con raza de 50", idRaza: 14, razaEspecificada: palabras(L.raza, "Schnauzer Gigante Cruzado Con Pastor Belga Malinois "), datos: { nombre: peor.nombre, color: peor.color, colonia: peor.colonia, caracteristicas: peor.carac, alcaldia: "La Magdalena Contreras" } },
  { tipo: "peor", nombre: "raza más larga del catálogo", idRaza: 5, datos: { nombre: peor.nombre, color: peor.color, colonia: peor.colonia, caracteristicas: peor.carac, alcaldia: "La Magdalena Contreras" } },
  { tipo: "peor", nombre: "textos de 50/100 sin espacios", idRaza: 14, razaEspecificada: sinEspacios(L.raza), datos: { nombre: sinEspacios(L.nombre), color: sinEspacios(L.color), colonia: sinEspacios(L.colonia), caracteristicas: sinEspacios(L.carac), alcaldia: "La Magdalena Contreras" } },
];

export async function registrar(base: string, e: Escenario): Promise<string> {
  const datos = { nombre: "Max", sexo: "Macho", idRaza: e.idRaza, ...(e.razaEspecificada ? { razaEspecificada: e.razaEspecificada } : {}), edad: { valor: 11, unidad: "años" }, tamano: "mediano", color: "Café", fechaExtravio: new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10), momento: "tarde", alcaldia: "Coyoacán", colonia: "Del Carmen", calle: "Calle 1", idMotivo: 1, ...e.datos };
  const f = new FormData();
  f.set("datos", JSON.stringify(datos));
  f.set("fotografia", new Blob([JPEG as BlobPart], { type: "image/jpeg" }), "fotografia.jpg");
  const r = await fetchComo(base, "tutor1", "/api/casos", { method: "POST", headers: { Origin: new URL(base).origin }, body: f });
  const j = (await r.json()) as { folio?: string; error?: unknown };
  if (r.status !== 201 || !j.folio) throw new Error(`No se pudo registrar «${e.nombre}»: HTTP ${r.status} ${JSON.stringify(j.error ?? j)}`);
  return j.folio;
}

export type Medida = { tipo: "normal" | "peor"; folio: string; caracteristicas: string; escenario: string; hoja: string; ancho: number; porcentaje: number; desbordes: string[] };

/** Mide las hojas Carta y Media carta (a 390 y 1280 px) de los peores casos. */
export type Opciones = { /** Se ejecuta con la hoja abierta (para probar un ajuste de estilo sin tocar la app). */ preparar?: (p: Page) => Promise<void>; /** Carpeta donde guardar una imagen de la hoja de cada escenario (solo 1280 px). */ imagenes?: string };
export async function medirPeoresCasos(navegador: Browser, base: string, { preparar, imagenes }: Opciones = {}): Promise<Medida[]> {
  const salida: Medida[] = [];
  for (const e of ESCENARIOS) {
    const folio = await registrar(base, e);
    for (const hoja of ["carta", "media-carta"] as const) {
      for (const ancho of [390, 1280]) {
        const contexto = await navegador.newContext({ viewport: { width: ancho, height: 900 }, colorScheme: "light" });
        await agregarSesion(contexto, base, "tutor1");
        await contexto.addInitScript(([k, v]) => localStorage.setItem(k, v), [CLAVE_TEMA, "light"]);
        const pagina = await contexto.newPage();
        await pagina.goto(`${base}/tutor/casos/${folio}/ficha?modal=visor&hoja=${hoja}`, { waitUntil: "load" });
        await pagina.getByRole("dialog", { name: "Tu ficha de búsqueda en PDF" }).waitFor();
        await pagina.evaluate(() => document.fonts.ready);
        await pagina.emulateMedia({ media: "print" });
        if (preparar) await preparar(pagina);
        if (imagenes && ancho === 1280) await pagina.locator(".ficha-impresion article").screenshot({ path: `${imagenes}/${e.nombre.replace(/[^a-z0-9]+/gi, "-")}-${hoja}.png` });
        const m = await pagina.evaluate(() => {
          const art = document.querySelector<HTMLElement>(".ficha-impresion article")!;
          const a = art.getBoundingClientRect();
          const marco = document.querySelector(".ficha-impresion [data-foto-ficha]")!.getBoundingClientRect();
          const fuera: string[] = [];
          for (const el of art.querySelectorAll<HTMLElement>("*")) {
            if (el.closest("[data-foto-ficha]") || el.closest("svg")) continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            if (r.right > a.right + 1 || r.bottom > a.bottom + 1 || r.left < a.left - 1 || r.top < a.top - 1) fuera.push(`${el.tagName.toLowerCase()} «${(el.textContent ?? "").trim().slice(0, 24)}»`);
            if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== "inline") fuera.push(`texto más ancho que su caja: «${(el.textContent ?? "").trim().slice(0, 24)}»`);
          }
          if (art.scrollHeight > art.clientHeight + 1) fuera.push(`la hoja desborda en alto (${art.scrollHeight} > ${art.clientHeight})`);
          if (art.scrollWidth > art.clientWidth + 1) fuera.push(`la hoja desborda en ancho (${art.scrollWidth} > ${art.clientWidth})`);
          const qr = art.querySelector("[aria-label*='QR']");
          if (!qr || qr.getBoundingClientRect().height < 10) fuera.push("sin QR visible");
          return { porcentaje: (marco.width * marco.height) / (a.width * a.height), ancho: a.width, fuera };
        });
        if (Math.abs(m.ancho - 21.6 * 37.795) < 2) salida.push({ tipo: e.tipo, folio, caracteristicas: String(e.datos.caracteristicas), escenario: e.nombre, hoja, ancho, porcentaje: m.porcentaje, desbordes: m.fuera });
        else salida.push({ tipo: e.tipo, folio, caracteristicas: String(e.datos.caracteristicas), escenario: e.nombre, hoja, ancho, porcentaje: m.porcentaje, desbordes: [...m.fuera, `la hoja no está a tamaño de impresión (${Math.round(m.ancho)} px)`] });
        await contexto.close();
      }
    }
  }
  return salida;
}
