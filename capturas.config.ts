import { FOLIO_EN_CURSO, FOLIO_INEXISTENTE } from "./src/mocks/casos";

// Configuración del script `npm run capturas`.
// Una ruta sin `secciones` se captura completa; con `secciones`, cada [data-seccion="..."] por separado.
// `anchos` sustituye a ANCHOS para esa entrada; `archivo` fija el nombre base (por defecto, la ruta sin parámetros).
export type Captura = { ruta: string; secciones?: string[]; anchos?: number[]; archivo?: string };

export const RUTAS: Captura[] = [
  { ruta: "/dev/fundaciones" },
  { ruta: "/dev/componentes", secciones: ["botones", "chips", "formularios", "navegacion", "retroalimentacion"] },
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
  { ruta: `/ficha/${FOLIO_INEXISTENTE}`, archivo: "ficha-c-folio-inexistente", anchos: M },
  { ruta: `${AVISTAMIENTO}?paso=1`, archivo: "avistamiento-paso-1" },
  { ruta: `${AVISTAMIENTO}?paso=2`, archivo: "avistamiento-paso-2", anchos: M },
  { ruta: `${AVISTAMIENTO}?paso=3`, archivo: "avistamiento-paso-3", anchos: M },
  { ruta: `${AVISTAMIENTO}?paso=4`, archivo: "avistamiento-paso-4" },
  { ruta: `${AVISTAMIENTO}?paso=5&datos=ejemplo`, archivo: "avistamiento-paso-5", anchos: M },
  { ruta: `${AVISTAMIENTO}?paso=6&datos=ejemplo`, archivo: "avistamiento-paso-6", anchos: M },
  ...["direccion", "mapa", "gps", "denegado"].map((u): Captura => ({ ruta: `${AVISTAMIENTO}?ubicacion=${u}`, archivo: `avistamiento-ubicacion-${u}`, anchos: M })),
  ...["vacio", "combinadas", "fallecido"].map((c): Captura => ({ ruta: `${AVISTAMIENTO}?caso=${c}`, archivo: `avistamiento-estado-animal-${c}`, anchos: M })),
  { ruta: "/ruta-que-no-existe", archivo: "tra-01-no-encontrada" },
  { ruta: "/dev/transversales/error", archivo: "tra-04-error" },
);
export const ANCHOS = [390, 1280];
export const TEMAS = ["claro", "oscuro"] as const; // se aplican como data-theme light | dark
export const ALTO_VENTANA = 900;
export const PUERTO = 3100;
