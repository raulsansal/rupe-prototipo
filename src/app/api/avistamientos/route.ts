import { formatoInvalido, jsonApi, respuestaDeError } from "@/server/errores";
import { leerFormularioAcotado } from "@/server/http/cuerpoAcotado";
import { exigirMismoOrigen } from "@/server/http/origen";
import { limiteDeCuerpo } from "@/server/servicios/extravio";
import { registrarAvistamiento } from "@/server/servicios/avistamientos";
import type { Acceso } from "@/server/servicios/fichas";

/**
 * F4 (HU 028 a 036): reporte de un avistamiento, SIN cuenta. `multipart/form-data` con la parte «datos» (JSON: acceso {canal:"folio",folio} o {canal:"qr",token}, fecha y hora de la
 * Ciudad de México, dirección, alcaldía, colonia, referencias, estados del animal y comentario) y la parte «fotografia». 201 {id, folio, fechaHoraEnvio}; 400 formato; 403 Origin;
 * 404 (folio no encontrado o QR_NO_VIGENTE); 409 (el caso no admite avistamientos, R13); 413; 422 por campo. No se guarda IP ni agente de usuario y la respuesta nunca lleva el token.
 */
export async function POST(peticion: Request) {
  try {
    exigirMismoOrigen(peticion);
    const formulario = await leerFormularioAcotado(peticion, await limiteDeCuerpo());
    const crudo = formulario.get("datos");
    if (typeof crudo !== "string") throw formatoInvalido("CUERPO_INVALIDO", "Faltan los datos del reporte.");
    let datos: Record<string, unknown>;
    try {
      const j = JSON.parse(crudo);
      if (!j || typeof j !== "object" || Array.isArray(j)) throw new Error();
      datos = j as Record<string, unknown>;
    } catch {
      throw formatoInvalido("CUERPO_INVALIDO", "Los datos del reporte no son válidos.");
    }
    const a = (datos.acceso && typeof datos.acceso === "object" ? datos.acceso : {}) as Record<string, unknown>;
    let acceso: Acceso;
    if (a.canal === "folio") acceso = { canal: "folio", folio: typeof a.folio === "string" ? a.folio : "" };
    else if (a.canal === "qr") acceso = { canal: "qr", token: typeof a.token === "string" ? a.token : "" };
    else throw formatoInvalido("ACCESO_INVALIDO", "Indica si el reporte viene del folio o del código QR.");
    const archivo = formulario.get("fotografia");
    const foto = archivo instanceof File ? { bytes: new Uint8Array(await archivo.arrayBuffer()), tipoDeclarado: archivo.type } : undefined;
    return jsonApi(await registrarAvistamiento(acceso, { datos, foto }), 201);
  } catch (e) {
    return respuestaDeError(e);
  }
}
