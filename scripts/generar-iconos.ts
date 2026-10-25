// Genera src/components/ui/iconos/rutas.ts con SOLO los íconos listados aquí (lámina 4.5).
// Fuente: @material-symbols/svg-400, variante rounded con relleno (FILL 1).
// Uso: npm run iconos   (tras agregar un nombre a la lista)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const NOMBRES = [
  "home", "pets", "search", "add_circle", "photo_camera",
  "location_on", "map", "notifications", "print", "share",
  "qr_code_2", "visibility", "schedule", "person", "menu",
  "light_mode", "dark_mode", "arrow_back", "close", "delete",
  "lock", "check_circle", "info", "warning", "error",
  // Bloque 1 (componentes base)
  "chevron_right", "chevron_left", "keyboard_arrow_down", "check", "more_vert", "add_a_photo", "edit",
  // Bloque 2 (plantillas)
  "login", "person_add", "help", "mail", "logout",
  // Bloque 4 (persona tutora)
  "visibility_off", "content_copy", "link", "download", "refresh", "add", "description", "calendar_month",
  // Bloque 5c (reportes y parámetros)
  "picture_as_pdf", "table_chart", "trending_up", "bar_chart", "restart_alt",
];

const base = join(process.cwd(), "node_modules/@material-symbols/svg-400/rounded");
const lineas = NOMBRES.map((nombre) => {
  const svg = readFileSync(join(base, `${nombre}-fill.svg`), "utf8");
  const rutas = [...svg.matchAll(/<path d="([^"]+)"\/?>/g)].map((m) => m[1]);
  if (rutas.length === 0) throw new Error(`Sin <path> en ${nombre}`);
  return `  ${nombre}: ${JSON.stringify(rutas)},`;
});

const salida = `// Archivo generado por scripts/generar-iconos.ts; no editar a mano.
// viewBox de todos: "0 -960 960 960".
export const RUTAS_ICONO = {
${lineas.join("\n")}
} as const satisfies Record<string, readonly string[]>;

export type NombreIcono = keyof typeof RUTAS_ICONO;
`;
writeFileSync(join(process.cwd(), "src/components/ui/iconos/rutas.ts"), salida);
console.log(`Íconos generados: ${NOMBRES.length}`);
