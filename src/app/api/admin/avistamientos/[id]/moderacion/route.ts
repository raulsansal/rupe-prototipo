import { exigirAdministrador } from "@/server/sesion/guardas";
import { formatoInvalido, jsonApi, respuestaDeError } from "@/server/errores";
import { leerJson } from "@/server/http/cuerpo";
import { exigirMismoOrigen } from "@/server/http/origen";
import { ocultarAvistamiento, restaurarAvistamiento } from "@/server/servicios/admin/moderacionAvistamientos";
import { obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/**
 * HU 037: el Administrador oculta o restaura un avistamiento. Cuerpo `{ accion: "ocultar" | "restaurar", motivo? }` (el motivo, ≤ 300 y saneado, es obligatorio al ocultar). 200
 * `{ id, visible, fechaCambio }`; 400; 401; 403; 404 uniforme; 409 si ya está oculto o ya es visible; 422 sin motivo.
 */
export async function POST(peticion: Request, contexto: RouteContext<"/api/admin/avistamientos/[id]/moderacion">) {
  try {
    exigirMismoOrigen(peticion);
    const { id } = await contexto.params;
    const sesion = await obtenerSesion();
    exigirAdministrador(sesion); // 401/403 antes de leer el cuerpo
    const cuerpo = await leerJson(peticion);
    if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) throw formatoInvalido("CUERPO_INVALIDO", "El cuerpo debe ser un objeto JSON.");
    const { accion, motivo } = cuerpo as { accion?: unknown; motivo?: unknown };
    if (accion === "ocultar") return jsonApi(await ocultarAvistamiento(sesion, id, motivo));
    if (accion === "restaurar") return jsonApi(await restaurarAvistamiento(sesion, id));
    throw formatoInvalido("ACCION_INVALIDA", "La acción debe ser «ocultar» o «restaurar».");
  } catch (e) {
    return respuestaDeError(e);
  }
}
