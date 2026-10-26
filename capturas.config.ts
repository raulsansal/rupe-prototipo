import type { Page } from "playwright";
import { credencial, fijarVersionAviso } from "./scripts/sesion-pruebas";
import { USUARIOS_INICIALES } from "./src/mocks/usuarios";
import { FOLIO_CON_AVISTAMIENTOS, FOLIO_UN_AVISTAMIENTO } from "./src/mocks/avistamientos";
import { FOLIO_EN_CURSO } from "./src/mocks/casos";
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
const M = [390]; // solo móvil: variantes de pantalla

// Bloque 3 · Visitante y transversales. A 1280 px solo PUB-01, PUB-03 (A), PUB-05 (paso 1 y 4) y las transversales.
RUTAS.push(
  { ruta: "/" },
  { ruta: `${FICHA}?estado=en-curso`, archivo: "ficha-a-en-curso" },
  { ruta: `${FICHA}?estado=localizado`, archivo: "ficha-b-localizado", anchos: M },
  { ruta: `${FICHA}?estado=no-disponible`, archivo: "ficha-c-no-disponible", anchos: M },
  { ruta: `${AVISTAMIENTO}/enviado`, archivo: "avistamiento-enviado", anchos: M },
  { ruta: `${AVISTAMIENTO}?paso=1`, archivo: "avistamiento-paso-1" },
  { ruta: `${AVISTAMIENTO}?paso=2`, archivo: "avistamiento-paso-2" },
  { ruta: `${AVISTAMIENTO}?paso=2&datos=ejemplo`, archivo: "avistamiento-paso-2-con-foto" },
  { ruta: `${AVISTAMIENTO}?paso=3`, archivo: "avistamiento-paso-3", anchos: M },
  { ruta: `${AVISTAMIENTO}?paso=4`, archivo: "avistamiento-paso-4" },
  { ruta: `${AVISTAMIENTO}?paso=5&datos=ejemplo`, archivo: "avistamiento-paso-5", anchos: M },
  { ruta: `${AVISTAMIENTO}?paso=6&datos=ejemplo`, archivo: "avistamiento-paso-6", anchos: M },
  ...["direccion", "mapa", "gps", "denegado"].map((u): Captura => ({ ruta: `${AVISTAMIENTO}?ubicacion=${u}`, archivo: `avistamiento-ubicacion-${u}`, anchos: M })),
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
  { ruta: `${CASO}?estado=en-curso`, archivo: "tutor-caso-en-curso" },
  { ruta: `${CASO}?estado=localizado`, archivo: "tutor-caso-localizado", anchos: M },
  { ruta: `${CASO}?estado=cerrado`, archivo: "tutor-caso-cerrado", anchos: M },
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
// Bloque 5a · Administrador: tablero (ADM-01) y usuarios (ADM-03 y MOD-10). Los modales se capturan como pantalla de teléfono.
RUTAS.push(
  { ruta: "/admin", archivo: "admin-tablero" },
  { ruta: "/admin?desde=2026-09-01&hasta=2026-09-30", archivo: "admin-tablero-septiembre", anchos: M },
  { ruta: "/admin/usuarios", archivo: "admin-usuarios" },
  { ruta: "/admin/usuarios?modal=rol", archivo: "admin-usuarios-cambiar-rol", anchos: M, ventana: true },
  { ruta: "/admin/usuarios?modal=deshabilitar", archivo: "admin-usuarios-deshabilitar", anchos: M, ventana: true },
  { ruta: "/admin/usuarios?modal=habilitar", archivo: "admin-usuarios-habilitar", anchos: M, ventana: true },
  { ruta: "/admin/usuarios?estado=cargando", archivo: "admin-usuarios-cargando", anchos: M },
  { ruta: "/admin/usuarios?estado=vacio", archivo: "admin-usuarios-vacio", anchos: M },
);
// Bloque 5b · Administrador: moderación de registros (ADM-04, MOD-08 y TUT-05 variante Administrador), de avistamientos (ADM-05 y MOD-09)
// y la plantilla de catálogo (ADM-06 a ADM-09 con MOD-11). Los modales se capturan como pantalla de teléfono.
const REGISTRO = "/admin/registros";
RUTAS.push(
  { ruta: REGISTRO, archivo: "admin-registros" },
  { ruta: `${REGISTRO}?modal=deshabilitar`, archivo: "admin-registros-deshabilitar", anchos: M, ventana: true },
  { ruta: `${REGISTRO}?modal=deshabilitar&error=motivo`, archivo: "admin-registros-deshabilitar-error", anchos: M, ventana: true },
  { ruta: `${REGISTRO}?estado=cargando`, archivo: "admin-registros-cargando", anchos: M },
  { ruta: `${REGISTRO}?estado=vacio`, archivo: "admin-registros-vacio", anchos: M },
  { ruta: `${REGISTRO}/${FOLIO_MODERACION_ACTIVO}`, archivo: "admin-registro-detalle" },
  { ruta: `${REGISTRO}/${FOLIO_MODERACION_ACTIVO}?modal=deshabilitar`, archivo: "admin-registro-detalle-deshabilitar", anchos: M, ventana: true },
  { ruta: `${REGISTRO}/${FOLIO_MODERACION_DESHABILITADO}`, archivo: "admin-registro-detalle-deshabilitado", anchos: M },
  { ruta: `${REGISTRO}/${FOLIO_MODERACION_CANCELADO}`, archivo: "admin-registro-detalle-cancelado", anchos: M },
  { ruta: "/admin/avistamientos", archivo: "admin-avistamientos" },
  { ruta: "/admin/avistamientos?modal=ocultar", archivo: "admin-avistamientos-ocultar", anchos: M, ventana: true },
  { ruta: "/admin/avistamientos?modal=ocultar&error=motivo", archivo: "admin-avistamientos-ocultar-error", anchos: M, ventana: true },
  { ruta: "/admin/avistamientos?modal=detalle", archivo: "admin-avistamientos-detalle", anchos: M, ventana: true },
  { ruta: "/admin/avistamientos?modal=detalle-oculto", archivo: "admin-avistamientos-detalle-oculto", anchos: M, ventana: true },
  { ruta: "/admin/avistamientos?pagina=2", archivo: "admin-avistamientos-fallecido-y-oculto" },
  { ruta: "/admin/avistamientos?modal=detalle-fallecido", archivo: "admin-avistamientos-detalle-fallecido", anchos: M, ventana: true },
  { ruta: "/admin/avistamientos?modal=detalle-fallecido&foto=visible", archivo: "admin-avistamientos-detalle-fallecido-foto", anchos: M, ventana: true },
  { ruta: "/admin/avistamientos?estado=cargando", archivo: "admin-avistamientos-cargando", anchos: M },
  { ruta: "/admin/avistamientos?estado=vacio", archivo: "admin-avistamientos-vacio", anchos: M },
  { ruta: "/admin/alcaldias", archivo: "admin-alcaldias" },
  { ruta: "/admin/alcaldias?modal=nuevo", archivo: "admin-alcaldias-agregar", anchos: M, ventana: true },
  { ruta: "/admin/alcaldias?modal=editar", archivo: "admin-alcaldias-editar", anchos: M, ventana: true },
  { ruta: "/admin/alcaldias?modal=desactivar", archivo: "admin-alcaldias-desactivar", anchos: M, ventana: true },
  { ruta: "/admin/alcaldias?pagina=3", archivo: "admin-alcaldias-protegida" },
  { ruta: "/admin/alcaldias?estado=cargando", archivo: "admin-alcaldias-cargando", anchos: M },
  { ruta: "/admin/razas", archivo: "admin-razas" },
  { ruta: "/admin/razas?modal=editar", archivo: "admin-razas-editar", anchos: M, ventana: true },
  { ruta: "/admin/motivos", archivo: "admin-motivos" },
  { ruta: "/admin/motivos?modal=nuevo", archivo: "admin-motivos-agregar", anchos: M, ventana: true },
  { ruta: "/admin/estados-animal", archivo: "admin-estados-animal" },
  { ruta: "/admin/estados-animal?modal=editar", archivo: "admin-estados-animal-editar", anchos: M, ventana: true },
  { ruta: "/admin/estados-animal?pagina=3", archivo: "admin-estados-animal-bloqueada" },
);
// Bloque 5c · Administrador: reportes, estados del caso, parámetros y bitácora (390 y 1280 px; las variantes, solo 390).
const PERIODO_REPORTE = "desde=2026-10-01&hasta=2026-10-18";
RUTAS.push(
  { ruta: "/admin/reportes", archivo: "admin-reportes" },
  { ruta: "/admin/reportes?generar=1", archivo: "admin-reportes-error-rango", anchos: M },
  { ruta: `/admin/reportes?${PERIODO_REPORTE}`, archivo: "admin-reportes-resultados" },
  { ruta: `/admin/reportes?${PERIODO_REPORTE}&alcaldia=Coyoacán&estadoCaso=Localizado`, archivo: "admin-reportes-filtrado", anchos: M },
  { ruta: "/admin/reportes?estado=vacio", archivo: "admin-reportes-sin-datos" },
  { ruta: "/admin/reportes?estado=cargando", archivo: "admin-reportes-cargando", anchos: M },
  { ruta: "/admin/estados-caso", archivo: "admin-estados-caso" },
  { ruta: "/admin/parametros", archivo: "admin-parametros" },
  { ruta: "/admin/parametros?variante=aviso", archivo: "admin-parametros-aviso" },
  { ruta: "/admin/parametros?variante=errores", archivo: "admin-parametros-errores" },
  { ruta: "/admin/parametros?variante=guardado", archivo: "admin-parametros-guardado" },
  { ruta: "/admin/parametros?modal=restablecer", archivo: "admin-parametros-restablecer", anchos: M, ventana: true },
  { ruta: "/admin/parametros?estado=cargando", archivo: "admin-parametros-cargando", anchos: M },
  { ruta: "/admin/registros/RUPE-C2J9RK6Z", archivo: "admin-registro-detalle-restaurado" }, // deshabilitado y restaurado (27 y 28 sep): su historial coincide con la bitácora
  { ruta: "/admin/bitacora", archivo: "admin-bitacora" },
  { ruta: "/admin/bitacora?pagina=2", archivo: "admin-bitacora-pagina-2", anchos: M },
  { ruta: "/admin/bitacora?estado=vacio", archivo: "admin-bitacora-sin-resultados" },
  { ruta: "/admin/bitacora?estado=cargando", archivo: "admin-bitacora-cargando", anchos: M },
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
  // La última: cambia la versión vigente del aviso a 2.0 y entra con una cuenta real, que debe reaceptarlo (409 real del servidor, TRA-03).
  { ruta: "/acceso", archivo: "acceso-reaceptacion-aviso", rol: null, preparar: async (p, { base }) => { await fijarVersionAviso(base, "2.0"); const c = credencial("tutor1"); await llenarAcceso(p, c.correo, c.contrasena); await p.getByRole("dialog", { name: /Aviso de privacidad actualizado v2\.0/ }).waitFor(); } },
);
export const ANCHOS = [390, 1280];
export const TEMAS = ["claro", "oscuro"] as const; // se aplican como data-theme light | dark
export const ALTO_VENTANA = 900;
export const ALTO_TELEFONO = 844; // ventana de un teléfono (capturas con modal)
export const PUERTO = 3100;
