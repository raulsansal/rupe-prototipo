// Verifica POR HTTP (next build + next start, sesión REAL de las cuentas de prueba) el seguimiento de la persona tutora y la consulta pública de estatus (P5, HU 038, 040, 042, 043, 017):
//  · localizar, cerrar, reactivar y cancelar con la matriz R12, el 409 ante repeticiones y peticiones simultáneas (un solo movimiento), el motivo saneado y las guardas (R32);
//  · el QR (mismo token) antes y después, R13/R33 y la consulta pública de estatus con los 404 idénticos (se comparan HUELLAS de los cuerpos; nunca se imprimen tokens);
//  · «avistamiento revisado» al abrir un avistamiento nuevo (idempotente) y la marca «relevante».
//  · la parte de INTERFAZ (navegador real): un GET del detalle NO marca el avistamiento como visto (ni con las cabeceras de prefetch); al abrirlo se marca solo UNA vez; la campana, la insignia «Nuevo»,
//    «Relevante», los modales con doble clic, el 409 que refresca con el estado real y «Compartir estatus».
// Imprime la respuesta REAL de cada paso. Opciones: --sin-build · --base=URL (servidor con RUPE_PERMITIR_REINICIO=1).
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { CASOS_ORIGEN } from "../src/mocks/casos";
import { JPEG_REAL } from "../src/server/pruebas/imagenes";
import { chromium, type Browser, type Page } from "playwright";
import { agregarSesion, fetchComo, reiniciarDatos, type RolPrueba } from "./sesion-pruebas";

const PUERTO = 3139;
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

type Resp = { estado: number; texto: string; json?: Record<string, unknown> & { error?: { codigo?: string; mensaje?: string } } };
async function leer(r: Response): Promise<Resp> {
  const texto = await r.text();
  let json: Resp["json"];
  try {
    json = JSON.parse(texto);
  } catch {
    json = undefined;
  }
  return { estado: r.status, texto, json };
}
const como = async (rol: RolPrueba | null, ruta: string, init: RequestInit = {}) => leer(await fetchComo(base, rol, ruta, { redirect: "manual", ...init }));
const publico = (ruta: string, init: RequestInit = {}) => como(null, ruta, init);
const post = (rol: RolPrueba | null, ruta: string, cuerpo: unknown, origen: string | null = ORIGEN) =>
  como(rol, ruta, { method: "POST", headers: { "Content-Type": "application/json", ...(origen ? { Origin: origen } : {}) }, body: JSON.stringify(cuerpo) });
const estado = (rol: RolPrueba | null, folio: string, accion: string, motivo?: unknown, origen: string | null = ORIGEN) => post(rol, `/api/casos/${folio}/estado`, { accion, ...(motivo !== undefined ? { motivo } : {}) }, origen);
const linea = (r: Resp) => `${r.estado} ${r.json ? JSON.stringify(r.json) : `#${huellaDe(r.texto)}`}`;
const normalizar = (t: string, ...claves: string[]) => claves.reduce((x, c) => x.split(c).join("CLAVE"), t);
const sinComentarios = (html: string) => html.replace(/<!-- -->/g, "");

const tokenSembrado = (folio: string) => CASOS_ORIGEN.find((c) => c.folio === folio)?.tokenPublico ?? `MAQUETA${folio.slice(5)}`.padEnd(32, "0");
const NOMBRE_ETIQUETA = { localizado: "Marcado como localizado", revisado: "Avistamiento revisado", reactivado: "Caso reactivado", cierre: "Cierre confirmado", cancelado: "Registro cancelado" };
/** Cuántas veces aparece una etiqueta del historial en el detalle del caso (HTML real de la persona dueña). */
async function contarEnHistorial(rol: RolPrueba, folio: string, etiqueta: string) {
  const html = sinComentarios((await como(rol, `/tutor/casos/${folio}`)).texto);
  return html.split(etiqueta).length - 1;
}
async function reportar(folio: string, canal: "folio" | "qr" = "folio") {
  const f = new FormData();
  const hoy = new Date(Date.now() - 6 * 3600_000 - 86_400_000).toISOString().slice(0, 10);
  f.set("datos", JSON.stringify({ acceso: canal === "folio" ? { canal, folio } : { canal, token: tokenSembrado(folio) }, fecha: hoy, hora: "10:00", direccion: "Calle de prueba 1", idAlcaldia: 6, estadosAnimal: [1, 7], comentario: "Se ve bien" }));
  f.set("fotografia", new Blob([Uint8Array.from(JPEG_REAL) as BlobPart], { type: "image/jpeg" }), "foto.jpg");
  return publico("/api/avistamientos", { method: "POST", body: f, headers: { Origin: ORIGEN } });
}

