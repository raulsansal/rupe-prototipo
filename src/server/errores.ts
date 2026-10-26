// Errores de la aplicación con la forma final de las respuestas HTTP (uniformes para todas las rutas):
// 400 formato · 401 sin sesión · 403 rol insuficiente · 404 no encontrado · 409 estado o duplicado · 413 cuerpo demasiado grande · 422 regla de negocio.
export type EstadoHttp = 400 | 401 | 403 | 404 | 409 | 413 | 422;

export class ErrorApp extends Error {
  constructor(
    readonly estado: EstadoHttp,
    readonly codigo: string,
    mensaje: string,
    /** Regla del diccionario (R10, R13…) que motivó el rechazo, si la hay. */
    readonly regla?: string,
    /** Mensajes por campo de un formulario (validación del servidor). */
    readonly campos?: Record<string, string>,
    /** Datos extra que la pantalla necesita (p. ej. la versión vigente del aviso). */
    readonly extra?: Record<string, unknown>,
  ) {
    super(mensaje);
    this.name = "ErrorApp";
  }
}

export const formatoInvalido = (codigo: string, mensaje: string) => new ErrorApp(400, codigo, mensaje);
export const sinSesion = () => new ErrorApp(401, "SIN_SESION", "Inicia sesión para continuar.");
export const sinPermiso = () => new ErrorApp(403, "SIN_PERMISO", "Tu rol no puede realizar esta acción.");
export const noEncontrado = (mensaje = "No se encuentra.", codigo = "NO_ENCONTRADO") => new ErrorApp(404, codigo, mensaje);
export const conflictoDeEstado = (codigo: string, mensaje: string, regla?: string) => new ErrorApp(409, codigo, mensaje, regla);
/** 413: la petición excede el tamaño permitido (se rechaza sin leerla entera). */
export const cuerpoDemasiadoGrande = (mensaje = "La petición es demasiado grande: reduce la fotografía e inténtalo de nuevo.") => new ErrorApp(413, "CUERPO_DEMASIADO_GRANDE", mensaje);
/** 422: el formulario trae errores; `campos` dice cuáles, campo por campo. */
export const validacion = (campos: Record<string, string>, mensaje = "Revisa los campos marcados.") => new ErrorApp(422, "VALIDACION", mensaje, undefined, campos);
export const reglaDeNegocio = (regla: string, mensaje: string, codigo = "REGLA_DE_NEGOCIO") => new ErrorApp(422, codigo, mensaje, regla);

/** Cuerpo JSON de cualquier error: {error:{codigo,mensaje,regla?}}. */
export const cuerpoDeError = (e: ErrorApp) => ({ error: { codigo: e.codigo, mensaje: e.message, ...(e.regla ? { regla: e.regla } : {}), ...(e.campos ? { campos: e.campos } : {}), ...(e.extra ?? {}) } });

/** Toda respuesta de /api lleva `Cache-Control: no-store` (también las de error): nada de lo que devuelve la API se guarda en cachés. */
export const SIN_CACHE = { "Cache-Control": "no-store" } as const;
export const jsonApi = (cuerpo: unknown, estado = 200, cabeceras: HeadersInit = {}) => Response.json(cuerpo, { status: estado, headers: { ...SIN_CACHE, ...cabeceras } });
export const redireccionApi = (destino: string, estado: 303 | 302 = 303) => new Response(null, { status: estado, headers: { Location: destino, ...SIN_CACHE } });

export function respuestaDeError(e: unknown): Response {
  if (e instanceof ErrorApp) return jsonApi(cuerpoDeError(e), e.estado);
  console.error(e);
  return jsonApi({ error: { codigo: "ERROR_INTERNO", mensaje: "Ocurrió un error inesperado." } }, 500);
}
