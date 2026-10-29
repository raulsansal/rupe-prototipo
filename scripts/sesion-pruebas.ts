// Sesiones REALES para los scripts de verificación y de capturas: inician sesión por el endpoint de inicio de sesión (POST /api/acceso/iniciar) con las
// cuentas ficticias de .env.local y entregan la cookie. Nunca desactivan las guardas ni imprimen credenciales ni valores de cookie (los errores nombran
// la VARIABLE que falta, jamás su valor). Un solo inicio de sesión por rol y por servidor en cada corrida.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { BrowserContext } from "playwright";
import { USUARIOS_INICIALES } from "../src/mocks/usuarios";

export type RolPrueba = "admin" | "tutor1" | "tutor2";
export const NOMBRE_COOKIE = "rupe_sesion";
const CUENTAS: Record<RolPrueba, { idUsuario: number; variableCorreo: string; variableContrasena: string }> = {
  admin: { idUsuario: 1, variableCorreo: "RUPE_ADMIN_CORREO", variableContrasena: "RUPE_ADMIN_CONTRASENA" },
  tutor1: { idUsuario: 2, variableCorreo: "RUPE_TUTOR1_CORREO", variableContrasena: "RUPE_TUTOR1_CONTRASENA" },
  tutor2: { idUsuario: 5, variableCorreo: "RUPE_TUTOR2_CORREO", variableContrasena: "RUPE_TUTOR2_CONTRASENA" },
};

/** Carga las variables RUPE_* de .env.local que NO estén ya definidas (no imprime nada). */
export function cargarEnvLocal(): void {
  const ruta = join(process.cwd(), ".env.local");
  if (!existsSync(ruta)) return;
  for (const linea of readFileSync(ruta, "utf8").split("\n")) {
    const m = linea.match(/^\s*(RUPE_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

/** Credencial ficticia de la cuenta (de .env.local). Solo para escribirla en formularios; nunca se imprime. */
export function credencial(rol: RolPrueba): { correo: string; contrasena: string } {
  cargarEnvLocal();
  const c = CUENTAS[rol];
  const contrasena = process.env[c.variableContrasena];
  if (!contrasena) throw new Error(`Falta la variable de entorno ${c.variableContrasena} (defínela en .env.local; ver .env.example).`);
  return { correo: process.env[c.variableCorreo] || USUARIOS_INICIALES.find((u) => u.id === c.idUsuario)!.correo, contrasena };
}

const cache = new Map<string, string>();

/** Inicia sesión por HTTP y devuelve el valor de la cookie (sin el nombre). Con caché por servidor y rol. */
export async function valorDeSesion(base: string, rol: RolPrueba): Promise<string> {
  const clave = `${base}|${rol}`;
  const guardada = cache.get(clave);
  if (guardada) return guardada;
  const { correo, contrasena } = credencial(rol);
  const r = await fetch(`${base}/api/acceso/iniciar`, { method: "POST", headers: { "Content-Type": "application/json", Origin: new URL(base).origin }, body: JSON.stringify({ correo, contrasena }), redirect: "manual" });
  if (!r.ok) throw new Error(`No se pudo iniciar sesión como «${rol}» en ${base}: HTTP ${r.status}`);
  const galleta = r.headers.getSetCookie().find((c) => c.startsWith(`${NOMBRE_COOKIE}=`));
  if (!galleta) throw new Error(`El inicio de sesión de «${rol}» no entregó la cookie ${NOMBRE_COOKIE}.`);
  const valor = galleta.slice(NOMBRE_COOKIE.length + 1).split(";")[0];
  cache.set(clave, valor);
  return valor;
}

/** Pone la sesión del rol en un contexto de Playwright. */
export async function agregarSesion(contexto: BrowserContext, base: string, rol: RolPrueba): Promise<void> {
  await contexto.addCookies([{ name: NOMBRE_COOKIE, value: await valorDeSesion(base, rol), url: base, httpOnly: true, sameSite: "Lax" }]); // como la real: JavaScript no la ve
}

/** fetch con la sesión del rol (o sin sesión si es null). Por defecto sigue las redirecciones. */
export async function fetchComo(base: string, rol: RolPrueba | null, ruta: string, init: RequestInit = {}): Promise<Response> {
  const cabeceras = new Headers(init.headers);
  if (rol) cabeceras.set("Cookie", `${NOMBRE_COOKIE}=${await valorDeSesion(base, rol)}`);
  return fetch(`${base}${ruta}`, { ...init, headers: cabeceras });
}

/** Qué sesión necesita una ruta: /admin → administrador; /tutor → persona tutora 1; el resto, ninguna. */
export const rolDeRuta = (ruta: string): RolPrueba | null => (/^\/admin(?:[/?#]|$)/.test(ruta) ? "admin" : /^\/tutor(?:[/?#]|$)/.test(ruta) ? "tutor1" : null);

/** Quita la sesión de un servidor (p. ej. tras reiniciar los datos, que invalida las sesiones). */
export const olvidarSesiones = () => cache.clear();

/** Herramienta de desarrollo: fija la versión vigente del aviso (para probar y capturar la reaceptación, R22). Requiere sesión de Administrador si el servidor está en producción. */
export async function fijarVersionAviso(base: string, valor: string): Promise<void> {
  const r = await fetchComo(base, "admin", "/api/dev/parametro", { method: "POST", headers: { "Content-Type": "application/json", Origin: new URL(base).origin }, body: JSON.stringify({ valor }) });
  if (!r.ok) throw new Error(`No se pudo fijar la versión del aviso: HTTP ${r.status}`);
}

/**
 * Vuelve a los datos ficticios iniciales (también los contadores de intentos y las sesiones). LANZA si el servidor no responde 200: un reinicio que falla en silencio dejaba pruebas y capturas
 * trabajando sobre datos sucios. El servidor debe arrancarse con RUPE_PERMITIR_REINICIO=1 (los scripts que lo levantan ya la fijan).
 */
export async function reiniciarDatos(base: string): Promise<number> {
  let estado = 0;
  try {
    const r = await fetchComo(base, "admin", "/api/dev/reiniciar", { method: "POST", headers: { Origin: new URL(base).origin } });
    estado = r.status;
  } catch {
    estado = 0;
  } finally {
    olvidarSesiones();
  }
  if (estado !== 200) throw new Error(`No se pudieron reiniciar los datos (HTTP ${estado}). Arranca el servidor con RUPE_PERMITIR_REINICIO=1 y una cuenta de Administrador activa.`);
  return estado;
}
