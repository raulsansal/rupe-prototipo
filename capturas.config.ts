import type { Page } from "playwright";
import { botonContinuar, capturarRegistroCompleto, ENTRADA_FOTO, registrarPorLaInterfaz } from "./scripts/imagenes-pruebas";
import { credencial, fetchComo } from "./scripts/sesion-pruebas";
import { USUARIOS_INICIALES } from "./src/mocks/usuarios";
import { FOLIO_CON_AVISTAMIENTOS, FOLIO_UN_AVISTAMIENTO } from "./src/mocks/avistamientos";
import { CASOS_ORIGEN, FOLIO_EN_CURSO } from "./src/mocks/casos";
import { FOLIO_MODERACION_ACTIVO, FOLIO_MODERACION_CANCELADO, FOLIO_MODERACION_DESHABILITADO } from "./src/mocks/moderacion";

// Configuración del script `npm run capturas`.
// Una ruta sin `secciones` se captura completa; con `secciones`, cada [data-seccion="..."] por separado.
// `anchos` sustituye a ANCHOS para esa entrada; `archivo` fija el nombre base (por defecto, la ruta sin parámetros).
// `ventana`: con un modal abierto se captura la ventana visible (390×ALTO_TELEFONO) en lugar de la página completa.
export type Captura = {
  ruta: string;
  secciones?: string[];
  anchos?: number[];
  archivo?: string;
  ventana?: boolean;
  /** Sesión con la que se visita (cuentas ficticias de .env.local). Por defecto sale de la ruta: /admin → admin, /tutor → tutor1; null = sin sesión. */
  rol?: "admin" | "tutor1" | "tutor2" | null;
  /** Interacciones previas a la captura (estados REALES del servidor: errores, bloqueo…). */
  preparar?: (pagina: Page, contexto: { base: string }) => Promise<void>;
};

