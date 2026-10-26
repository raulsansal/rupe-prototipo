import { exigirMismoOrigen } from "@/server/http/origen";
import { leerJson } from "@/server/http/cuerpo";
import { formatoInvalido, jsonApi, reglaDeNegocio, respuestaDeError } from "@/server/errores";
import { crearRepositorios } from "@/server/memoria/repos";
import { autorizarReinicio, reinicioRequiereSesion, VARIABLE_PERMITIR_REINICIO } from "@/server/servicios/reinicio";
import { obtenerSesion } from "@/server/sesion/sesion";

/**
 * HERRAMIENTA DE DESARROLLO (misma protección que /api/dev/reiniciar): cambia SOLO la versión del aviso de privacidad para probar y capturar la reaceptación
 * (R22) sin la pantalla de parámetros, que se conecta en un bloque posterior. «Reiniciar» la deja en 1.0. Cuerpo: {valor: "2.0"}.
 */
export async function POST(peticion: Request) {
  try {
    exigirMismoOrigen(peticion);
    const entorno = process.env.NODE_ENV;
    const permitir = process.env[VARIABLE_PERMITIR_REINICIO];
    autorizarReinicio({ entorno, permitir, sesion: reinicioRequiereSesion(entorno, permitir) ? await obtenerSesion() : undefined });
    const c = await leerJson(peticion);
    const valor = typeof c === "object" && c !== null ? (c as { valor?: unknown }).valor : undefined;
    if (typeof valor !== "string") throw formatoInvalido("CUERPO_INVALIDO", "Indica el valor de la versión.");
    if (!/^\d+(\.\d+)*$/.test(valor) || valor.length > 20) throw reglaDeNegocio("R22", "La versión del aviso son números separados por punto, como 1.0 o 2.1.", "VERSION_INVALIDA");
    await crearRepositorios().parametros.actualizar("version_aviso_privacidad", valor);
    return jsonApi({ estado: "actualizado", version_aviso_privacidad: valor });
  } catch (e) {
    return respuestaDeError(e);
  }
}
