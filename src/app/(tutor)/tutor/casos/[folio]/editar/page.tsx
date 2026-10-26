import type { Metadata } from "next";
import { PantallaPendiente } from "@/components/features/PantallaPendiente";
import { exigirCasoPropio } from "@/server/servicios/misRegistros";
import { paraPagina } from "@/server/sesion/pagina";
import { obtenerSesion } from "@/server/sesion/sesion";

export const metadata: Metadata = { title: "Editar registro · RUPE" };

export default async function Pendiente({ params }: PageProps<"/tutor/casos/[folio]/editar">) {
  const { folio } = await params;
  // Solo la dueña (404 igual para ajeno, inexistente y mal formado); la pantalla sigue pendiente, como en el maquetado.
  const caso = await paraPagina(exigirCasoPropio(await obtenerSesion(), folio));
  return <PantallaPendiente pantalla="Editar registro" href={`/tutor/casos/${caso.folio}`} etiquetaVolver="Regresar al detalle del caso" />;
}
