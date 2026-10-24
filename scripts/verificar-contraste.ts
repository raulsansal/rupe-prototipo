// Razón de contraste (WCAG 2.1) de los pares clave de globals.css, en claro y en oscuro.
// Falla si el texto normal queda bajo 4.5:1 o los bordes de controles / foco bajo 3:1.
// Los pares «informativos» (texto deshabilitado) se reportan pero no fallan: WCAG los exime.
import { readFileSync } from "node:fs";

const css = readFileSync("src/app/globals.css", "utf8");
const leer = (inicio: string) => {
  const i = css.indexOf(inicio);
  const bloque = css.slice(css.indexOf("{", i), css.indexOf("\n}", i));
  return new Map([...bloque.matchAll(/^\s*--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6});/gm)].map((m) => [m[1], m[2]]));
};
const temas = { claro: leer(':root,\n[data-theme="light"]'), oscuro: leer('\n[data-theme="dark"] {') };

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const razon = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// Diferencia de color CIEDE2000 (para distinguir los seis tonos de la barra por estado entre sí, no solo los vecinos).
const lab = (hex: string): [number, number, number] => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const x = (c[0] * 0.4124564 + c[1] * 0.3575761 + c[2] * 0.1804375) / 0.95047;
  const y = c[0] * 0.2126729 + c[1] * 0.7151522 + c[2] * 0.072175;
  const z = (c[0] * 0.0193339 + c[1] * 0.119192 + c[2] * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const ciede2000 = (h1x: string, h2x: string) => {
  const [L1, a1, b1] = lab(h1x);
  const [L2, a2, b2] = lab(h2x);
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);
  const tono = (y: number, x: number) => (x === 0 && y === 0 ? 0 : (deg(Math.atan2(y, x)) + 360) % 360);
  const h1 = tono(b1, ap1);
  const h2 = tono(b2, ap2);
  let dh = 0;
  if (Cp1 * Cp2 !== 0) {
    dh = h2 - h1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dL = L2 - L1;
  const dC = Cp2 - Cp1;
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(rad(dh / 2));
  const Lb = (L1 + L2) / 2;
  const Cpb = (Cp1 + Cp2) / 2;
  let hb = h1 + h2;
  if (Cp1 * Cp2 !== 0) hb = Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2;
  const T = 1 - 0.17 * Math.cos(rad(hb - 30)) + 0.24 * Math.cos(rad(2 * hb)) + 0.32 * Math.cos(rad(3 * hb + 6)) - 0.2 * Math.cos(rad(4 * hb - 63));
  const dt = 30 * Math.exp(-(((hb - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2);
  const SC = 1 + 0.045 * Cpb;
  const SH = 1 + 0.015 * Cpb * T;
  const RT = -Math.sin(rad(2 * dt)) * Rc;
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
};

type Par = { nombre: string; fg: string; bg: string; minimo: number; informativo?: boolean };
const texto = (nombre: string, fg: string, bg: string): Par => ({ nombre, fg, bg, minimo: 4.5 });
const borde = (nombre: string, fg: string, bg: string): Par => ({ nombre, fg, bg, minimo: 3 });

const ESTADOS = ["extraviado", "en-busqueda", "avistamiento", "en-seguimiento", "localizado", "cerrado"];
const pares: Par[] = [
  texto("texto / fondo", "text", "background"),
  texto("texto / superficie", "text", "surface"),
  texto("texto / superficie elevada", "text", "surface-raised"),
  texto("texto secundario / superficie", "text-muted", "surface"),
  texto("texto secundario / fondo", "text-muted", "background"),
  texto("texto del botón primario", "on-primary", "primary"),
  texto("texto del botón destructivo", "on-primary", "danger"),
  texto("hover del destructivo (texto)", "on-primary", "estado-extraviado-fg"),
  texto("enlace primario / superficie", "primary", "surface"),
  texto("primario / primary-soft (secundario en hover, pestaña activa)", "primary", "primary-soft"),
  texto("texto / primary-soft (tarjeta presionada)", "text", "primary-soft"),
  texto("on-accent / accent (etiqueta Nuevo)", "on-accent", "accent"),
  texto("éxito / superficie", "success", "surface"),
  texto("advertencia / superficie", "warning", "surface"),
  texto("error / superficie", "danger", "surface"),
  texto("información / superficie", "info", "surface"),
  texto("texto / alerta de información", "text", "info-bg"),
  texto("texto / alerta de éxito", "text", "success-bg"),
  texto("texto / alerta de advertencia", "text", "warning-bg"),
  texto("texto / alerta de peligro", "text", "danger-bg"),
  texto("error / fondo de la carga con error", "danger", "danger-bg"),
  texto("texto del toast (fondo / texto)", "background", "text"),
  ...ESTADOS.map((e) => texto(`chip estado ${e}`, `estado-${e}-fg`, `estado-${e}-bg`)),
  ...[1, 2, 3, 4, 5, 6].flatMap((n) => [borde(`gráfica: chart-${n} / superficie`, `chart-${n}`, "surface"), borde(`gráfica: chart-${n} / fondo`, `chart-${n}`, "background")]),
  ...ESTADOS.flatMap((e) => [borde(`barra de estados: ${e} / superficie`, `barra-estado-${e}`, "surface"), borde(`barra de estados: ${e} / fondo`, `barra-estado-${e}`, "background")]),
  borde("borde de controles / fondo", "border-strong", "background"),
  borde("borde de controles / superficie", "border-strong", "surface"),
  borde("anillo de foco / fondo", "focus-ring", "background"),
  borde("anillo de foco / superficie", "focus-ring", "surface"),
  { nombre: "texto deshabilitado / fondo deshabilitado", fg: "disabled-text", bg: "disabled-bg", minimo: 4.5, informativo: true },
];

// Barra «Casos por estado del caso»: los seis tonos se comparan por parejas (CIEDE2000 ≥ 20) y cada uno contra la superficie (≥ 3:1);
// los tramos vecinos llevan un separador visible, que se lee del componente.
const separador = /border-r-\[3px\] border-surface/.test(readFileSync("src/components/ui/BarraApilada.tsx", "utf8"));

let fallos = 0;
for (const [tema, t] of Object.entries(temas)) {
  console.log(`\n${tema}`);
  for (const p of pares) {
    const fg = t.get(p.fg);
    const bg = t.get(p.bg);
    if (!fg || !bg) {
      fallos++;
      console.log(`  ✗ ${p.nombre}: falta el token ${!fg ? p.fg : p.bg}`);
      continue;
    }
    const r = razon(fg, bg);
    const ok = r >= p.minimo;
    if (!ok && !p.informativo) fallos++;
    console.log(`  ${ok ? "✓" : p.informativo ? "i" : "✗"} ${r.toFixed(2)}:1 (mín. ${p.minimo}) ${p.nombre}`);
  }
}
// Los tramos vecinos se separan con una línea de 3 px del color de la superficie, que contrasta ≥ 3:1 con cada tono (pares «/ superficie»).
if (!separador) {
  fallos++;
  console.log("\n✗ la barra por estado ya no dibuja el separador entre tramos");
} else console.log("\n✓ la barra por estado dibuja el separador de 3 px entre tramos (color de la superficie)");
for (const [tema, t] of Object.entries(temas)) {
  console.log(`\n${tema}: las 15 parejas de tonos de la barra por estado (CIEDE2000 ≥ 20)`);
  let minimo = Infinity;
  const malas: string[] = [];
  for (let i = 0; i < ESTADOS.length; i++) {
    for (let j = i + 1; j < ESTADOS.length; j++) {
      const a = t.get(`barra-estado-${ESTADOS[i]}`);
      const b = t.get(`barra-estado-${ESTADOS[j]}`);
      if (!a || !b) {
        malas.push(`${ESTADOS[i]} / ${ESTADOS[j]}: falta el token`);
        continue;
      }
      const d = ciede2000(a, b);
      minimo = Math.min(minimo, d);
      if (d < 20) malas.push(`${ESTADOS[i]} / ${ESTADOS[j]} ΔE00 ${d.toFixed(1)}`);
    }
  }
  if (malas.length) fallos++;
  console.log(`  ${malas.length ? "✗" : "✓"} 15 parejas, ΔE00 mínima ${minimo.toFixed(1)}${malas.length ? ` → ${malas.join(" | ")}` : ""}`);
}
console.log(fallos === 0 ? "\nOK: todos los pares cumplen" : `\n${fallos} par(es) bajo el mínimo`);
process.exit(fallos === 0 ? 0 : 1);
