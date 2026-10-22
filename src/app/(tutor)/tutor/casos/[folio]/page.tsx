import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetalleCasoTutor } from "@/components/features/DetalleCasoTutor";
import { aCasoTutor, resolverCaso } from "@/mocks/casos";
import type { EstadoCaso } from "@/mocks/tipos";

export const metadata: Metadata = { title: "Detalle del caso · RUPE" };

/** ?estado=en-curso | localizado | cerrado fuerza la variante de la lámina 2.5 (capturas y pruebas). En curso muestra «En seguimiento», como el ejemplo de la lámina. */
function estadoVariante(real: EstadoCaso, variante: string | undefined): EstadoCaso {
  if (variante === "localizado") return "Localizado";
  if (variante === "cerrado") return "Cerrado";
  if (variante === "en-curso") return "En seguimiento";
  return real;
}

export default async function DetalleCaso({ params, searchParams }: PageProps<"/tutor/casos/[folio]">) {
  const { folio } = await params;
  const { estado } = await searchParams;
  const origen = resolverCaso(folio);
  if (!origen) notFound();
  // Solo se pasa la vista de la persona tutora dueña: sin su nombre, correo ni teléfono, y sin el token del QR.
  return <DetalleCasoTutor caso={aCasoTutor(origen, estadoVariante(origen.estado, typeof estado === "string" ? estado : undefined))} />;
}
