// Verifica POR HTTP (next build + next start, sesiones REALES de las cuentas de prueba) la moderación del Administrador (P6a, Etapa 1, sin pantallas):
//  A) el rol vale EN CADA PETICIÓN (se lee del almacén, no de la cookie): al cambiar de rol o deshabilitar, la cookie vieja deja de servir;
//  B) la foto del perro de un caso deshabilitado solo la entrega la vía del Administrador (200 · tutora 403 · sin sesión 401); la pública sigue en 404 idéntico;
//  C) qué ve la persona dueña de su caso deshabilitado (se imprime lo observado);
//  D) al deshabilitar, ficha, estatus, QR y reporte por QR/folio quedan en 404 idéntico (se comparan HUELLAS, nunca tokens); al restaurar todo vuelve a lo de antes, también un caso Localizado;
//  y la bitácora (R24), los avistamientos, las cuentas (R19, R21, CUENTA_DESHABILITADA) y la concurrencia.
// Imprime la respuesta REAL de cada paso. Opciones: --sin-build · --base=URL (servidor con RUPE_PERMITIR_REINICIO=1).
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { CASOS_ORIGEN } from "../src/mocks/casos";
import { ESTADOS_CASO } from "../src/mocks/tipos";
import { credencial, fetchComo, NOMBRE_COOKIE, olvidarSesiones, reiniciarDatos, valorDeSesion, type RolPrueba } from "./sesion-pruebas";

