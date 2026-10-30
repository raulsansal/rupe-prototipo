import type { Metadata } from "next";
import { PaginaCatalogo } from "@/components/features/catalogos/PaginaCatalogo";

export const metadata: Metadata = { title: "Catálogo de razas · RUPE" };

/** ADM-07 (HU 049 a 052). Lee el almacén por el servicio de Administrador; la búsqueda (?q=) y la página (?pagina=) vienen de la URL y el servidor las valida. */
export default function CatalogoRazas({ searchParams }: PageProps<"/admin/razas">) {
  return <PaginaCatalogo tipo="razas" searchParams={searchParams} />;
}
