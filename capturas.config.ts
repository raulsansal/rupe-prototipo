// Configuración del script `npm run capturas`.
// Una ruta sin `secciones` se captura completa; con `secciones`, cada [data-seccion="..."] por separado.
export const RUTAS: { ruta: string; secciones?: string[] }[] = [
  { ruta: "/dev/fundaciones" },
  { ruta: "/dev/componentes", secciones: ["botones", "chips", "formularios", "navegacion", "retroalimentacion"] },
];
export const ANCHOS = [390, 1280];
export const TEMAS = ["claro", "oscuro"] as const; // se aplican como data-theme light | dark
export const ALTO_VENTANA = 900;
export const PUERTO = 3100;
