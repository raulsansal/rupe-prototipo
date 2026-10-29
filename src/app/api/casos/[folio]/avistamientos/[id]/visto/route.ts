import { jsonApi, respuestaDeError } from "@/server/errores";
import { exigirMismoOrigen } from "@/server/http/origen";
import { abrirAvistamiento } from "@/server/servicios/seguimiento";
import { obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/**
 * HU 040, regla 3: la pantalla del detalle llama aquí al montarse si el avistamiento es nuevo. Marca «visto» y, si el caso está en «Avistamiento reportado», lo pasa a «En seguimiento»
 * («avistamiento revisado»). Idempotente: repetirlo no duplica movimientos. 200 `{ id, marcado, estado, cambioDeEstado }`; 401; 403; 404 uniforme. El cuerpo se ignora.
 */
export async function POST(peticion: Request, contexto: RouteContext<"/api/casos/[folio]/avistamientos/[id]/visto">) {
  try {
    exigirMismoOrigen(peticion);
    const { folio, id } = await contexto.params;
    return jsonApi(await abrirAvistamiento(await obtenerSesion(), folio, id));
  } catch (e) {
    return respuestaDeError(e);
  }
}
