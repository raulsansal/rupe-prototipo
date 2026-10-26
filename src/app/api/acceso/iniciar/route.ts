import { exigirMismoOrigen } from "@/server/http/origen";
import { leerJson } from "@/server/http/cuerpo";
import { formatoInvalido, jsonApi, respuestaDeError } from "@/server/errores";
import { iniciarSesion } from "@/server/sesion/autenticacion";
import { rutaInternaSegura } from "@/server/sesion/destino";
import { establecerCookieDeSesion } from "@/server/sesion/sesion";

/**
 * ACC-01 (HU 001): inicia sesión. Cuerpo: {correo, contrasena, aceptarAviso?, siguiente?}. Tutor va a /tutor y Administrador a /admin; `siguiente` solo
 * se respeta si es una ruta relativa interna. 401 uniforme ante credenciales inválidas; 403 bloqueada o deshabilitada; 409 si el aviso cambió (R22).
 */
export async function POST(peticion: Request) {
  try {
    exigirMismoOrigen(peticion);
    const c = await leerJson(peticion);
    if (typeof c !== "object" || c === null) throw formatoInvalido("CUERPO_INVALIDO", "El cuerpo de la petición no es válido.");
    const { correo, contrasena, aceptarAviso, siguiente } = c as Record<string, unknown>;
    if (typeof correo !== "string" || typeof contrasena !== "string" || !correo.trim() || !contrasena) throw formatoInvalido("CAMPOS_FALTANTES", "Escribe tu correo y tu contraseña.");
    const r = await iniciarSesion({ correo, contrasena, aceptarAviso: aceptarAviso === true });
    await establecerCookieDeSesion(r.valorCookie, peticion, r.maxAge);
    return jsonApi({ destino: rutaInternaSegura(typeof siguiente === "string" ? siguiente : undefined, r.sesion.rol), usuario: { nombre: r.sesion.nombre, rol: r.sesion.rol } });
  } catch (e) {
    return respuestaDeError(e);
  }
}
