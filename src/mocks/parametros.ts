/**
 * Parámetros del sistema (tbl_parametro_sistema del diccionario), con las claves del diccionario.
 * Aquí se centralizan los valores que las pantallas leen; en el Prototipo saldrán de la base de datos.
 */
export const PARAMETROS = {
  /** Versión vigente del aviso de privacidad (R22). Valor ficticio: el diccionario inicia en «1.0»; en los mockups aparece como «[vN]». */
  version_aviso_privacidad: "v1",
  /** Minutos de vigencia del token de recuperación de contraseña (R20). */
  expiracion_token_minutos: 60,
  /** Tamaño máximo de archivo permitido, en MB (R11). */
  tamano_maximo_archivo_mb: 4,
} as const;

