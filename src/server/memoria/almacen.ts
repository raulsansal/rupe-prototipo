import "server-only";
// Almacén EN MEMORIA del Prototipo (datos ficticios). Vive en el servidor, en un singleton sobre globalThis para que sobreviva a las
// recargas en caliente de desarrollo. LIMITACIÓN: se pierde al reiniciar el servidor y, en producción con varias instancias, cada una
// tiene su propia copia. Se sustituirá por MySQL detrás de las mismas interfaces de repos/.
import type * as T from "../tipos";
import { sembrar } from "../seed/seed";

export type Almacen = {
  usuarios: T.Usuario[]; sesiones: T.Sesion[]; fotografias: T.Fotografia[]; perros: T.Perro[]; casos: T.CasoExtravio[];
  historial: T.MovimientoDeHistorial[]; qr: T.CodigoQr[]; avistamientos: T.Avistamiento[]; avistamientoEstados: T.AvistamientoEstadoAnimal[];
  notificaciones: T.Notificacion[]; bitacora: T.AccionBitacoraReg[];
  alcaldias: T.Alcaldia[]; razas: T.Raza[]; categoriasMotivo: T.CategoriaMotivo[]; motivos: T.Motivo[];
  categoriasEstadoAnimal: T.CategoriaEstadoAnimal[]; estadosAnimal: T.EstadoAnimal[]; estadosCaso: T.EstadoCasoCat[]; parametros: T.ParametroSistema[];
  /** Último id entregado por tabla (equivale al AUTO_INCREMENT). */
  ids: Record<string, number>;
};

export const almacenVacio = (): Almacen => ({
  usuarios: [], sesiones: [], fotografias: [], perros: [], casos: [], historial: [], qr: [], avistamientos: [], avistamientoEstados: [], notificaciones: [], bitacora: [],
  alcaldias: [], razas: [], categoriasMotivo: [], motivos: [], categoriasEstadoAnimal: [], estadosAnimal: [], estadosCaso: [], parametros: [], ids: {},
});

/** Siguiente id de una tabla. */
export const siguienteId = (a: Almacen, tabla: string) => (a.ids[tabla] = (a.ids[tabla] ?? 0) + 1);

const LLAVE = "__RUPE_ALMACEN__";
type ConAlmacen = typeof globalThis & { [LLAVE]?: Almacen };

/** El almacén vigente (se siembra la primera vez). */
export function obtenerAlmacen(): Almacen {
  const g = globalThis as ConAlmacen;
  return (g[LLAVE] ??= sembrar(almacenVacio()));
}

/** Descarta todo lo hecho y vuelve a los datos ficticios iniciales. */
export function reiniciarAlmacen(): Almacen {
  const g = globalThis as ConAlmacen;
  return (g[LLAVE] = sembrar(almacenVacio()));
}
