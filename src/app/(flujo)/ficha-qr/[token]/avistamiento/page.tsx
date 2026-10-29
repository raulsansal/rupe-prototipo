import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlujoAvistamiento } from "@/components/features/avistamiento/FlujoAvistamiento";
import { estadoInicial } from "@/components/features/avistamiento/variantes";
import { ReporteNoDisponible } from "@/components/features/ReporteNoDisponible";
import { PlantillaPublica } from "@/components/layout/PlantillaPublica";
import { ErrorApp } from "@/server/errores";
import { iniciarReporte } from "@/server/servicios/avistamientos";

// Ruta INTERNA del canal QR (rewrite de /ficha/<token>/avistamiento): noindex, sin referencia y con su propio 404 «QR no vigente».
export const metadata: Metadata = { title: "Reportar avistamiento · RUPE", robots: { index: false, follow: false }, referrer: "no-referrer" };

const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PaginaAvistamientoPorQr({ params, searchParams }: PageProps<"/ficha-qr/[token]/avistamiento">) {
  const { token } = await params;
  const q = await searchParams;
  let inicio;
  try {
    inicio = await iniciarReporte({ canal: "qr", token });
  } catch (e) {
    if (e instanceof ErrorApp && e.estado === 404) notFound(); // QR_NO_VIGENTE
    if (e instanceof ErrorApp && e.estado === 409) {
      return (
        <PlantillaPublica>
          <ReporteNoDisponible hrefFicha={`/ficha/${token}`} />
        </PlantillaPublica>
      );
    }
    throw e;
  }
  const { alcaldias, estadosAnimal, maximoMb, ...ficha } = inicio;
  return <FlujoAvistamiento ficha={ficha} acceso={{ canal: "qr", clave: token }} alcaldias={alcaldias} estadosAnimal={estadosAnimal} maximoMb={maximoMb} inicial={estadoInicial({ paso: primero(q.paso), caso: primero(q.caso), datos: primero(q.datos) })} />;
}
