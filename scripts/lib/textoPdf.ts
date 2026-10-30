// Extrae el TEXTO de un PDF con pdf.js (pdfjs-dist, devDependency) dentro de una página de Playwright, igual que `rasterizarPdf`: sin binarios extra.
// Sirve para comprobar lo que el PDF REAL de la ficha dice (nombre de la raza y de la alcaldía), no solo su aspecto.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser } from "playwright";

const RAIZ = join(process.cwd(), "node_modules", "pdfjs-dist", "build");
const ORIGEN = "https://pdf.prueba";

/** Todo el texto de la página 1, con los fragmentos unidos por un espacio. */
export async function textoDePdf(navegador: Browser, pdf: Uint8Array): Promise<string> {
  const contexto = await navegador.newContext({ viewport: { width: 400, height: 400 } });
  try {
    const pagina = await contexto.newPage();
    await pagina.route(`${ORIGEN}/**`, async (ruta) => {
      const camino = new URL(ruta.request().url()).pathname;
      if (camino === "/") return ruta.fulfill({ contentType: "text/html", body: "<!doctype html><p>pdf</p>" });
      if (camino === "/pdf.mjs" || camino === "/pdf.worker.mjs") return ruta.fulfill({ contentType: "text/javascript", body: readFileSync(join(RAIZ, camino.slice(1))) });
      return ruta.fulfill({ status: 404, body: "" });
    });
    await pagina.goto(`${ORIGEN}/`);
    const r = await pagina.evaluate(
      `(async function(){var lib=await import("${ORIGEN}/pdf.mjs");lib.GlobalWorkerOptions.workerSrc="${ORIGEN}/pdf.worker.mjs";var datos=Uint8Array.from(atob(${JSON.stringify(Buffer.from(pdf).toString("base64"))}),function(c){return c.charCodeAt(0)});var doc=await lib.getDocument({data:datos}).promise;var p=await doc.getPage(1);var t=await p.getTextContent();return t.items.map(function(i){return i.str}).join(" ")})()`,
    );
    return String(r).replace(/\s+/g, " ").trim();
  } finally {
    await contexto.close();
  }
}
