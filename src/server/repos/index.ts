// Interfaces de repositorio por entidad. Todas son asíncronas para poder sustituir la implementación en memoria por MySQL sin tocar
// servicios, pantallas ni rutas. Las operaciones compuestas del diccionario (R4, R6, R7, R24, R35) se expresan como UN método de repositorio.
import type * as T from "../tipos";
import type { EstadoCaso } from "../../mocks/tipos";
import type { Actor } from "../dominio/transiciones";
import type { TipoCatalogo } from "../../config/catalogos";
import type { FilaCatalogo } from "../dominio/catalogos";
import type { CambioDeParametro } from "../dominio/parametros";
import type { DatosEstadisticos } from "../dominio/capaReal";

export interface RepoUsuarios {
  porId(id: number): Promise<T.Usuario | undefined>;
  porCorreo(correo: string): Promise<T.Usuario | undefined>;
  todos(): Promise<T.Usuario[]>;
  guardar(u: T.Usuario): Promise<void>;
  /** P6a (HU 008): cambia solo el estatus (1 activo, 0 deshabilitado) y la fecha de última modificación. Las reglas (último administrador, sesiones, bitácora) viven en `administracion`. */
  cambiarEstatus(idUsuario: number, estatus: 0 | 1, fecha: string): Promise<void>;
  /** P6a (HU 009): cambia solo el rol y la fecha de última modificación. */
  cambiarRol(idUsuario: number, rol: T.Rol, fecha: string): Promise<void>;
  /** R5: el alta del usuario y su primera aceptación del aviso son UNA operación (si algo falla no se guarda nada). */
  crearConAceptacion(u: Omit<T.Usuario, "idUsuario">, versionAviso: string, fechaHora: string): Promise<T.Usuario>;
}
export interface RepoAceptaciones {
  /** R22: la de mayor fecha_hora, con desempate por id. */
  ultimaDe(idUsuario: number): Promise<T.AceptacionAviso | undefined>;
  agregar(a: Omit<T.AceptacionAviso, "idAceptacionAviso">): Promise<T.AceptacionAviso>;
  deUsuario(idUsuario: number): Promise<T.AceptacionAviso[]>;
}
export interface RepoIntentos {
  de(correo: string): Promise<T.IntentosAnonimos>;
  guardar(correo: string, estado: T.IntentosAnonimos): Promise<void>;
  limpiar(correo: string): Promise<void>;
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
  /**
   * R6: alta del caso con su perro, fotografía (y sus bytes), QR inicial y los movimientos «registro» y «ficha generada», en UNA transacción: o queda todo o no queda nada.
   * Lanza `ConflictoDeUnicidad` si el folio o el token del QR ya existen (el servicio reintenta con otro).
   */
  crearConPerro(datos: { fotografia: Omit<T.Fotografia, "idFotografia">; contenidoFotografia?: { tipo: string; bytes: Uint8Array }; perro: Omit<T.Perro, "idPerro" | "idFotografia">; caso: Omit<T.CasoExtravio, "idCasoExtravio" | "idPerro" | "idEstadoCaso">; qr: Omit<T.CodigoQr, "idCodigoQr" | "idCasoExtravio">; movimientos: Omit<T.MovimientoDeHistorial, "idCasoExtravio" | "consecutivo">[] }): Promise<T.CasoExtravio>;
  /** Bytes y tipo de una fotografía subida (undefined si es una sembrada que apunta a /mocks). */
  contenidoDeFotografia(idFotografia: number): Promise<{ tipo: string; bytes: Uint8Array } | undefined>;
  /** Id de la persona usuaria dueña de la fotografía (la del perro o la de un avistamiento de su caso). */
  duenoDeFotografia(idFotografia: number): Promise<number | undefined>;
  /** Solo cambia el estado del caso: `fecha` se conserva en la firma, pero `fechaUltimaModificacion` es la fecha de EDICIÓN (HU 014) y no se mueve. */
  actualizarEstado(idCaso: number, idEstadoCaso: number, fecha: string): Promise<void>;
}
export interface RepoHistorial {
  deCaso(idCaso: number): Promise<T.MovimientoDeHistorial[]>;
  /** R4: consecutivo = máximo + 1 por caso, asignado dentro del repositorio. Solo inserta (nunca actualiza ni borra). */
  agregar(m: Omit<T.MovimientoDeHistorial, "consecutivo">): Promise<T.MovimientoDeHistorial>;
  /**
   * P5, R12: UN movimiento válido del caso en una sola operación atómica: lee el historial, valida la transición con la matriz (409 si no vale, 422 sin motivo), agrega el movimiento y
   * actualiza el estado del caso. Dos peticiones simultáneas no pueden intercalarse: la segunda ve el estado nuevo y falla con 409 sin duplicar nada. `motivo` ya viene saneado.
   */
  registrar(idCaso: number, m: EntradaDeMovimiento): Promise<{ movimiento: T.MovimientoDeHistorial; estado: EstadoCaso }>;
}
export type EntradaDeMovimiento = { tipo: T.TipoMovimiento; actor: Actor; motivo?: string; idUsuario: number | null; fechaHora: string };
export interface RepoQr {
  activoDe(idCaso: number): Promise<T.CodigoQr | undefined>;
  porToken(token: string): Promise<T.CodigoQr | undefined>;
  deCaso(idCaso: number): Promise<T.CodigoQr[]>;
  /** R7: invalida el activo y crea el nuevo de una sola vez. */
  regenerar(idCaso: number, tokenNuevo: string, fecha: string): Promise<T.CodigoQr>;
}
/** Todo lo que se guarda al confirmar un avistamiento (HU 035), en una sola operación atómica. */
export type AltaDeAvistamiento = {
  avistamiento: Omit<T.Avistamiento, "idAvistamiento" | "idFotografia">;
  fotografia: Omit<T.Fotografia, "idFotografia">;
  contenidoFotografia: { tipo: string; bytes: Uint8Array };
  estados: number[];
  /** Movimiento de historial y estado nuevo del caso; ausente si el caso ya está en «Avistamiento reportado» (no se duplica). */
  movimiento?: { fechaHora: string; tipoMovimiento: T.MovimientoDeHistorial["tipoMovimiento"]; idEstadoCaso: number };
  /** Registro de la notificación simulada (sin id de avistamiento: lo asigna el repositorio); ausente si la persona tutora no recibe avisos (R25). */
  notificacion?: Omit<T.Notificacion, "idNotificacion" | "idAvistamiento">;
};
export interface RepoAvistamientos {
  porId(id: number): Promise<T.Avistamiento | undefined>;
  deCaso(idCaso: number): Promise<T.Avistamiento[]>;
  todos(): Promise<T.Avistamiento[]>;
  estadosDe(idAvistamiento: number): Promise<number[]>;
  /** R35: avistamiento, fotografía y estados del animal en una sola operación (la notificación va aparte). */
  crear(a: Omit<T.Avistamiento, "idAvistamiento" | "idFotografia">, fotografia: Omit<T.Fotografia, "idFotografia">, estados: number[]): Promise<T.Avistamiento>;
  moderar(id: number, visible: boolean, motivo?: string): Promise<void>;
  /**
   * P5, HU 040: marca el avistamiento como visto por la persona tutora y, si era NUEVO y el caso está en «Avistamiento reportado», registra «avistamiento revisado» (→ En seguimiento), todo
   * en UNA transacción. `cambio` es false si ya estaba visto (no se duplica nada).
   */
  marcarVisto(idAvistamiento: number, fechaHora: string): Promise<{ cambio: boolean; movimiento?: T.MovimientoDeHistorial; estado: EstadoCaso }>;
  /** P5, HU 040: marca o desmarca «relevante» (idempotente). */
  marcarRelevante(idAvistamiento: number, relevante: boolean): Promise<void>;
  /** HU 035: fotografía (con sus bytes), avistamiento, estados del animal, movimiento y estado del caso, y notificación en UNA transacción: si algo falla no queda nada. */
  registrarCompleto(alta: AltaDeAvistamiento): Promise<{ avistamiento: T.Avistamiento; notificacion?: T.Notificacion }>;
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
  /** Solo lectura: se modifican con `RepoAdministracion.modificarParametros` / `restablecerParametros` (transacción + bitácora, R24). */
  todos(): Promise<T.ParametroSistema[]>;
  valor(clave: T.ParametroSistema["clave"]): Promise<string>;
}

