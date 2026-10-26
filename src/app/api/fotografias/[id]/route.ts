import { respuestaDeError } from "@/server/errores";
import { fotografiaDelCaso } from "@/server/servicios/extravio";
import { obtenerSesion } from "@/server/sesion/sesion";

/**
 * Fotografía subida de un caso: SOLO para su dueña y, en consulta, para el Administrador. NO es pública (las fichas públicas son de P3/P4). Otra tutora, un id
 * inexistente y una foto sembrada sin bytes responden exactamente lo mismo (404).
 */
export async function GET(_peticion: Request, contexto: RouteContext<"/api/fotografias/[id]">) {
  try {
    const { id } = await contexto.params;
    const sesion = await obtenerSesion();
    const contenido = await fotografiaDelCaso(sesion, /^\d{1,9}$/.test(id) ? Number(id) : -1);
    return new Response(contenido.bytes as BodyInit, {
      headers: { "Content-Type": contenido.tipo, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" },
    });
  } catch (e) {
    return respuestaDeError(e);
  }
}

