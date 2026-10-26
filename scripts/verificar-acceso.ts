// Verifica por HTTP REAL el flujo de acceso (P1): registro, inicio y cierre de sesión, cookie, guardas por rol, redirección `siguiente`, Origin, no-store y
// reinicio de datos. Imprime cada petición con su código, las cabeceras relevantes y el cuerpo, SIN credenciales ni valores de cookie (de Set-Cookie solo
// se muestran los atributos). El último paso reinicia los datos ficticios (invalida las sesiones usadas) y deja limpios los contadores de intentos.
// Opciones: --sin-build reutiliza el build · --base=URL usa un servidor que ya corre (debe tener RUPE_PERMITIR_REINICIO=1).
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { USUARIOS_INICIALES } from "../src/mocks/usuarios";
import { credencial, NOMBRE_COOKIE, olvidarSesiones, valorDeSesion, type RolPrueba } from "./sesion-pruebas";

const PUERTO = 3109;
const PUERTO_SIN_PERMISO = 3111; // segundo servidor, SIN RUPE_PERMITIR_REINICIO (las herramientas /api/dev deben dar 404)
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

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, ...new Array(400).fill(9), 0xff, 0xd9]);
const datosDeCaso = (extra: Record<string, unknown> = {}) => ({ nombre: "Pelusa", sexo: "Hembra", idRaza: 1, edad: { valor: 0, unidad: "meses" }, tamano: "pequeño", color: "Blanco", fechaExtravio: new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10), momento: "tarde", alcaldia: "Coyoacán", colonia: "Del Carmen", calle: "Calle Reservada 99", idMotivo: 1, ...extra });
/** POST /api/casos como lo envía el navegador: multipart con «datos» y «fotografia». */
async function postCaso({ rol, datos = datosDeCaso(), bytes = JPEG, tipo = "image/jpeg", origen = new URL(base).origin, sinFoto = false }: { rol?: RolPrueba; datos?: unknown; bytes?: Uint8Array; tipo?: string; origen?: string; sinFoto?: boolean } = {}): Promise<Resp> {
  const f = new FormData();
  f.set("datos", JSON.stringify(datos));
  if (!sinFoto) f.set("fotografia", new Blob([bytes as BlobPart], { type: tipo }), "fotografia.jpg");
  const h = new Headers({ Origin: origen });
  if (rol) h.set("Cookie", `${NOMBRE_COOKIE}=${await valorDeSesion(base, rol)}`);
  const r = await fetch(`${base}/api/casos`, { method: "POST", headers: h, body: f, redirect: "manual" });
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

async function esperarServidor(servidor: ChildProcess, destino: string = base) {
  for (let i = 0; i < 120; i++) {
    if (servidor.exitCode !== null) throw new Error("El servidor terminó antes de estar listo");
    try {
      if ((await fetch(destino)).status < 500) return;
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
  // Contadores de «Mis registros» con los datos iniciales (se derivan del último movimiento de cada caso): Rosa 5/2/8 (Rocky cerrado) y Luis 2/0/4 (Kira deshabilitada y Simba cancelada, ambos «Cerrado»).
  const contadores = (r: Resp) => ["Activos", "Localizados", "Todos"].map((n) => new RegExp(`role="tab"[^>]*>${n}<span[^>]*>(\\d+)<`).exec(r.texto)?.[1] ?? "?").join("/");
  ver(contadores(t) === "5/2/8" && contadores(t2) === "2/0/4", "«Mis registros» con los datos iniciales: Activos/Localizados/Todos de Rosa 5/2/8 y de Luis 2/0/4 (los cerrados no son activos ni localizados)", t2, `Rosa ${contadores(t)} · Luis ${contadores(t2)}`);
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

  console.log("\n— Registrar extravío (P2): POST /api/casos y fotografía —");
  const c0 = await postCaso();
  const cAdmin = await postCaso({ rol: "admin" });
  const cOrigen = await postCaso({ rol: "tutor1", origen: "http://evil.example" });
  ver(c0.estado === 401 && cAdmin.estado === 403 && cOrigen.estado === 403 && (cOrigen.json?.error as { codigo: string }).codigo === "ORIGEN_NO_PERMITIDO", "POST /api/casos: 401 sin sesión, 403 con el Administrador y 403 desde otro origen", cAdmin, `sin sesión → HTTP ${c0.estado}; otro origen → HTTP ${cOrigen.estado}`);
  const cOk = await postCaso({ rol: "tutor1", datos: datosDeCaso({ idUsuario: 5, folio: "RUPE-AAAAAAAA", estado: "Cerrado", idCaso: 1, rol: "Administrador", fechaRegistro: "2000-01-01T00:00:00Z" }) });
  const folioNuevo = String(cOk.json?.folio ?? "");
  ver(cOk.estado === 201 && /^RUPE-[A-HJ-NP-Z2-9]{8}$/.test(folioNuevo) && folioNuevo !== "RUPE-AAAAAAAA" && cOk.json?.estado === "En búsqueda" && cOk.json?.destino === `/tutor/casos/${folioNuevo}/creado` && cOk.cabeceras.get("cache-control") === "no-store", "POST /api/casos válido (con idUsuario, folio, estado e idCaso de más): 201, folio nuevo con el patrón, «En búsqueda» y no-store", cOk);
  const conf = await peticion("GET", `/tutor/casos/${folioNuevo}/creado`, { rol: "tutor1" });
  const confOtra = await peticion("GET", `/tutor/casos/${folioNuevo}/creado`, { rol: "tutor2" });
  ver(conf.estado === 200 && conf.texto.includes(folioNuevo) && conf.texto.includes("menos de 1 mes") && confOtra.estado === 404, "el dueño real es quien tiene la sesión (tutor1, no el idUsuario enviado): su confirmación da 200 con «menos de 1 mes» y la de la otra persona 404", conf, "html: folio, «menos de 1 mes», «Te avisamos tu folio»");
  // P2b · «Mis registros» y las 7 pantallas de caso, por HTTP real y con sesiones firmadas (sin imprimir cookies).
  const DE_ROSA = ["RUPE-K7M4XQ9T", "RUPE-P3H8WD5N", "RUPE-B6R2TZ7C", "RUPE-Y9F4LK2E", "RUPE-3HN8WD2B", "RUPE-H4TQ7V2M", "RUPE-N8D5GX3W", "RUPE-C2J9RK6Z"];
  const DE_LUIS = ["RUPE-D5W2QK8X", "RUPE-F7L3MN6Y", "RUPE-G8R4TV3K", "RUPE-J2C6PZ9H"];
  const [listaD, listaO] = [await peticion("GET", "/tutor", { rol: "tutor1" }), await peticion("GET", "/tutor", { rol: "tutor2" })];
  ver(listaD.estado === 200 && listaD.texto.includes(folioNuevo) && listaD.texto.indexOf(folioNuevo) < listaD.texto.indexOf(DE_ROSA[0]) && DE_LUIS.every((f) => !listaD.texto.includes(f)), "/tutor de la dueña (Rosa): contiene el caso recién registrado, antes de los sembrados, y ningún caso de Luis", listaD);
  ver(listaO.estado === 200 && DE_LUIS.every((f) => listaO.texto.includes(f)) && !listaO.texto.includes(folioNuevo) && DE_ROSA.every((f) => !listaO.texto.includes(f)), "/tutor de Luis: sus 4 casos y ninguno de Rosa (ni el recién registrado)", listaO);
  const PANTALLAS: [string, string][] = [["detalle", ""], ["ficha", "/ficha"], ["mapa", "/mapa"], ["editar", "/editar"], ["avistamientos", "/avistamientos"], ["avistamiento/101", "/avistamientos/101"], ["notificaciones", "/notificaciones"]];
  const NALA = "RUPE-Y9F4LK2E";
  const de = (rol: RolPrueba | undefined, folio: string) => Promise.all(PANTALLAS.map(([, x]) => peticion("GET", `/tutor/casos/${folio}${x}`, { rol })));
  const [propias, ajenasLuis, ajenasRosa, inexRosa, inexLuis, comoAdmin, anonimas] = [await de("tutor1", NALA), await de("tutor2", NALA), await de("tutor1", DE_LUIS[0]), await de("tutor1", "RUPE-ZZZZZZZZ"), await de("tutor2", "RUPE-ZZZZZZZZ"), await de("admin", NALA), await de(undefined, NALA)];
  const malFormado = await de("tutor2", "no-es-un-folio");
  console.log("    matriz (pantalla × persona → HTTP):");
  console.log(`    ${"pantalla".padEnd(18)}${["dueña", "Luis→Rosa", "Rosa→Luis", "inex.(Luis)", "mal form.", "Admin", "sin sesión"].map((c) => c.padEnd(12)).join("")}`);
  PANTALLAS.forEach(([n], i) => console.log(`    ${n.padEnd(18)}${[propias[i].estado, ajenasLuis[i].estado, ajenasRosa[i].estado, inexLuis[i].estado, malFormado[i].estado, comoAdmin[i].estado, anonimas[i].estado].map((c) => String(c).padEnd(12)).join("")}`));
  const igual = (x: Resp, y: Resp, folioX: string, folioY: string) => x.texto.replaceAll(folioX, folioY) === y.texto && x.cabeceras.get("content-type") === y.cabeceras.get("content-type") && x.cabeceras.get("cache-control") === y.cabeceras.get("cache-control");
  ver(propias.every((r) => r.estado === 200), "la dueña abre las 7 pantallas de su caso (200; editar y notificaciones siguen como pantalla pendiente)", propias[0]);
  ver(ajenasLuis.every((r, i) => r.estado === 404 && igual(r, inexLuis[i], NALA, "RUPE-ZZZZZZZZ")) && ajenasRosa.every((r, i) => r.estado === 404 && igual(r, inexRosa[i], DE_LUIS[0], "RUPE-ZZZZZZZZ")) && malFormado.every((r) => r.estado === 404), "las 7 pantallas: Luis con un folio de Rosa y Rosa con uno de Luis dan 404 con el mismo cuerpo y cabeceras que un folio inexistente en esa pantalla (se normaliza solo el folio que Next repite); el mal formado también 404", ajenasLuis[0], `estados: ${ajenasLuis.map((r) => r.estado).join()} / ${ajenasRosa.map((r) => r.estado).join()}`);
  ver(comoAdmin.every((r) => r.estado === 403), "el Administrador en las 7 pantallas de la persona tutora: 403", comoAdmin[0]);
  ver(anonimas.every((r, i) => r.estado === 307 && r.cabeceras.get("location") === `/acceso?siguiente=${encodeURIComponent(`/tutor/casos/${NALA}${PANTALLAS[i][1]}`)}`), "sin sesión: las 7 pantallas redirigen (307) a /acceso?siguiente= con su propia ruta", anonimas[0]);
  const idFoto = /\/api\/fotografias\/(\d+)/.exec(conf.texto)?.[1] ?? "0";
  const [fDueno, fOtra, fAdmin, fAnon, fNoExiste] = [await peticion("GET", `/api/fotografias/${idFoto}`, { rol: "tutor1" }), await peticion("GET", `/api/fotografias/${idFoto}`, { rol: "tutor2" }), await peticion("GET", `/api/fotografias/${idFoto}`, { rol: "admin" }), await peticion("GET", `/api/fotografias/${idFoto}`), await peticion("GET", "/api/fotografias/987654", { rol: "tutor1" })];
  const sembrada = await peticion("GET", "/api/fotografias/1", { rol: "tutor1" });
  ver(fDueno.estado === 200 && fDueno.cabeceras.get("content-type") === "image/jpeg" && fAdmin.estado === 200 && fAnon.estado === 401 && fOtra.estado === 404 && fOtra.texto === fNoExiste.texto && fOtra.texto === sembrada.texto, "GET /api/fotografias/<id>: dueña 200 image/jpeg, Administrador 200 (consulta), anónimo 401, y otra persona, id inexistente y foto sembrada 404 con el MISMO cuerpo", fOtra);
  const grande = await postCaso({ rol: "tutor1", bytes: new Uint8Array(5 * 1024 * 1024).fill(1) });
  ver(grande.estado === 413 && (grande.json?.error as { codigo: string }).codigo === "CUERPO_DEMASIADO_GRANDE" && grande.cabeceras.get("cache-control") === "no-store", "una petición de más de 4.5 MB: 413 CUERPO_DEMASIADO_GRANDE", grande);
  const invalido = await postCaso({ rol: "tutor1", datos: datosDeCaso({ nombre: "", alcaldia: "Fuera de la Ciudad de México", fechaExtravio: "2999-01-01" }), bytes: Uint8Array.from(Buffer.from("GIF89a-no-es-jpeg")) });
  const campos = Object.keys((invalido.json?.error as { campos: object }).campos).sort().join();
  const json = await fetch(`${base}/api/casos`, { method: "POST", headers: { "Content-Type": "application/json", Origin: new URL(base).origin, Cookie: `${NOMBRE_COOKIE}=${await valorDeSesion(base, "tutor1")}` }, body: "{}" });
  ver(invalido.estado === 422 && campos === "alcaldia,fecha,foto,nombre" && json.status === 400, "POST /api/casos inválido: 422 con errores por campo (nombre, alcaldía, fecha futura y foto que no es JPG/PNG por sus bytes); sin multipart: 400", invalido, `un cuerpo JSON en vez de multipart → HTTP ${json.status}`);
  const ficha = await peticion("GET", `/api/fichas/${folioNuevo}`);
  ver(ficha.estado === 200 && !/Calle Reservada|tarde|Rosa|Hern|api\/fotografias/i.test(ficha.texto), "la ficha pública del caso nuevo: 200 y sin calle, momento, datos de la persona ni la ruta de la foto", ficha);

  console.log("\n— P1: casos que faltaban —");
  const diego = USUARIOS_INICIALES.find((u) => u.id === 7)!; // cuenta del seed sin contraseña: se bloquea sin tocar las reales
  const intentos: number[] = [];
  for (let i = 0; i < 5; i++) intentos.push((await peticion("POST", "/api/acceso/iniciar", { cuerpo: { correo: diego.correo, contrasena: "Incorrecta123" } })).estado);
  const sexto = await peticion("POST", "/api/acceso/iniciar", { cuerpo: { correo: diego.correo, contrasena: "Incorrecta123" } });
  ver(intentos.join() === "401,401,401,401,403" && (sexto.json?.error as { codigo: string }).codigo === "CUENTA_BLOQUEADA", "R17: cuatro intentos fallidos dan 401 y el QUINTO ya da 403 CUENTA_BLOQUEADA (y el sexto también)", sexto, `intentos: ${intentos.join()}`);
  const sinPermisoDev = await peticion("POST", "/api/dev/parametro", { rol: "admin", cuerpo: { valor: "2.0" } }); // este servidor sí permite la herramienta
  const c2 = credencial("tutor2");
  const malaConAviso = await peticion("POST", "/api/acceso/iniciar", { cuerpo: { correo: c2.correo, contrasena: "Incorrecta123" } });
  const sin = await iniciar("tutor2");
  const con = await iniciar("tutor2", { aceptarAviso: true });
  ver(sinPermisoDev.estado === 200 && malaConAviso.estado === 401 && sin.estado === 409 && (sin.json?.error as { codigo: string; versionAviso: string }).codigo === "AVISO_DESACTUALIZADO" && (sin.json?.error as { versionAviso: string }).versionAviso === "2.0" && sin.cabeceras.get("set-cookie") === null && con.estado === 200, "R22: con el aviso en 2.0, contraseña mala → 401 uniforme; contraseña correcta → 409 AVISO_DESACTUALIZADO sin cookie; aceptándolo → 200", sin, `mala → ${malaConAviso.estado}; aceptando → ${con.estado}`);
  const setenta2 = "a1".repeat(36);
  const largo = await peticion("POST", "/api/acceso/registrar", { cuerpo: { nombre: "Persona Larga", correo: `larga.${Date.now()}@example.org`, contrasena: `${setenta2}b`, telefono: "5512345678", aceptaAviso: true, versionAviso: "2.0" } });
  const justo = await peticion("POST", "/api/acceso/registrar", { cuerpo: { nombre: "Persona Justa", correo: `justa.${Date.now()}@example.org`, contrasena: setenta2, telefono: "5512345678", aceptaAviso: true, versionAviso: "2.0" } });
  ver(largo.estado === 422 && /72 bytes/.test((largo.json?.error as { campos: { contrasena: string } }).campos.contrasena) && justo.estado === 201, "contraseña de 73 bytes: 422 «no puede pasar de 72 bytes» bajo el campo; de exactamente 72 bytes: 201", largo, `72 bytes exactos → HTTP ${justo.estado}`);

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

/** Segundo servidor SIN RUPE_PERMITIR_REINICIO=1: las herramientas de desarrollo no existen (404 idéntico), ni siquiera para el Administrador. */
async function herramientasSinPermiso(base2: string) {
  console.log("\n— Sin RUPE_PERMITIR_REINICIO (segundo servidor) —");
  const origen = new URL(base2).origin;
  const login = await fetch(`${base2}/api/acceso/iniciar`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origen }, body: JSON.stringify({ correo: credencial("admin").correo, contrasena: credencial("admin").contrasena }) });
  const cookie = login.headers.getSetCookie().find((c) => c.startsWith(`${NOMBRE_COOKIE}=`))?.split(";")[0] ?? "";
  const pedir = async (ruta: string, cuerpo: unknown, conSesion: boolean): Promise<Resp> => {
    const h = new Headers({ "Content-Type": "application/json", Origin: origen });
    if (conSesion) h.set("Cookie", cookie);
    const r = await fetch(`${base2}${ruta}`, { method: "POST", headers: h, body: JSON.stringify(cuerpo) });
    const texto = await r.text();
    return { estado: r.status, cabeceras: r.headers, texto, json: JSON.parse(texto) };
  };
  const [a, b, c, d] = [await pedir("/api/dev/reiniciar", {}, false), await pedir("/api/dev/parametro", { valor: "2.0" }, false), await pedir("/api/dev/reiniciar", {}, true), await pedir("/api/dev/parametro", { valor: "2.0" }, true)];
  ver(login.status === 200 && [a, b, c, d].every((r) => r.estado === 404 && r.texto === a.texto && r.cabeceras.get("cache-control") === "no-store"), "POST /api/dev/reiniciar y POST /api/dev/parametro: 404 con el MISMO cuerpo y no-store, sin sesión y también con sesión de Administrador", b, `(reiniciar sin sesión ${a.estado}, parametro sin sesión ${b.estado}, reiniciar con Administrador ${c.estado}, parametro con Administrador ${d.estado})`);
}

async function main() {
  let servidor: ChildProcess | undefined;
  let servidor2: ChildProcess | undefined;
  const base2 = `http://localhost:${PUERTO_SIN_PERMISO}`;
  if (!baseExterna) {
    if (!process.argv.includes("--sin-build") && spawnSync("npx", ["next", "build"], { stdio: "inherit" }).status !== 0) throw new Error("Falló next build");
    servidor = spawn("npx", ["next", "start", "-p", String(PUERTO)], { stdio: "ignore", detached: true, env: { ...process.env, RUPE_PERMITIR_REINICIO: "1" } });
    servidor2 = spawn("npx", ["next", "start", "-p", String(PUERTO_SIN_PERMISO)], { stdio: "ignore", detached: true, env: { ...process.env, RUPE_PERMITIR_REINICIO: "0" } });
  }
  // Los dos servidores se apagan SIEMPRE (también si algo falla o se interrumpe): sin procesos colgados.
  const apagar = () => {
    for (const s of [servidor, servidor2]) {
      try {
        if (s?.pid) process.kill(-s.pid);
      } catch {
        // ya terminó
      }
    }
  };
  process.on("SIGINT", () => {
    apagar();
    process.exit(130);
  });
  process.on("exit", apagar);
  try {
    if (servidor) await esperarServidor(servidor);
    await pruebas();
    if (servidor2) {
      await esperarServidor(servidor2, base2);
      await herramientasSinPermiso(base2);
    }
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
