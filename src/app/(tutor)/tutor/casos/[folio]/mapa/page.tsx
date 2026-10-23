import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MapaAvistamientos } from "@/components/features/avistamientos/MapaAvistamientos";
import { fechaLocalISO } from "@/lib/formato";
import { avistamientosCronologicos } from "@/mocks/avistamientos";
import { resolverCaso } from "@/mocks/casos";

export const metadata: Metadata = { title: "Avistamientos en mapa · RUPE" };

/** TUT-09. ?ruta=visible abre la ruta al cargar y ?filtro=abierto el filtro de fechas (capturas y pruebas). */
export default async function AvistamientosEnMapa({ params, searchParams }: PageProps<"/tutor/casos/[folio]/mapa">) {
  const { folio } = await params;
  const { ruta, filtro } = await searchParams;
  const origen = resolverCaso(folio);
  if (!origen) notFound();
  const puntos = avistamientosCronologicos(origen.folio).map(({ id, fechaHora, alcaldia, coloniaZona, latitud, longitud }) => ({ id, fechaHora, alcaldia, coloniaZona, latitud, longitud }));
  // Sin avistamientos no hay nada que ubicar: «Mapa» está deshabilitado en TUT-08, así que se vuelve a la lista.
  if (puntos.length === 0) redirect(`/tutor/casos/${origen.folio}/avistamientos`);
  return <MapaAvistamientos folio={origen.folio} registro={fechaLocalISO(origen.fechaRegistro)} puntos={puntos} rutaInicial={ruta === "visible"} filtroAbiertoInicial={filtro === "abierto"} />;
}
