import type { Almacen } from "./almacen";

/** Tablas a las que una operación puede AGREGAR filas: si falla, se recortan a su largo anterior. */
const ARREGLOS = ["usuarios", "aceptaciones", "sesiones", "fotografias", "perros", "casos", "historial", "qr", "avistamientos", "avistamientoEstados", "notificaciones", "bitacora", "alcaldias", "razas", "motivos", "estadosAnimal"] as const;
/** Tablas cuyas filas EXISTENTES una operación puede cambiar en sitio (rol o estatus de un usuario, cierre de sesiones, parámetros, catálogos, estado de un caso, marcas de un avistamiento…): se restauran completas. */
const FILAS_MUTABLES = ["usuarios", "sesiones", "parametros", "alcaldias", "razas", "motivos", "estadosAnimal", "casos", "qr", "avistamientos"] as const;

/**
 * Transacción del almacén en memoria: si `fn` lanza, todo lo que alcanzó a hacer se deshace: las filas agregadas se recortan, los contadores de id vuelven a su valor y los bytes de fotografías
 * nuevas se descartan, así que no quedan perros, fotos, QR ni entradas de bitácora huérfanos; y las filas EXISTENTES de `FILAS_MUTABLES` se restauran completas (incluidas las claves que la operación
 * hubiera agregado). `fn` es síncrona: en un solo proceso, la comprobación de unicidad y la inserción son atómicas (con MySQL serán UNIQUE y su error de duplicado).
 */
export function transaccion<T>(a: Almacen, fn: () => T): T {
  const largos = ARREGLOS.map((k) => a[k].length);
  const ids = { ...a.ids };
  const fotos = new Set(Object.keys(a.contenidosFoto));
  const antes = FILAS_MUTABLES.map((k) => (a[k] as object[]).map((f) => ({ ...f })));
  try {
    return fn();
  } catch (e) {
    ARREGLOS.forEach((k, i) => {
      (a[k] as unknown[]).length = largos[i];
    });
    a.ids = ids;
    FILAS_MUTABLES.forEach((k, i) => {
      const filas = a[k] as Record<string, unknown>[];
      antes[i].forEach((original, j) => {
        for (const clave of Object.keys(filas[j])) delete filas[j][clave];
        Object.assign(filas[j], original);
      });
    });
    for (const k of Object.keys(a.contenidosFoto)) if (!fotos.has(k)) delete a.contenidosFoto[Number(k)];
    throw e;
  }
}
