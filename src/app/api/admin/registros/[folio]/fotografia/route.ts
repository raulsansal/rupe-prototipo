import { respuestaDeError } from "@/server/errores";
import { fotografiaDelPerroAdmin } from "@/server/servicios/admin/moderacionRegistros";
import { obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/**
 * Vía EXCLUSIVA del Administrador a la foto del PERRO de un registro, también cuando está deshabilitado (la ruta pública da 404 por R33 y no se toca). 401 sin sesión, 403 la tutora, 404 uniforme
 * (folio inexistente, mal formado o sin foto subida). `image/jpeg`, `no-store` y `nosniff`.
 */
export async function GET(_peticion: Request, contexto: RouteContext<"/api/admin/registros/[folio]/fotografia">) {
  try {
    const { folio } = await contexto.params;
    const foto = await fotografiaDelPerroAdmin(await obtenerSesion(), folio);
    return new Response(foto.bytes as BodyInit, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
  } catch (e) {
    return respuestaDeError(e);
  }
}
