import { jsonApi, respuestaDeError } from "@/server/errores";
import { consultarBitacora } from "@/server/servicios/admin/bitacoraAdmin";
import { obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/**
 * HU 058: consulta de la bitácora (solo lectura: no hay otra operación). Parámetros `tipo`, `desde`, `hasta` (día de la Ciudad de México) y `pagina` (de 8 en 8, la más reciente primero), validados en el
 * servidor. 200 el listado con la entidad afectada legible; 401 sin sesión; 403 la tutora.
 */
export async function GET(peticion: Request) {
  try {
    const q = new URL(peticion.url).searchParams;
    return jsonApi(await consultarBitacora(await obtenerSesion(), { tipo: q.get("tipo") ?? undefined, desde: q.get("desde") ?? undefined, hasta: q.get("hasta") ?? undefined, pagina: q.get("pagina") ?? undefined }));
  } catch (e) {
    return respuestaDeError(e);
  }
}
