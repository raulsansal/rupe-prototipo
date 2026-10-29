import type { Almacen } from "./almacen";

const ARREGLOS = ["usuarios", "aceptaciones", "sesiones", "fotografias", "perros", "casos", "historial", "qr", "avistamientos", "avistamientoEstados", "notificaciones", "bitacora"] as const;

/**
 * Transacción del almacén en memoria: si `fn` lanza, todo lo que alcanzó a agregar se deshace (filas, contadores de id y bytes de fotografías), así que no quedan
 * perros, fotos ni QR huérfanos. Casi todas las operaciones del almacén solo AGREGAN filas, por eso basta recortar los arreglos a su largo anterior; la excepción es la
 * regeneración del QR (R7), que además MUTA `fechaInvalidacion` de la fila vigente, y el alta de un avistamiento, que cambia el estado del caso: las filas de `qr` y de `casos`
 * se restauran también. `fn` es síncrona: en un
 * solo proceso, la comprobación de unicidad y la inserción son atómicas (con MySQL serán UNIQUE y su error de duplicado).
 */
export function transaccion<T>(a: Almacen, fn: () => T): T {
  const largos = ARREGLOS.map((k) => a[k].length);
  const ids = { ...a.ids };
  const fotos = new Set(Object.keys(a.contenidosFoto));
  const qrAntes = a.qr.map((q) => ({ ...q }));
  const casosAntes = a.casos.map((c) => ({ ...c }));
  const avistamientosAntes = a.avistamientos.map((v) => ({ ...v }));
  try {
    return fn();
  } catch (e) {
    ARREGLOS.forEach((k, i) => {
      (a[k] as unknown[]).length = largos[i];
    });
    a.ids = ids;
    qrAntes.forEach((q, i) => Object.assign(a.qr[i], q));
    casosAntes.forEach((c, i) => Object.assign(a.casos[i], c));
    // Las filas de avistamientos que existían se restauran COMPLETAS (también se quitan las marcas que se hubieran agregado: «visto», «relevante», `visible`).
    avistamientosAntes.forEach((v, i) => {
      for (const k of Object.keys(a.avistamientos[i])) delete (a.avistamientos[i] as Record<string, unknown>)[k];
      Object.assign(a.avistamientos[i], v);
    });
    for (const k of Object.keys(a.contenidosFoto)) if (!fotos.has(k)) delete a.contenidosFoto[Number(k)];
    throw e;
  }
}
