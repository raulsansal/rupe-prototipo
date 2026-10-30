import type { Metadata } from "next";
import { PaginaCatalogo } from "@/components/features/catalogos/PaginaCatalogo";

export const metadata: Metadata = { title: "Catálogo de estados del animal · RUPE" };

/** ADM-09 (HU 049 a 052). Lee el almacén por el servicio de Administrador; la búsqueda (?q=) y la página (?pagina=) vienen de la URL y el servidor las valida. */
export default function CatalogoEstadosAnimal({ searchParams }: PageProps<"/admin/estados-animal">) {
  return <PaginaCatalogo tipo="estados-animal" searchParams={searchParams} />;
}
