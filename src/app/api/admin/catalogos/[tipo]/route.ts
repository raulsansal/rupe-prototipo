import { formatoInvalido, jsonApi, respuestaDeError } from "@/server/errores";
import { leerJson } from "@/server/http/cuerpo";
import { exigirMismoOrigen } from "@/server/http/origen";
import { altaCatalogo, listarCatalogo } from "@/server/servicios/admin/catalogosAdmin";
import { exigirAdministrador } from "@/server/sesion/guardas";
import { obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/** HU 049-052: listado de un catálogo (`alcaldias|razas|motivos|estados-animal`) con `texto` y `pagina`. 200; 401; 403; 404 (catálogo desconocido). */
export async function GET(peticion: Request, contexto: RouteContext<"/api/admin/catalogos/[tipo]">) {
  try {
    const { tipo } = await contexto.params;
    const q = new URL(peticion.url).searchParams;
    return jsonApi(await listarCatalogo(await obtenerSesion(), tipo, { texto: q.get("texto") ?? undefined, pagina: q.get("pagina") ?? undefined }));
  } catch (e) {
    return respuestaDeError(e);
  }
}

/**
 * HU 049-052: alta (siempre activa). Cuerpo `{ nombre, clave? (alcaldías), idCategoria? y descripcion? (motivos y estados) }`. 201 `{ item }`; 401; 403; 404; 409 nombre o clave repetidos (con `campos`);
 * 422 formato (con `campos`). Nombre, clave y descripción se sanean (R34). Bitácora «alta de catálogo» en la misma transacción.
 */
export async function POST(peticion: Request, contexto: RouteContext<"/api/admin/catalogos/[tipo]">) {
  try {
    exigirMismoOrigen(peticion);
    const { tipo } = await contexto.params;
    const sesion = await obtenerSesion();
    exigirAdministrador(sesion); // 401/403 antes de leer el cuerpo
    const cuerpo = await leerJson(peticion);
    if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) throw formatoInvalido("CUERPO_INVALIDO", "El cuerpo debe ser un objeto JSON.");
    return jsonApi(await altaCatalogo(sesion, tipo, cuerpo), 201);
  } catch (e) {
    return respuestaDeError(e);
  }
}
