import type { Almacen } from "./almacen";

const ARREGLOS = ["usuarios", "aceptaciones", "sesiones", "fotografias", "perros", "casos", "historial", "qr", "avistamientos", "avistamientoEstados", "notificaciones", "bitacora"] as const;

/**
 * Transacción del almacén en memoria: si `fn` lanza, todo lo que alcanzó a agregar se deshace (filas, contadores de id y bytes de fotografías), así que no quedan
 * perros, fotos ni QR huérfanos. Las operaciones del almacén solo AGREGAN filas, por eso basta recortar los arreglos a su largo anterior. `fn` es síncrona: en un
 * solo proceso, la comprobación de unicidad y la inserción son atómicas (con MySQL serán UNIQUE y su error de duplicado).
 */
export function transaccion<T>(a: Almacen, fn: () => T): T {
  const largos = ARREGLOS.map((k) => a[k].length);
  const ids = { ...a.ids };
  const fotos = new Set(Object.keys(a.contenidosFoto));
  try {
    return fn();
  } catch (e) {
    ARREGLOS.forEach((k, i) => {
      (a[k] as unknown[]).length = largos[i];
    });
    a.ids = ids;
    for (const k of Object.keys(a.contenidosFoto)) if (!fotos.has(k)) delete a.contenidosFoto[Number(k)];
    throw e;
  }
}
