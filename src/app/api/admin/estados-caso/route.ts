import { jsonApi, respuestaDeError } from "@/server/errores";
import { listarEstadosCaso } from "@/server/servicios/admin/estadosCasoAdmin";
import { obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/** HU 053: los 6 estados del caso, SOLO CONSULTA (no existe otra operación sobre ellos). 200 `{ items }`; 401; 403. */
export async function GET() {
  try {
    return jsonApi(await listarEstadosCaso(await obtenerSesion()));
  } catch (e) {
    return respuestaDeError(e);
  }
}
