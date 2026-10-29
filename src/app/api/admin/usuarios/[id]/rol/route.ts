import { formatoInvalido, jsonApi, respuestaDeError } from "@/server/errores";
import { leerJson } from "@/server/http/cuerpo";
import { exigirMismoOrigen } from "@/server/http/origen";
import { cambiarRol } from "@/server/servicios/admin/usuariosAdmin";
import { exigirAdministrador } from "@/server/sesion/guardas";
import { borrarCookieDeSesion, obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/**
 * HU 009: el Administrador cambia el rol de una cuenta. Cuerpo `{ rol: "Administrador" | "Tutor", confirmarSesionPropia? }`. Cierra las sesiones de esa cuenta (el rol además se lee del almacén en cada petición)
 * y exige que quede otra persona administradora activa si se degrada a una (409 ULTIMO_ADMINISTRADOR, R21); sobre la propia cuenta hace falta `confirmarSesionPropia: true`. 200 `{ id, activo, rol, rolAnterior,
 * sesionesCerradas, cerroSuPropiaSesion }`; 401; 403; 404; 409; 422 rol inválido.
 */
export async function PUT(peticion: Request, contexto: RouteContext<"/api/admin/usuarios/[id]/rol">) {
  try {
    exigirMismoOrigen(peticion);
    const { id } = await contexto.params;
    const sesion = await obtenerSesion();
    exigirAdministrador(sesion); // 401/403 antes de leer el cuerpo
    const cuerpo = await leerJson(peticion);
    if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) throw formatoInvalido("CUERPO_INVALIDO", "El cuerpo debe ser un objeto JSON.");
    const { rol, confirmarSesionPropia } = cuerpo as { rol?: unknown; confirmarSesionPropia?: unknown };
    const r = await cambiarRol(sesion, id, rol, { confirmarSesionPropia: confirmarSesionPropia === true });
    if (r.cerroSuPropiaSesion) await borrarCookieDeSesion();
    return jsonApi(r);
  } catch (e) {
    return respuestaDeError(e);
  }
}
