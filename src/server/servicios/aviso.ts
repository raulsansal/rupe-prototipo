import "server-only";
// Versión vigente del aviso de privacidad (parámetro `version_aviso_privacidad`, R22). Es información PÚBLICA (el aviso está a la vista de todas las personas), así que no pide sesión.
// Se lee del almacén en cada petición: si el Administrador la cambia, las pantallas muestran la nueva en la siguiente carga.
import { obtenerAlmacen } from "../memoria/almacen";
import { contextoPorDefecto, type Contexto } from "./contexto";

/**
 * Lectura SÍNCRONA, solo para el layout raíz. NO debe volverse asíncrona: un `await` en el layout raíz cambia la temporización con que Next emite el 404 (aparece o no un fragmento
 * `NEXT_HTTP_ERROR_FALLBACK` según cuánto tarde cada página en responder) y deja de ser idéntico el 404 de un caso deshabilitado, cancelado o inexistente (PUB-03 C). Con MySQL será una
 * configuración en caché que se invalida al modificar el parámetro, no una consulta por petición dentro del layout.
 */
export function versionVigenteDelAvisoSincrona(): string {
  return obtenerAlmacen().parametros.find((p) => p.clave === "version_aviso_privacidad")!.valor;
}

export async function versionVigenteDelAviso(ctx: Contexto = contextoPorDefecto()): Promise<string> {
  return ctx.repos.parametros.valor("version_aviso_privacidad");
}