const PUERTO = 3141;
const baseExterna = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1];
const base = baseExterna ?? `http://localhost:${PUERTO}`;
const ORIGEN = new URL(base).origin;
let fallos = 0;
let total = 0;
const ver = (ok: boolean, bien: string, mal: string) => {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? "✓" : "✗"} ${ok ? bien : mal}`);
};
const huellaDe = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 10);

type Datos = { [k: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
type Resp = { estado: number; texto: string; tipo: string; json?: Datos };
async function leer(r: Response): Promise<Resp> {
  const texto = r.headers.get("content-type")?.startsWith("image/") ? `[imagen ${(await r.arrayBuffer()).byteLength} bytes]` : await r.text();
  let json: Resp["json"];
  try {
    json = JSON.parse(texto);
  } catch {
    json = undefined;
  }
  return { estado: r.status, texto, tipo: r.headers.get("content-type") ?? "", json };
}
const como = async (rol: RolPrueba | null, ruta: string, init: RequestInit = {}) => leer(await fetchComo(base, rol, ruta, { redirect: "manual", ...init }));
const conCookie = async (cookie: string | null, ruta: string, init: RequestInit = {}) =>
  leer(await fetch(`${base}${ruta}`, { redirect: "manual", ...init, headers: { ...(init.headers as Record<string, string>), ...(cookie ? { Cookie: `${NOMBRE_COOKIE}=${cookie}` } : {}) } }));
const enviar = (rol: RolPrueba | null, ruta: string, cuerpo: unknown, metodo = "POST", origen: string | null = ORIGEN) =>
  como(rol, ruta, { method: metodo, headers: { "Content-Type": "application/json", ...(origen ? { Origin: origen } : {}) }, body: JSON.stringify(cuerpo) });
const linea = (r: Resp) => `${r.estado} ${r.json ? JSON.stringify(r.json) : `#${huellaDe(r.texto)}`}`;
const codigo = (r: Resp) => r.json?.error?.codigo as string | undefined;

const deshabilitar = (folio: string, motivo: unknown = "Incumple las condiciones de uso.", rol: RolPrueba | null = "admin") => enviar(rol, `/api/admin/registros/${folio}/moderacion`, { accion: "deshabilitar", motivo });
const restaurar = (folio: string, rol: RolPrueba | null = "admin") => enviar(rol, `/api/admin/registros/${folio}/moderacion`, { accion: "restaurar" });
const estatusUsuario = (id: number, accion: string, extra: object = {}, rol: RolPrueba | null = "admin") => enviar(rol, `/api/admin/usuarios/${id}/estatus`, { accion, ...extra });
const rolDe = (id: number, rol: string, extra: object = {}, quien: RolPrueba | null = "admin") => enviar(quien, `/api/admin/usuarios/${id}/rol`, { rol, ...extra }, "PUT");
const bitacora = async (q = "") => (await como("admin", `/api/admin/bitacora${q}`)).json as { items: Datos[]; total: number; totalPaginas: number };

const MAX = "RUPE-K7M4XQ9T"; // Rosa (tutor1), En búsqueda
const COCO = "RUPE-H4TQ7V2M"; // Rosa, En búsqueda
const TOBY = "RUPE-B6R2TZ7C"; // Rosa, Localizado
const SIMBA = "RUPE-F7L3MN6Y"; // Luis, Cerrado por cancelación
const ROCKY = "RUPE-3HN8WD2B"; // Rosa, Cerrado por cierre confirmado
const KIRA = "RUPE-D5W2QK8X"; // Luis, Cerrado por deshabilitación
const INEXISTENTE = "RUPE-ZZZZZZZZ";
const tokenDe = (folio: string) => CASOS_ORIGEN.find((c) => c.folio === folio)?.tokenPublico ?? `MAQUETA${folio.slice(5)}`.padEnd(32, "0");
const canalesPublicos = (folio: string) => ({
  "API ficha por folio": `/api/fichas/${folio}`, "API estatus por folio": `/api/estatus/${folio}`, "API foto pública": `/api/fichas/${folio}/fotografia`,
  "página ficha": `/ficha/${folio}`, "página estatus": `/estatus/${folio}`, "página reportar": `/ficha/${folio}/avistamiento`,
});
const normal = (t: string, folio: string) => t.split(folio).join("FOLIO");
async function huellasPublicas(folio: string) {
  const salida: Record<string, string> = {};
  for (const [n, ruta] of Object.entries(canalesPublicos(folio))) {
    const r = await como(null, ruta);
    // El estatus público lleva la fecha del último cambio (R12): tras restaurar es la de la restauración, así que ahí se compara el ESTADO y no el cuerpo completo.
    const nombre = r.estado === 200 && n.includes("estatus") ? (r.json?.estado ?? ESTADOS_CASO.find((e) => r.texto.includes(e))) : undefined;
    salida[n] = nombre ? `${r.estado}:${nombre}` : `${r.estado}#${huellaDe(normal(r.texto, folio))}`;
  }
  return salida;
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

