import { formatoInvalido, jsonApi, respuestaDeError } from "@/server/errores";
import { leerJson } from "@/server/http/cuerpo";
import { exigirMismoOrigen } from "@/server/http/origen";
import { cambiarEstadoDelCaso } from "@/server/servicios/cambioDeEstado";
import { obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/**
 * HU 042, 043 y 017: la persona tutora cambia el estado de un caso PROPIO. Cuerpo JSON `{ accion: "localizar" | "cerrar" | "reactivar" | "cancelar", motivo? }`; el motivo (≤ 300, saneado)
 * es obligatorio en «reactivar» y «cancelar». 200 `{ folio, estado, fechaCambio }`; 400 acción o cuerpo inválidos; 401; 403 (Administrador u ORIGEN_NO_PERMITIDO); 404 uniforme
 * (ajeno, inexistente o mal formado); 409 si el caso ya no está en un estado que permita la acción (también ante una repetición); 422 sin motivo. La guarda vive dentro del servicio.
 */
export async function POST(peticion: Request, contexto: RouteContext<"/api/casos/[folio]/estado">) {
  try {
    exigirMismoOrigen(peticion);
    const { folio } = await contexto.params;
    const cuerpo = await leerJson(peticion);
    if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) throw formatoInvalido("CUERPO_INVALIDO", "El cuerpo debe ser un objeto JSON.");
    const { accion, motivo } = cuerpo as { accion?: unknown; motivo?: unknown }; // solo estos dos campos: no hay asignación masiva
    return jsonApi(await cambiarEstadoDelCaso(await obtenerSesion(), folio, { accion, motivo }));
  } catch (e) {
    return respuestaDeError(e);
  }
}
