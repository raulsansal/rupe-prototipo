import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FichaPublicaVista } from "@/components/features/FichaPublicaVista";
import { ErrorApp } from "@/server/errores";
import { consultarFichaPorToken } from "@/server/servicios/fichas";

// Ruta INTERNA del canal QR: la URL pública es /ficha/<token> (rewrite de next.config.ts). Esta página repite el token en su enlace de «Reportar avistamiento» (el que la persona ya
// trae en la URL); lleva noindex y Referrer-Policy: no-referrer. El botón de compartir lleva el FOLIO, nunca el token.
export const metadata: Metadata = { title: "Ficha pública · RUPE", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function PaginaFichaPorQr({ params }: PageProps<"/ficha-qr/[token]">) {
  const { token } = await params;
  const ficha = await consultarFichaPorToken(token).catch((e) => {
    if (e instanceof ErrorApp && e.estado === 404) notFound(); // QR_NO_VIGENTE: la pantalla propia del canal QR
    throw e;
  });
  return <FichaPublicaVista ficha={ficha} hrefAvistamiento={`/ficha/${token}/avistamiento`} />;
}