/** Quién ejecuta la acción administrativa y cuándo; se guarda en la bitácora (R24). */
export type Ejecucion = { idAdministrador: number; fecha: string };
export type ResultadoDeUsuario = { usuario: T.Usuario; sesionesCerradas: number; /** La acción fue sobre la propia cuenta del administrador (se cerró su propia sesión). */ esLaPropiaCuenta: boolean };

/**
 * P6a: acciones del Administrador. Cada método es UNA transacción: el cambio y su entrada de bitácora (R24) se guardan juntos o no se guarda nada, y la bitácora solo admite agregar (R15).
 * Las reglas (R12, R19, R21, motivo obligatorio ≤ 300) se validan DENTRO, para que dos peticiones simultáneas no puedan intercalarse: la segunda ve el estado nuevo y recibe 409.
 */
export interface RepoAdministracion {
  /** HU 018: «deshabilitación» (matriz R12, actor Administrador, motivo obligatorio) + bitácora «deshabilitar caso». 409 si el caso ya no lo permite. */
  deshabilitarCaso(idCaso: number, e: Ejecucion & { motivo: string }): Promise<{ movimiento: T.MovimientoDeHistorial; estado: EstadoCaso; entrada: T.AccionBitacoraReg }>;
  /** HU 018: «restauración» al estado previo a la deshabilitación + bitácora «restaurar caso». 409 si el caso no está cerrado por deshabilitación. */
  restaurarCaso(idCaso: number, e: Ejecucion): Promise<{ movimiento: T.MovimientoDeHistorial; estado: EstadoCaso; entrada: T.AccionBitacoraReg }>;
  /** HU 037: oculta un avistamiento visible (motivo obligatorio) + bitácora «ocultar avistamiento». 409 si ya está oculto. */
  ocultarAvistamiento(idAvistamiento: number, e: Ejecucion & { motivo: string }): Promise<{ entrada: T.AccionBitacoraReg }>;
  /** HU 037: restaura un avistamiento oculto (limpia el motivo, D12) + bitácora «restaurar avistamiento». 409 si ya es visible. */
  restaurarAvistamiento(idAvistamiento: number, e: Ejecucion): Promise<{ entrada: T.AccionBitacoraReg }>;
  /** HU 008: deshabilita la cuenta, cierra todas sus sesiones (R19) y registra «deshabilitar usuario». 409 `ULTIMO_ADMINISTRADOR` (R21), `SIN_CAMBIO` o `CONFIRMACION_REQUERIDA` (cuenta propia sin confirmar). */
  deshabilitarUsuario(idUsuario: number, e: Ejecucion & { confirmarSesionPropia?: boolean }): Promise<ResultadoDeUsuario & { entrada: T.AccionBitacoraReg }>;
  /** HU 008: habilita la cuenta y registra «habilitar usuario». */
  habilitarUsuario(idUsuario: number, e: Ejecucion): Promise<ResultadoDeUsuario & { entrada: T.AccionBitacoraReg }>;
  /** HU 009: cambia el rol (Administrador o Tutor), cierra las sesiones de esa cuenta (R19: el rol se lee del almacén en cada petición, y así también cambia la sesión) y registra «cambiar rol» con «anterior → nuevo». */
  cambiarRolDeUsuario(idUsuario: number, rol: T.Rol, e: Ejecucion & { confirmarSesionPropia?: boolean }): Promise<ResultadoDeUsuario & { rolAnterior: T.Rol; entrada: T.AccionBitacoraReg }>;

