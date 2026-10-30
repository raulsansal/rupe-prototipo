import { formatoInvalido, respuestaDeError, SIN_CACHE } from "@/server/errores";
import { leerJson } from "@/server/http/cuerpo";
import { exigirMismoOrigen } from "@/server/http/origen";
import { exportarReporte } from "@/server/servicios/admin/exportacionAdmin";
import { exigirAdministrador } from "@/server/sesion/guardas";
import { obtenerSesion } from "@/server/sesion/sesion";

export const runtime = "nodejs";

/**
 * HU 057: exporta el reporte a PDF o Excel. Cuerpo `{ formato: "pdf" | "xlsx", filtros: {…los de GET /api/admin/reportes}, huella }`. El servidor recalcula el reporte con esos filtros y compara la huella; no usa
 * cifras del cliente. 200 con el archivo (`attachment; filename="reporte-rupe-<desde>_<hasta>.<ext>"`, `no-store`, `nosniff`; no se guarda); 401; 403; 409 `DATOS_CAMBIARON`; 422 `SIN_DATOS` o por campo. No escribe en la bitácora.
 */
export async function POST(peticion: Request) {
  try {
    exigirMismoOrigen(peticion);
    const sesion = await obtenerSesion();
    exigirAdministrador(sesion);
    const cuerpo = await leerJson(peticion);
    if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) throw formatoInvalido("CUERPO_INVALIDO", "El cuerpo debe ser un objeto JSON.");
    const { bytes, nombreArchivo, tipoContenido } = await exportarReporte(sesion, cuerpo);
    return new Response(bytes as BodyInit, { headers: { "Content-Type": tipoContenido, "Content-Disposition": `attachment; filename="${nombreArchivo}"`, ...SIN_CACHE, "X-Content-Type-Options": "nosniff" } });
  } catch (e) {
    return respuestaDeError(e);
  }
}
