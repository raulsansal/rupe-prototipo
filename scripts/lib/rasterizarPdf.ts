// Rasteriza la primera página de un PDF con pdf.js (pdfjs-dist, devDependency) dentro de una página de Playwright: sin binarios extra (poppler, ghostscript).
// Sirve para mirar el PDF REAL como imagen de página completa y para decodificar el QR impreso con jsQR (verificar-pdf, pruebas y capturas).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser } from "playwright";

const RAIZ = join(process.cwd(), "node_modules", "pdfjs-dist", "build");
const ORIGEN = "https://pdf.prueba";

/** Renderiza la página 1 a `ppp` puntos por pulgada. Devuelve el PNG y su tamaño en píxeles. */
export async function rasterizarPdf(navegador: Browser, pdf: Uint8Array, ppp = 150): Promise<{ png: Buffer; ancho: number; alto: number; paginas: number; ptAncho: number; ptAlto: number }> {
  const contexto = await navegador.newContext({ viewport: { width: 400, height: 400 } });
  try {
    const pagina = await contexto.newPage();
    await pagina.route(`${ORIGEN}/**`, async (ruta) => {
      const camino = new URL(ruta.request().url()).pathname;
      if (camino === "/") return ruta.fulfill({ contentType: "text/html", body: "<!doctype html><canvas id=c></canvas>" });
      if (camino === "/pdf.mjs" || camino === "/pdf.worker.mjs") return ruta.fulfill({ contentType: "text/javascript", body: readFileSync(join(RAIZ, camino.slice(1))) });
      return ruta.fulfill({ status: 404, body: "" });
    });
    await pagina.goto(`${ORIGEN}/`);
    const r = await pagina.evaluate(
      `(async function(){var lib=await import("${ORIGEN}/pdf.mjs");lib.GlobalWorkerOptions.workerSrc="${ORIGEN}/pdf.worker.mjs";var datos=Uint8Array.from(atob(${JSON.stringify(Buffer.from(pdf).toString("base64"))}),function(c){return c.charCodeAt(0)});var doc=await lib.getDocument({data:datos}).promise;var p=await doc.getPage(1);var base=p.getViewport({scale:1});var vp=p.getViewport({scale:${ppp} / 72});var c=document.getElementById("c");c.width=Math.round(vp.width);c.height=Math.round(vp.height);var ctx=c.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);await p.render({canvasContext:ctx,viewport:vp,canvas:c}).promise;return JSON.stringify({url:c.toDataURL("image/png"),ancho:c.width,alto:c.height,paginas:doc.numPages,ptAncho:base.width,ptAlto:base.height})})()`,
    );
    const j = JSON.parse(r as string) as { url: string; ancho: number; alto: number; paginas: number; ptAncho: number; ptAlto: number };
    return { png: Buffer.from(j.url.split(",")[1], "base64"), ancho: j.ancho, alto: j.alto, paginas: j.paginas, ptAncho: j.ptAncho, ptAlto: j.ptAlto };
  } finally {
    await contexto.close();
  }
}

/** Igual que `rasterizarPdf`, pero renderiza la página 1 a varias resoluciones en UNA sola página del navegador (para mediciones con muchos PDF). */
export async function rasterizarPdfVarios(navegador: Browser, pdf: Uint8Array, ppps: number[]): Promise<Buffer[]> {
  const contexto = await navegador.newContext({ viewport: { width: 400, height: 400 } });
  try {
    const pagina = await contexto.newPage();
    await pagina.route(`${ORIGEN}/**`, async (ruta) => {
      const camino = new URL(ruta.request().url()).pathname;
      if (camino === "/") return ruta.fulfill({ contentType: "text/html", body: "<!doctype html><canvas id=c></canvas>" });
      if (camino === "/pdf.mjs" || camino === "/pdf.worker.mjs") return ruta.fulfill({ contentType: "text/javascript", body: readFileSync(join(RAIZ, camino.slice(1))) });
      return ruta.fulfill({ status: 404, body: "" });
    });
    await pagina.goto(`${ORIGEN}/`);
    const r = await pagina.evaluate(
      `(async function(){var lib=await import("${ORIGEN}/pdf.mjs");lib.GlobalWorkerOptions.workerSrc="${ORIGEN}/pdf.worker.mjs";var datos=Uint8Array.from(atob(${JSON.stringify(Buffer.from(pdf).toString("base64"))}),function(c){return c.charCodeAt(0)});var doc=await lib.getDocument({data:datos}).promise;var p=await doc.getPage(1);var salida=[];var ppps=${JSON.stringify(ppps)};for(var i=0;i<ppps.length;i++){var vp=p.getViewport({scale:ppps[i]/72});var c=document.getElementById("c");c.width=Math.round(vp.width);c.height=Math.round(vp.height);var ctx=c.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);await p.render({canvasContext:ctx,viewport:vp,canvas:c}).promise;salida.push(c.toDataURL("image/png"))}return JSON.stringify(salida)})()`,
    );
    return (JSON.parse(r as string) as string[]).map((u) => Buffer.from(u.split(",")[1], "base64"));
  } finally {
    await contexto.close();
  }
}
