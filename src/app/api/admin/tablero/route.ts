import { jsonApi, respuestaDeError } from "@/server/errores";
import { consultarTablero } from "@/server/servicios/admin/tableroAdmin";
import { obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/**
 * HU 055: indicadores y gráficas del tablero (base histórica + lo creado después de la siembra), calculados en cada petición. `desde` y `hasta` (AAAA-MM-DD, día de la Ciudad de México) son opcionales:
 * sin ellos, del 1 de octubre de 2026 (o de hoy, si es anterior) a hoy. 200; 401 sin sesión; 403 la tutora; 422 con `campos` por fecha inválida, futura o anterior al 1 de junio de 2026.
 */
export async function GET(peticion: Request) {
  try {
    const q = new URL(peticion.url).searchParams;
    return jsonApi(await consultarTablero(await obtenerSesion(), { desde: q.get("desde") ?? undefined, hasta: q.get("hasta") ?? undefined }));
  } catch (e) {
    return respuestaDeError(e);
  }
}
