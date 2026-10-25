import { respuestaDeError } from "@/server/errores";
import { obtenerAlmacen, reiniciarAlmacen } from "@/server/memoria/almacen";
import { autorizarReinicio, reinicioRequiereSesion, VARIABLE_PERMITIR_REINICIO } from "@/server/servicios/reinicio";
import { obtenerSesion } from "@/server/sesion/sesion";

/**
 * Reinicia los datos ficticios en memoria. Solo desarrollo: en producción responde 404 salvo que RUPE_PERMITIR_REINICIO valga «1», y entonces exige
 * sesión de Administrador (ver servicios/reinicio.ts).
 */
export async function POST() {
  try {
    const entorno = process.env.NODE_ENV;
    const permitir = process.env[VARIABLE_PERMITIR_REINICIO];
    autorizarReinicio({ entorno, permitir, sesion: reinicioRequiereSesion(entorno, permitir) ? await obtenerSesion() : undefined });
    reiniciarAlmacen();
    const a = obtenerAlmacen();
    return Response.json({ estado: "reiniciado", datos: { usuarios: a.usuarios.length, casos: a.casos.length, avistamientos: a.avistamientos.length } });
  } catch (e) {
    return respuestaDeError(e);
  }
}
