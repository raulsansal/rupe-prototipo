// Verifica por HTTP REAL el flujo de acceso (P1): registro, inicio y cierre de sesión, cookie, guardas por rol, redirección `siguiente`, Origin, no-store y
// reinicio de datos. Imprime cada petición con su código, las cabeceras relevantes y el cuerpo, SIN credenciales ni valores de cookie (de Set-Cookie solo
// se muestran los atributos). El último paso reinicia los datos ficticios (invalida las sesiones usadas) y deja limpios los contadores de intentos.
// Opciones: --sin-build reutiliza el build · --base=URL usa un servidor que ya corre (debe tener RUPE_PERMITIR_REINICIO=1).
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { USUARIOS_INICIALES } from "../src/mocks/usuarios";
import { credencial, NOMBRE_COOKIE, olvidarSesiones, valorDeSesion, type RolPrueba } from "./sesion-pruebas";

const PUERTO = 3109;
const baseExterna = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1];
const base = baseExterna ?? `http://localhost:${PUERTO}`;
let fallos = 0;
let total = 0;

type Resp = { estado: number; cabeceras: Headers; texto: string; json?: Record<string, unknown> };
async function peticion(metodo: string, ruta: string, { rol, valorCookie, cuerpo, cabeceras = {}, origen = new URL(base).origin }: { rol?: RolPrueba; valorCookie?: string; cuerpo?: unknown; cabeceras?: Record<string, string>; origen?: string | null } = {}): Promise<Resp> {
  const h = new Headers(cabeceras);
  if (metodo !== "GET" && origen !== null) h.set("Origin", origen);
  if (cuerpo !== undefined) h.set("Content-Type", "application/json");
  const valor = valorCookie ?? (rol ? await valorDeSesion(base, rol) : undefined);
  if (valor) h.set("Cookie", `${NOMBRE_COOKIE}=${valor}`);
  const r = await fetch(`${base}${ruta}`, { method: metodo, headers: h, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo), redirect: "manual" });
  const texto = await r.text();
  let json: Record<string, unknown> | undefined;
  try {
    json = JSON.parse(texto);
  } catch {
    json = undefined;
  }
  return { estado: r.status, cabeceras: r.headers, texto, json };
}

/** Set-Cookie sin el valor: solo nombre y atributos. */
const atributos = (r: Resp) => r.cabeceras.getSetCookie().map((c) => c.replace(/^([^=]+)=[^;]*/, "$1=<valor oculto>"));
const cuerpoCorto = (r: Resp) => (r.json ? JSON.stringify(r.json) : r.texto.replace(/\s+/g, " ").slice(0, 110) + (r.texto.length > 110 ? "…" : ""));

