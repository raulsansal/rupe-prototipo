import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetalleRegistroAdmin } from "@/components/features/moderacion/DetalleRegistroAdmin";
import { CASOS_MODERACION } from "@/mocks/moderacion";

export const metadata: Metadata = { title: "Detalle del registro · RUPE" };

/** TUT-05 en variante Administrador (solo consulta). ?modal=deshabilitar abre MOD-08 al cargar (capturas y pruebas). */
export default async function DetalleRegistro({ params, searchParams }: PageProps<"/admin/registros/[folio]">) {
  const { folio } = await params;
  const { modal } = await searchParams;
  const caso = CASOS_MODERACION.find((c) => c.folio === folio);
  if (!caso) notFound();
  return <DetalleRegistroAdmin caso={caso} modalInicial={modal === "deshabilitar"} />;
}
