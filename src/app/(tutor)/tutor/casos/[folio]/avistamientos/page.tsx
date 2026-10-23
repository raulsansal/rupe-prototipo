import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListaAvistamientos, type ItemAvistamiento } from "@/components/features/avistamientos/ListaAvistamientos";
import { fechaLocalISO } from "@/lib/formato";
import { avistamientosDelCaso, esFallecido } from "@/mocks/avistamientos";
import { resolverCaso } from "@/mocks/casos";

export const metadata: Metadata = { title: "Avistamientos del caso · RUPE" };

/** TUT-08. ?filtros=abiertos muestra los filtros desplegados (capturas y pruebas). */
export default async function AvistamientosDelCaso({ params, searchParams }: PageProps<"/tutor/casos/[folio]/avistamientos">) {
  const { folio } = await params;
  const { filtros } = await searchParams;
  const origen = resolverCaso(folio);
  if (!origen) notFound();
  // Un avistamiento «Fallecido» llega a la lista sin fotografía ni estados: solo el aviso sobrio (HU 039).
  const items: ItemAvistamiento[] = avistamientosDelCaso(origen.folio).map((a) => {
    const fallecido = esFallecido(a);
    return { id: a.id, fechaHora: a.fechaHora, alcaldia: a.alcaldia, coloniaZona: a.coloniaZona, estados: fallecido ? [] : a.estadosAnimal, fotografiaUrl: fallecido ? undefined : a.fotografiaUrl, fallecido };
  });
  return <ListaAvistamientos folio={origen.folio} nombrePerro={origen.nombre} fotografiaPerro={origen.fotografiaUrl} registro={fechaLocalISO(origen.fechaRegistro)} items={items} filtrosAbiertos={filtros === "abiertos"} />;
}
