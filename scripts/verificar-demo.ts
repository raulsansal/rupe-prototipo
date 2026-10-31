// Comprobación PREVIA a la demostración: ¿el sistema está listo? Solo lectura y operaciones inofensivas (no crea casos, cuentas ni avistamientos; no sube fotos).
//   npm run verificar-demo -- https://<direccion-publica>                         modo PÚBLICO: peticiones a la dirección real (cabecera X-Tunnel-Skip-AntiPhishing-Page para el aviso del túnel)
//   npm run verificar-demo -- https://<direccion-publica> --local=http://localhost:3000   modo LOCAL: el servidor local recibe Host localhost y Origin público, SIN x-forwarded-* (el peor caso de un túnel)
// Con la dirección omitida se usa RUPE_URL_PUBLICA. Inicia sesión como Administrador UNA vez (y la cierra) para no acercarse al bloqueo de la cuenta. Nunca imprime cookies ni credenciales.
import http from "node:http";
import https from "node:https";
import { cargarEnvLocal, credencial } from "./sesion-pruebas";

type Resp = { estado: number; cabeceras: http.IncomingHttpHeaders; texto: string };
// Variables: entorno Y .env.local (el entorno gana; cargarEnvLocal no imprime nada). La dirección pública: argumento > RUPE_URL_PUBLICA (entorno o .env.local).
cargarEnvLocal();
const argumentos = process.argv.slice(2);
const local = argumentos.find((a) => a.startsWith("--local="))?.slice(8);
const publica = (argumentos.find((a) => /^https?:\/\//.test(a)) ?? process.env.RUPE_URL_PUBLICA ?? "").replace(/\/+$/, "");
if (!/^https:\/\/[^/]+$/.test(publica)) { console.error("Indica la dirección pública https (sin ruta) como argumento o en RUPE_URL_PUBLICA."); process.exit(1); }
const destino = new URL(local ?? publica);
const modo = local ? "local" : "público";

function pedir(ruta: string, { metodo = "GET", cabeceras = {}, cuerpo }: { metodo?: string; cabeceras?: Record<string, string>; cuerpo?: string } = {}): Promise<Resp> {
  const h: Record<string, string> = { "X-Tunnel-Skip-AntiPhishing-Page": "true", ...cabeceras };
  if (cuerpo !== undefined) { h["content-type"] = "application/json"; h["content-length"] = String(Buffer.byteLength(cuerpo)); }
  const lib = destino.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const r = lib.request({ hostname: destino.hostname, port: destino.port || undefined, path: ruta, method: metodo, headers: h, timeout: 20000 }, (res) => {
      const trozos: Buffer[] = [];
      res.on("data", (t) => trozos.push(t));
      res.on("end", () => resolve({ estado: res.statusCode ?? 0, cabeceras: res.headers, texto: Buffer.concat(trozos).toString("utf8") }));
    });
    r.on("timeout", () => r.destroy(new Error("tiempo de espera agotado")));
    r.on("error", reject);
    if (cuerpo !== undefined) r.write(cuerpo);
    r.end();
  });
}
/** En modo local simula lo que ve el servidor detrás de un túnel que no reenvía el host original: Host localhost (el de verdad) y Origin público. */
const origen = publica;
const post = (ruta: string, cuerpo = "{}", extra: Record<string, string> = {}) => pedir(ruta, { metodo: "POST", cabeceras: { Origin: origen, ...extra }, cuerpo });

let total = 0;
let rojos = 0;
let advertencias = 0;
const secciones: Array<[string, number, number]> = [];
let seccion = "";
let enSeccion = 0;
let rojosSeccion = 0;
const ver = (ok: boolean, texto: string, detalle = "") => {
  total++; enSeccion++;
  if (!ok) { rojos++; rojosSeccion++; }
  console.log(`  ${ok ? "✓" : "✗"} ${texto}${ok || !detalle ? "" : ` → ${detalle}`}`);
};
const advertir = (ok: boolean, texto: string, detalle: string) => {
  total++; enSeccion++;
  if (!ok) advertencias++;
  console.log(`  ${ok ? "✓" : "⚠"} ${texto}${ok ? "" : ` → ${detalle}`}`);
};
async function en(nombre: string, f: () => Promise<void>) {
  seccion = nombre; enSeccion = 0; rojosSeccion = 0;
  console.log(`\n— ${nombre} —`);
  try { await f(); } catch (e) { ver(false, `${nombre}: la sección no pudo completarse`, (e as Error).message); }
  secciones.push([seccion, enSeccion, rojosSeccion]);
}
const atributos = (r: Resp) => (r.cabeceras["set-cookie"] ?? []).find((c) => c.startsWith("rupe_sesion="))?.split(";").slice(1).map((x) => x.trim().toLowerCase()) ?? [];
const FOLIO = "RUPE-K7M4XQ9T";

