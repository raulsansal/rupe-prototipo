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
  borde("borde de controles / fondo", "border-strong", "background"),
  borde("borde de controles / superficie", "border-strong", "surface"),
  borde("anillo de foco / fondo", "focus-ring", "background"),
  borde("anillo de foco / superficie", "focus-ring", "surface"),
  { nombre: "texto deshabilitado / fondo deshabilitado", fg: "disabled-text", bg: "disabled-bg", minimo: 4.5, informativo: true },
];

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
console.log(fallos === 0 ? "\nOK: todos los pares cumplen" : `\n${fallos} par(es) bajo el mínimo`);
process.exit(fallos === 0 ? 0 : 1);
