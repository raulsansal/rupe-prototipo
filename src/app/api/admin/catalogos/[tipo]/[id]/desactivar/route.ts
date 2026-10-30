import { jsonApi, respuestaDeError } from "@/server/errores";
import { exigirMismoOrigen } from "@/server/http/origen";
import { desactivarCatalogo } from "@/server/servicios/admin/catalogosAdmin";
import { obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/**
 * HU 049-052: desactiva un valor (nunca se elimina). Sin cuerpo. 200 `{ item }`; 401; 403; 404; 409 `VALOR_PROTEGIDO`, `ULTIMA_ACTIVA_DE_CATEGORIA`, `ULTIMA_ALCALDIA_ACTIVA` (extensión) o `YA_DESACTIVADO`.
 * Bitácora «desactivación de catálogo» en la misma transacción. Los casos que ya usan el valor lo siguen mostrando con su nombre.
 */
export async function POST(peticion: Request, contexto: RouteContext<"/api/admin/catalogos/[tipo]/[id]/desactivar">) {
  try {
    exigirMismoOrigen(peticion);
    const { tipo, id } = await contexto.params;
    return jsonApi(await desactivarCatalogo(await obtenerSesion(), tipo, id));
  } catch (e) {
    return respuestaDeError(e);
  }
}
