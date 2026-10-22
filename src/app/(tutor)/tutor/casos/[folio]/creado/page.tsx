import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RegistroCreado } from "@/components/features/RegistroCreado";
import { aFichaPublica, resolverCaso } from "@/mocks/casos";

export const metadata: Metadata = { title: "Registro creado · RUPE" };

export default async function PaginaRegistroCreado({ params }: PageProps<"/tutor/casos/[folio]/creado">) {
  const { folio } = await params;
  const origen = resolverCaso(folio);
  if (!origen) notFound();
  // Un registro recién creado queda «En búsqueda» (R6); solo se pasan folio y estado, nunca el resto del caso.
  const { folio: f } = aFichaPublica(origen);
  return <RegistroCreado ficha={{ folio: f, estado: "En búsqueda" }} />;
}
