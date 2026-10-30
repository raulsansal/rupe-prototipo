import { formatoInvalido, jsonApi, respuestaDeError } from "@/server/errores";
import { leerJson } from "@/server/http/cuerpo";
import { exigirMismoOrigen } from "@/server/http/origen";
import { editarCatalogo } from "@/server/servicios/admin/catalogosAdmin";
import { exigirAdministrador } from "@/server/sesion/guardas";
import { obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/**
 * HU 049-052: edición. Cuerpo igual al del alta + `activo?` (`true` sobre una fila desactivada la REACTIVA: reactivar = editar, R9; `false` no desactiva: para eso es `…/desactivar`, 422).
 * 200 `{ item, sinCambios, reactivado }` (sin cambios no se escribe nada ni bitácora); 401; 403; 404; 409; 422. Bitácora «edición de catálogo» con «anterior → nuevo».
 */
export async function PUT(peticion: Request, contexto: RouteContext<"/api/admin/catalogos/[tipo]/[id]">) {
  try {
    exigirMismoOrigen(peticion);
    const { tipo, id } = await contexto.params;
    const sesion = await obtenerSesion();
    exigirAdministrador(sesion);
    const cuerpo = await leerJson(peticion);
    if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) throw formatoInvalido("CUERPO_INVALIDO", "El cuerpo debe ser un objeto JSON.");
    return jsonApi(await editarCatalogo(sesion, tipo, id, cuerpo));
  } catch (e) {
    return respuestaDeError(e);
  }
}
