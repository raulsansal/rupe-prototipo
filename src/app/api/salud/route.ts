import { jsonApi } from "@/server/errores";
import { obtenerAlmacen } from "@/server/memoria/almacen";

/** Salud del sistema: responde 200 con el entorno y el tamaño de los datos ficticios en memoria. */
export async function GET() {
  const a = obtenerAlmacen();
  return jsonApi({ estado: "ok", entorno: process.env.NODE_ENV, datos: { usuarios: a.usuarios.length, casos: a.casos.length, avistamientos: a.avistamientos.length } });
}
