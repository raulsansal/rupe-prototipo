import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetalleRegistroAdmin } from "@/components/features/moderacion/DetalleRegistroAdmin";
import { ErrorApp } from "@/server/errores";
import { exigirSesionDePagina } from "@/server/sesion/pagina";
import { detalleRegistro } from "@/server/servicios/admin/moderacionRegistros";

export const metadata: Metadata = { title: "Detalle del registro · RUPE" };

/** TUT-05 en variante Administrador (solo consulta, HU 016). El folio mal formado o inexistente es el mismo 404. */
export default async function DetalleRegistro({ params }: PageProps<"/admin/registros/[folio]">) {
  const { folio } = await params;
  const sesion = await exigirSesionDePagina("Administrador");
  const caso = await detalleRegistro(sesion, folio).catch((e) => {
    if (e instanceof ErrorApp && e.estado === 404) return notFound();
    throw e;
  });
  return <DetalleRegistroAdmin caso={caso} />;
}
