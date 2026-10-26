import { PATRON_FOLIO } from "@/mocks/tipos";
import { normalizarFolio } from "@/server/dominio/folio";
import { formatoInvalido, jsonApi, respuestaDeError } from "@/server/errores";
import { consultarFichaPorFolio } from "@/server/servicios/fichas";

/**
 * Consulta pública de la ficha por folio (sin sesión). Devuelve SOLO columnas públicas (D6); 400 si el folio no tiene el formato RUPE-XXXXXXXX,
 * 404 igual para un folio inexistente, cancelado, deshabilitado o de un caso cerrado (R33). El folio no distingue mayúsculas (R26).
 */
export async function GET(_peticion: Request, contexto: RouteContext<"/api/fichas/[folio]">) {
  try {
    const { folio } = await contexto.params;
    if (!PATRON_FOLIO.test(normalizarFolio(folio))) throw formatoInvalido("FOLIO_INVALIDO", "El folio debe tener el formato RUPE-XXXXXXXX.");
    return jsonApi({ ficha: await consultarFichaPorFolio(folio) });
  } catch (e) {
    return respuestaDeError(e);
  }
}