const MAX = "RUPE-K7M4XQ9T"; // Rosa (tutor1), En búsqueda
const COCO = "RUPE-H4TQ7V2M"; // Rosa, En búsqueda
const LUNA = "RUPE-P3H8WD5N"; // Rosa, Avistamiento reportado, avistamiento nuevo 201
const MIA = "RUPE-J2C6PZ9H"; // Luis (tutor2), En búsqueda
const SIMBA = "RUPE-F7L3MN6Y"; // Luis, Cerrado por cancelación
const KIRA = "RUPE-D5W2QK8X"; // Luis, Cerrado por deshabilitación
const ROCKY = "RUPE-3HN8WD2B"; // Rosa, Cerrado por cierre confirmado
const BRUNO = "RUPE-N8D5GX3W"; // Rosa, Avistamiento reportado, avistamiento nuevo 302

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
  await reiniciarDatos(base);
  console.log("— Max (En búsqueda, de Rosa): localizar, repetir, reporte, estatus, reactivar, reporte, localizar, cerrar —");
  const qr0 = await publico(`/api/fichas/qr/${tokenSembrado(MAX)}`);
  const l1 = await estado("tutor1", MAX, "localizar");
  console.log(`  POST /api/casos/${MAX}/estado {accion:"localizar"} → ${linea(l1)}`);
  ver(l1.estado === 200 && l1.json?.estado === "Localizado" && Object.keys(l1.json).sort().join() === "estado,fechaCambio,folio", "localizar: 200 con solo { folio, estado, fechaCambio }, estado «Localizado»", `localizar: ${linea(l1)}`);
  const l2 = await estado("tutor1", MAX, "localizar");
  console.log(`  segundo localizar → ${linea(l2)}`);
  ver(l2.estado === 409 && l2.json?.error?.codigo === "TRANSICION_INVALIDA" && /ya no está en un estado que permita/.test(l2.json?.error?.mensaje ?? ""), "segundo localizar: 409 TRANSICION_INVALIDA con mensaje amable (no duplica)", `segundo localizar: ${linea(l2)}`);
  const rf = await reportar(MAX);
  const rq = await reportar(MAX, "qr");
  console.log(`  reporte por folio → ${rf.estado} ${rf.json?.error?.codigo} · reporte por QR → ${rq.estado} ${rq.json?.error?.codigo}`);
  ver(rf.estado === 409 && rf.json?.error?.codigo === "CASO_NO_ADMITE_AVISTAMIENTOS" && rq.estado === 409, "Localizado: el reporte por folio y por QR dan 409 (R13)", `reporte localizado: ${linea(rf)} / ${linea(rq)}`);
  const e1 = await publico(`/api/estatus/${MAX}`);
  console.log(`  GET /api/estatus/${MAX} → ${linea(e1)}`);
  ver(e1.estado === 200 && (e1.json?.estatus as { estado?: string })?.estado === "Localizado", "estatus público: «Localizado»", `estatus: ${linea(e1)}`);
  const qr1 = await publico(`/api/fichas/qr/${tokenSembrado(MAX)}`);
  const r0 = await estado("tutor1", MAX, "reactivar");
  const r00 = await estado("tutor1", MAX, "reactivar", "<b>   </b>");
  console.log(`  reactivar sin motivo → ${linea(r0)} · con motivo solo etiquetas → ${r00.estado} ${r00.json?.error?.codigo}`);
  ver(r0.estado === 422 && r0.json?.error?.codigo === "MOTIVO_OBLIGATORIO" && r00.estado === 422, "reactivar sin motivo (o solo etiquetas): 422 MOTIVO_OBLIGATORIO", `reactivar sin motivo: ${linea(r0)}`);
  const r1 = await estado("tutor1", MAX, "reactivar", "<b>Fue un error</b><script>alert(1)</script> de la familia");
  console.log(`  reactivar con motivo con etiquetas → ${linea(r1)}`);
  const detalle = sinComentarios((await como("tutor1", `/tutor/casos/${MAX}`)).texto);
  const motivoGuardado = /Motivo: ([^<]*)</.exec(detalle)?.[1];
  console.log(`  motivo guardado, leído en el historial de la dueña: «${motivoGuardado}»`);
  ver(r1.estado === 200 && r1.json?.estado === "En seguimiento" && motivoGuardado === "Fue un erroralert(1) de la familia" && !detalle.includes("&lt;b&gt;") && !detalle.includes("<b>Fue"), "reactivar con motivo con etiquetas: 200, «En seguimiento» y el motivo se guardó SANEADO (sin etiquetas)", `reactivar: ${linea(r1)} · motivo «${motivoGuardado}»`);
  const ra = await reportar(MAX);
  const rb = await reportar(MAX, "qr");
  const e2 = await publico(`/api/estatus/${MAX}`);
  console.log(`  reporte por folio → ${ra.estado} · por QR (mismo token del seed) → ${rb.estado} · estatus → ${JSON.stringify((e2.json?.estatus as { estado?: string })?.estado)}`);
  ver(ra.estado === 201 && rb.estado === 201 && (e2.json?.estatus as { estado?: string })?.estado === "Avistamiento reportado", "tras reactivar el caso vuelve a aceptar avistamientos (201 por folio y por QR con el MISMO token) y queda «Avistamiento reportado»", `reporte tras reactivar: ${ra.estado}/${rb.estado}`);
  const qr2 = await publico(`/api/fichas/qr/${tokenSembrado(MAX)}`);
  console.log(`  ficha por el MISMO token del QR: antes de localizar ${qr0.estado} #${huellaDe(qr0.texto).slice(0, 4)}… · localizado ${qr1.estado} · tras reactivar y reportar ${qr2.estado}`);
  ver(qr0.estado === 200 && qr1.estado === 200 && qr2.estado === 200 && !qr2.texto.includes(tokenSembrado(MAX)), "el QR (mismo token) sigue vigente antes, durante y después: 200 en los tres momentos y la respuesta no repite el token", "el QR cambió o dejó de valer");
  const l3 = await estado("tutor1", MAX, "localizar");
  const c1 = await estado("tutor1", MAX, "cerrar");
  const ra2 = await estado("tutor1", MAX, "reactivar", "Quiero volver a abrirlo");
  const ec = await publico(`/api/estatus/${MAX}`);
  const fc = await publico(`/api/fichas/${MAX}`);
  console.log(`  localizar → ${l3.estado} · cerrar → ${linea(c1)} · reactivar tras cerrar → ${linea(ra2)}`);
  console.log(`  estatus público tras cerrar → ${linea(ec)} · ficha pública → ${fc.estado} ${fc.json?.error?.codigo}`);
  ver(l3.estado === 200 && c1.estado === 200 && c1.json?.estado === "Cerrado" && ra2.estado === 409 && (ec.json?.estatus as { estado?: string })?.estado === "Cerrado" && fc.estado === 404, "localizar → cerrar (200, «Cerrado»); reactivar tras cerrar 409; estatus «Cerrado» (200) y ficha pública 404", "secuencia de cierre incorrecta");

  console.log("\n— Cancelar un caso activo (Coco, de Rosa) —");
  const cs0 = await estado("tutor1", COCO, "cancelar");
  const cs1 = await estado("tutor1", COCO, "cancelar", "Ya apareció, lo registré por error");
  const cs2 = await estado("tutor1", COCO, "cancelar", "otra vez");
  console.log(`  cancelar sin motivo → ${cs0.estado} ${cs0.json?.error?.codigo} · con motivo → ${linea(cs1)} · repetir → ${cs2.estado} ${cs2.json?.error?.codigo}`);
  ver(cs0.estado === 422 && cs1.estado === 200 && cs1.json?.estado === "Cerrado" && cs2.estado === 409, "cancelar: sin motivo 422; con motivo 200 «Cerrado»; repetir 409", "cancelar mal");
  const [fichaCoco, estCoco, inex, qrCoco, mias] = [await publico(`/api/fichas/${COCO}`), await publico(`/api/estatus/${COCO}`), await publico("/api/estatus/RUPE-ZZZZZZZZ"), await publico(`/api/fichas/qr/${tokenSembrado(COCO)}`), await como("tutor1", "/tutor")];
  const detalleCoco = sinComentarios((await como("tutor1", `/tutor/casos/${COCO}`)).texto);
  console.log(`  tras cancelar: ficha ${fichaCoco.estado}, estatus ${estCoco.estado} #${huellaDe(estCoco.texto)} (inexistente ${inex.estado} #${huellaDe(inex.texto)}), QR ${qrCoco.estado} ${qrCoco.json?.error?.codigo}; Mis registros ${mias.estado}; detalle «Registro cancelado»: ${detalleCoco.includes(NOMBRE_ETIQUETA.cancelado)}`);
  ver(fichaCoco.estado === 404 && estCoco.estado === 404 && estCoco.texto === inex.texto && qrCoco.estado === 404 && qrCoco.json?.error?.codigo === "QR_NO_VIGENTE" && mias.estado === 200 && mias.texto.includes(COCO) && detalleCoco.includes(NOMBRE_ETIQUETA.cancelado), "tras cancelar: ficha 404, estatus 404 idéntico al de un folio inexistente, QR no vigente, el caso sigue en Mis registros y su historial dice «Registro cancelado»", "efectos de la cancelación incorrectos");

  console.log("\n— Abrir un avistamiento NUEVO (Luna, avistamiento 201) y «relevante» —");
  const antes = await contarEnHistorial("tutor1", LUNA, NOMBRE_ETIQUETA.revisado);
  const v1 = await post("tutor1", `/api/casos/${LUNA}/avistamientos/201/visto`, {});
  const v2 = await post("tutor1", `/api/casos/${LUNA}/avistamientos/201/visto`, {});
  const despues = await contarEnHistorial("tutor1", LUNA, NOMBRE_ETIQUETA.revisado);
  const eL = await publico(`/api/estatus/${LUNA}`);
  console.log(`  POST …/avistamientos/201/visto → ${linea(v1)}`);
  console.log(`  repetirlo → ${linea(v2)} · «Avistamiento revisado» en el historial: ${antes} → ${despues} · estatus público → ${JSON.stringify((eL.json?.estatus as { estado?: string })?.estado)}`);
  ver(v1.estado === 200 && v1.json?.marcado === true && v1.json?.cambioDeEstado === true && v1.json?.estado === "En seguimiento" && v2.json?.marcado === false && v2.json?.cambioDeEstado === false && despues === antes + 1 && (eL.json?.estatus as { estado?: string })?.estado === "En seguimiento", "abrir el avistamiento nuevo de Luna: el caso pasa a «En seguimiento» con «avistamiento revisado»; repetirlo no duplica (el historial suma UNO)", "abrir avistamiento mal");
  const rel1 = await como("tutor1", `/api/casos/${LUNA}/avistamientos/201/relevante`, { method: "PUT", headers: { "Content-Type": "application/json", Origin: ORIGEN }, body: JSON.stringify({ relevante: true }) });
  const rel2 = await como("tutor1", `/api/casos/${LUNA}/avistamientos/201/relevante`, { method: "PUT", headers: { "Content-Type": "application/json", Origin: ORIGEN }, body: JSON.stringify({ relevante: "sí" }) });
  const publicoTodo = JSON.stringify([await publico(`/api/fichas/${LUNA}`), await publico(`/api/estatus/${LUNA}`), await publico(`/api/fichas/qr/${tokenSembrado(LUNA)}`)].map((r) => r.texto));
  console.log(`  PUT …/relevante {relevante:true} → ${linea(rel1)} · con un valor que no es booleano → ${rel2.estado} ${rel2.json?.error?.codigo}`);
  ver(rel1.estado === 200 && rel1.json?.relevante === true && rel2.estado === 400 && !/relevante|vistoPorTutora|visto/i.test(publicoTodo), "«relevante»: 200; un valor no booleano 400; no aparece en ninguna respuesta pública (ficha por folio, estatus, ficha por QR)", "relevante mal");

  console.log("\n— Guardas: ajena, inexistente, mal formada, Administrador y sin sesión —");
  const ajenas = [await estado("tutor2", MAX, "localizar"), await estado("tutor2", "RUPE-ZZZZZZZZ", "localizar"), await estado("tutor2", "mal-formado", "localizar"), await estado("tutor2", "RUPE-123", "cancelar", "x")];
  console.log(`  ajena / inexistente / mal formada / folio corto → ${ajenas.map((r) => `${r.estado} #${huellaDe(r.texto)}`).join(" · ")}`);
  ver(ajenas.every((r) => r.estado === 404) && new Set(ajenas.map((r) => r.texto)).size === 1, "caso ajeno, inexistente y folio mal formado: el MISMO 404 (misma huella del cuerpo)", "los 404 difieren");
  const [admin, sin, origen, accionMala, abiertas] = [await estado("admin", COCO, "localizar"), await estado(null, COCO, "localizar"), await estado("tutor1", MIA, "localizar", undefined, "https://otro-sitio.example"), await estado("tutor1", MAX, "borrar"), await como("tutor2", `/api/casos/${LUNA}/avistamientos/201/visto`, { method: "POST", headers: { Origin: ORIGEN } })];
  console.log(`  Administrador → ${admin.estado} ${admin.json?.error?.codigo} · sin sesión → ${sin.estado} ${sin.json?.error?.codigo} · Origin ajeno → ${origen.estado} ${origen.json?.error?.codigo} · acción «borrar» → ${accionMala.estado} ${accionMala.json?.error?.codigo} · abrir avistamiento ajeno → ${abiertas.estado}`);
  ver(admin.estado === 403 && sin.estado === 401 && origen.estado === 403 && origen.json?.error?.codigo === "ORIGEN_NO_PERMITIDO" && accionMala.estado === 400 && accionMala.json?.error?.codigo === "ACCION_INVALIDA" && abiertas.estado === 404, "Administrador 403, sin sesión 401, Origin ajeno 403, acción inválida 400 y abrir un avistamiento ajeno 404", "guardas mal");
  const [pAjena, pSin] = [await como("tutor2", `/tutor/casos/${LUNA}`), await publico(`/tutor/casos/${LUNA}`)];
  console.log(`  página del caso: otra persona tutora → ${pAjena.estado} · sin sesión → ${pSin.estado}`);
  ver(pAjena.estado === 404 && pSin.estado === 307, "las páginas del caso: ajena 404 y sin sesión 307 a /acceso", "páginas mal");

  console.log("\n— Concurrencia: 25 peticiones simultáneas de «localizar» sobre Mia (de Luis) —");
  const antesM = await contarEnHistorial("tutor2", MIA, NOMBRE_ETIQUETA.localizado);
  const rs = await Promise.all(Array.from({ length: 25 }, () => estado("tutor2", MIA, "localizar")));
  const cuenta = rs.reduce<Record<string, number>>((m, r) => ({ ...m, [r.estado]: (m[r.estado] ?? 0) + 1 }), {});
  const despuesM = await contarEnHistorial("tutor2", MIA, NOMBRE_ETIQUETA.localizado);
  console.log(`  respuestas por estado: ${JSON.stringify(cuenta)} · «Marcado como localizado» en el historial: ${antesM} → ${despuesM}`);
  ver(cuenta[200] === 1 && cuenta[409] === 24 && despuesM === antesM + 1, "25 peticiones simultáneas: exactamente UNA da 200, 24 dan 409 y el historial suma UN solo movimiento", `concurrencia: ${JSON.stringify(cuenta)} · movimientos ${antesM}→${despuesM}`);

  console.log("\n— Estatus público (R33): huellas de los cuerpos —");
  const filas: [string, Resp][] = [["Localizado (Mia)", await publico(`/api/estatus/${MIA}`)], ["Cerrado por cierre (Rocky)", await publico(`/api/estatus/${ROCKY}`)], ["Cancelado (Simba)", await publico(`/api/estatus/${SIMBA}`)], ["Deshabilitado (Kira)", await publico(`/api/estatus/${KIRA}`)],
    ["inexistente", await publico("/api/estatus/RUPE-ZZZZZZZZ")], ["inexistente en minúsculas", await publico("/api/estatus/rupe-zzzzzzzz")], ["formato inválido", await publico("/api/estatus/RUPE-123")], ["minúsculas válidas (Rocky)", await publico(`/api/estatus/${ROCKY.toLowerCase()}`)]];
  for (const [n, r] of filas) console.log(`  ${n.padEnd(34)} ${r.estado} ${r.json?.error?.codigo ?? JSON.stringify((r.json?.estatus as { estado?: string })?.estado)} #${huellaDe(r.texto)}`);
  const [mia, rocky, simba, kira, inexistente, inexMin, invalido, rockyMin] = filas.map(([, r]) => r);
  ver((mia.json?.estatus as { estado?: string })?.estado === "Localizado" && (rocky.json?.estatus as { estado?: string })?.estado === "Cerrado" && rockyMin.estado === 200, "estatus: Localizado y «Cerrado» (cierre confirmado) se muestran; el folio no distingue mayúsculas", "estatus visibles mal");
  ver([simba, kira, inexistente, inexMin].every((r) => r.estado === 404) && new Set([simba, kira, inexistente, inexMin].map((r) => normalizar(r.texto, SIMBA, KIRA, "RUPE-ZZZZZZZZ", "rupe-zzzzzzzz"))).size === 1, "Cancelado, Deshabilitado e inexistente: 404 con el MISMO cuerpo (misma huella)", "los 404 del estatus difieren");
  ver(invalido.estado === 400 && invalido.json?.error?.codigo === "FOLIO_INVALIDO", "formato inválido: 400 FOLIO_INVALIDO", `formato inválido: ${linea(invalido)}`);
  const datosPersonales = filas.map(([, r]) => r.texto).join("");
  ver(!/Rosa|Luis|Hern|Navarro|@example|tutor|token|calle|direcci/i.test(datosPersonales), "ninguna respuesta de estatus lleva datos personales", "el estatus filtra datos personales");

  await reiniciarDatos(base);
  await interfaz();
  await reiniciarDatos(base);
}

