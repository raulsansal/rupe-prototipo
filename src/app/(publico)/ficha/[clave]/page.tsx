import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FichaPublicaVista } from "@/components/features/FichaPublicaVista";
import { PATRON_FOLIO, type FichaPublica } from "@/mocks/tipos";
import { normalizarFolio } from "@/server/dominio/folio";
import { ErrorApp } from "@/server/errores";
import { consultarFichaPorFolio } from "@/server/servicios/fichas";

export const metadata: Metadata = { title: "Ficha pública · RUPE" };

/** ?estado=en-curso | localizado | no-disponible fuerza el estado de la pantalla (SOLO capturas y pruebas); sin él, manda el estado real del caso. */
function aplicarVariante(ficha: FichaPublica, estado: string | undefined): FichaPublica | "no-disponible" {
  if (estado === "no-disponible") return "no-disponible";
  if (estado === "localizado") return { ...ficha, estado: "Localizado" };
  if (estado === "en-curso") return ficha.estado === "Localizado" || ficha.estado === "Cerrado" ? { ...ficha, estado: "En búsqueda" } : ficha;
  return ficha;
}

/**
 * HU 024 y 025, canal FOLIO: la ficha sale del almacén (R33): un folio inexistente, mal formado, cancelado, deshabilitado o de un caso cerrado responde el MISMO 404
 * (con su pantalla «Folio no encontrado»). El canal QR (/ficha/<token>) lo atiende /ficha-qr/[token] mediante un rewrite; aquí nunca entra un token.
 */
export default async function PaginaFicha({ params, searchParams }: PageProps<"/ficha/[clave]">) {
  const { clave } = await params;
  const { estado } = await searchParams;
  const folio = normalizarFolio(clave);
  if (!PATRON_FOLIO.test(folio)) notFound();
  const real = await consultarFichaPorFolio(folio).catch((e) => {
    if (e instanceof ErrorApp && e.estado === 404) notFound();
    throw e;
  });
  const ficha = aplicarVariante(real, typeof estado === "string" ? estado : undefined);
  if (ficha === "no-disponible") notFound();
  return <FichaPublicaVista ficha={ficha} hrefAvistamiento={`/ficha/${ficha.folio}/avistamiento`} />;
}
