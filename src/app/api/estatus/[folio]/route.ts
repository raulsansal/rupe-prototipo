import { PATRON_FOLIO } from "@/mocks/tipos";
import { normalizarFolio } from "@/server/dominio/folio";
import { formatoInvalido, jsonApi, respuestaDeError } from "@/server/errores";
import { consultarEstatusPorFolio } from "@/server/servicios/fichas";

/**
 * HU 038: consulta pública del ESTATUS de un caso por folio (sin sesión). Devuelve solo `{ folio, estado, fechaCambioEstado }`, nunca datos personales. 400 FOLIO_INVALIDO si el folio no tiene
 * el formato RUPE-XXXXXXXX; 404 idéntico para un folio inexistente, cancelado o deshabilitado (R33); un caso cerrado por cierre confirmado se muestra como «Cerrado». No distingue mayúsculas (R26).
 */
export async function GET(_peticion: Request, contexto: RouteContext<"/api/estatus/[folio]">) {
  try {
    const { folio } = await contexto.params;
    if (!PATRON_FOLIO.test(normalizarFolio(folio))) throw formatoInvalido("FOLIO_INVALIDO", "El folio debe tener el formato RUPE-XXXXXXXX.");
    return jsonApi({ estatus: await consultarEstatusPorFolio(folio) });
  } catch (e) {
    return respuestaDeError(e);
  }
}
