import { formatoInvalido, jsonApi, respuestaDeError } from "@/server/errores";
import { leerFormularioAcotado } from "@/server/http/cuerpoAcotado";
import { exigirMismoOrigen } from "@/server/http/origen";
import { limiteDeCuerpo, registrarExtravio } from "@/server/servicios/extravio";
import { exigirRol } from "@/server/sesion/guardas";
import { obtenerSesion } from "@/server/sesion/sesion";

/**
 * F2 (HU 011, 012 y 013): registra un extravío. `multipart/form-data` con la parte «datos» (JSON) y la parte «fotografia» (archivo ya reducido por el navegador).
 * 201 {folio, estado, destino}; 400 formato; 401/403 sesión y rol; 413 cuerpo demasiado grande; 422 errores por campo. La guarda de verdad está dentro del servicio;
 * aquí se repite solo para no leer un cuerpo de varios MB de quien no tiene sesión.
 */
export async function POST(peticion: Request) {
  try {
    exigirMismoOrigen(peticion);
    const sesion = await obtenerSesion();
    exigirRol(sesion, "Tutor");
    const formulario = await leerFormularioAcotado(peticion, await limiteDeCuerpo());
    const crudo = formulario.get("datos");
    if (typeof crudo !== "string") throw formatoInvalido("CUERPO_INVALIDO", "Faltan los datos del registro.");
    let datos: unknown;
    try {
      datos = JSON.parse(crudo);
    } catch {
      throw formatoInvalido("CUERPO_INVALIDO", "Los datos del registro no son válidos.");
    }
    const archivo = formulario.get("fotografia");
    const foto = archivo instanceof File ? { bytes: new Uint8Array(await archivo.arrayBuffer()), tipoDeclarado: archivo.type } : undefined;
    const r = await registrarExtravio(sesion, { datos, foto });
    return jsonApi({ folio: r.folio, estado: r.estado, destino: `/tutor/casos/${r.folio}/creado` }, 201);
  } catch (e) {
    return respuestaDeError(e);
  }
}
