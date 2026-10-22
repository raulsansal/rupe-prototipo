/**
 * Parámetros del sistema (tbl_parametro_sistema del diccionario), con las claves del diccionario.
 * Aquí se centralizan los valores que las pantallas leen; en el Prototipo saldrán de la base de datos.
 */
export const PARAMETROS = {
  /** Versión vigente del aviso de privacidad (R22). Valor inicial del diccionario; en pantalla se muestra con prefijo «v» (`etiquetaVersionAviso`). */
  version_aviso_privacidad: "1.0",
  /** Minutos de vigencia del token de recuperación de contraseña (R20). */
  expiracion_token_minutos: 60,
  /** Tamaño máximo de archivo permitido, en MB (R11). */
  tamano_maximo_archivo_mb: 4,
} as const;


/** «v1.0»: cómo se muestra la versión del aviso en pantalla. */
export const etiquetaVersionAviso = () => `v${PARAMETROS.version_aviso_privacidad}`;

/** Base de la dirección pública (en el Prototipo vendrá de la configuración del despliegue). Dominio de ejemplo, como en la lámina 4.11. */
export const URL_BASE_PUBLICA = "https://rupe.example";
export const DOMINIO_PUBLICO = "rupe.example";
