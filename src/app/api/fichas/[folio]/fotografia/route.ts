import { respuestaDeError } from "@/server/errores";
import { fotografiaPublicaDelCaso } from "@/server/servicios/fichas";

/**
 * Foto del PERRO para la ficha pública (HU 024), sin sesión: solo la foto del caso (nunca la de un avistamiento) y solo mientras la ficha se muestre (R33). Un folio inexistente,
 * mal formado, cancelado, deshabilitado o cerrado, o un caso sin foto subida, responden el mismo 404 (cuerpo y cabeceras idénticos).
 */
export async function GET(_peticion: Request, contexto: RouteContext<"/api/fichas/[folio]/fotografia">) {
  try {
    const { folio } = await contexto.params;
    const foto = await fotografiaPublicaDelCaso(folio);
    return new Response(foto.bytes as BodyInit, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" },
    });
  } catch (e) {
    return respuestaDeError(e);
  }
}
