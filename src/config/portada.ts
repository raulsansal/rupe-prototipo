// Configuración de la PORTADA de la página de inicio (componente ImagenPrincipal). Es el único lugar donde se cambian estos valores.
// Las imágenes salen de `npm run preparar-fotos -- --portada` (public/portada/portada-claro.jpg y portada-oscuro.jpg). Al añadir, quitar o cambiar una portada hay que
// RECONSTRUIR (`npm run build`): la página de inicio es estática y fija al construir qué portada usa (si falta alguna de las dos, se conserva la ilustración SVG).

/** Texto alternativo de la portada que leen los lectores de pantalla (una sola vez: la imagen del otro tema está oculta con display:none). */
// PROVISIONAL: texto de trabajo; se sustituye por el texto definitivo cuando la persona responsable del proyecto lo defina.
export const PORTADA_ALT = "Calle empedrada de la Ciudad de México con huellas de perro sobre el pavimento, la Torre Latinoamericana al fondo y un marcador de ubicación en el cielo.";

/** Verdadero mientras `PORTADA_ALT` sea el texto provisional. Es solo un recordatorio para quien edite este archivo; no cambia nada en pantalla. */
export const PORTADA_ALT_ES_PROVISIONAL = true;

/**
 * Qué parte de la imagen queda a la vista cuando se recorta (CSS `object-position`: «horizontal vertical»). La imagen es 4:3 y la portada se muestra en 16:9 (móvil) y
 * 21:8 (escritorio), así que siempre se recorta arriba y abajo. `50% 50%` (centro) privilegia el suelo: el empedrado y las huellas del primer plano, con la torre y el taxi en el horizonte;
 * el signo de ubicación del cielo queda recortado. Más cerca de `0%` sube la ventana (más cielo, torre y signo de ubicación); más cerca de `100%` la baja (más empedrado).
 */
export const PORTADA_OBJECT_POSITION = "50% 50%";

/** Dimensiones reales (px) de los JPEG generados: se declaran en la etiqueta de imagen para que el navegador reserve el espacio sin saltos. Actualízalas si cambian los originales. */
export const PORTADA_ANCHO = 1200;
export const PORTADA_ALTO = 896;

/** Rutas públicas y archivos de cada versión: «claro» y «oscuro» son los dos valores de `data-theme`. */
export const PORTADA_ARCHIVOS = {
  claro: "/portada/portada-claro.jpg",
  oscuro: "/portada/portada-oscuro.jpg",
} as const;

/** Ancho (px) que ocupa la portada en pantallas grandes (contenedor máximo de la página, menos márgenes): ayuda al navegador a elegir el tamaño a descargar. */
export const PORTADA_SIZES = "(min-width: 1280px) 1216px, 100vw";
