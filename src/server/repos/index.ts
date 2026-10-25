// Interfaces de repositorio por entidad. Todas son asíncronas para poder sustituir la implementación en memoria por MySQL sin tocar
// servicios, pantallas ni rutas. Las operaciones compuestas del diccionario (R4, R6, R7, R24, R35) se expresan como UN método de repositorio.
import type * as T from "../tipos";

export interface RepoUsuarios {
  porId(id: number): Promise<T.Usuario | undefined>;
  porCorreo(correo: string): Promise<T.Usuario | undefined>;
  todos(): Promise<T.Usuario[]>;
  guardar(u: T.Usuario): Promise<void>;
}
export interface RepoSesiones {
  crear(s: Omit<T.Sesion, "idSesion">): Promise<T.Sesion>;
  porTokenHash(hash: string): Promise<T.Sesion | undefined>;
  cerrar(idSesion: number, fecha: string): Promise<void>;
  /** R19: cierra todas las sesiones activas del usuario. */
  cerrarTodasDe(idUsuario: number, fecha: string): Promise<number>;
}
export interface RepoCasos {
  porId(id: number): Promise<T.CasoExtravio | undefined>;
  /** R26: el folio se guarda en mayúsculas; el repositorio compara sin distinguir mayúsculas. */
  porFolio(folio: string): Promise<T.CasoExtravio | undefined>;
  todos(): Promise<T.CasoExtravio[]>;
  perro(id: number): Promise<T.Perro | undefined>;
  fotografia(id: number): Promise<T.Fotografia | undefined>;
  /** R6: alta del caso con su perro, fotografía, QR inicial y los movimientos «registro» y «ficha generada», todo junto. */
  crearConPerro(datos: { fotografia: Omit<T.Fotografia, "idFotografia">; perro: Omit<T.Perro, "idPerro" | "idFotografia">; caso: Omit<T.CasoExtravio, "idCasoExtravio" | "idPerro" | "idEstadoCaso">; qr: Omit<T.CodigoQr, "idCodigoQr" | "idCasoExtravio">; movimientos: Omit<T.MovimientoDeHistorial, "idCasoExtravio" | "consecutivo">[] }): Promise<T.CasoExtravio>;
  actualizarEstado(idCaso: number, idEstadoCaso: number, fecha: string): Promise<void>;
}
export interface RepoHistorial {
  deCaso(idCaso: number): Promise<T.MovimientoDeHistorial[]>;
  /** R4: consecutivo = máximo + 1 por caso, asignado dentro del repositorio. Solo inserta (nunca actualiza ni borra). */
  agregar(m: Omit<T.MovimientoDeHistorial, "consecutivo">): Promise<T.MovimientoDeHistorial>;
}
export interface RepoQr {
  activoDe(idCaso: number): Promise<T.CodigoQr | undefined>;
  porToken(token: string): Promise<T.CodigoQr | undefined>;
  deCaso(idCaso: number): Promise<T.CodigoQr[]>;
  /** R7: invalida el activo y crea el nuevo de una sola vez. */
  regenerar(idCaso: number, tokenNuevo: string, fecha: string): Promise<T.CodigoQr>;
}
export interface RepoAvistamientos {
  porId(id: number): Promise<T.Avistamiento | undefined>;
  deCaso(idCaso: number): Promise<T.Avistamiento[]>;
  todos(): Promise<T.Avistamiento[]>;
  estadosDe(idAvistamiento: number): Promise<number[]>;
  /** R35: avistamiento, fotografía y estados del animal en una sola operación (la notificación va aparte). */
  crear(a: Omit<T.Avistamiento, "idAvistamiento" | "idFotografia">, fotografia: Omit<T.Fotografia, "idFotografia">, estados: number[]): Promise<T.Avistamiento>;
  moderar(id: number, visible: boolean, motivo?: string): Promise<void>;
}
export interface RepoNotificaciones {
  crear(n: Omit<T.Notificacion, "idNotificacion">): Promise<T.Notificacion>;
  deAvistamiento(idAvistamiento: number): Promise<T.Notificacion | undefined>;
  todas(): Promise<T.Notificacion[]>;
}
export interface RepoBitacora {
  /** R15: solo insertar y consultar. */
  agregar(a: Omit<T.AccionBitacoraReg, "idBitacoraAdmin">): Promise<T.AccionBitacoraReg>;
  todas(): Promise<T.AccionBitacoraReg[]>;
}
export interface RepoCatalogos {
  alcaldias(): Promise<T.Alcaldia[]>;
  razas(): Promise<T.Raza[]>;
  categoriasMotivo(): Promise<T.CategoriaMotivo[]>;
  motivos(): Promise<T.Motivo[]>;
  categoriasEstadoAnimal(): Promise<T.CategoriaEstadoAnimal[]>;
  estadosAnimal(): Promise<T.EstadoAnimal[]>;
  estadosCaso(): Promise<T.EstadoCasoCat[]>;
}
export interface RepoParametros {
  todos(): Promise<T.ParametroSistema[]>;
  valor(clave: T.ParametroSistema["clave"]): Promise<string>;
  /** Solo se actualiza la columna `valor`. */
  actualizar(clave: T.ParametroSistema["clave"], valor: string): Promise<void>;
}

export type Repositorios = {
  usuarios: RepoUsuarios; sesiones: RepoSesiones; casos: RepoCasos; historial: RepoHistorial; qr: RepoQr;
  avistamientos: RepoAvistamientos; notificaciones: RepoNotificaciones; bitacora: RepoBitacora; catalogos: RepoCatalogos; parametros: RepoParametros;
};
