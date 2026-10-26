import { cookies } from "next/headers";
import { exigirMismoOrigen } from "@/server/http/origen";
import { redireccionApi, respuestaDeError } from "@/server/errores";
import { cerrarSesion } from "@/server/sesion/autenticacion";
import { NOMBRE_COOKIE } from "@/server/sesion/cookies";
import { borrarCookieDeSesion } from "@/server/sesion/sesion";

/**
 * HU 007: cierra SOLO la sesión de esta cookie (el identificador queda invalidado en el almacén), borra la cookie y redirige a la página principal (303).
 * Sin cookie también redirige (cerrar sesión es idempotente). Exige el mismo origen.
 */
export async function POST(peticion: Request) {
  try {
    exigirMismoOrigen(peticion);
    await cerrarSesion((await cookies()).get(NOMBRE_COOKIE)?.value);
    await borrarCookieDeSesion();
    return redireccionApi("/");
  } catch (e) {
    return respuestaDeError(e);
  }
}