/** Desde el paso 4 de una variante: completa fecha, hora, foto y ubicación y envía el reporte (la captura del rechazo intercepta la respuesta: el seed del Prototipo deja el catálogo activo). */
async function enviarReporteCompleto(p: Page) {
  const boton = p.getByRole("button", { name: /^(Continuar|Enviar reporte)$/ });
  const paso = (n: number) => p.locator(`[data-paso="${n}"]`);
  await paso(4).locator("input[type=date]").fill("2026-10-18");
  await paso(4).locator("input[type=time]").fill("10:30");
  for (let i = 0; i < 3; i++) await boton.click(); // 5, 6 y «Enviar»: sin foto ni ubicación regresa al paso 2
  await paso(2).locator("input[type=file]:not([capture])").setInputFiles({ name: "avistamiento.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
  await paso(2).getByAltText("Vista previa de la fotografía").waitFor();
  await boton.click();
  await p.getByLabel(/Dirección aproximada/).fill("Av. Insurgentes y Chilpancingo");
  await p.getByLabel(/Alcaldía/).selectOption({ label: "Cuauhtémoc" });
  for (let i = 0; i < 4; i++) await boton.click();
  await paso(4).getByText("Una de las opciones elegidas ya no está disponible. Revisa tus selecciones.").first().waitFor();
}

export const RUTAS: Captura[] = [
  { ruta: "/dev/fundaciones" },
  { ruta: "/dev/componentes", secciones: ["botones", "chips", "formularios", "navegacion", "retroalimentacion", "graficas"] },
  { ruta: "/dev/plantillas/publica" },
  { ruta: "/dev/plantillas/tutor" },
  { ruta: "/dev/plantillas/admin" },
  { ruta: "/dev/plantillas/flujo" },
  { ruta: "/dev/plantillas/publica?menu=abierto", anchos: [390], archivo: "dev-plantillas-publica-menu-abierto" },
  { ruta: "/dev/plantillas/admin?menu=abierto", anchos: [390], archivo: "dev-plantillas-admin-menu-abierto" },
];
const FICHA = `/ficha/${FOLIO_EN_CURSO}`;
const AVISTAMIENTO = `${FICHA}/avistamiento`;
const TOKEN_MAX = CASOS_ORIGEN.find((c) => c.folio === FOLIO_EN_CURSO)!.tokenPublico;
const FOLIO_LOCALIZADO = CASOS_ORIGEN.find((c) => c.estado === "Localizado")!.folio;
const M = [390]; // solo móvil: variantes de pantalla

// Bloque 3 · Visitante y transversales. A 1280 px solo PUB-01, PUB-03 (A), PUB-05 (paso 1 y 4) y las transversales.
RUTAS.push(
  { ruta: "/" },
  { ruta: `${FICHA}?estado=en-curso`, archivo: "ficha-a-en-curso" },
  { ruta: `${FICHA}?estado=localizado`, archivo: "ficha-b-localizado", anchos: M },
  { ruta: `${FICHA}?estado=no-disponible`, archivo: "ficha-c-no-disponible", anchos: M },
  { ruta: `${AVISTAMIENTO}/enviado`, archivo: "avistamiento-enviado", anchos: M },
  // P4: la ficha real por folio y por QR (la clave de 32 caracteres), el QR no vigente, un caso Localizado real y el reporte con su ID.
  { ruta: FICHA, archivo: "ficha-por-folio", anchos: M },
  { ruta: `/ficha/${TOKEN_MAX}`, archivo: "ficha-por-qr", anchos: M },
  { ruta: `/ficha/${"x".repeat(32)}`, archivo: "ficha-qr-no-vigente", anchos: M },
  { ruta: `/ficha/${FOLIO_LOCALIZADO}`, archivo: "ficha-localizado-real", anchos: M },
  { ruta: `/ficha/${FOLIO_LOCALIZADO}/avistamiento`, archivo: "avistamiento-no-disponible", anchos: M },
  { ruta: `${AVISTAMIENTO}/enviado?id=504`, archivo: "avistamiento-enviado-con-id", anchos: M },
  { ruta: `${AVISTAMIENTO}?paso=1`, archivo: "avistamiento-paso-1" },
  { ruta: `${AVISTAMIENTO}?paso=2`, archivo: "avistamiento-paso-2" },
  { ruta: `${AVISTAMIENTO}?paso=2&datos=ejemplo`, archivo: "avistamiento-paso-2-con-foto" },
  { ruta: `${AVISTAMIENTO}?paso=3`, archivo: "avistamiento-paso-3", anchos: M },
  { ruta: `${AVISTAMIENTO}?paso=4`, archivo: "avistamiento-paso-4" },
  { ruta: `${AVISTAMIENTO}?paso=5&datos=ejemplo`, archivo: "avistamiento-paso-5", anchos: M },
  { ruta: `${AVISTAMIENTO}?paso=6&datos=ejemplo`, archivo: "avistamiento-paso-6", anchos: M },
  // Paso 5: con «Libre» (placeholder normal), con «Resguardado» (invitación a dejar un correo y nota) y el rechazo de una opción que ya no está disponible.
  { ruta: `${AVISTAMIENTO}?paso=5&caso=libre`, archivo: "avistamiento-comentario-libre", anchos: [390] },
  { ruta: `${AVISTAMIENTO}?paso=5&caso=combinadas`, archivo: "avistamiento-comentario-resguardado", anchos: [390] },
  { ruta: `${AVISTAMIENTO}?caso=no-disponible`, archivo: "avistamiento-opcion-no-disponible", anchos: [390], preparar: async (p) => { await p.route("**/api/avistamientos", (r) => r.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: { codigo: "VALIDACION", mensaje: "Revisa los campos marcados.", campos: { estadosAnimal: "Una de las opciones elegidas ya no está disponible. Revisa tus selecciones." } } }) })); await enviarReporteCompleto(p); } },
  ...["vacio", "combinadas", "fallecido"].map((c): Captura => ({ ruta: `${AVISTAMIENTO}?caso=${c}`, archivo: `avistamiento-estado-animal-${c}`, anchos: M })),
  { ruta: "/ruta-que-no-existe", archivo: "tra-01-no-encontrada" },
  { ruta: "/dev/transversales/error", archivo: "tra-04-error" },
);
const CASO = `/tutor/casos/${FOLIO_EN_CURSO}`;

// Bloque 4 · persona tutora. A 1280 px solo ACC-01, TUT-01, TUT-05 (en curso) y TUT-07.
RUTAS.push(
  { ruta: "/acceso", archivo: "acceso" },
  { ruta: "/acceso?estado=bloqueo", archivo: "acceso-bloqueo", anchos: M },
  { ruta: "/acceso?estado=deshabilitada", archivo: "acceso-deshabilitada", anchos: M },
  { ruta: "/tutor", archivo: "tutor-mis-registros" },
  { ruta: "/tutor?estado=vacio", archivo: "tutor-mis-registros-vacio", anchos: M },
  { ruta: "/tutor?estado=cargando", archivo: "tutor-mis-registros-cargando", anchos: M },
  { ruta: "/tutor/registrar", archivo: "tutor-registrar-paso-1" },
  { ruta: "/tutor/registrar?raza=otra", archivo: "tutor-registrar-raza-otra" },
  { ruta: "/tutor/registrar?paso=2", archivo: "tutor-registrar-paso-2", anchos: M },
  { ruta: `${CASO}/creado`, archivo: "tutor-caso-creado", anchos: M },
  // P5: el detalle usa casos REALES de cada estado (se retiró ?estado=): Max «En búsqueda», Toby «Localizado» y Rocky «Cerrado».
  { ruta: CASO, archivo: "tutor-caso-en-curso" },
  { ruta: "/tutor/casos/RUPE-B6R2TZ7C", archivo: "tutor-caso-localizado", anchos: M },
  { ruta: "/tutor/casos/RUPE-3HN8WD2B", archivo: "tutor-caso-cerrado", anchos: M },
  { ruta: `${CASO}/ficha`, archivo: "tutor-ficha" },
  { ruta: `${CASO}/ficha?modal=visor`, archivo: "tutor-ficha-visor-carta", anchos: M, ventana: true },
  { ruta: `${CASO}/ficha?modal=visor&hoja=media-carta`, archivo: "tutor-ficha-visor-media-carta", anchos: M, ventana: true },
  { ruta: `${CASO}/ficha?modal=compartir`, archivo: "tutor-ficha-compartir", anchos: M, ventana: true },
  { ruta: `${CASO}/ficha?modal=regenerar`, archivo: "tutor-ficha-regenerar", anchos: M, ventana: true },
);
const CON_AV = `/tutor/casos/${FOLIO_CON_AVISTAMIENTOS}`;
const UN_AV = `/tutor/casos/${FOLIO_UN_AVISTAMIENTO}`;

