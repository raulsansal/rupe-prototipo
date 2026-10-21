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
export const ANCHOS = [390, 1280];
export const TEMAS = ["claro", "oscuro"] as const; // se aplican como data-theme light | dark
export const ALTO_VENTANA = 900;
export const PUERTO = 3100;
