import { jsonApi, respuestaDeError } from "@/server/errores";
import { exigirMismoOrigen } from "@/server/http/origen";
import { regenerarQrDelTutor } from "@/server/servicios/fichaBusqueda";
import { obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/**
 * HU 026: regenera el QR de un caso PROPIO. El anterior se invalida de inmediato y el nuevo se crea en la misma transacción; no cambia folio, datos, estado ni historial.
 * El cuerpo se ignora (no hay asignación masiva). 200 {regenerado, fechaRegeneracion} (sin el token); 401; 403 (Administrador u ORIGEN_NO_PERMITIDO); 404 uniforme;
 * 409 CASO_NO_ACTIVO. La guarda de sesión, rol y dueño vive dentro del servicio.
 */
export async function POST(peticion: Request, contexto: RouteContext<"/api/casos/[folio]/qr/regenerar">) {
  try {
    exigirMismoOrigen(peticion);
    const { folio } = await contexto.params;
    const { fechaRegeneracion } = await regenerarQrDelTutor(await obtenerSesion(), folio);
    return jsonApi({ regenerado: true, fechaRegeneracion });
  } catch (e) {
    return respuestaDeError(e);
  }
}
