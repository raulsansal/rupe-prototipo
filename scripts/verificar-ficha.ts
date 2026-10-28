// Verifica la hoja impresa de la ficha de búsqueda (Carta y Media carta, a tamaño de impresión) con casos normales y con los PEORES casos que permiten las validaciones:
//  · normales (incluida la raza más larga del catálogo): la fotografía ocupa ≥ 40 % de la hoja;
//  · peores (nombre 50, raza especificada 50, color 50, colonia 100, características 300, la alcaldía más larga y variantes sin espacios): nada desborda en ancho ni en alto,
//    el QR, el folio y el lugar quedan dentro de la hoja; Media carta ≥ 40 % y Carta ≥ 32 %;
//  · el texto completo de las características sigue visible en el detalle del caso.
// Opciones: --sin-build reutiliza el build · --base=URL usa un servidor que ya corre (con RUPE_PERMITIR_REINICIO=1) · --imagenes=carpeta guarda una imagen de cada hoja.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium, type Browser } from "playwright";
import { geometriaDeHoja } from "../src/lib/ficha/composicion";
import { ESCENARIOS, medirFotoVisible, medirPeoresCasos, usarImagenDePrueba } from "./ficha-peores-casos";
import { fetchComo, reiniciarDatos } from "./sesion-pruebas";

const PUERTO = 3112;
const baseExterna = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1];
const base = baseExterna ?? `http://localhost:${PUERTO}`;
const imagenes = process.argv.find((a) => a.startsWith("--imagenes="))?.split("=")[1];
// La zona reservada para la fotografía es ≥ 40 % de la hoja POR CONSTRUCCIÓN (lib/ficha/composicion.ts): Carta ≥ 45,8 %, Media carta 40,8 %, con cualquier texto permitido.
// Se mide la CAJA de la fotografía (no la imagen) y falla si baja de ese mínimo, si algo queda fuera de la hoja o recortado, o si el QR, el folio o el lugar se salen.
// El área de foto VISIBLE (la imagen completa sin recorte dentro de la caja) depende de su proporción: solo se informa, no hace fallar.
const MINIMO = { carta: geometriaDeHoja("carta").fraccionFoto - 0.0005, "media-carta": geometriaDeHoja("media-carta").fraccionFoto - 0.0005 };
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
      const minimo = MINIMO[m.hoja as "carta" | "media-carta"];
      const pct = `${(m.porcentaje * 100).toFixed(1)} %`;
      ver(m.porcentaje >= minimo && m.desbordes.length === 0, `${m.tipo === "normal" ? "normal" : "peor caso"} · ${m.escenario} · ${m.hoja} (${m.ancho} px): fotografía ${pct} (≥ ${(minimo * 100).toFixed(1)} %) y sin desbordes; QR, folio y lugar dentro de la hoja`, `${m.escenario} · ${m.hoja} (${m.ancho} px): fotografía ${pct} (mínimo ${(minimo * 100).toFixed(1)} %) · ${m.desbordes.length ? m.desbordes.join(" | ") : "sin desbordes"}`);
    }
    // El recorte con elipsis es solo de la hoja: el detalle del caso trae las características completas.
    const peor = medidas.find((m) => m.tipo === "peor")!;
    const detalle = await (await fetchComo(base, "tutor1", `/tutor/casos/${peor.folio}`)).text();
    ver(detalle.includes(peor.caracteristicas), "el detalle del caso muestra completas las 300 características que la hoja recorta", "el detalle del caso no trae las características completas");
    // Área de foto visible por proporción: solo informativa (no hace fallar).
    const visibles = await medirFotoVisible(navegador, base);
    console.log("\nÁrea de fotografía visible (imagen completa, sin recorte) como % de la hoja, texto normal / peor caso (zona reservada entre paréntesis):");
    for (const hoja of ["carta", "media-carta"]) {
      const fila = ["4:5", "1:1", "4:3", "16:9"].map((p) => {
        const n = visibles.find((v) => v.hoja === hoja && v.proporcion === p && v.caso === "normal")!;
        const w = visibles.find((v) => v.hoja === hoja && v.proporcion === p && v.caso === "peor")!;
        return `${p}: ${(n.visible * 100).toFixed(1)} / ${(w.visible * 100).toFixed(1)} %`;
      });
      const z = visibles.filter((v) => v.hoja === hoja).map((v) => v.zona);
      console.log(`  ℹ ${hoja.padEnd(11)} ${fila.join("   ")}   (zona ${(Math.min(...z) * 100).toFixed(1)}–${(Math.max(...z) * 100).toFixed(1)} %)`);
    }
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
