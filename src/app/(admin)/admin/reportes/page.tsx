import type { Metadata } from "next";
import { ConsultaReportes } from "@/components/features/reportes/ConsultaReportes";
import { EstadoCarga } from "@/components/ui/EstadoCarga";
import { SIN_FILTROS } from "@/lib/reportes";

export const metadata: Metadata = { title: "Reportes · RUPE" };

const texto = (p: string | string[] | undefined) => (typeof p === "string" ? p : "");

/**
 * ADM-02 (HU 056 y 057). Los parámetros de consulta solo fijan variantes (capturas y pruebas): ?estado=cargando | vacio (periodo sin datos);
 * ?desde= &hasta= &alcaldia= &categoria= &estadoCaso= abren con esos filtros ya generados; ?generar=1 intenta generar con lo que haya (errores de rango).
 */
export default async function Reportes({ searchParams }: PageProps<"/admin/reportes">) {
  const q = await searchParams;
  if (q.estado === "cargando")
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h1">Reportes</h1>
        <div className="flex flex-col gap-3" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <EstadoCarga sinFoto key={i} etiqueta="Generando el reporte…" />
          ))}
        </div>
      </div>
    );
  const filtros = q.estado === "vacio" ? { ...SIN_FILTROS, desde: "2026-10-19", hasta: "2026-10-31" } : { desde: texto(q.desde), hasta: texto(q.hasta), alcaldia: texto(q.alcaldia), categoria: texto(q.categoria), estadoCaso: texto(q.estadoCaso) };
  const generar = q.estado === "vacio" || q.generar === "1" || !!(filtros.desde || filtros.hasta);
  return <ConsultaReportes filtrosIniciales={filtros} generarAlCargar={generar} />;
}
