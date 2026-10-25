// Errores de la aplicación con la forma final de las respuestas HTTP (uniformes para todas las rutas):
// 400 formato · 401 sin sesión · 403 rol insuficiente · 404 no encontrado · 409 estado o duplicado · 422 regla de negocio.
export type EstadoHttp = 400 | 401 | 403 | 404 | 409 | 422;

export class ErrorApp extends Error {
  constructor(
    readonly estado: EstadoHttp,
    readonly codigo: string,
    mensaje: string,
    /** Regla del diccionario (R10, R13…) que motivó el rechazo, si la hay. */
    readonly regla?: string,
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
export const reglaDeNegocio = (regla: string, mensaje: string, codigo = "REGLA_DE_NEGOCIO") => new ErrorApp(422, codigo, mensaje, regla);

/** Cuerpo JSON de cualquier error: {error:{codigo,mensaje,regla?}}. */
export const cuerpoDeError = (e: ErrorApp) => ({ error: { codigo: e.codigo, mensaje: e.message, ...(e.regla ? { regla: e.regla } : {}) } });

export function respuestaDeError(e: unknown): Response {
  if (e instanceof ErrorApp) return Response.json(cuerpoDeError(e), { status: e.estado });
  console.error(e);
  return Response.json({ error: { codigo: "ERROR_INTERNO", mensaje: "Ocurrió un error inesperado." } }, { status: 500 });
}
