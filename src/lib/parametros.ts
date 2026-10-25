// ADM-11 (HU 054): valores por defecto y validación de los tres parámetros del sistema.
export const VALORES_POR_DEFECTO = { version_aviso_privacidad: "1.0", expiracion_token_minutos: "60", tamano_maximo_archivo_mb: "4" } as const;
/** Límite técnico de carga del servidor (regla 5). */
export const LIMITE_TECNICO_MB = 4.5;
export const LONGITUD_VERSION = 20;
/** Formato simple de versión: números separados por punto, como 1.0 o 2.1. */
export const PATRON_VERSION = /^\d+(\.\d+)*$/;

export type ValoresParametros = { version_aviso_privacidad: string; expiracion_token_minutos: string; tamano_maximo_archivo_mb: string };
export type ErroresParametros = Partial<Record<keyof ValoresParametros, string>>;

const numero = (v: string) => (v.trim() === "" ? NaN : Number(v.trim().replace(",", ".")));

/** Regla 2: los valores numéricos deben ser mayores a cero; regla 5: el tamaño no puede superar 4.5 MB. */
export function validarParametros(v: ValoresParametros): ErroresParametros {
  const e: ErroresParametros = {};
  if (!v.version_aviso_privacidad.trim()) e.version_aviso_privacidad = "Escribe la versión vigente del aviso de privacidad.";
  else if (!PATRON_VERSION.test(v.version_aviso_privacidad.trim())) e.version_aviso_privacidad = "Escribe la versión con números separados por punto, como 1.0 o 2.1.";
  else if (v.version_aviso_privacidad.trim().length > LONGITUD_VERSION) e.version_aviso_privacidad = `Usa ${LONGITUD_VERSION} caracteres o menos.`;
  const token = numero(v.expiracion_token_minutos);
  if (!(token > 0) || !Number.isInteger(token)) e.expiracion_token_minutos = "Debe ser un número entero mayor que cero.";
  const mb = numero(v.tamano_maximo_archivo_mb);
  if (!(mb > 0)) e.tamano_maximo_archivo_mb = "Debe ser un número mayor que cero.";
  else if (mb > LIMITE_TECNICO_MB) e.tamano_maximo_archivo_mb = `No puede superar el límite técnico de ${LIMITE_TECNICO_MB} MB.`;
  return e;
}
