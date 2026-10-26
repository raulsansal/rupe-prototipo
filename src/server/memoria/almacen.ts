import "server-only";
// Almacén EN MEMORIA del Prototipo (datos ficticios). Vive en el servidor, en un singleton sobre globalThis para que sobreviva a las
// recargas en caliente de desarrollo. LIMITACIÓN: se pierde al reiniciar el servidor y, en producción con varias instancias, cada una
// tiene su propia copia. Se sustituirá por MySQL detrás de las mismas interfaces de repos/.
import type * as T from "../tipos";
import { CARPETA_FOTOS_SEMBRADAS } from "../seed/fotosSembradas";
import { sembrar } from "../seed/seed";

export type Almacen = {
  usuarios: T.Usuario[]; aceptaciones: T.AceptacionAviso[]; intentosAnonimos: Record<string, T.IntentosAnonimos>; sesiones: T.Sesion[]; fotografias: T.Fotografia[]; perros: T.Perro[]; casos: T.CasoExtravio[];
  historial: T.MovimientoDeHistorial[]; qr: T.CodigoQr[]; avistamientos: T.Avistamiento[]; avistamientoEstados: T.AvistamientoEstadoAnimal[];
  notificaciones: T.Notificacion[]; bitacora: T.AccionBitacoraReg[];
  alcaldias: T.Alcaldia[]; razas: T.Raza[]; categoriasMotivo: T.CategoriaMotivo[]; motivos: T.Motivo[];
  categoriasEstadoAnimal: T.CategoriaEstadoAnimal[]; estadosAnimal: T.EstadoAnimal[]; estadosCaso: T.EstadoCasoCat[]; parametros: T.ParametroSistema[];
  /** Bytes de las fotografías subidas (en memoria: sin BLOB ni archivos). Las sembradas apuntan a /mocks y no tienen bytes aquí. */
  contenidosFoto: Record<number, { tipo: string; bytes: Uint8Array }>;
  /** Último id entregado por tabla (equivale al AUTO_INCREMENT). */
  ids: Record<string, number>;
};

export const almacenVacio = (): Almacen => ({
  usuarios: [], aceptaciones: [], intentosAnonimos: {}, sesiones: [], fotografias: [], perros: [], casos: [], historial: [], qr: [], avistamientos: [], avistamientoEstados: [], notificaciones: [], bitacora: [],
  alcaldias: [], razas: [], categoriasMotivo: [], motivos: [], categoriasEstadoAnimal: [], estadosAnimal: [], estadosCaso: [], parametros: [], contenidosFoto: {}, ids: {},
});

/** Siguiente id de una tabla. */
export const siguienteId = (a: Almacen, tabla: string) => (a.ids[tabla] = (a.ids[tabla] ?? 0) + 1);

const LLAVE = "__RUPE_ALMACEN__";
type ConAlmacen = typeof globalThis & { [LLAVE]?: Almacen };

/** El almacén vigente (se siembra la primera vez). */
export function obtenerAlmacen(): Almacen {
  const g = globalThis as ConAlmacen;
  return (g[LLAVE] ??= sembrar(almacenVacio(), process.env, { carpetaFotos: CARPETA_FOTOS_SEMBRADAS }));
}

/** Descarta todo lo hecho y vuelve a los datos ficticios iniciales. */
export function reiniciarAlmacen(): Almacen {
  const g = globalThis as ConAlmacen;
  return (g[LLAVE] = sembrar(almacenVacio(), process.env, { carpetaFotos: CARPETA_FOTOS_SEMBRADAS }));
}
