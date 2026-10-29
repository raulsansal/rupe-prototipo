import { formatoInvalido, jsonApi, respuestaDeError } from "@/server/errores";
import { leerJson } from "@/server/http/cuerpo";
import { exigirMismoOrigen } from "@/server/http/origen";
import { deshabilitarCaso, restaurarCaso } from "@/server/servicios/admin/moderacionRegistros";
import { exigirAdministrador } from "@/server/sesion/guardas";
import { obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/**
 * HU 018: el Administrador deshabilita o restaura un registro. Cuerpo JSON `{ accion: "deshabilitar" | "restaurar", motivo? }` (el motivo, ≤ 300 y saneado, es obligatorio al deshabilitar). 200
 * `{ folio, estado, fechaCambio }`; 400 acción o cuerpo inválidos; 401 sin sesión; 403 la tutora (u ORIGEN_NO_PERMITIDO); 404 folio inexistente o mal formado; 409 si el caso ya no lo permite; 422 sin motivo.
 * La guarda de Administrador vive dentro del servicio. No hay asignación masiva: solo se leen `accion` y `motivo`.
 */
export async function POST(peticion: Request, contexto: RouteContext<"/api/admin/registros/[folio]/moderacion">) {
  try {
    exigirMismoOrigen(peticion);
    const { folio } = await contexto.params;
    const sesion = await obtenerSesion();
    exigirAdministrador(sesion); // 401/403 antes de leer el cuerpo
    const cuerpo = await leerJson(peticion);
    if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) throw formatoInvalido("CUERPO_INVALIDO", "El cuerpo debe ser un objeto JSON.");
    const { accion, motivo } = cuerpo as { accion?: unknown; motivo?: unknown };
    if (accion === "deshabilitar") return jsonApi(await deshabilitarCaso(sesion, folio, motivo));
    if (accion === "restaurar") return jsonApi(await restaurarCaso(sesion, folio));
    throw formatoInvalido("ACCION_INVALIDA", "La acción debe ser «deshabilitar» o «restaurar».");
  } catch (e) {
    return respuestaDeError(e);
  }
}