// ----------------------------------------------------------------------------------------------------------------------------- interfaz
/** Cuántos avistamientos nuevos dice la campana de una página real de la persona tutora (aria-label «Avistamientos, N nuevos»; sin insignia = 0). */
const campanaDe = (html: string) => {
  const m = /aria-label="Avistamientos(?:, (\d+|más de 9) nuevos)?"/.exec(html);
  return m ? (m[1] ? Number(m[1]) : 0) : -1;
};
async function abrirNavegador(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch {
    return await chromium.launch({ channel: "chrome" });
  }
}
/** La insignia «Nuevo» de un avistamiento del listado (la Etiqueta con ícono), no la palabra suelta. */
const insigniaNuevo = (html: string) => /Nuevo<\/span>/.test(html);
const campanaEnPagina = (p: Page) => p.locator('a[href="/tutor/avistamientos"]').getAttribute("aria-label").then((l) => (l ? (/(\d+) nuevos/.exec(l)?.[1] ? Number(/(\d+) nuevos/.exec(l)![1]) : 0) : -1));

async function interfaz() {
  console.log("\n— Interfaz: un GET no marca nada; abrir el detalle sí, una sola vez —");
  await reiniciarDatos(base);
  const LISTA = `/tutor/casos/${LUNA}/avistamientos`;
  const DETALLE = `${LISTA}/201`;
  const [rosa, luis] = [await como("tutor1", "/tutor"), await como("tutor2", "/tutor")];
  console.log(`  campana en /tutor: Rosa (dueña de Luna y de Bruno) → ${campanaDe(rosa.texto)} · Luis → ${campanaDe(luis.texto)}`);
  ver(campanaDe(rosa.texto) === 2 && campanaDe(luis.texto) === 0, "campana con el seed: la dueña de Luna y de Bruno ve 2 avistamientos nuevos (201 y 302); la otra cuenta ve 0", `campana: ${campanaDe(rosa.texto)} / ${campanaDe(luis.texto)}`);
  const antes = await contarEnHistorial("tutor1", LUNA, NOMBRE_ETIQUETA.revisado);
  const lecturas = [await como("tutor1", DETALLE), await como("tutor1", DETALLE, { redirect: "follow", headers: { RSC: "1", "Next-Router-Prefetch": "1", "Next-Url": DETALLE } }), await como("tutor1", DETALLE, { headers: { Purpose: "prefetch" } }), await como("tutor1", `${DETALLE}?_rsc=abc`, { redirect: "follow", headers: { RSC: "1" } })];
  const lista = sinComentarios((await como("tutor1", LISTA)).texto);
  const despues = await contarEnHistorial("tutor1", LUNA, NOMBRE_ETIQUETA.revisado);
  console.log(`  4 lecturas del detalle del avistamiento nuevo (completa, RSC, prefetch y ?_rsc) → ${lecturas.map((r) => r.estado).join(" ")} · «Avistamiento revisado» ${antes} → ${despues} · el listado sigue con «Nuevo»: ${insigniaNuevo(lista)} · campana ${campanaDe((await como("tutor1", "/tutor")).texto)}`);
  ver(lecturas.every((r) => r.estado === 200) && despues === antes && insigniaNuevo(lista) && campanaDe((await como("tutor1", "/tutor")).texto) === 2, "un GET del detalle de un avistamiento nuevo (también con las cabeceras de prefetch y RSC) NO lo marca como visto ni mueve el caso: el servidor nunca escribe al renderizar", "una lectura marcó el avistamiento como visto");

  const navegador = await abrirNavegador();
  try {
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    await agregarSesion(contexto, base, "tutor1");
    const pagina = await contexto.newPage();
    const posts: string[] = [];
    pagina.on("request", (r) => r.method() === "POST" && /\/visto$/.test(r.url()) && posts.push(r.url()));
    await pagina.goto(`${base}${DETALLE}`, { waitUntil: "load" });
    await pagina.waitForFunction(() => /1 nuevos/.test(document.querySelector('a[href="/tutor/avistamientos"]')?.getAttribute("aria-label") ?? ""), undefined, { timeout: 15000 }).catch(() => undefined);
    const campana1 = await campanaEnPagina(pagina);
    const detalleCaso = sinComentarios((await como("tutor1", `/tutor/casos/${LUNA}`)).texto);
    const lista2 = sinComentarios((await como("tutor1", LISTA)).texto);
    console.log(`  al abrir el detalle: POST …/visto enviados ${posts.length} · campana ${campana1} · estatus del caso en su detalle: «En seguimiento» ${detalleCaso.includes("En seguimiento")} · «Avistamiento revisado» ${await contarEnHistorial("tutor1", LUNA, NOMBRE_ETIQUETA.revisado)} · «Nuevo» en el listado ${insigniaNuevo(lista2)}`);
    ver(posts.length === 1 && campana1 === 1 && detalleCaso.includes("En seguimiento") && (await contarEnHistorial("tutor1", LUNA, NOMBRE_ETIQUETA.revisado)) === 1 && !insigniaNuevo(lista2), "abrir el detalle de un avistamiento nuevo envía UN solo POST «visto»: la campana baja de 2 a 1, el caso pasa a «En seguimiento» (historial «Avistamiento revisado» una vez) y el listado ya no lo muestra «Nuevo»", "abrir el detalle no dejó el estado esperado");
    posts.length = 0;
    await pagina.reload({ waitUntil: "load" });
    await pagina.waitForTimeout(800);
    ver(posts.length === 0, "volver a abrir un avistamiento YA visto no envía ningún POST", `volver a abrir envió ${posts.length} POST`);
    const bruno = await como("tutor1", `/tutor/casos/${BRUNO}/avistamientos`);
    ver(insigniaNuevo(sinComentarios(bruno.texto)), "el avistamiento nuevo de Bruno (302) sigue «Nuevo»: cada uno baja la campana solo al abrirse", "Bruno ya no tiene su avistamiento nuevo");

    // «Marcar como relevante».
    const casilla = pagina.getByRole("checkbox", { name: /Marcar como relevante/ });
    const marcar = () => Promise.all([pagina.waitForResponse((r) => /\/relevante$/.test(r.url()) && r.status() === 200), pagina.getByText("Marcar como relevante", { exact: true }).click()]); // la casilla real es sr-only: se pulsa su etiqueta
    await marcar();
    const conMarca = sinComentarios((await como("tutor1", LISTA)).texto).includes("Relevante");
    await pagina.reload({ waitUntil: "load" });
    const sigue = await casilla.isChecked();
    await marcar();
    const sinMarca = !sinComentarios((await como("tutor1", LISTA)).texto).includes("Relevante");
    console.log(`  «Marcar como relevante»: con la marca el listado dice «Relevante» ${conMarca} · tras recargar la casilla sigue marcada ${sigue} · al desmarcar desaparece ${sinMarca}`);
    ver(conMarca && sigue && sinMarca, "«Marcar como relevante»: se guarda (el listado muestra «Relevante»), sobrevive a recargar y es reversible", "relevante en la interfaz mal");

    // Doble clic en un modal: una sola petición. Compartir estatus. Y el 409 que refresca con el estado real.
    await pagina.goto(`${base}/tutor/casos/${COCO}`, { waitUntil: "load" });
    const peticiones: string[] = [];
    pagina.on("request", (r) => r.method() === "POST" && /\/estado$/.test(r.url()) && peticiones.push(r.postData() ?? ""));
    await pagina.getByRole("button", { name: "Compartir estatus" }).click();
    const comp = pagina.getByRole("dialog", { name: "Compartir estatus" });
    const enlace = await comp.locator("#enlace-estatus").inputValue();
    const wa = await comp.getByRole("link", { name: /WhatsApp/ }).getAttribute("href");
    console.log(`  «Compartir estatus»: enlace termina en /estatus/${COCO}: ${enlace.endsWith(`/estatus/${COCO}`)} · Facebook: ${await comp.getByRole("link", { name: /Facebook/ }).count()} · WhatsApp lleva el enlace: ${decodeURIComponent(wa ?? "").includes(`/estatus/${COCO}`)}`);
    ver(enlace.endsWith(`/estatus/${COCO}`) && !enlace.includes(tokenSembrado(COCO)) && (await comp.getByRole("link", { name: /Facebook/ }).count()) === 0 && !!wa?.startsWith("https://wa.me/?text=") && decodeURIComponent(wa).includes(`/estatus/${COCO}`) && !/Rosa|Coco|Hern/.test(decodeURIComponent(wa)), "«Compartir estatus»: el enlace es /estatus/<FOLIO> (nunca el token), sin Facebook, y el texto de WhatsApp no lleva datos personales", "compartir estatus mal");
    await comp.getByRole("button", { name: "Cerrar" }).click();
    await pagina.getByRole("button", { name: "Marcar como localizado" }).click();
    await pagina.getByRole("dialog", { name: "¿Marcar el caso como localizado?" }).getByRole("button", { name: "Marcar como localizado" }).dblclick();
    await pagina.getByText("Localizado", { exact: true }).first().waitFor({ timeout: 15000 });
    await pagina.waitForTimeout(500);
    const aviso = await pagina.locator('p[role="status"]').first().innerText();
    const [mov, est] = [await contarEnHistorial("tutor1", COCO, NOMBRE_ETIQUETA.localizado), await publico(`/api/estatus/${COCO}`)];
    console.log(`  doble clic en «Marcar como localizado» → ${peticiones.length} petición(es) a /estado · historial «Marcado como localizado» ×${mov} · aviso anunciado: «${aviso}» · estatus público ${JSON.stringify((est.json?.estatus as { estado?: string })?.estado)}`);
    ver(peticiones.length === 1 && mov === 1 && aviso.includes("Localizado") && (est.json?.estatus as { estado?: string })?.estado === "Localizado", "doble clic en el botón del modal: UNA sola petición, un solo movimiento, aviso anunciado en una región accesible y el estado ya es real (estatus público «Localizado»)", "el doble clic duplicó o no cambió el estado");
    // 409: la pantalla muestra «Localizado» (Coco); otra petición lo reactiva; al cerrar desde la pantalla vieja el servidor da 409 y se refresca con el estado real.
    await estado("tutor1", COCO, "reactivar", "Se movió desde otra pestaña");
    await pagina.getByRole("button", { name: "Cerrar caso" }).click();
    peticiones.length = 0;
    await pagina.getByRole("dialog", { name: "¿Cerrar el caso?" }).getByRole("button", { name: "Cerrar caso" }).click();
    await pagina.getByText("En seguimiento", { exact: true }).first().waitFor({ timeout: 15000 });
    const aviso409 = await pagina.locator('p[role="status"]').first().innerText();
    const dialogoAbierto = await pagina.evaluate(() => [...document.querySelectorAll("dialog")].some((d) => d.open));
    console.log(`  409 desde una pantalla desactualizada: «${aviso409}» · diálogo abierto ${dialogoAbierto} · el caso quedó en «En seguimiento» (estado real)`);
    ver(/ya había cambiado/.test(aviso409) && !dialogoAbierto && peticiones.length === 1, "ante un 409 («ya cambió») la pantalla refresca con el estado real, avisa y cierra el modal", "el 409 no refrescó con el estado real");
    await contexto.close();
  } finally {
    await navegador.close();
  }
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
  console.log(fallos === 0 ? `\nOK: ${total} comprobaciones del seguimiento de la persona tutora y del estatus público` : `\n${fallos} de ${total} verificación(es) fallida(s)`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