async function pruebas() {
  const reinicio = await reiniciarDatos(base);
  ver(reinicio === 200, "el servidor permite reiniciar los datos (RUPE_PERMITIR_REINICIO=1)", `no se pudo reiniciar los datos: HTTP ${reinicio}`);
  if (reinicio !== 200) throw new Error("Sin reinicio no hay pruebas confiables");

  console.log("\n— Guardas por rol en cada ruta de Administrador —");
  const rutas: Array<[string, string, unknown?]> = [
    ["GET", "/api/admin/bitacora"], ["GET", `/api/admin/registros/${MAX}/fotografia`], ["POST", `/api/admin/registros/${MAX}/moderacion`, { accion: "restaurar" }],
    ["POST", "/api/admin/avistamientos/101/moderacion", { accion: "restaurar" }], ["POST", "/api/admin/usuarios/5/estatus", { accion: "habilitar" }], ["PUT", "/api/admin/usuarios/5/rol", { rol: "Tutor" }],
  ];
  for (const [m, ruta, cuerpo] of rutas) {
    const llamar = (rol: RolPrueba | null) => (m === "GET" ? como(rol, ruta) : enviar(rol, ruta, cuerpo, m));
    const [s, t, a] = [await llamar(null), await llamar("tutor1"), await llamar("admin")];
    ver(s.estado === 401 && t.estado === 403 && a.estado !== 401 && a.estado !== 403, `${m} ${ruta.replace(MAX, "‹folio›")}: sin sesión 401 · Tutor 403 · Administrador ${a.estado}`, `${m} ${ruta}: ${s.estado}/${t.estado}/${a.estado}`);
  }
  const sinOrigen = await enviar("admin", `/api/admin/registros/${MAX}/moderacion`, { accion: "restaurar" }, "POST", null);
  const otroOrigen = await enviar("admin", `/api/admin/registros/${MAX}/moderacion`, { accion: "restaurar" }, "POST", "https://otro.example");
  ver(otroOrigen.estado === 403 && sinOrigen.estado !== 403, `mutación con Origin ajeno: ${otroOrigen.estado}; sin cabecera Origin pasa (como en el resto de las rutas: ${sinOrigen.estado})`, `Origen: ${sinOrigen.estado}/${otroOrigen.estado}`);

  console.log("\n— D) Visibilidad pública al deshabilitar y restaurar (MAX en búsqueda y TOBY localizado) —");
  const inexistente = await huellasPublicas(INEXISTENTE);
  for (const folio of [MAX, TOBY]) {
    const antes = await huellasPublicas(folio);
    const tokenAntes = await como(null, `/api/fichas/qr/${tokenDe(folio)}`);
    const d = await deshabilitar(folio);
    console.log(`  deshabilitar ${folio}: ${linea(d)}`);
    ver(d.estado === 200 && d.json?.estado === "Cerrado", `${folio}: deshabilitado (Cerrado)`, `${folio}: ${linea(d)}`);
    const durante = await huellasPublicas(folio);
    const igual = Object.keys(durante).filter((k) => durante[k] !== inexistente[k]);
    ver(igual.length === 0, `${folio} deshabilitado: ${Object.keys(durante).length} canales públicos idénticos (huella) a un folio inexistente`, `${folio}: difieren de un folio inexistente: ${igual.join(", ")}`);
    const qr = await como(null, `/api/fichas/qr/${tokenDe(folio)}`);
    const qrMalo = await como(null, `/api/fichas/qr/${"X".repeat(32)}`);
    ver(qr.estado === 404 && codigo(qr) === "QR_NO_VIGENTE" && qr.texto === qrMalo.texto, `${folio}: el QR responde QR_NO_VIGENTE idéntico a un token inventado (#${huellaDe(qr.texto)})`, `${folio}: QR ${linea(qr)}`);
    const pagQr = await como(null, `/ficha/${tokenDe(folio)}`);
    ver(pagQr.estado === 404, `${folio}: la página por QR da ${pagQr.estado}`, `${folio}: página QR ${pagQr.estado}`);
    const r = await restaurar(folio);
    console.log(`  restaurar ${folio}: ${linea(r)}`);
    ver(r.estado === 200, `${folio}: restaurado a «${r.json?.estado}»`, `${folio}: ${linea(r)}`);
    const despues = await huellasPublicas(folio);
    const distintos = Object.keys(antes).filter((k) => antes[k] !== despues[k]);
    const qrDespues = await como(null, `/api/fichas/qr/${tokenDe(folio)}`);
    ver(distintos.length === 0 && qrDespues.estado === tokenAntes.estado, `${folio}: tras restaurar, los ${Object.keys(antes).length} canales vuelven a lo de antes (el QR, ${qrDespues.estado}, con el mismo token)`, `${folio}: cambiaron ${distintos.join(", ")} · QR ${tokenAntes.estado}→${qrDespues.estado}`);
  }
  const rest = await como("admin", `/api/admin/registros/${TOBY}/moderacion`, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGEN }, body: JSON.stringify({ accion: "restaurar" }) });
  ver(rest.estado === 409, `restaurar un caso ya restaurado: 409 (${codigo(rest)})`, `restaurar repetido: ${linea(rest)}`);

  console.log("\n— Reglas de la matriz R12 por HTTP —");
  const sinMotivo = await deshabilitar(COCO, "  ");
  const largo = await deshabilitar(COCO, "x".repeat(301));
  ver(sinMotivo.estado === 422 && largo.estado === 422, `motivo vacío ${sinMotivo.estado} (${codigo(sinMotivo)}) y de 301 caracteres ${largo.estado} (${codigo(largo)})`, `motivo: ${sinMotivo.estado}/${largo.estado}`);
  const [c1, c2, c3] = [await deshabilitar(ROCKY), await restaurar(SIMBA), await restaurar(ROCKY)];
  ver(c1.estado === 409 && c2.estado === 409 && c3.estado === 409, `Cerrado no se deshabilita (409); cancelado y cierre confirmado no se restauran (409, 409)`, `matriz: ${c1.estado}/${c2.estado}/${c3.estado}`);
  const folioMalo = await deshabilitar("no-es-folio");
  const folioNo = await deshabilitar(INEXISTENTE);
  ver(folioMalo.estado === 404 && folioNo.estado === 404 && folioMalo.texto === folioNo.texto, "folio mal formado e inexistente: el mismo 404", `404: ${folioMalo.estado}/${folioNo.estado}`);
  const saneado = await deshabilitar(COCO, "<b>Texto</b> con etiquetas");
  const ent = (await bitacora()).items[0];
  ver(saneado.estado === 200 && !/[<>]/.test(ent.motivo ?? ""), `el motivo se sanea antes de guardarse: «${ent.motivo}»`, `motivo sin sanear: ${ent.motivo}`);
  await restaurar(COCO);

  console.log("\n— B) Foto del perro de un caso deshabilitado —");
  await deshabilitar(MAX);
  const [fa, ft, fs, fp, fpInexistente] = [await como("admin", `/api/admin/registros/${MAX}/fotografia`), await como("tutor1", `/api/admin/registros/${MAX}/fotografia`), await como(null, `/api/admin/registros/${MAX}/fotografia`), await como(null, `/api/fichas/${MAX}/fotografia`), await como(null, `/api/fichas/${INEXISTENTE}/fotografia`)];
  const cab = (await fetchComo(base, "admin", `/api/admin/registros/${MAX}/fotografia`)).headers;
  console.log(`  Administrador ${fa.estado} ${fa.tipo} ${fa.texto} · cache-control «${cab.get("cache-control")}» · nosniff «${cab.get("x-content-type-options")}»`);
  ver(fa.estado === 200 && fa.tipo === "image/jpeg" && /no-store/.test(cab.get("cache-control") ?? "") && cab.get("x-content-type-options") === "nosniff", "el Administrador recibe la foto (200, image/jpeg, no-store, nosniff)", `foto admin: ${fa.estado} ${fa.tipo}`);
  ver(ft.estado === 403 && fs.estado === 401, `la tutora recibe ${ft.estado} y sin sesión ${fs.estado}`, `foto: ${ft.estado}/${fs.estado}`);
  ver(fp.estado === 404 && normal(fp.texto, MAX) === normal(fpInexistente.texto, INEXISTENTE), "la ruta pública de la foto sigue en 404, idéntica a la de un folio inexistente", `foto pública: ${fp.estado}`);
  const detalle = await como("admin", `/admin/registros/${MAX}`);
  console.log(`  (la pantalla /admin/registros/‹folio› sigue siendo la del maquetado en esta etapa: ${detalle.estado})`);

  console.log("\n— C) Lo que ve la persona dueña de su caso deshabilitado —");
  const lista = await como("tutor1", "/tutor/registros");
  const detalleT = await como("tutor1", `/tutor/casos/${MAX}`);
  const fichaT = await como("tutor1", `/api/casos/${MAX}/ficha?hoja=carta`);
  const ajena = await como("tutor2", `/tutor/casos/${MAX}`);
  console.log(`  lista /tutor/registros ${lista.estado} (aparece el folio: ${lista.texto.includes(MAX)}) · detalle ${detalleT.estado} (dice «Cerrado»: ${/Cerrado/.test(detalleT.texto)}, muestra la deshabilitación: ${/[Dd]eshabilit/.test(detalleT.texto)}) · PDF de la ficha ${fichaT.estado} ${codigo(fichaT) ?? ""} · otra tutora ${ajena.estado}`);
  ver(detalleT.estado === 200 && /Cerrado/.test(detalleT.texto) && fichaT.estado !== 200 && ajena.estado === 404, "la dueña ve su caso como Cerrado y no puede generar la ficha; otra persona recibe 404", "lo que ve la dueña no es lo esperado");
  const tr = await restaurar(MAX);
  ver(tr.estado === 200, "MAX restaurado para seguir", linea(tr));

  console.log("\n— A) El rol vale en cada petición y la cookie vieja deja de servir —");
  const cookieAntes = await valorDeSesion(base, "tutor2");
  ver((await conCookie(cookieAntes, "/api/admin/bitacora")).estado === 403, "tutor2 (Tutor) con su cookie: 403 en una ruta de Administrador", "tutor2 debería recibir 403");
  const ascenso = await rolDe(5, "Administrador");
  console.log(`  Admin → Luis a Administrador: ${linea(ascenso)}`);
  ver(ascenso.estado === 200 && ascenso.json?.rol === "Administrador", "el Administrador asciende a tutor2", linea(ascenso));
  const vieja = await conCookie(cookieAntes, "/api/admin/bitacora");
  ver(vieja.estado === 401, `la cookie anterior de tutor2 ya no sirve (${vieja.estado}): sus sesiones se cerraron al cambiar el rol`, `cookie anterior: ${vieja.estado}`);
  olvidarSesiones();
  const nuevaAdmin = await conCookie(await valorDeSesion(base, "tutor2"), "/api/admin/bitacora");
  ver(nuevaAdmin.estado === 200, "al iniciar sesión de nuevo, tutor2 ya entra como Administrador (200)", `nueva sesión: ${nuevaAdmin.estado}`);
  const cookieAdmin2 = await valorDeSesion(base, "tutor2");
  const degradar = await rolDe(5, "Tutor");
  const tras = await conCookie(cookieAdmin2, "/api/admin/bitacora");
  ver(degradar.estado === 200 && tras.estado === 401, `degradarlo cierra su sesión y la cookie vigente deja de servir de inmediato (${tras.estado})`, `degradar: ${degradar.estado} · cookie: ${tras.estado}`);
  olvidarSesiones();
  ver((await conCookie(await valorDeSesion(base, "tutor2"), "/api/admin/bitacora")).estado === 403, "y al entrar otra vez como Tutor recibe 403 en rutas de Administrador", "tras degradar debería recibir 403");

  console.log("\n— Cuentas: R19, R21 y CUENTA_DESHABILITADA —");
  const cookieLuis = await valorDeSesion(base, "tutor2");
  const des = await estatusUsuario(5, "deshabilitar");
  console.log(`  deshabilitar a Luis: ${linea(des)}`);
  ver(des.estado === 200 && des.json?.activo === false && des.json?.sesionesCerradas >= 1, `deshabilitar cierra sus sesiones (${des.json?.sesionesCerradas})`, linea(des));
  ver((await conCookie(cookieLuis, "/tutor")).estado !== 200 && (await conCookie(cookieLuis, "/api/admin/bitacora")).estado === 401, "su cookie deja de valer en cualquier ruta protegida", "la cookie de Luis aún sirve");
  const { correo, contrasena } = credencial("tutor2");
  const ingreso = (clave: string) => fetch(`${base}/api/acceso/iniciar`, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGEN }, body: JSON.stringify({ correo, contrasena: clave }), redirect: "manual" }).then(leer);
  const bien = await ingreso(contrasena);
  const mal = await ingreso(randomBytes(12).toString("hex"));
  const noExiste = await fetch(`${base}/api/acceso/iniciar`, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGEN }, body: JSON.stringify({ correo: "nadie@ejemplo.invalid", contrasena: randomBytes(12).toString("hex") }), redirect: "manual" }).then(leer);
  console.log(`  contraseña correcta: ${linea(bien)} · incorrecta: ${linea(mal)}`);
  ver(bien.estado === 403 && codigo(bien) === "CUENTA_DESHABILITADA", "con la contraseña correcta, la cuenta deshabilitada recibe 403 CUENTA_DESHABILITADA", `correcta: ${linea(bien)}`);
  ver(mal.estado === 401 && mal.texto === noExiste.texto, "con la contraseña incorrecta, el 401 uniforme (igual al de un correo inexistente): no revela que está deshabilitada", `incorrecta: ${linea(mal)}`);
  const hab = await estatusUsuario(5, "habilitar");
  olvidarSesiones();
  const vuelve = await ingreso(contrasena);
  ver(hab.estado === 200 && vuelve.estado === 200, `al habilitarla, vuelve a entrar (${vuelve.estado})`, `habilitar: ${hab.estado} · entrar: ${vuelve.estado}`);
  const ultimo = await estatusUsuario(1, "deshabilitar", { confirmarSesionPropia: true });
  const ultimoRol = await rolDe(1, "Tutor", { confirmarSesionPropia: true });
  console.log(`  último administrador: ${linea(ultimo)}`);
  ver(ultimo.estado === 409 && codigo(ultimo) === "ULTIMO_ADMINISTRADOR" && ultimoRol.estado === 409, "el último administrador activo no se deshabilita ni se degrada (409 ULTIMO_ADMINISTRADOR)", `último admin: ${ultimo.estado}/${ultimoRol.estado}`);
  const [e1, e2, e3] = [await estatusUsuario(5, "habilitar"), await estatusUsuario(5, "ninguna"), await rolDe(5, "Superusuario")];
  ver(e1.estado === 409 && e2.estado === 400 && e3.estado === 422, `habilitar a quien ya está activa 409; acción desconocida ${e2.estado}; rol inválido ${e3.estado}`, `${e1.estado}/${e2.estado}/${e3.estado}`);

  console.log("\n— Avistamientos —");
  const o1 = await enviar("admin", "/api/admin/avistamientos/101/moderacion", { accion: "ocultar" });
  const o2 = await enviar("admin", "/api/admin/avistamientos/101/moderacion", { accion: "ocultar", motivo: "Contiene datos personales." });
  const o3 = await enviar("admin", "/api/admin/avistamientos/101/moderacion", { accion: "ocultar", motivo: "Contiene datos personales." });
  console.log(`  ocultar sin motivo ${linea(o1)} · con motivo ${linea(o2)} · repetido ${linea(o3)}`);
  ver(o1.estado === 422 && o2.estado === 200 && o3.estado === 409, "ocultar: sin motivo 422 · con motivo 200 · repetido 409", `${o1.estado}/${o2.estado}/${o3.estado}`);
  const r1 = await enviar("admin", "/api/admin/avistamientos/101/moderacion", { accion: "restaurar" });
  const r2 = await enviar("admin", "/api/admin/avistamientos/101/moderacion", { accion: "restaurar" });
  const r3 = await enviar("admin", "/api/admin/avistamientos/99999/moderacion", { accion: "restaurar" });
  ver(r1.estado === 200 && r2.estado === 409 && r3.estado === 404, "restaurar: 200 · repetido 409 · inexistente 404", `${r1.estado}/${r2.estado}/${r3.estado}`);

  console.log("\n— Bitácora (R24, R15) —");
  const b = await bitacora();
  const tipos = new Set(b.items.map((i) => i.tipo));
  console.log(`  total ${b.total} · páginas ${b.totalPaginas} · primeras: ${b.items.slice(0, 3).map((i) => `${i.tipo}/${i.entidadAfectada}`).join(" | ")}`);
  ver(b.total > 30 && b.items.length === 8 && ["restaurar avistamiento", "ocultar avistamiento"].every((t) => tipos.has(t)), `la bitácora creció desde las 30 sembradas (${b.total}) y se pagina de 8 en 8`, "la bitácora no registró las acciones");
  const caso = (await bitacora("?tipo=deshabilitar%20caso")).items[0];
  ver(String(caso.entidadAfectada).includes("RUPE-") && !/^\d+$/.test(String(caso.entidadAfectada)), `la entidad se muestra por folio («${caso.entidadAfectada}») aunque se guarda el id`, `entidad: ${caso.entidadAfectada}`);
  const malFiltro = await como("admin", "/api/admin/bitacora?tipo=inventado&desde=2026-13-45");
  ver(malFiltro.estado === 200 && malFiltro.json?.errores?.tipo && malFiltro.json?.errores?.desde, "un filtro inválido se informa y no se aplica", linea(malFiltro));
  const denegado = await como("admin", "/api/admin/bitacora", { method: "DELETE", headers: { Origin: ORIGEN } });
  ver(denegado.estado === 405, `la bitácora no admite borrar (DELETE ${denegado.estado}): solo insertar y consultar`, `DELETE: ${denegado.estado}`);
  const llaves = JSON.stringify(b);
  ver(!/telefono|contrasena|token|vistoPorTutora|relevante/i.test(llaves), "la respuesta de la bitácora no lleva teléfono, contraseña, token ni marcas internas", "la bitácora filtra datos internos");

  console.log("\n— Concurrencia —");
  const antesC = (await bitacora("?tipo=deshabilitar%20caso")).total;
  const rondas = await Promise.all(Array.from({ length: 25 }, () => deshabilitar(COCO)));
  const ok = rondas.filter((x) => x.estado === 200).length;
  const c409 = rondas.filter((x) => x.estado === 409).length;
  const entradas = (await bitacora("?tipo=deshabilitar%20caso")).total - antesC;
  ver(ok === 1 && c409 === 24 && entradas === 1, `25 deshabilitaciones simultáneas: ${ok} × 200, ${c409} × 409 y UNA entrada de bitácora`, `${ok} ok · ${c409} 409 · ${entradas} entradas`);
  await restaurar(COCO);
  const mixto = await Promise.all([...Array.from({ length: 10 }, () => deshabilitar(KIRA)), ...Array.from({ length: 10 }, () => restaurar(KIRA))]);
  ver(mixto.every((x) => x.estado === 200 || x.estado === 409), `10 deshabilitar + 10 restaurar a la vez sobre un caso ya deshabilitado: solo 200 o 409 (${mixto.filter((x) => x.estado === 200).length} × 200)`, "respuestas inesperadas en carrera");
}

async function main() {
  let servidor: ChildProcess | undefined;
  if (!baseExterna) {
    if (!process.argv.includes("--sin-build") && spawnSync("npx", ["next", "build"], { stdio: "ignore" }).status !== 0) throw new Error("Falló next build");
    const env: NodeJS.ProcessEnv = { ...process.env, RUPE_PERMITIR_REINICIO: "1" };
    delete env.RUPE_URL_PUBLICA;
    servidor = spawn("npx", ["next", "start", "-p", String(PUERTO)], { stdio: "ignore", detached: true, env });
  }
  const apagar = () => {
    try {
      if (servidor?.pid) process.kill(-servidor.pid);
    } catch {
      // ya terminó
    }
  };
  process.on("exit", apagar);
  try {
    if (servidor) await esperarServidor(servidor);
    await pruebas();
  } finally {
    apagar();
  }
  console.log(fallos === 0 ? `\nOK: ${total} comprobaciones de la moderación del Administrador por HTTP` : `\n${fallos} de ${total} verificación(es) fallida(s)`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
