import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlujoAvistamiento } from "@/components/features/avistamiento/FlujoAvistamiento";
import { estadoInicial } from "@/components/features/avistamiento/variantes";
import { ReporteNoDisponible } from "@/components/features/ReporteNoDisponible";
import { PlantillaPublica } from "@/components/layout/PlantillaPublica";
import { PATRON_FOLIO } from "@/mocks/tipos";
import { normalizarFolio } from "@/server/dominio/folio";
import { ErrorApp } from "@/server/errores";
import { iniciarReporte } from "@/server/servicios/avistamientos";

export const metadata: Metadata = { title: "Reportar avistamiento · RUPE" };

const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * HU 028, canal FOLIO: al ENTRAR se valida el acceso. Un folio inexistente, mal formado, cancelado o deshabilitado da 404; Localizado o Cerrado (R13) muestra su mensaje en lugar del
 * formulario. ?paso, ?caso y ?datos solo fijan el estado inicial para capturas y pruebas (ver CLAUDE.md).
 */
export default async function PaginaAvistamiento({ params, searchParams }: PageProps<"/ficha/[clave]/avistamiento">) {
  const { clave } = await params;
  const q = await searchParams;
  const folio = normalizarFolio(clave);
  if (!PATRON_FOLIO.test(folio)) notFound();
  let inicio;
  try {
    inicio = await iniciarReporte({ canal: "folio", folio });
  } catch (e) {
    if (e instanceof ErrorApp && e.estado === 404) notFound();
    if (e instanceof ErrorApp && e.estado === 409) {
      return (
        <PlantillaPublica>
          <ReporteNoDisponible hrefFicha={`/ficha/${folio}`} />
        </PlantillaPublica>
      );
    }
    throw e;
  }
  const { alcaldias, estadosAnimal, maximoMb, ...ficha } = inicio;
  return <FlujoAvistamiento ficha={ficha} acceso={{ canal: "folio", clave: folio }} alcaldias={alcaldias} estadosAnimal={estadosAnimal} maximoMb={maximoMb} inicial={estadoInicial({ paso: primero(q.paso), caso: primero(q.caso), datos: primero(q.datos) })} />;
}
