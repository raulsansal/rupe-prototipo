import { formatoInvalido, jsonApi, respuestaDeError } from "@/server/errores";
import { leerJson } from "@/server/http/cuerpo";
import { exigirMismoOrigen } from "@/server/http/origen";
import { deshabilitarUsuario, habilitarUsuario } from "@/server/servicios/admin/usuariosAdmin";
import { exigirAdministrador } from "@/server/sesion/guardas";
import { borrarCookieDeSesion, obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/**
 * HU 008: el Administrador habilita o deshabilita una cuenta. Cuerpo `{ accion: "habilitar" | "deshabilitar", confirmarSesionPropia? }`. Deshabilitar cierra todas sus sesiones (R19) y exige que quede otra
 * persona administradora activa (409 ULTIMO_ADMINISTRADOR, R21); si la cuenta es la propia, hace falta `confirmarSesionPropia: true` (409 CONFIRMACION_REQUERIDA) y se borra su cookie. 200 `{ id, activo, rol,
 * sesionesCerradas, cerroSuPropiaSesion }`; 401; 403; 404; 409.
 */
export async function POST(peticion: Request, contexto: RouteContext<"/api/admin/usuarios/[id]/estatus">) {
  try {
    exigirMismoOrigen(peticion);
    const { id } = await contexto.params;
    const sesion = await obtenerSesion();
    exigirAdministrador(sesion); // 401/403 antes de leer el cuerpo
    const cuerpo = await leerJson(peticion);
    if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) throw formatoInvalido("CUERPO_INVALIDO", "El cuerpo debe ser un objeto JSON.");
    const { accion, confirmarSesionPropia } = cuerpo as { accion?: unknown; confirmarSesionPropia?: unknown };
    if (accion === "habilitar") return jsonApi(await habilitarUsuario(sesion, id));
    if (accion === "deshabilitar") {
      const r = await deshabilitarUsuario(sesion, id, { confirmarSesionPropia: confirmarSesionPropia === true });
      if (r.cerroSuPropiaSesion) await borrarCookieDeSesion();
      return jsonApi(r);
    }
    throw formatoInvalido("ACCION_INVALIDA", "La acción debe ser «habilitar» o «deshabilitar».");
  } catch (e) {
    return respuestaDeError(e);
  }
}
