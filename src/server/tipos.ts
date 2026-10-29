// Entidades del diccionario de datos (docs/referencia/diccionario-de-datos.docx), en camelCase. Las fechas son ISO 8601 en UTC (E12).
// Las columnas marcadas «R» (reservadas) nunca salen por las funciones públicas: ver serializadores/publico.ts.
import type { MomentoDelDia, Sexo, Tamano, EdadUnidad, TipoMovimiento } from "../mocks/tipos";
import type { Rol } from "../mocks/usuarios";
import type { TipoAccion } from "../mocks/bitacora";

export type { Rol, TipoAccion, TipoMovimiento };

export type Usuario = {
  idUsuario: number; nombreCompleto: string; correo: string;
  /** Solo hash bcrypt; null = la cuenta existe pero no tiene credencial (variables de entorno ausentes). */
  contrasenaHash: string | null;
  telefono: string; estatus: 0 | 1; fechaRegistro: string; fechaUltimaModificacion: string;
  intentosFallidos: number; bloqueadoHasta: string | null; notificacionesActivas: boolean; rol: Rol;
};
/** tbl_aceptacion_aviso: un usuario acumula una aceptación por versión (R5, R22). */
export type AceptacionAviso = { idAceptacionAviso: number; versionAviso: string; fechaHora: string; idUsuario: number };
export type Sesion = { idSesion: number; tokenHash: string; fechaInicio: string; fechaExpiracion: string; fechaCierre: string | null; idUsuario: number };
/** Intentos fallidos de un correo que NO tiene cuenta: el bloqueo (R17) debe verse igual que el de una cuenta real. */
export type IntentosAnonimos = { intentos: number; bloqueadoHasta: string | null };
export type Fotografia = { idFotografia: number; referenciaArchivo: string; formato: "JPG" | "PNG"; tamanoBytes: number; fechaCarga: string };
export type Perro = {
  idPerro: number; nombre: string; sexo: Sexo; edadValor: number; edadUnidad: EdadUnidad; tamano: Tamano; color: string;
  caracteristicasDistintivas?: string; razaEspecificada?: string; idRaza: number; idUsuario: number; idFotografia: number;
};
export type CasoExtravio = {
  idCasoExtravio: number; folio: string; fechaExtravio: string; momentoDelDia: MomentoDelDia; coloniaZona: string;
  direccionAproximada?: string; referenciasDelLugar?: string; descripcionCircunstancias?: string;
  fechaRegistro: string; fechaUltimaModificacion: string; idAlcaldia: number; idMotivo: number; idEstadoCaso: number; idPerro: number;
};
export type CodigoQr = { idCodigoQr: number; idCasoExtravio: number; tokenPublico: string; fechaGeneracion: string; fechaInvalidacion: string | null };
export type MovimientoDeHistorial = { idCasoExtravio: number; consecutivo: number; fechaHora: string; tipoMovimiento: TipoMovimiento; motivo?: string; idEstadoCaso: number; idUsuario: number | null };
export type Avistamiento = {
  idAvistamiento: number; fechaHoraAvistamiento: string; direccionAproximada?: string; coloniaZona?: string; referenciasDelLugar?: string;
  latitud: number; longitud: number; precisionGps?: number; comentario?: string; fechaHoraEnvio: string;
  visible: boolean; motivoModeracion?: string; idAlcaldia: number; idCasoExtravio: number; idFotografia: number;
  /** SOLO DEL PROTOTIPO (sin columna en el diccionario): la latitud y la longitud salen de la alcaldía elegida, no de un mapa. Se retira cuando haya mapa (HU 031). */
  ubicacionSimulada?: boolean;
};
export type AvistamientoEstadoAnimal = { idAvistamiento: number; idEstadoAnimal: number };
export type Notificacion = {
  idNotificacion: number; tipo: "nuevo avistamiento"; canal: "correo"; fechaEnvio: string; estadoEnvio: "enviada" | "fallida"; idAvistamiento: number;
  /** SOLO DEL PROTOTIPO (sin columna): el asunto y el cuerpo que se habrían enviado, para las pruebas. Ninguna ruta lo expone. */
  mensajeSimulado?: { asunto: string; cuerpo: string[] };
};
export type AccionBitacoraReg = { idBitacoraAdmin: number; tipoAccion: TipoAccion; idAfectada: string; motivo?: string; detalle?: string; fechaHora: string; idUsuario: number };

// Catálogos
export type Alcaldia = { idAlcaldia: number; nombre: string; claveGeoestadistica: string | null; estatus: 0 | 1 };
export type Raza = { idRaza: number; nombre: string; estatus: 0 | 1 };
export type CategoriaMotivo = { idCategoriaMotivo: number; nombre: string };
export type Motivo = { idMotivo: number; idCategoriaMotivo: number; nombre: string; descripcion: string; estatus: 0 | 1 };
export type CategoriaEstadoAnimal = { idCategoriaEstadoAnimal: number; nombre: string };
export type EstadoAnimal = { idEstadoAnimal: number; idCategoriaEstadoAnimal: number; nombre: string; descripcion: string; estatus: 0 | 1 };
export type EstadoCasoCat = { idEstadoCaso: number; nombre: string; orden: number };
export type ParametroSistema = { clave: "version_aviso_privacidad" | "expiracion_token_minutos" | "tamano_maximo_archivo_mb"; descripcion: string; valor: string; valorPorDefecto: string };

export const ROL_ADMINISTRADOR = 1;
export const ROL_TUTOR = 2;
