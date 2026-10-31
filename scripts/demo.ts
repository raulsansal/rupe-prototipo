// Variables: se leen del entorno Y de .env.local (basta una); el entorno gana. La dirección pública: --url= > RUPE_URL_PUBLICA del entorno > RUPE_URL_PUBLICA de .env.local.
// Arranque de la DEMOSTRACIÓN en vivo: compila y sirve el prototipo en el puerto 3000 para compartirlo por un túnel https (p. ej. el de VS Code en modo Público).
//   npm run demo                         (RUPE_URL_PUBLICA ya definida en el entorno o en .env.local)
//   npm run demo -- --url=https://...    (la dirección pública llega por argumento; nunca se escribe en el repositorio)
//   npm run demo -- --sin-build          (reutiliza el build)
// Garantías: exige por NOMBRE las variables necesarias y una RUPE_URL_PUBLICA https (sin ruta); anula RUPE_PERMITIR_REINICIO en el proceso hijo (un .env.local que la defina no la
// reactiva) y lo COMPRUEBA (POST /api/dev/reiniciar debe dar 404); no imprime secretos ni el entorno. Cada arranque es un proceso nuevo: los datos vuelven a la siembra.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PUERTO = Number(process.argv.find((a) => a.startsWith("--puerto="))?.split("=")[1] ?? 3000);
// Los correos también son obligatorios: en público nunca deben usarse los correos del seed (están en el repositorio).
const REQUERIDAS = ["RUPE_SESION_SECRETO", "RUPE_ADMIN_CORREO", "RUPE_ADMIN_CONTRASENA", "RUPE_TUTOR1_CORREO", "RUPE_TUTOR1_CONTRASENA", "RUPE_TUTOR2_CORREO", "RUPE_TUTOR2_CONTRASENA"];

/** Nombres de variables RUPE_* definidas en .env.local (solo nombres; los valores nunca se guardan ni se imprimen). */
function nombresEnEnvLocal(): Set<string> {
  const ruta = join(process.cwd(), ".env.local");
  const nombres = new Set<string>();
  if (!existsSync(ruta)) return nombres;
  for (const linea of readFileSync(ruta, "utf8").split("\n")) {
    const m = linea.match(/^\s*(RUPE_[A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m && m[2] !== '""' && m[2] !== "''") nombres.add(m[1]);
  }
  return nombres;
}

/** Valor de RUPE_URL_PUBLICA (argumento > entorno > .env.local) sin imprimirlo salvo la dirección pública, que es lo único que se muestra. */
function direccionPublica(): string | undefined {
  const arg = process.argv.find((a) => a.startsWith("--url="))?.slice(6);
  if (arg) return arg;
  if (process.env.RUPE_URL_PUBLICA?.trim()) return process.env.RUPE_URL_PUBLICA.trim();
  const ruta = join(process.cwd(), ".env.local");
  if (!existsSync(ruta)) return undefined;
  const linea = readFileSync(ruta, "utf8").split("\n").find((l) => /^\s*RUPE_URL_PUBLICA\s*=/.test(l));
  return linea?.replace(/^\s*RUPE_URL_PUBLICA\s*=\s*/, "").trim().replace(/^(['"])(.*)\1$/, "$2") || undefined;
}

/** Origen https válido (sin credenciales, ruta, consulta ni ancla) o undefined. */
export function origenHttps(valor: string | undefined): string | undefined {
  try {
    const u = new URL(valor ?? "");
    if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || (u.pathname !== "/" && u.pathname !== "")) return undefined;
    return u.origin;
  } catch {
    return undefined;
  }
}

function fallar(mensaje: string): never {
  console.error(`✗ ${mensaje}`);
  process.exit(1);
}

async function main() {
  const enLocal = nombresEnEnvLocal();
  const definida = (n: string) => Boolean(process.env[n]?.trim()) || enLocal.has(n);
  const faltan = REQUERIDAS.filter((n) => !definida(n));
  if (faltan.length) fallar(`No se arranca la demostración: faltan estas variables (solo nombres; defínelas en el entorno o en .env.local, ver .env.example): ${faltan.join(", ")}`);
  const publica = origenHttps(direccionPublica());
  if (!publica) fallar("RUPE_URL_PUBLICA debe ser una dirección https sin ruta (ni consulta). Defínela o pásala con --url=https://…");
  const reinicioEn = [process.env.RUPE_PERMITIR_REINICIO !== undefined ? "el entorno" : "", enLocal.has("RUPE_PERMITIR_REINICIO") ? ".env.local" : ""].filter(Boolean);
  if (reinicioEn.length) console.log(`ℹ RUPE_PERMITIR_REINICIO está definida en ${reinicioEn.join(" y ")}: se anula en el proceso de la demostración.`);

  if (!process.argv.includes("--sin-build")) {
    console.log("Compilando (next build)…");
    const b = spawnSync("npx", ["next", "build"], { encoding: "utf8", env: { ...process.env, RUPE_URL_PUBLICA: publica, RUPE_PERMITIR_REINICIO: "" } });
    if (b.status !== 0) fallar(`Falló next build:\n${(b.stdout ?? "").split("\n").slice(-15).join("\n")}`);
  }

  // RUPE_PERMITIR_REINICIO="" gana sobre .env.local (Next no sobrescribe variables ya definidas en el proceso).
  const hijo: ChildProcess = spawn("npx", ["next", "start", "-p", String(PUERTO)], { stdio: "ignore", detached: true, env: { ...process.env, RUPE_URL_PUBLICA: publica, RUPE_PERMITIR_REINICIO: "" } });
  const apagar = () => {
    try {
      if (hijo.pid) process.kill(-hijo.pid);
    } catch {
      // ya terminó
    }
  };
  for (const s of ["SIGINT", "SIGTERM"] as const) process.on(s, () => { apagar(); process.exit(0); });
  hijo.on("exit", (c) => { if (c) fallar(`El servidor terminó (código ${c}). ¿El puerto ${PUERTO} está ocupado?`); });

  const local = `http://localhost:${PUERTO}`;
  let listo = false;
  for (let i = 0; i < 60 && !listo; i++) {
    try { listo = (await fetch(`${local}/api/salud`)).ok; } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  if (!listo) { apagar(); fallar("El servidor no respondió a tiempo."); }

  const reinicio = await fetch(`${local}/api/dev/reiniciar`, { method: "POST", headers: { Origin: local } });
  if (reinicio.status !== 404) { apagar(); fallar(`/api/dev/reiniciar respondió ${reinicio.status} y debía dar 404: la demostración NO debe poder reiniciar datos.`); }

  console.log(`\n✓ RUPE listo con datos de siembra limpios.\n  Dirección pública: ${publica}\n  Puerto local:      ${PUERTO}   (comparte ese puerto con el túnel en modo Público)\n  Ctrl+C para detener.`);
}

if (process.argv[1]?.endsWith("demo.ts")) main();

