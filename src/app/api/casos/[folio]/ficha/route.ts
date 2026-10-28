import { basePublicaDeCabeceras } from "@/server/config/urlPublica";
import { respuestaDeError } from "@/server/errores";
import { generarPdfDeFicha } from "@/server/servicios/fichaBusqueda";
import { obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/**
 * HU 020, 022 y 027: PDF de la ficha de búsqueda de un caso PROPIO, generado al momento (siempre la versión más reciente). `?hoja=carta|media-carta` (Carta por omisión).
 * 200 application/pdf con Content-Disposition attachment; 400 HOJA_INVALIDA; 401; 403 (Administrador); 404 igual para ajeno, inexistente y mal formado; 409 CASO_NO_ACTIVO
 * (Localizado o Cerrado); 503 CONFIGURACION_FALTANTE (sin RUPE_URL_PUBLICA fuera de redes locales). La guarda de sesión, rol y dueño vive dentro del servicio.
 */
export async function GET(peticion: Request, contexto: RouteContext<"/api/casos/[folio]/ficha">) {
  try {
    const { folio } = await contexto.params;
    const hoja = new URL(peticion.url).searchParams.get("hoja") ?? undefined;
    const { bytes, nombreArchivo } = await generarPdfDeFicha(await obtenerSesion(), folio, hoja, basePublicaDeCabeceras(peticion.headers));
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return respuestaDeError(e);
  }
}