function ver(ok: boolean, titulo: string, r?: Resp, extra = "") {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${titulo}`);
  if (r) {
    const h = ["cache-control", "location", "content-type"].flatMap((n) => (r.cabeceras.get(n) ? [`${n}: ${r.cabeceras.get(n)}`] : []));
    console.log(`    HTTP ${r.estado} · ${h.join(" · ")}`);
    for (const a of atributos(r)) console.log(`    set-cookie: ${a}`);
    if (r.json || !r.cabeceras.get("content-type")?.includes("html")) console.log(`    cuerpo: ${cuerpoCorto(r)}`);
    else if (extra) console.log(`    ${extra}`);
  }
}

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

const valorDeCookie = (r: Resp) => r.cabeceras.getSetCookie().find((c) => c.startsWith(`${NOMBRE_COOKIE}=`))?.slice(NOMBRE_COOKIE.length + 1).split(";")[0];
const iniciar = (rol: RolPrueba, extra: Record<string, unknown> = {}, cabeceras: Record<string, string> = {}) => {
  const c = credencial(rol);
  return peticion("POST", "/api/acceso/iniciar", { cuerpo: { correo: c.correo, contrasena: c.contrasena, ...extra }, cabeceras });
};

async function pruebas() {
  const sinCredencial = USUARIOS_INICIALES.find((u) => u.id === 6)!; // cuenta del seed SIN contraseña: se usa para los intentos fallidos
  console.log("\n— Inicio de sesión —");
  const malo1 = await peticion("POST", "/api/acceso/iniciar", { cuerpo: { correo: sinCredencial.correo, contrasena: "Incorrecta123" } });
  const malo2 = await peticion("POST", "/api/acceso/iniciar", { cuerpo: { correo: "nadie.existe@example.org", contrasena: "Incorrecta123" } });
  ver(malo1.estado === 401 && malo2.estado === 401 && malo1.texto === malo2.texto && malo1.cabeceras.get("set-cookie") === null, "credenciales inválidas: 401 con el MISMO cuerpo para una cuenta existente y para una inexistente, sin cookie", malo1);
  const ok = await iniciar("tutor1");
  const attr = atributos(ok)[0] ?? "";
  ver(ok.estado === 200 && ok.json?.destino === "/tutor" && /HttpOnly/i.test(attr) && /SameSite=lax/i.test(attr) && /Max-Age=28800/i.test(attr) && !/Secure/i.test(attr), "login de persona tutora por HTTP: 200, destino /tutor, cookie HttpOnly + SameSite=Lax + 8 h y SIN Secure", ok);
  const c1 = credencial("tutor1");
  const https = await peticion("POST", "/api/acceso/iniciar", { cuerpo: { correo: c1.correo, contrasena: c1.contrasena }, cabeceras: { "x-forwarded-proto": "https" }, origen: `https://${new URL(base).host}` }); // detrás de un proxy HTTPS
  ver(https.estado === 200 && /Secure/i.test(atributos(https)[0] ?? ""), "con x-forwarded-proto: https la cookie lleva Secure", https);
  const admin = await iniciar("admin");
  ver(admin.estado === 200 && admin.json?.destino === "/admin", "login de Administrador: destino /admin", admin);
  const sig = await iniciar("admin", { siguiente: "/admin/usuarios?modal=rol" });
  ver(sig.json?.destino === "/admin/usuarios?modal=rol", "siguiente con ruta relativa interna válida: se respeta", sig);
  for (const mala of ["https://evil.example/admin", "//evil.example", "/\\evil.example", "javascript:alert(1)"]) {
    const r = await iniciar("admin", { siguiente: mala });
    ver(r.json?.destino === "/admin", `siguiente externo o malicioso (${JSON.stringify(mala)}): se ignora → /admin`, r);
  }
  const foraneo = await peticion("POST", "/api/acceso/iniciar", { cuerpo: { correo: credencial("admin").correo, contrasena: credencial("admin").contrasena }, origen: "http://evil.example" });
  const sinOrigen = await peticion("POST", "/api/acceso/iniciar", { cuerpo: { correo: credencial("admin").correo, contrasena: credencial("admin").contrasena }, origen: null });
  ver(foraneo.estado === 403 && foraneo.json?.error !== undefined && (foraneo.json.error as { codigo: string }).codigo === "ORIGEN_NO_PERMITIDO" && sinOrigen.estado === 200, "Origin de otro sitio: 403 ORIGEN_NO_PERMITIDO (sin cabecera Origin se acepta)", foraneo);

  console.log("\n— Rutas protegidas —");
  for (const ruta of ["/tutor", "/admin", "/tutor/registrar", "/admin/usuarios?modal=rol"]) {
    const r = await peticion("GET", ruta);
    const l = new URL(r.cabeceras.get("location") ?? "http://x/", base);
    ver(r.estado === 307 && l.pathname === "/acceso" && l.searchParams.get("siguiente") === ruta, `${ruta} SIN sesión: redirige a /acceso con siguiente`, r);
  }
  const t = await peticion("GET", "/tutor", { rol: "tutor1" });
  ver(t.estado === 200 && t.texto.includes("Cuenta de Rosa Hernández Ficticia"), "/tutor con sesión de Tutor: 200 y el encabezado muestra el NOMBRE REAL de la sesión", t, "html: «Cuenta de Rosa Hernández Ficticia»");
  const t2 = await peticion("GET", "/tutor", { rol: "tutor2" });
  ver(t2.estado === 200 && t2.texto.includes("Cuenta de Luis Navarro Ficticio") && !t2.texto.includes("Cuenta de Rosa"), "/tutor con la sesión de OTRA persona tutora: muestra su nombre (Luis Navarro Ficticio)", t2, "html: «Cuenta de Luis Navarro Ficticio»");
  const a = await peticion("GET", "/admin", { rol: "admin" });
  ver(a.estado === 200 && a.texto.includes("Ricardo Vega Ficticio"), "/admin con sesión de Administrador: 200 y muestra el nombre real (Ricardo Vega Ficticio)", a, "html: «Ricardo Vega Ficticio»");
  const aT = await peticion("GET", "/admin", { rol: "tutor1" });
  ver(aT.estado === 403 && aT.texto.includes("No tienes acceso a esta página"), "/admin con sesión de Tutor: 403 con la pantalla de acceso denegado", aT, "html: «No tienes acceso a esta página»");
  const aT2 = await peticion("GET", "/admin/usuarios", { rol: "tutor1" });
  const tA = await peticion("GET", "/tutor", { rol: "admin" });
  ver(aT2.estado === 403 && tA.estado === 403, "/admin/usuarios con Tutor y /tutor con Administrador: 403 también", tA, `/admin/usuarios con Tutor → HTTP ${aT2.estado}`);
  const reg = await peticion("GET", "/tutor/registrar", { rol: "admin" });
  ver(reg.estado === 403, "/tutor/registrar (ruta de (flujo)) con Administrador: 403", reg);

  console.log("\n— Reinicio de datos (RUPE_PERMITIR_REINICIO=1) —");
  const r0 = await peticion("POST", "/api/dev/reiniciar");
  const rT = await peticion("POST", "/api/dev/reiniciar", { rol: "tutor1" });
  ver(r0.estado === 401 && rT.estado === 403, "POST /api/dev/reiniciar: 401 sin sesión y 403 con sesión de Tutor", rT, `sin sesión → HTTP ${r0.estado}`);

  console.log("\n— Registro —");
  const correoNuevo = `prueba.${Date.now()}@example.org`;
  const datos = { nombre: "Persona de Prueba Ficticia", correo: correoNuevo, contrasena: `Clave${Date.now()}x1`, telefono: "5512345678", aceptaAviso: true, versionAviso: "1.0" };
  const sinAviso = await peticion("POST", "/api/acceso/registrar", { cuerpo: { ...datos, aceptaAviso: false } });
  const vacio = await peticion("POST", "/api/acceso/registrar", { cuerpo: {} });
  ver(sinAviso.estado === 422 && Object.keys((sinAviso.json?.error as { campos: object }).campos).join() === "aviso" && vacio.estado === 422 && Object.keys((vacio.json?.error as { campos: object }).campos).length === 5, "registro sin aceptar el aviso o vacío: 422 con errores por campo y sin cookie", sinAviso);
  const malicioso = await peticion("POST", "/api/acceso/registrar", { cuerpo: { ...datos, rol: "Administrador", estatus: 0, idUsuario: 1, notificacionesActivas: false } });
  const miCookie = valorDeCookie(malicioso);
  ver(malicioso.estado === 201 && malicioso.json?.destino === "/tutor" && (malicioso.json.usuario as { rol: string }).rol === "Tutor" && /HttpOnly/i.test(atributos(malicioso)[0] ?? ""), "registro válido con campos de más (rol, estatus, id): 201, rol Tutor y sesión abierta", malicioso);
  const comoNuevo = await peticion("GET", "/admin", { valorCookie: miCookie });
  const duplicado = await peticion("POST", "/api/acceso/registrar", { cuerpo: { ...datos, correo: correoNuevo.toUpperCase() } });
  ver(comoNuevo.estado === 403 && duplicado.estado === 409 && (duplicado.json?.error as { campos: { correo: string } }).campos.correo.length > 0, "la cuenta nueva NO es administradora (403 en /admin) y repetir el correo en mayúsculas da 409", duplicado, `/admin con la cuenta nueva → HTTP ${comoNuevo.estado}`);

  console.log("\n— Cerrar sesión —");
  const s1 = valorDeCookie(await iniciar("tutor1"));
  const s2 = valorDeCookie(await iniciar("tutor1"));
  const cierra = await peticion("POST", "/api/acceso/cerrar", { valorCookie: s1 });
  const borra = atributos(cierra)[0] ?? "";
  ver(cierra.estado === 303 && cierra.cabeceras.get("location") === "/" && /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(borra), "cerrar sesión: 303 a «/» y la cookie se borra", cierra);
  const conViejo = await peticion("GET", "/tutor", { valorCookie: s1 });
  const conOtra = await peticion("GET", "/tutor", { valorCookie: s2 });
  ver(conViejo.estado === 307 && new URL(conViejo.cabeceras.get("location") ?? "http://x/", base).pathname === "/acceso" && conOtra.estado === 200, "con la cookie de la sesión cerrada ya no se entra (307 a /acceso); la OTRA sesión de la misma persona sigue abierta (200)", conViejo, `la otra sesión → HTTP ${conOtra.estado}`);
  const foraneoCierre = await peticion("POST", "/api/acceso/cerrar", { valorCookie: s2, origen: "http://evil.example" });
  const sigue = await peticion("GET", "/tutor", { valorCookie: s2 });
  ver(foraneoCierre.estado === 403 && sigue.estado === 200, "cerrar sesión desde otro origen: 403 y la sesión sigue abierta", foraneoCierre);

  console.log("\n— no-store en toda la API —");
  const muestras = [await peticion("GET", "/api/salud"), await peticion("GET", "/api/fichas/RUPE-K7M4XQ9T"), await peticion("GET", "/api/fichas/RUPE-ZZZZZZZZ"), await peticion("GET", "/api/fichas/hola"), malo1, foraneo, cierra, sinAviso];
  ver(muestras.every((m) => m.cabeceras.get("cache-control") === "no-store"), `Cache-Control: no-store (exacto) en las ${muestras.length} respuestas de las rutas /api (éxito, 400, 401, 403, 404, 303 y 422)`, muestras[3]);
  const inexistente = await peticion("GET", "/api/ruta-que-no-existe");
  ver(inexistente.estado === 404 && (inexistente.cabeceras.get("cache-control") ?? "").includes("no-store"), "una ruta /api que no existe también responde 404 con no-store (en la lista de directivas de Next)", inexistente);

  console.log("\n— Reinicio con Administrador (último paso) —");
  const viejaAdmin = await valorDeSesion(base, "admin");
  const rA = await peticion("POST", "/api/dev/reiniciar", { rol: "admin" });
  ver(rA.estado === 200 && (rA.json?.estado as string) === "reiniciado", "POST /api/dev/reiniciar con sesión de Administrador: 200", rA);
  olvidarSesiones();
  const trasReinicio = await peticion("GET", "/admin", { valorCookie: viejaAdmin });
  const intentosLimpios = await peticion("POST", "/api/acceso/iniciar", { cuerpo: { correo: sinCredencial.correo, contrasena: "Incorrecta123" } });
  ver(trasReinicio.estado === 307 && intentosLimpios.estado === 401, "tras reiniciar: las sesiones anteriores quedan invalidadas (307) y los contadores de intentos vuelven a cero (401, no bloqueo)", trasReinicio);
  await peticion("POST", "/api/dev/reiniciar", { valorCookie: await valorDeSesion(base, "admin") }); // vuelve a limpiar lo que dejó esta última comprobación
  olvidarSesiones();
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
  try {
    if (servidor) await esperarServidor(servidor);
    await pruebas();
  } finally {
    apagar();
  }
  console.log(fallos === 0 ? `\nOK: ${total} comprobaciones del flujo de acceso por HTTP` : `\n${fallos} de ${total} comprobación(es) fallida(s)`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
