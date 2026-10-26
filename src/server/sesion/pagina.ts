import "server-only";
// Guarda para páginas y layouts del servidor. IMPORTANTE: el layout NO es el límite de seguridad (en la navegación del cliente no se vuelve a ejecutar):
// la protección real está en proxy.ts (firma de la cookie en cada petición) y en cada servicio o ruta que lee o escribe datos de un rol, que llama por
// sí mismo a la guarda de sesión, rol y dueño (R32). Esto solo cubre la carga completa de la página y la sesión revocada o la cuenta inactiva.
import { forbidden, notFound, redirect } from "next/navigation";
import type { Rol } from "../../mocks/usuarios";
import { ErrorApp } from "../errores";
import { resolverAcceso, type SesionActual } from "./guardas";
import { obtenerSesion } from "./sesion";

export async function exigirSesionDePagina(rol: Rol): Promise<SesionActual> {
  const sesion = await obtenerSesion();
  const acceso = resolverAcceso(sesion, rol);
  if (acceso === "sin-sesion") redirect("/acceso");
  if (acceso === "prohibido") forbidden();
  return sesion!;
}

/** Traduce el error de un servicio a la pantalla que corresponde: 404 → «no encontrada» (igual para ajeno, inexistente y mal formado), 403 → acceso denegado, 401 → inicio de sesión. */
export async function paraPagina<T>(trabajo: Promise<T>): Promise<T> {
  try {
    return await trabajo;
  } catch (e) {
    if (e instanceof ErrorApp) {
      if (e.estado === 404) notFound();
      if (e.estado === 403) forbidden();
      if (e.estado === 401) redirect("/acceso");
    }
    throw e;
  }
}
