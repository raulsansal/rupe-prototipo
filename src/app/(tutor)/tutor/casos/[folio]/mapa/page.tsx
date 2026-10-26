import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MapaAvistamientos } from "@/components/features/avistamientos/MapaAvistamientos";
import { fechaLocalISO } from "@/lib/formato";
import { puntosDelMapa } from "@/server/servicios/misRegistros";
import { paraPagina } from "@/server/sesion/pagina";
import { obtenerSesion } from "@/server/sesion/sesion";

export const metadata: Metadata = { title: "Avistamientos en mapa · RUPE" };

/** TUT-09. ?ruta=visible abre la ruta al cargar y ?filtro=abierto el filtro de fechas (capturas y pruebas). */
export default async function AvistamientosEnMapa({ params, searchParams }: PageProps<"/tutor/casos/[folio]/mapa">) {
  const { folio } = await params;
  const { ruta, filtro } = await searchParams;
  const mapa = await paraPagina(puntosDelMapa(await obtenerSesion(), folio));
  // Sin avistamientos no hay nada que ubicar: «Mapa» está deshabilitado en TUT-08, así que se vuelve a la lista.
  if (mapa.puntos.length === 0) redirect(`/tutor/casos/${mapa.folio}/avistamientos`);
  return <MapaAvistamientos folio={mapa.folio} registro={fechaLocalISO(mapa.registro)} puntos={mapa.puntos} rutaInicial={ruta === "visible"} filtroAbiertoInicial={filtro === "abierto"} />;
}
