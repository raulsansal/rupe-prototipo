import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PantallaPendiente } from "@/components/features/PantallaPendiente";
import { resolverCaso } from "@/mocks/casos";

export const metadata: Metadata = { title: "Mapa de avistamientos · RUPE" };

export default async function Pendiente({ params }: PageProps<"/tutor/casos/[folio]/mapa">) {
  const { folio } = await params;
  const origen = resolverCaso(folio);
  if (!origen) notFound();
  return <PantallaPendiente pantalla="Mapa de avistamientos" href={`/tutor/casos/${origen.folio}`} etiquetaVolver="Regresar al detalle del caso" />;
}
