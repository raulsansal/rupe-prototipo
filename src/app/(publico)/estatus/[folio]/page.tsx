import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EstatusDelCaso } from "@/components/features/EstatusDelCaso";
import { PATRON_FOLIO } from "@/mocks/tipos";
import { normalizarFolio } from "@/server/dominio/folio";
import { ErrorApp } from "@/server/errores";
import { consultarEstatusPorFolio } from "@/server/servicios/fichas";

export const metadata: Metadata = { title: "Estatus del caso · RUPE", robots: { index: false } };

/**
 * HU 038 y 046: estatus público del caso por FOLIO (el enlace que comparte la persona tutora; nunca un token). R33: un folio inexistente, mal formado, cancelado o deshabilitado responde el
 * MISMO 404 real con «Folio no encontrado»; un caso cerrado por cierre confirmado se muestra «Cerrado». Solo estatus y fecha del último cambio.
 */
export default async function EstatusPorFolio({ params }: PageProps<"/estatus/[folio]">) {
  const { folio } = await params;
  const f = normalizarFolio(folio);
  if (!PATRON_FOLIO.test(f)) notFound();
  const e = await consultarEstatusPorFolio(f).catch((err) => {
    if (err instanceof ErrorApp && err.estado === 404) notFound();
    throw err;
  });
  return <EstatusDelCaso folio={e.folio} estado={e.estado} fechaCambioEstado={e.fechaCambioEstado} />;
}
