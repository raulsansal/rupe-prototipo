// ADM-11 (HU 054): valores por defecto y validación de los tres parámetros del sistema.
import { CLAVES_PARAMETRO, LIMITE_TECNICO_MB, LONGITUD_VERSION, PATRON_VERSION, type ClaveParametro } from "../config/parametros";

export { LIMITE_TECNICO_MB, LONGITUD_VERSION, PATRON_VERSION };

export type ValoresParametros = { version_aviso_privacidad: string; expiracion_token_minutos: string; tamano_maximo_archivo_mb: string };
export type ErroresParametros = Partial<Record<keyof ValoresParametros, string>>;

const numero = (v: string) => (v.trim() === "" ? NaN : Number(v.trim().replace(",", ".")));

/**
 * Un parámetro: devuelve su valor NORMALIZADO (el que se guarda: «4.0» y «4» son el mismo tamaño, «060» el mismo token) o el mensaje de error.
 * Regla 2: los valores numéricos deben ser mayores a cero (el token, además, entero); regla 5: el tamaño no puede superar 4.5 MB. Única fuente para la pantalla y el servidor.
 */
export function normalizarParametro(clave: ClaveParametro, valor: string): { valor: string } | { error: string } {
  if (clave === "version_aviso_privacidad") {
    const v = valor.trim();
    if (!v) return { error: "Escribe la versión vigente del aviso de privacidad." };
    if (!PATRON_VERSION.test(v)) return { error: "Escribe la versión con números separados por punto, como 1.0 o 2.1." };
    if (v.length > LONGITUD_VERSION) return { error: `Usa ${LONGITUD_VERSION} caracteres o menos.` };
    return { valor: v };
  }
  const n = numero(valor);
  if (clave === "expiracion_token_minutos") return n > 0 && Number.isInteger(n) ? { valor: String(n) } : { error: "Debe ser un número entero mayor que cero." };
  if (!(n > 0)) return { error: "Debe ser un número mayor que cero." };
  if (n > LIMITE_TECNICO_MB) return { error: `No puede superar el límite técnico de ${LIMITE_TECNICO_MB} MB.` };
  return { valor: String(n) };
}

/** Valida los tres parámetros de la pantalla; vacío si todo está bien. */
export function validarParametros(v: ValoresParametros): ErroresParametros {
  const e: ErroresParametros = {};
  for (const clave of CLAVES_PARAMETRO) {
    const r = normalizarParametro(clave, v[clave]);
    if ("error" in r) e[clave] = r.error;
  }
  return e;
}
