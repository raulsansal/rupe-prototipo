import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PantallaPendiente } from "@/components/features/PantallaPendiente";
import { resolverCaso } from "@/mocks/casos";

export const metadata: Metadata = { title: "Notificaciones del caso · RUPE" };

export default async function Pendiente({ params }: PageProps<"/tutor/casos/[folio]/notificaciones">) {
  const { folio } = await params;
  const origen = resolverCaso(folio);
  if (!origen) notFound();
  return <PantallaPendiente pantalla="Notificaciones del caso" href={`/tutor/casos/${origen.folio}`} etiquetaVolver="Regresar al detalle del caso" />;
}
