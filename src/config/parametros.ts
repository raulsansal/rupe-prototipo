// Configuración de los parámetros del sistema (HU 054). Sin datos del almacén: solo reglas y límites; los valores viven en tbl_parametro_sistema.

/** Límite técnico de carga del servidor (R11, HU 054 regla 5): ningún parámetro ni validación puede pasar de aquí. ÚNICA definición. */
export const LIMITE_TECNICO_MB = 4.5;
export const LONGITUD_VERSION = 20;
/** Formato simple de versión: números separados por punto, como 1.0 o 2.1. */
export const PATRON_VERSION = /^\d+(\.\d+)*$/;

export const CLAVES_PARAMETRO = ["version_aviso_privacidad", "expiracion_token_minutos", "tamano_maximo_archivo_mb"] as const;
export type ClaveParametro = (typeof CLAVES_PARAMETRO)[number];