async function main() {
  console.log(`Modo ${modo}: ${local ? `servidor ${destino.origin}, Host localhost, Origin ${publica}` : publica}`);
  const humo = await pedir("/api/salud").catch((e: Error) => e);
  if (humo instanceof Error) { console.log(`✗ No se pudo conectar: ${humo.message}`); process.exit(1); }
  let esRupe = false;
  try { esRupe = (JSON.parse(humo.texto) as { estado?: string }).estado === "ok"; } catch { esRupe = false; }
  if (!esRupe) {
    console.log(`\n⚠ aviso del túnel detectado: ábrelo en un navegador (la respuesta no es de RUPE: HTTP ${humo.estado}, ${humo.cabeceras["content-type"] ?? "sin tipo"}). Acepta el aviso una vez y vuelve a ejecutar.`);
    process.exit(2);
  }

  await en("Salud e inicio", async () => {
    const salud = JSON.parse(humo.texto) as { estado: string; entorno: string; datos: { casos: number } };
    ver(humo.estado === 200 && salud.estado === "ok" && salud.entorno === "production", "GET /api/salud: 200, estado ok, entorno production", `${humo.estado} ${humo.texto.slice(0, 80)}`);
    const inicio = await pedir("/");
    ver(inicio.estado === 200 && /text\/html/.test(String(inicio.cabeceras["content-type"])), "GET /: 200 HTML", String(inicio.estado));
    const acceso = await pedir("/acceso");
    ver(acceso.estado === 200, "GET /acceso: 200", String(acceso.estado));
    ver(!/localhost/i.test(inicio.texto + acceso.texto), "ni / ni /acceso contienen «localhost»", "aparece «localhost» en el HTML");
  });

  let cookieAdmin: string | undefined;
  await en("Inicio de sesión del Administrador (una sola vez)", async () => {
    const c = credencial("admin");
    const r = await post("/api/acceso/iniciar", JSON.stringify({ correo: c.correo, contrasena: c.contrasena }));
    ver(r.estado === 200, "POST /api/acceso/iniciar con Origin público: 200", `${r.estado} ${r.texto.slice(0, 100)}`);
    const sc = (r.cabeceras["set-cookie"] ?? []).find((x) => x.startsWith("rupe_sesion="));
    cookieAdmin = sc?.split(";")[0];
    const a = atributos(r);
    ver(a.includes("httponly") && a.includes("samesite=lax") && a.includes("path=/"), "la cookie de sesión lleva HttpOnly, SameSite=Lax y Path=/", a.join("; "));
    advertir(a.includes("secure"), "la cookie de sesión lleva Secure (la dirección es https)", `sin Secure: el servidor no detecta https; revisa x-forwarded-proto del túnel. Atributos: ${a.join("; ")}`);
    if (cookieAdmin) {
      const panel = await pedir("/admin", { cabeceras: { Cookie: cookieAdmin } });
      ver(panel.estado === 200, "con la sesión, GET /admin: 200", String(panel.estado));
    }
  });

  await en("Ficha pública de ejemplo", async () => {
    const api = await pedir(`/api/fichas/${FOLIO}`);
    ver(api.estado === 200 && !/tokenPublico|telefono|correo/i.test(api.texto), `GET /api/fichas/${FOLIO}: 200 sin datos de la persona tutora ni token`, `${api.estado}`);
    const pag = await pedir(`/ficha/${FOLIO}`);
    ver(pag.estado === 200 && pag.texto.includes(FOLIO) && !/localhost/i.test(pag.texto), `GET /ficha/${FOLIO}: 200, muestra el folio y no contiene «localhost»`, `${pag.estado}`);
    const rep = await pedir(`/ficha/${FOLIO}/avistamiento`);
    ver(rep.estado === 200, "GET del formulario de reporte de avistamiento: 200", String(rep.estado));
  });

  await en("Defensa de origen", async () => {
    const bueno = await post("/api/acceso/cerrar");
    ver(bueno.estado < 400, "POST inofensivo (cerrar sesión sin sesión) con Origin público: aceptado", `${bueno.estado} ${bueno.texto.slice(0, 100)}`);
    const malo = await post("/api/acceso/cerrar", "{}", { Origin: "https://sitio-ajeno.example" });
    ver(malo.estado === 403 && /ORIGEN_NO_PERMITIDO/.test(malo.texto), "el mismo POST con Origin ajeno: 403 ORIGEN_NO_PERMITIDO", `${malo.estado}`);
  });

  await en("Rutas protegidas y herramientas de desarrollo", async () => {
    const r = await pedir("/tutor?x=1");
    const loc = String(r.cabeceras.location ?? "");
    ver(r.estado === 307 && loc.startsWith("/acceso?siguiente="), "GET /tutor sin sesión: 307 con Location RELATIVO a /acceso?siguiente=", `${r.estado} ${loc}`);
    ver(!/localhost/i.test(loc), "ese Location no contiene «localhost»", loc);
    const dev = await post("/api/dev/reiniciar");
    ver(dev.estado === 404, "POST /api/dev/reiniciar: 404 (la demostración no puede reiniciar datos)", `${dev.estado}`);
  });

  if (cookieAdmin) {
    await en("Cierre de la sesión de pruebas", async () => {
      const r = await post("/api/acceso/cerrar", "{}", { Cookie: cookieAdmin! });
      ver(r.estado < 400, "POST /api/acceso/cerrar con la sesión del Administrador", String(r.estado));
      const panel = await pedir("/admin", { cabeceras: { Cookie: cookieAdmin! } });
      ver(panel.estado === 307, "tras cerrar, GET /admin vuelve a pedir acceso (307)", String(panel.estado));
    });
  }

  const suma = secciones.reduce((s, x) => s + x[1], 0);
  console.log("\nComprobaciones por sección:");
  for (const [n, c, r] of secciones) console.log(`  ${n}: ${c}${r ? ` (${r} en rojo)` : ""}`);
  console.log(`  Suma: ${suma} ${suma === total ? "= total" : `≠ total (${total})`}`);
  console.log(`\n${rojos === 0 ? "✓ VERDE" : "✗ ROJO"}: ${total - rojos - advertencias}/${total} correctas, ${advertencias} advertencia(s), ${rojos} en rojo (modo ${modo}).`);
  if (suma !== total) rojos++;
  process.exit(rojos ? 1 : 0);
}
main().catch((e) => { console.error(`✗ ${(e as Error).message}`); process.exit(1); });
