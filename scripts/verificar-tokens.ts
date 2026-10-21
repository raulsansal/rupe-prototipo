// Compara los tokens de color de globals.css con los valores del encargo del Bloque 0.
import { readFileSync } from "node:fs";

const CLARO = "primary #0F766E, primary-hover #115E59, primary-pressed #134E4A, primary-soft #CCFBF1, on-primary #FFFFFF, accent #F59E0B, accent-soft #FEF3C7, on-accent #451A03, background #F8FAFC, surface #FFFFFF, border #E2E8F0, border-strong #64748B, text #0F172A, text-muted #475569, disabled-text #475569, disabled-bg #E2E8F0, success #15803D, warning #B45309, danger #B91C1C, info #1D4ED8, focus-ring #1D4ED8, success-bg #DCFCE7, warning-bg #FEF3C7, danger-bg #FEE2E2, info-bg #DBEAFE";
const OSCURO = "primary #5EEAD4, primary-hover #99F6E4, primary-pressed #2DD4BF, primary-soft #0D5B4E, on-primary #032E28, accent #FBBF24, accent-soft #4A3A0C, on-accent #2B1D03, background #054239, surface #0A5246, surface-raised #0F6153, border #1F7566, border-strong #6FB3A5, text #ECFDF8, text-muted #A7D8CD, disabled-text #D5EFE9, disabled-bg #0F6153, success #86EFAC, warning #FCD34D, danger #FCA5A5, info #93C5FD, focus-ring #FCD34D, success-bg #14532D, warning-bg #5A4310, danger-bg #5C2326, info-bg #17426B";
// estado: [fondo claro, texto claro, fondo oscuro, texto oscuro]
const ESTADOS: Record<string, [string, string, string, string]> = {
  extraviado: ["#FEE2E2", "#991B1B", "#5C2326", "#FECACA"],
  "en-busqueda": ["#DBEAFE", "#1E40AF", "#17426B", "#BFDBFE"],
  avistamiento: ["#FEF3C7", "#92400E", "#5A4310", "#FDE68A"],
  "en-seguimiento": ["#EDE9FE", "#5B21B6", "#41307A", "#DDD6FE"],
  localizado: ["#DCFCE7", "#166534", "#14532D", "#BBF7D0"],
  cerrado: ["#E2E8F0", "#334155", "#0F3F37", "#CFE8E2"],
};

const aMapa = (txt: string) => new Map(txt.split(", ").map((p) => p.split(" ") as [string, string]));
const esperado = { claro: aMapa(CLARO), oscuro: aMapa(OSCURO) };
for (const [e, [bgC, fgC, bgO, fgO]] of Object.entries(ESTADOS)) {
  esperado.claro.set(`estado-${e}-bg`, bgC).set(`estado-${e}-fg`, fgC);
  esperado.oscuro.set(`estado-${e}-bg`, bgO).set(`estado-${e}-fg`, fgO);
}

const css = readFileSync("src/app/globals.css", "utf8");
const bloque = (selector: string) => {
  const i = css.indexOf(selector);
  return css.slice(css.indexOf("{", i), css.indexOf("\n}", i));
};
const leer = (b: string) => new Map([...b.matchAll(/^\s*--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6});/gm)].map((m) => [m[1], m[2].toUpperCase()]));
const real = { claro: leer(bloque(":root,\n[data-theme=\"light\"]")), oscuro: leer(bloque("\n[data-theme=\"dark\"] {")) };

let diferencias = 0;
for (const modo of ["claro", "oscuro"] as const) {
  for (const [token, valor] of esperado[modo]) {
    const r = real[modo].get(token);
    if (r !== valor) {
      diferencias++;
      console.log(`✗ ${modo} ${token}: encargo ${valor}, css ${r ?? "(falta)"}`);
    }
  }
  console.log(`${modo}: ${esperado[modo].size} tokens del encargo comparados`);
}
// surface-raised en claro no está en el encargo: se informa, no se compara.
console.log(diferencias === 0 ? "OK: sin diferencias" : `${diferencias} diferencia(s)`);
process.exit(diferencias === 0 ? 0 : 1);
