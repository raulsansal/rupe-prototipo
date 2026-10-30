import { jsonApi, respuestaDeError } from "@/server/errores";
import { exigirMismoOrigen } from "@/server/http/origen";
import { restablecerParametros } from "@/server/servicios/admin/parametrosAdmin";
import { obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/** HU 054: «Restablecer valores por defecto» (copia `valorPorDefecto` a `valor`). Sin cuerpo. 200 igual que el PUT; una entrada de bitácora por parámetro que cambió. 401; 403. */
export async function POST(peticion: Request) {
  try {
    exigirMismoOrigen(peticion);
    return jsonApi(await restablecerParametros(await obtenerSesion()));
  } catch (e) {
    return respuestaDeError(e);
  }
}
