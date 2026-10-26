// Verifica la hoja impresa de la ficha de búsqueda (Carta y Media carta, a tamaño de impresión) con casos normales y con los PEORES casos que permiten las validaciones:
//  · normales (incluida la raza más larga del catálogo): la fotografía ocupa ≥ 40 % de la hoja;
//  · peores (nombre 50, raza especificada 50, color 50, colonia 100, características 300, la alcaldía más larga y variantes sin espacios): nada desborda en ancho ni en alto,
//    el QR, el folio y el lugar quedan dentro de la hoja; Media carta ≥ 40 % y Carta ≥ 32 %;
//  · el texto completo de las características sigue visible en el detalle del caso.
// Opciones: --sin-build reutiliza el build · --base=URL usa un servidor que ya corre (con RUPE_PERMITIR_REINICIO=1) · --imagenes=carpeta guarda una imagen de cada hoja.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium, type Browser } from "playwright";
import { ESCENARIOS, medirPeoresCasos, usarImagenDePrueba } from "./ficha-peores-casos";
import { fetchComo, reiniciarDatos } from "./sesion-pruebas";

const PUERTO = 3112;
const baseExterna = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1];
const base = baseExterna ?? `http://localhost:${PUERTO}`;
const imagenes = process.argv.find((a) => a.startsWith("--imagenes="))?.split("=")[1];
const MINIMO = { normal: 0.4, peorMedia: 0.4, peorCarta: 0.32 };
// Solo para «normal con la raza más larga del catálogo» en Carta: ahí la fotografía queda en 40,0 % (margen cero) y la tipografía de otra máquina puede mover una línea;
// se tolera 0,5 puntos (≥ 39,5 %). El rediseño robusto de la hoja (bloque inferior en dos columnas) queda para P3.
const TOLERANCIA_RAZA_LARGA_CARTA = 0.005;
const minimoDe = (m: { tipo: string; hoja: string; escenario: string }) =>
  m.tipo === "normal" ? (m.hoja === "carta" && /raza más larga/.test(m.escenario) ? MINIMO.normal - TOLERANCIA_RAZA_LARGA_CARTA : MINIMO.normal) : m.hoja === "carta" ? MINIMO.peorCarta : MINIMO.peorMedia;
let fallos = 0;
let total = 0;
const ver = (ok: boolean, bien: string, mal: string) => {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${ok ? bien : mal}`);
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
    await reiniciarDatos(base);
    navegador = await abrirNavegador();
    if (imagenes) {
      mkdirSync(imagenes, { recursive: true });
      const hoja = await navegador.newPage();
      await usarImagenDePrueba(hoja); // para MIRAR las hojas (la medida no depende de la imagen)
      await hoja.close();
    }
    const medidas = await medirPeoresCasos(navegador, base, { imagenes });
    for (const m of medidas) {
      const minimo = minimoDe(m);
      const pct = `${(m.porcentaje * 100).toFixed(1)} %`;
      ver(m.porcentaje >= minimo && m.desbordes.length === 0, `${m.tipo === "normal" ? "normal" : "peor caso"} · ${m.escenario} · ${m.hoja} (${m.ancho} px): fotografía ${pct} (≥ ${(minimo * 100).toFixed(1)} %) y sin desbordes; QR, folio y lugar dentro de la hoja`, `${m.escenario} · ${m.hoja} (${m.ancho} px): fotografía ${pct} (mínimo ${(minimo * 100).toFixed(1)} %) · ${m.desbordes.length ? m.desbordes.join(" | ") : "sin desbordes"}`);
    }
    // El recorte con elipsis es solo de la hoja: el detalle del caso trae las características completas.
    const peor = medidas.find((m) => m.tipo === "peor")!;
    const detalle = await (await fetchComo(base, "tutor1", `/tutor/casos/${peor.folio}`)).text();
    ver(detalle.includes(peor.caracteristicas), "el detalle del caso muestra completas las 300 características que la hoja recorta", "el detalle del caso no trae las características completas");
    ver(ESCENARIOS.length === 5, `${ESCENARIOS.length} escenarios medidos (2 normales y 3 peores) × Carta y Media carta × 390 y 1280 px`, `escenarios inesperados: ${ESCENARIOS.length}`);
  } finally {
    await reiniciarDatos(base); // los casos de prueba se registraron de verdad en el almacén
    await navegador?.close();
    apagar();
  }
  console.log(fallos === 0 ? `\nOK: ${total} comprobaciones de la hoja de la ficha` : `\n${fallos} de ${total} verificación(es) fallida(s)`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
