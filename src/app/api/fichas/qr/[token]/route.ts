import { jsonApi, respuestaDeError } from "@/server/errores";
import { consultarFichaPorToken } from "@/server/servicios/fichas";

/**
 * Consulta pública de la ficha por el token del QR (HU 024, R27), sin sesión. Solo el QR VIGENTE resuelve la ficha; un token inexistente, mal formado, regenerado o de un caso que
 * no se muestra responde SIEMPRE lo mismo: 404 QR_NO_VIGENTE. La respuesta lleva solo columnas públicas y nunca repite el token.
 */
export async function GET(_peticion: Request, contexto: RouteContext<"/api/fichas/qr/[token]">) {
  try {
    const { token } = await contexto.params;
    return jsonApi({ ficha: await consultarFichaPorToken(token) });
  } catch (e) {
    return respuestaDeError(e);
  }
}
