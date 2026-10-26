import { exigirMismoOrigen } from "@/server/http/origen";
import { leerJson } from "@/server/http/cuerpo";
import { jsonApi, respuestaDeError } from "@/server/errores";
import { registrarTutor } from "@/server/servicios/registro";
import { DESTINO_POR_DEFECTO } from "@/server/sesion/destino";
import { establecerCookieDeSesion } from "@/server/sesion/sesion";

/** ACC-02 (HU 002 y 003): crea la cuenta (rol Tutor) con su aceptación del aviso y abre la sesión. Público; exige el mismo origen. */
export async function POST(peticion: Request) {
  try {
    exigirMismoOrigen(peticion);
    const r = await registrarTutor(await leerJson(peticion));
    await establecerCookieDeSesion(r.valorCookie, peticion, r.maxAge);
    return jsonApi({ destino: DESTINO_POR_DEFECTO.Tutor, usuario: { nombre: r.sesion.nombre, rol: r.sesion.rol } }, 201);
  } catch (e) {
    return respuestaDeError(e);
  }
}
