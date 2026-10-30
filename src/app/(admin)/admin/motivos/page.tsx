import type { Metadata } from "next";
import { PaginaCatalogo } from "@/components/features/catalogos/PaginaCatalogo";

export const metadata: Metadata = { title: "Catálogo de motivos de extravío · RUPE" };

/** ADM-08 (HU 049 a 052). Lee el almacén por el servicio de Administrador; la búsqueda (?q=) y la página (?pagina=) vienen de la URL y el servidor las valida. */
export default function CatalogoMotivos({ searchParams }: PageProps<"/admin/motivos">) {
  return <PaginaCatalogo tipo="motivos" searchParams={searchParams} />;
}
