import { formatoInvalido, jsonApi, respuestaDeError } from "@/server/errores";
import { leerJson } from "@/server/http/cuerpo";
import { exigirMismoOrigen } from "@/server/http/origen";
import { listarParametros, modificarParametros } from "@/server/servicios/admin/parametrosAdmin";
import { exigirAdministrador } from "@/server/sesion/guardas";
import { obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/** HU 054: los tres parámetros con su valor y su valor por defecto. 200; 401; 403. */
export async function GET() {
  try {
    return jsonApi(await listarParametros(await obtenerSesion()));
  } catch (e) {
    return respuestaDeError(e);
  }
}

/**
 * HU 054: modifica uno o más parámetros. Cuerpo `{ version_aviso_privacidad?, expiracion_token_minutos?, tamano_maximo_archivo_mb? }`. 200 `{ parametros, cambios, sinCambios, avisoReaceptacion }`;
 * 401; 403; 422 por parámetro (no se cambia ninguno). Una entrada «modificar parámetro» por cada parámetro que cambió (anterior → nuevo), en la misma transacción.
 * Cambiar la versión del aviso obliga a re-aceptarlo al siguiente inicio de sesión (R22).
 */
export async function PUT(peticion: Request) {
  try {
    exigirMismoOrigen(peticion);
    const sesion = await obtenerSesion();
    exigirAdministrador(sesion);
    const cuerpo = await leerJson(peticion);
    if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) throw formatoInvalido("CUERPO_INVALIDO", "El cuerpo debe ser un objeto JSON.");
    return jsonApi(await modificarParametros(sesion, cuerpo));
  } catch (e) {
    return respuestaDeError(e);
  }
}
