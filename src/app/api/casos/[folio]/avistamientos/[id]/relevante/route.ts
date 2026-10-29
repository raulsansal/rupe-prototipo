import { formatoInvalido, jsonApi, respuestaDeError } from "@/server/errores";
import { leerJson } from "@/server/http/cuerpo";
import { exigirMismoOrigen } from "@/server/http/origen";
import { marcarRelevante } from "@/server/servicios/seguimiento";
import { obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/** HU 040: «Marcar como relevante», reversible y solo de la persona dueña. Cuerpo `{ relevante: boolean }`. 200 `{ id, relevante }`; 400; 401; 403; 404 uniforme. Idempotente. */
export async function PUT(peticion: Request, contexto: RouteContext<"/api/casos/[folio]/avistamientos/[id]/relevante">) {
  try {
    exigirMismoOrigen(peticion);
    const { folio, id } = await contexto.params;
    const cuerpo = await leerJson(peticion);
    if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) throw formatoInvalido("CUERPO_INVALIDO", "El cuerpo debe ser un objeto JSON.");
    return jsonApi(await marcarRelevante(await obtenerSesion(), folio, id, (cuerpo as { relevante?: unknown }).relevante));
  } catch (e) {
    return respuestaDeError(e);
  }
}