// Bloque 4b · ACC-02, MOD-01, TUT-08, TUT-09, TUT-10, TRA-02 y TRA-03. A 1280 px solo TUT-09 (la lámina 2.7 lo dibuja en escritorio).
RUTAS.push(
  { ruta: "/registro", archivo: "registro", anchos: M },
  { ruta: "/registro?estado=aviso", archivo: "registro-aviso-privacidad", anchos: M, ventana: true },
  { ruta: "/?aviso=abierto", archivo: "inicio-aviso-privacidad", anchos: M, ventana: true },
  { ruta: "/acceso?estado=aviso-actualizado", archivo: "tra-03-aviso-actualizado", anchos: M, ventana: true },
  { ruta: "/dev/transversales/sesion-expirada", archivo: "tra-02-sesion-expirada", anchos: M, ventana: true },
  { ruta: `${CASO}/avistamientos`, archivo: "tutor-avistamientos-sin", anchos: M },
  { ruta: `${CON_AV}/avistamientos`, archivo: "tutor-avistamientos", anchos: M },
  { ruta: `${CON_AV}/avistamientos?filtros=abiertos`, archivo: "tutor-avistamientos-filtros", anchos: M },
  { ruta: `${CON_AV}/mapa`, archivo: "tutor-mapa" },
  { ruta: `${CON_AV}/mapa?ruta=visible`, archivo: "tutor-mapa-ruta" },
  { ruta: `${UN_AV}/mapa`, archivo: "tutor-mapa-un-avistamiento", anchos: M },
  { ruta: `${CON_AV}/avistamientos/101`, archivo: "tutor-avistamiento-detalle", anchos: M },
  { ruta: `${CON_AV}/avistamientos/102`, archivo: "tutor-avistamiento-fallecido-oculta", anchos: M },
  { ruta: `${CON_AV}/avistamientos/102?foto=visible`, archivo: "tutor-avistamiento-fallecido-mostrada", anchos: M },
);
// P5 · seguimiento de la persona tutora y estatus público. Los casos y avistamientos son los sembrados; las capturas con modal se abren con una interacción real. Se capturan ANTES de abrir el detalle de
// un avistamiento nuevo (abrirlo lo marca como visto) y el almacén se reinicia al terminar.
/** Abre un modal pulsando un botón (nombre exacto o patrón) con un clic real; los modales de la moderación ya no se fijan por la URL. */
const clicYDialogo = (nombre: string | RegExp) => async (p: Page) => {
  await p.getByRole("button", { name: nombre }).first().click();
  await p.getByRole("dialog").waitFor();
};
const PEND = (nombre: string) => ({ name: nombre, exact: true });
const abrirModal = (boton: string) => async (p: Page) => {
  await p.getByRole("button", PEND(boton)).click();
  await p.getByRole("dialog").waitFor();
};
RUTAS.push(
  { ruta: "/estatus", archivo: "estatus-buscador", rol: null, anchos: M },
  { ruta: "/estatus", archivo: "estatus-formato-invalido", rol: null, anchos: [390], preparar: async (p) => { await p.getByRole("textbox", { name: "Folio" }).fill("RUPE-OOOO1111"); await p.getByRole("button", { name: "Consultar folio" }).click(); await p.getByText("formato RUPE-XXXXXXXX").first().waitFor(); } },
  { ruta: `/estatus/${FOLIO_EN_CURSO}`, archivo: "estatus-activo", rol: null, anchos: M },
  { ruta: "/estatus/RUPE-B6R2TZ7C", archivo: "estatus-localizado", rol: null, anchos: [390] },
  { ruta: "/estatus/RUPE-3HN8WD2B", archivo: "estatus-cerrado", rol: null, anchos: [390] },
  { ruta: "/estatus/RUPE-ZZZZZZZZ", archivo: "estatus-no-encontrado", rol: null, anchos: [390] },
  { ruta: "/tutor/consultar-folio", archivo: "tutor-consultar-folio", anchos: M },
  { ruta: `/tutor/consultar-folio?folio=${FOLIO_EN_CURSO}`, archivo: "tutor-consultar-folio-resultado", anchos: [390] },
  { ruta: "/tutor", archivo: "tutor-campana-con-contador", anchos: [390] },
  { ruta: `${CASO}`, archivo: "tutor-caso-modal-localizar", anchos: [390], ventana: true, preparar: abrirModal("Marcar como localizado") },
  { ruta: `${CASO}`, archivo: "tutor-caso-modal-cancelar", anchos: [390], ventana: true, preparar: abrirModal("Cancelar registro") },
  { ruta: `${CASO}`, archivo: "tutor-caso-compartir-estatus", anchos: [390], ventana: true, preparar: abrirModal("Compartir estatus") },
  { ruta: "/tutor/casos/RUPE-B6R2TZ7C", archivo: "tutor-caso-modal-cerrar", anchos: [390], ventana: true, preparar: abrirModal("Cerrar caso") },
  { ruta: "/tutor/casos/RUPE-B6R2TZ7C", archivo: "tutor-caso-modal-reactivar-error", anchos: [390], ventana: true, preparar: async (p) => { await abrirModal("Reactivar caso")(p); await p.getByRole("dialog").getByRole("button", { name: "Reactivar caso" }).click(); await p.getByText("Escribe el motivo para continuar.").waitFor(); } },
  { ruta: "/tutor/casos/RUPE-C2J9RK6Z", archivo: "tutor-caso-localizado-compartir-estatus", anchos: [390], ventana: true, preparar: abrirModal("Compartir estatus") },
  { ruta: `${CON_AV}/avistamientos?desde=2026-10-06&hasta=2026-10-07&alcaldia=9`, archivo: "tutor-avistamientos-filtros-aplicados", anchos: [390] },
  { ruta: `${CON_AV}/avistamientos?desde=2026-10-03&hasta=abc&alcaldia=99`, archivo: "tutor-avistamientos-filtros-error", anchos: [390] },
  { ruta: "/tutor/casos/RUPE-N8D5GX3W/avistamientos", archivo: "tutor-avistamientos-nuevo", anchos: M },
  { ruta: "/tutor/casos/RUPE-N8D5GX3W/avistamientos", archivo: "tutor-avistamientos-relevante", anchos: [390], preparar: async (p) => { await p.evaluate(() => fetch("/api/casos/RUPE-N8D5GX3W/avistamientos/301/relevante", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ relevante: true }) })); await p.reload({ waitUntil: "load" }); } },
  { ruta: "/tutor/casos/RUPE-P3H8WD5N/avistamientos/201", archivo: "tutor-avistamiento-nuevo-detalle", anchos: [390] },
);
// Bloque 5a · Administrador: tablero (ADM-01) y usuarios (ADM-03 y MOD-10). Los modales se capturan como pantalla de teléfono.
RUTAS.push(
  { ruta: "/admin", archivo: "admin-tablero", anchos: [390, 768, 1280] }, // 768 px también: el menú lateral del Administrador (encabezados de grupo) se revisa en los tres anchos
  { ruta: "/admin?desde=2026-09-01&hasta=2026-09-30", archivo: "admin-tablero-septiembre", anchos: M },
  { ruta: "/admin?desde=2026-10-10&hasta=2026-10-01", archivo: "admin-tablero-periodo-invalido", anchos: M },
  { ruta: "/admin?desde=2026-10-19&hasta=2026-10-19", archivo: "admin-tablero-sin-datos", anchos: M },
  { ruta: "/admin/usuarios", archivo: "admin-usuarios", anchos: [390, 768, 1280] },
  { ruta: "/admin/usuarios", archivo: "admin-usuarios-cambiar-rol", anchos: M, ventana: true, preparar: clicYDialogo(/^Cambiar rol de Rosa/) },
  { ruta: "/admin/usuarios", archivo: "admin-usuarios-deshabilitar", anchos: M, ventana: true, preparar: clicYDialogo(/^Deshabilitar a Rosa/) },
  { ruta: "/admin/usuarios", archivo: "admin-usuarios-habilitar", anchos: M, ventana: true, preparar: clicYDialogo(/^Habilitar a Mateo/) },
  { ruta: "/admin/usuarios?q=zzzz", archivo: "admin-usuarios-sin-resultados", anchos: M },
);
// Bloque 5b · Administrador: moderación de registros (ADM-04, MOD-08 y TUT-05 variante Administrador), de avistamientos (ADM-05 y MOD-09)
// y la plantilla de catálogo (ADM-06 a ADM-09 con MOD-11). Los modales se capturan como pantalla de teléfono.
const REGISTRO = "/admin/registros";
RUTAS.push(
  { ruta: REGISTRO, archivo: "admin-registros" },
  { ruta: REGISTRO, archivo: "admin-registros-deshabilitar", anchos: M, ventana: true, preparar: clicYDialogo(/^Deshabilitar RUPE-K7M4XQ9T/) },
  { ruta: REGISTRO, archivo: "admin-registros-deshabilitar-error", anchos: M, ventana: true, preparar: async (p) => { await clicYDialogo(/^Deshabilitar RUPE-K7M4XQ9T/)(p); await p.getByRole("button", { name: "Confirmar" }).click(); } },
  { ruta: `${REGISTRO}?estado=Extraviado`, archivo: "admin-registros-sin-resultados", anchos: M },
  { ruta: `${REGISTRO}/${FOLIO_MODERACION_ACTIVO}`, archivo: "admin-registro-detalle" },
  { ruta: `${REGISTRO}/${FOLIO_MODERACION_ACTIVO}`, archivo: "admin-registro-detalle-deshabilitar", anchos: M, ventana: true, preparar: clicYDialogo("Deshabilitar registro") },
  { ruta: `${REGISTRO}/${FOLIO_MODERACION_DESHABILITADO}`, archivo: "admin-registro-detalle-deshabilitado", anchos: M },
  { ruta: `${REGISTRO}/${FOLIO_MODERACION_CANCELADO}`, archivo: "admin-registro-detalle-cancelado", anchos: M },
  { ruta: "/admin/avistamientos", archivo: "admin-avistamientos" },
  { ruta: "/admin/avistamientos", archivo: "admin-avistamientos-ocultar", anchos: M, ventana: true, preparar: clicYDialogo(/^Ocultar el avistamiento/) },
  { ruta: "/admin/avistamientos", archivo: "admin-avistamientos-ocultar-error", anchos: M, ventana: true, preparar: async (p) => { await clicYDialogo(/^Ocultar el avistamiento/)(p); await p.getByRole("button", { name: "Confirmar" }).click(); } },
  { ruta: "/admin/avistamientos?detalle=201", archivo: "admin-avistamientos-detalle", anchos: M, ventana: true },
  { ruta: "/admin/avistamientos?detalle=105", archivo: "admin-avistamientos-detalle-oculto", anchos: M, ventana: true },
  { ruta: "/admin/avistamientos?pagina=2", archivo: "admin-avistamientos-fallecido-y-oculto" },
  { ruta: "/admin/avistamientos?detalle=102", archivo: "admin-avistamientos-detalle-fallecido", anchos: M, ventana: true },
  { ruta: "/admin/avistamientos?detalle=102&foto=visible", archivo: "admin-avistamientos-detalle-fallecido-foto", anchos: M, ventana: true },
  { ruta: "/admin/avistamientos?desde=2026-01-01&hasta=2026-01-02", archivo: "admin-avistamientos-sin-resultados", anchos: M },
  { ruta: "/admin/alcaldias", archivo: "admin-alcaldias" },
  { ruta: "/admin/alcaldias", archivo: "admin-alcaldias-agregar", anchos: M, ventana: true, preparar: clicYDialogo("Agregar alcaldía") },
  { ruta: "/admin/alcaldias", archivo: "admin-alcaldias-editar", anchos: M, ventana: true, preparar: clicYDialogo(/^Editar Álvaro Obregón/) },
  { ruta: "/admin/alcaldias", archivo: "admin-alcaldias-desactivar", anchos: M, ventana: true, preparar: clicYDialogo(/^Desactivar Álvaro Obregón/) },
  { ruta: "/admin/alcaldias?pagina=3", archivo: "admin-alcaldias-protegida" },
  { ruta: "/admin/alcaldias?q=zzzz", archivo: "admin-alcaldias-sin-resultados", anchos: M },
  { ruta: "/admin/razas", archivo: "admin-razas" },
  { ruta: "/admin/razas", archivo: "admin-razas-editar", anchos: M, ventana: true, preparar: clicYDialogo(/^Editar Chihuahua/) },
  { ruta: "/admin/motivos", archivo: "admin-motivos" },
  { ruta: "/admin/motivos", archivo: "admin-motivos-agregar", anchos: M, ventana: true, preparar: clicYDialogo("Agregar motivo") },
  { ruta: "/admin/estados-animal", archivo: "admin-estados-animal" },
  { ruta: "/admin/estados-animal", archivo: "admin-estados-animal-editar", anchos: M, ventana: true, preparar: clicYDialogo(/^Editar Herido/) },
  { ruta: "/admin/estados-animal?pagina=3", archivo: "admin-estados-animal-bloqueada" },
);
// Bloque 5c · Administrador: reportes, estados del caso, parámetros y bitácora (390 y 1280 px; las variantes, solo 390).
// P6c: Reportes ya no tiene variantes por URL: cada estado se alcanza con acciones reales (rellenar y pulsar «Generar reporte»). Todas comparten la ruta /admin/reportes (se capturan con --rutas-exactas=/admin/reportes).
const generarReporte = (desde: string, hasta: string, extra?: (p: Page) => Promise<void>) => async (p: Page) => {
  await p.locator("#reporte-desde").fill(desde);
  await p.locator("#reporte-hasta").fill(hasta);
  await extra?.(p);
  await p.getByRole("button", { name: "Generar reporte" }).click();
};
RUTAS.push(
  { ruta: "/admin/reportes", archivo: "admin-reportes" },
  { ruta: "/admin/reportes", archivo: "admin-reportes-error-rango", anchos: M, preparar: async (p) => { await p.getByRole("button", { name: "Generar reporte" }).click(); await p.getByText("El rango de fechas es obligatorio: indica «Desde».").waitFor(); } },
  { ruta: "/admin/reportes", archivo: "admin-reportes-resultados", preparar: async (p) => { await generarReporte("2026-10-01", "2026-10-18")(p); await p.locator("section[aria-label='Resultados del reporte']").waitFor(); } },
  { ruta: "/admin/reportes", archivo: "admin-reportes-filtrado", anchos: M, preparar: async (p) => { await generarReporte("2026-10-01", "2026-10-18", async (q) => { await q.getByLabel("Alcaldía · opcional").selectOption({ label: "Coyoacán" }); await q.getByLabel("Estado del caso · opcional").selectOption("Localizado"); })(p); await p.locator("section[aria-label='Resultados del reporte']").waitFor(); } },
  { ruta: "/admin/reportes", archivo: "admin-reportes-sin-datos", preparar: async (p) => { await generarReporte("2026-10-19", "2026-10-31")(p); await p.getByText("No hay datos en el periodo y filtros seleccionados").waitFor(); } },
  { ruta: "/admin/reportes", archivo: "admin-reportes-cargando", anchos: M, preparar: async (p) => { await p.route("**/api/admin/reportes?*", () => undefined); await generarReporte("2026-10-01", "2026-10-18")(p); await p.locator("[role=status][aria-busy=true]").first().waitFor(); } },
  { ruta: "/admin/estados-caso", archivo: "admin-estados-caso" },
  { ruta: "/admin/parametros", archivo: "admin-parametros" },
  { ruta: "/admin/parametros", archivo: "admin-parametros-aviso", preparar: async (p) => { await p.getByLabel("Versión vigente del aviso de privacidad").fill("2.0"); } },
  { ruta: "/admin/parametros", archivo: "admin-parametros-errores", preparar: async (p) => { await p.getByLabel(/^Tiempo de expiración/).fill("0"); await p.getByLabel(/^Tamaño máximo/).fill("6"); await p.getByRole("button", { name: "Guardar configuración" }).click(); await p.getByText("Debe ser un número entero mayor que cero.").waitFor(); } },
  { ruta: "/admin/parametros", archivo: "admin-parametros-guardado", preparar: async (p) => { const campo = p.getByLabel(/^Tiempo de expiración/); await campo.fill((await campo.inputValue()) === "45" ? "50" : "45"); /* siempre un valor distinto del guardado: cada ancho y tema repite la captura sobre los mismos datos */ await p.getByRole("button", { name: "Guardar configuración" }).click(); await p.getByRole("status").filter({ hasText: "Configuración guardada" }).waitFor(); } },
  { ruta: "/admin/parametros", archivo: "admin-parametros-restablecer", anchos: M, ventana: true, preparar: clicYDialogo("Restablecer valores por defecto") },
  { ruta: "/admin/registros/RUPE-C2J9RK6Z", archivo: "admin-registro-detalle-restaurado" }, // deshabilitado y restaurado (27 y 28 sep): su historial coincide con la bitácora
  { ruta: "/admin/bitacora", archivo: "admin-bitacora" },
  { ruta: "/admin/bitacora?pagina=2", archivo: "admin-bitacora-pagina-2", anchos: M },
  { ruta: "/admin/bitacora?tipo=modificar%20par%C3%A1metro&desde=2026-10-17&hasta=2026-10-18", archivo: "admin-bitacora-sin-resultados" },
);
// Prototipo P1 · Acceso. Estados REALES del servidor (no variantes de la URL): cada captura rellena el formulario y lo envía. Tutor y Administrador entran con
// las cuentas ficticias de .env.local. Los datos se reinician al terminar (bloqueos, aviso de la versión 2.0, sesiones).
const CORREO_SIN_CUENTA_CON_CREDENCIAL = USUARIOS_INICIALES.find((u) => u.id === 6)!.correo; // cuenta del seed sin contraseña: sirve para bloquear sin tocar las reales
const llenarAcceso = async (p: Page, correo: string, contrasena: string) => {
  await p.getByLabel("Correo electrónico").fill(correo);
  await p.getByLabel(/^Contraseña/).fill(contrasena);
  await p.getByRole("button", { name: "Iniciar sesión" }).click();
};
const llenarRegistro = async (p: Page, { correo, aceptar }: { correo: string; aceptar: boolean }) => {
  await p.getByLabel(/^Nombre completo/).fill("Persona de Prueba Ficticia");
  await p.getByLabel(/^Correo electrónico/).fill(correo);
  await p.getByLabel(/^Contraseña/).fill("Clave2026Segura");
  await p.getByLabel(/^Teléfono de contacto/).fill("5512345678");
  if (aceptar) await p.locator("label", { hasText: "He leído y acepto el" }).click({ position: { x: 4, y: 10 } }); // la casilla es un control propio: se marca desde su etiqueta
  await p.getByRole("button", { name: "Registrarse" }).click();
};
RUTAS.push(
  { ruta: "/registro", archivo: "registro-errores", rol: null, preparar: (p) => p.getByRole("button", { name: "Registrarse" }).click() },
  { ruta: "/registro", archivo: "registro-aviso-sin-aceptar", rol: null, preparar: (p) => llenarRegistro(p, { correo: "persona.nueva@example.org", aceptar: false }) },
  { ruta: "/registro", archivo: "registro-correo-duplicado", rol: null, preparar: async (p) => { await llenarRegistro(p, { correo: credencial("tutor1").correo, aceptar: true }); await p.getByText("Ese correo ya está registrado: inicia sesión o usa otro.").waitFor(); } },
  { ruta: "/acceso", archivo: "acceso-credenciales-invalidas", rol: null, preparar: async (p) => { await llenarAcceso(p, "persona.inexistente@example.org", "Incorrecta123"); await p.getByText("El correo o la contraseña no son correctos.").waitFor(); } },
  { ruta: "/acceso", archivo: "acceso-bloqueada", rol: null, preparar: async (p) => { for (let i = 0; i < 5; i++) { await llenarAcceso(p, CORREO_SIN_CUENTA_CON_CREDENCIAL, "Incorrecta123"); await p.waitForTimeout(400); if (await p.getByRole("dialog").isVisible()) break; } await p.getByRole("dialog", { name: "Acceso bloqueado temporalmente" }).waitFor(); } },
  { ruta: "/admin", archivo: "acceso-denegado", rol: "tutor1" },
  { ruta: "/tutor", archivo: "tutor-identidad-luis", rol: "tutor2" },
  { ruta: "/tutor", archivo: "tutor-mis-registros-luis", rol: "tutor2" },
);
// Prototipo P2 · Registrar extravío. Estados REALES: el flujo se completa por la interfaz (la imagen se dibuja en el navegador, se reduce y se guarda en el servidor).
// Cada captura se rehace en un servidor propio y los datos se reinician al terminar.
RUTAS.push(
  { ruta: "/tutor/registrar", archivo: "tutor-registro-creado-real", rol: "tutor1", preparar: async (p) => { await registrarPorLaInterfaz(p); await p.getByRole("button", { name: /Vista previa del correo/ }).click(); } },
  { ruta: "/tutor/registrar", archivo: "tutor-registrar-foto-ilegible", rol: "tutor1", preparar: async (p) => { await p.locator(ENTRADA_FOTO).setInputFiles({ name: "corrupta.png", mimeType: "image/png", buffer: Buffer.from("esto no es un PNG, solo lo parece por su extensión") }); await p.getByText("No pudimos leer esta imagen").waitFor(); } },
  { ruta: "/tutor/registrar", archivo: "tutor-registrar-sesion-expirada", rol: "tutor1", anchos: [390], ventana: true, preparar: async (p) => { await capturarRegistroCompleto(p); const c = credencial("tutor1"); /* una sesión PROPIA de esta captura (la compartida de las demás no se cierra) */ await p.evaluate(async ([correo, contrasena]) => { await fetch("/api/acceso/iniciar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo, contrasena }) }); await fetch("/api/acceso/cerrar", { method: "POST", redirect: "manual" }); }, [c.correo, c.contrasena]); await botonContinuar(p).click(); await p.getByRole("dialog", { name: "Tu sesión expiró" }).waitFor(); } },
  { ruta: "/tutor/registrar", archivo: "tutor-caso-nuevo-detalle", rol: "tutor1", preparar: async (p, { base }) => { const folio = await registrarPorLaInterfaz(p); await p.goto(`${base}/tutor/casos/${folio}`, { waitUntil: "load" }); await p.getByRole("heading", { level: 1, name: folio }).waitFor(); } },
  { ruta: "/tutor/registrar", archivo: "tutor-caso-nuevo-ficha", rol: "tutor1", preparar: async (p, { base }) => { const folio = await registrarPorLaInterfaz(p); await p.goto(`${base}/tutor/casos/${folio}/ficha`, { waitUntil: "load" }); await p.getByRole("heading", { level: 1 }).first().waitFor(); } },
  { ruta: "/tutor/registrar", archivo: "tutor-mis-registros-nuevo", rol: "tutor1", preparar: async (p, { base }) => { await registrarPorLaInterfaz(p); await p.goto(`${base}/tutor`, { waitUntil: "load" }); await p.getByRole("heading", { level: 1 }).first().waitFor(); } },
);
// P2c · portada real por tema y fotos reales de los casos sembrados. El parámetro ?vista= / ?fotos= no cambia nada (solo da un prefijo propio para capturar con --rutas, sin tocar las demás capturas).
// Requieren las imágenes generadas con `npm run preparar-fotos` (y `-- --portada`); sin ellas la portada es la ilustración SVG y los casos conservan su marcador.
RUTAS.push(
  { ruta: "/?vista=portada", archivo: "inicio-portada", anchos: [390, 1280], rol: null },
  { ruta: "/tutor?fotos=rosa", archivo: "tutor-mis-registros-fotos", rol: "tutor1" },
  { ruta: "/tutor?fotos=luis", archivo: "tutor-mis-registros-fotos-luis", rol: "tutor2" },
  { ruta: "/tutor/casos/RUPE-K7M4XQ9T?fotos=max", archivo: "tutor-detalle-max-foto", rol: "tutor1" },
  { ruta: "/tutor/casos/RUPE-G8R4TV3K?fotos=duque", archivo: "tutor-detalle-duque-foto", rol: "tutor2" },
  { ruta: "/tutor/casos/RUPE-J2C6PZ9H?fotos=mia", archivo: "tutor-detalle-mia-foto", rol: "tutor2" },
);
// Editar y notificaciones del caso (siguen como PantallaPendiente, igual que en main): un caso sembrado de Rosa (Max) y el caso recién registrado.
RUTAS.push(
  { ruta: "/tutor/casos/RUPE-K7M4XQ9T/editar", archivo: "tutor-editar-max", rol: "tutor1" },
  { ruta: "/tutor/casos/RUPE-K7M4XQ9T/notificaciones", archivo: "tutor-notificaciones-max", rol: "tutor1" },
  { ruta: "/tutor/registrar", archivo: "tutor-editar-caso-nuevo", rol: "tutor1", preparar: async (p, { base }) => { const folio = await registrarPorLaInterfaz(p); await p.goto(`${base}/tutor/casos/${folio}/editar`, { waitUntil: "load" }); await p.getByRole("heading", { level: 1 }).first().waitFor(); } },
  { ruta: "/tutor/registrar", archivo: "tutor-notificaciones-caso-nuevo", rol: "tutor1", preparar: async (p, { base }) => { const folio = await registrarPorLaInterfaz(p); await p.goto(`${base}/tutor/casos/${folio}/notificaciones`, { waitUntil: "load" }); await p.getByRole("heading", { level: 1 }).first().waitFor(); } },
);
// P3 · ficha de búsqueda con QR y PDF reales. Los renders del PDF como página completa salen de `npm run verificar-pdf -- --imagenes=capturas` (p3-pdf-<hoja>-<caso>.png).
RUTAS.push(
  { ruta: `${CASO}/ficha`, archivo: "tutor-ficha-vista-previa-real", rol: "tutor1" },
  { ruta: `${CASO}/ficha`, archivo: "tutor-ficha-qr-regenerado", rol: "tutor1", anchos: M, preparar: async (p) => { await p.getByRole("button", { name: "Regenerar QR" }).click(); const d = p.getByRole("dialog", { name: "Regenerar código QR" }); await d.getByRole("button", { name: "Regenerar QR" }).click(); await p.getByRole("status").getByText(/Código QR regenerado el/).waitFor(); } },
  { ruta: "/tutor/casos/RUPE-B6R2TZ7C/ficha", archivo: "tutor-ficha-localizado-bloqueada", rol: "tutor1" },
  // El visor a 1280×844: la hoja completa (QR, folio y pie) sin desplazarse.
  { ruta: `${CASO}/ficha?modal=visor&hoja=carta`, archivo: "tutor-ficha-visor-1280-carta", anchos: [1280], ventana: true },
  { ruta: `${CASO}/ficha?modal=visor&hoja=media-carta`, archivo: "tutor-ficha-visor-1280-media-carta", anchos: [1280], ventana: true },
);
/** Cambia la versión vigente del aviso por la ruta REAL del Administrador (P6b: ya no existe /api/dev/parametro); queda su entrada en la bitácora. */
async function cambiarVersionDelAviso(base: string, valor: string): Promise<void> {
  const r = await fetchComo(base, "admin", "/api/admin/parametros", { method: "PUT", headers: { "Content-Type": "application/json", Origin: new URL(base).origin }, body: JSON.stringify({ version_aviso_privacidad: valor }) });
  if (!r.ok) throw new Error(`No se pudo cambiar la versión del aviso: HTTP ${r.status}`);
}
// SIEMPRE la última: fija la versión del aviso en 2.0, y lo que se capture después ya no sería comparable (los datos se reinician al terminar la corrida).
RUTAS.push(
  // Cambia la versión vigente del aviso a 2.0 y entra con una cuenta real, que debe reaceptarlo (409 real del servidor, TRA-03).
  { ruta: "/acceso", archivo: "acceso-reaceptacion-aviso", rol: null, preparar: async (p, { base }) => { await cambiarVersionDelAviso(base, "2.0"); const c = credencial("tutor1"); await llenarAcceso(p, c.correo, c.contrasena); await p.getByRole("dialog", { name: /Aviso de privacidad actualizado v2\.0/ }).waitFor(); } },
);

export const ANCHOS = [390, 1280];
export const TEMAS = ["claro", "oscuro"] as const; // se aplican como data-theme light | dark
export const ALTO_VENTANA = 900;
export const ALTO_TELEFONO = 844; // ventana de un teléfono (capturas con modal)
export const PUERTO = 3100;