  // ---- P6b: catálogos (HU 049-052) y parámetros (HU 054). Reciben la entrada SIN validar: el formato (422), la unicidad, los protegidos y «la última opción activa» (409) se comprueban DENTRO de la
  // transacción, sobre las filas vigentes, junto con la entrada de bitácora (R24). ----
  /** Alta (siempre activa) + bitácora «alta de catálogo» con el nombre. 422 formato; 409 `NOMBRE_DUPLICADO` / `CLAVE_DUPLICADA`. */
  altaCatalogo(tipo: TipoCatalogo, entrada: unknown, e: Ejecucion): Promise<{ fila: FilaCatalogo; entrada: T.AccionBitacoraReg }>;
  /** Edición (reactivar = editar con `activo:true`) + bitácora «edición de catálogo» con «anterior → nuevo». Sin cambios no escribe nada (`sinCambios`, sin entrada). 404 si no existe. */
  editarCatalogo(tipo: TipoCatalogo, id: number, entrada: unknown, e: Ejecucion): Promise<{ fila: FilaCatalogo; sinCambios: boolean; reactivado: boolean; entrada?: T.AccionBitacoraReg }>;
  /** Desactivación + bitácora «desactivación de catálogo». 409 `VALOR_PROTEGIDO`, `ULTIMA_ACTIVA_DE_CATEGORIA`, `ULTIMA_ALCALDIA_ACTIVA` (extensión) o `YA_DESACTIVADO`. */
  desactivarCatalogo(tipo: TipoCatalogo, id: number, e: Ejecucion): Promise<{ fila: FilaCatalogo; entrada: T.AccionBitacoraReg }>;
  /** Modifica uno o más parámetros en UNA transacción, con una entrada «modificar parámetro» por cada parámetro que cambió (valor anterior → nuevo). Si ninguno cambia, no escribe nada. */
  modificarParametros(entrada: unknown, e: Ejecucion): Promise<{ parametros: T.ParametroSistema[]; cambios: CambioDeParametro[]; entradas: T.AccionBitacoraReg[] }>;
  /** «Restablecer valores por defecto»: copia `valorPorDefecto` a `valor`, con una entrada por parámetro que cambió. */
  restablecerParametros(e: Ejecucion): Promise<{ parametros: T.ParametroSistema[]; cambios: CambioDeParametro[]; entradas: T.AccionBitacoraReg[] }>;
}

/**
 * P6c: lectura para el tablero (HU 055) y los reportes (HU 056). UN solo método y UNA pasada síncrona: base histórica, casos y avistamientos nuevos con su historial, y catálogos vigentes son de un mismo instante
 * (con MySQL será un procedimiento almacenado de solo lectura). La proyección NO incluye datos de la persona tutora, folios, direcciones ni referencias. `base` se entrega sin copiar porque está congelada.
 */
export interface RepoEstadisticas {
  leer(): Promise<DatosEstadisticos>;
}

export type Repositorios = {
  usuarios: RepoUsuarios; aceptaciones: RepoAceptaciones; intentos: RepoIntentos; sesiones: RepoSesiones; casos: RepoCasos; historial: RepoHistorial; qr: RepoQr;
  avistamientos: RepoAvistamientos; notificaciones: RepoNotificaciones; bitacora: RepoBitacora; catalogos: RepoCatalogos; parametros: RepoParametros; administracion: RepoAdministracion; estadisticas: RepoEstadisticas;
};
