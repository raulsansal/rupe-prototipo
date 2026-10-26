// A dónde se va tras iniciar sesión. El parámetro `siguiente` solo admite rutas RELATIVAS INTERNAS (evita la redirección abierta) y compatibles con el rol.
import type { Rol } from "../../mocks/usuarios";

export const DESTINO_POR_DEFECTO: Record<Rol, string> = { Tutor: "/tutor", Administrador: "/admin" };

function esRutaInterna(ruta: string): boolean {
  if (!ruta.startsWith("/") || ruta.startsWith("//") || ruta.startsWith("/\\") || /[\u0000-\u001f\u007f\\]/.test(ruta)) return false;
  try {
    const u = new URL(ruta, "http://interno.invalido");
    return u.origin === "http://interno.invalido" && u.pathname.startsWith("/");
  } catch {
    return false;
  }
}

export function rutaInternaSegura(siguiente: string | null | undefined, rol: Rol): string {
  const defecto = DESTINO_POR_DEFECTO[rol];
  if (!siguiente || !esRutaInterna(siguiente)) return defecto;
  const camino = new URL(siguiente, "http://interno.invalido").pathname;
  if (camino === "/acceso" || camino.startsWith("/acceso/") || camino === "/registro") return defecto;
  // Solo se vuelve a una zona del rol propio; las rutas públicas están bien para cualquiera.
  const zonaAjena = rol === "Tutor" ? /^\/admin(\/|$)/ : /^\/tutor(\/|$)/;
  return zonaAjena.test(camino) ? defecto : siguiente;
}
