import "server-only";
// HU 057 (P6c): exportación del reporte a PDF o Excel. El servidor RECALCULA el reporte con los filtros recibidos y compara la huella que el cliente guardó al generarlo (HU 057, regla 1: solo se exporta lo que se
// vio en pantalla); nunca usa cifras del cliente. No guarda el archivo (los reportes no se almacenan) ni escribe en la bitácora (HU 058 no incluye «exportar»).
import { ErrorApp, validacion } from "../../errores";
import { generarPdf } from "../../exportacion/pdfReporte";
import { contenidoDeReporte } from "../../exportacion/contenidoDeReporte";
import { generarXlsx } from "../../exportacion/xlsxReporte";
import { exigirAdministrador, type SesionActual } from "../../sesion/guardas";
import { contextoPorDefecto, type Contexto } from "../contexto";
import { calcularReporte } from "./reportesAdmin";

export const FORMATOS_DE_EXPORTACION = { pdf: { extension: "pdf", tipo: "application/pdf" }, xlsx: { extension: "xlsx", tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } } as const;
export type ArchivoExportado = { bytes: Uint8Array; nombreArchivo: string; tipoContenido: string };
const HUELLA = /^[0-9a-f]{32}$/;

/** Cuerpo `{ formato: "pdf" | "xlsx", filtros: { desde, hasta, alcaldia?, categoria?, estadoCaso? }, huella }`. Cualquier otra clave (p. ej. cifras) se ignora. 422 por campo; 422 `SIN_DATOS`; 409 `DATOS_CAMBIARON`. */
export async function exportarReporte(sesion: SesionActual | undefined, cuerpo: unknown, ctx: Contexto = contextoPorDefecto()): Promise<ArchivoExportado> {
  exigirAdministrador(sesion);
  const c = typeof cuerpo === "object" && cuerpo !== null && !Array.isArray(cuerpo) ? (cuerpo as Record<string, unknown>) : {};
  const campos: Record<string, string> = {};
  const formato = typeof c.formato === "string" && Object.hasOwn(FORMATOS_DE_EXPORTACION, c.formato) ? (c.formato as keyof typeof FORMATOS_DE_EXPORTACION) : undefined;
  if (!formato) campos.formato = "Elige PDF o Excel.";
  const filtros = typeof c.filtros === "object" && c.filtros !== null && !Array.isArray(c.filtros) ? (c.filtros as Record<string, unknown>) : undefined;
  if (!filtros) campos.filtros = "Faltan los filtros del reporte.";
  const huella = typeof c.huella === "string" && HUELLA.test(c.huella) ? c.huella : undefined;
  if (!huella) campos.huella = "Genera el reporte antes de exportarlo.";
  if (!formato || !filtros || !huella) throw validacion(campos, "Revisa la solicitud de exportación.");

  const r = await calcularReporte({ desde: filtros.desde, hasta: filtros.hasta, alcaldia: filtros.alcaldia, categoria: filtros.categoria, estadoCaso: filtros.estadoCaso }, ctx); // 422 por campo
  if (r.vista.sinDatos) throw new ErrorApp(422, "SIN_DATOS", "No hay datos en el periodo y filtros seleccionados; no se puede exportar.");
  if (r.vista.huella !== huella) throw new ErrorApp(409, "DATOS_CAMBIARON", "Los datos cambiaron; genera el reporte de nuevo.");
  const contenido = contenidoDeReporte(r.vista);
  const bytes = formato === "pdf" ? await generarPdf(contenido, ctx.reloj()) : await generarXlsx(contenido);
  const { extension, tipo } = FORMATOS_DE_EXPORTACION[formato];
  return { bytes, nombreArchivo: `reporte-rupe-${r.filtros.desde}_${r.filtros.hasta}.${extension}`, tipoContenido: tipo };
}
