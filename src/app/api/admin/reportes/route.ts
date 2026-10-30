import { jsonApi, respuestaDeError } from "@/server/errores";
import { generarReporteAdmin } from "@/server/servicios/admin/reportesAdmin";
import { obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/**
 * HU 056: reporte estadístico. `desde` y `hasta` (obligatorios); `alcaldia` (id de la alcaldía del CASO), `categoria` (id de la categoría de motivo) y `estadoCaso` (nombre), opcionales. 200 con el reporte y su
 * `huella` (la que debe devolver la exportación), o 200 `{ sinDatos: true }` si no hay casos con esos filtros; 401; 403; 422 con `campos`. El reporte no se guarda.
 */
export async function GET(peticion: Request) {
  try {
    const q = new URL(peticion.url).searchParams;
    return jsonApi(await generarReporteAdmin(await obtenerSesion(), { desde: q.get("desde") ?? undefined, hasta: q.get("hasta") ?? undefined, alcaldia: q.get("alcaldia") ?? undefined, categoria: q.get("categoria") ?? undefined, estadoCaso: q.get("estadoCaso") ?? undefined }));
  } catch (e) {
    return respuestaDeError(e);
  }
}
