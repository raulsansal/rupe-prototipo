import type { Metadata } from "next";
import { ConsultaReportes } from "@/components/features/reportes/ConsultaReportes";
import { opcionesDeReporte } from "@/server/servicios/admin/reportesAdmin";
import { exigirSesionDePagina } from "@/server/sesion/pagina";

export const metadata: Metadata = { title: "Reportes · RUPE" };

/**
 * ADM-02 (HU 056 y 057). El servidor entrega las opciones de los filtros con su nombre vigente (todas las alcaldías del almacén, activas e inactivas, sin «Fuera de la Ciudad de México», que no puede ser
 * la alcaldía de un caso); el reporte lo genera `GET /api/admin/reportes` al pulsar «Generar reporte». Sin parámetros de consulta.
 */
export default async function Reportes() {
  const sesion = await exigirSesionDePagina("Administrador");
  return <ConsultaReportes opciones={await opcionesDeReporte(sesion)} />;
}
