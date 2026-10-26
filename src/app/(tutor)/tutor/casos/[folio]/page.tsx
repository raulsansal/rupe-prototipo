import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetalleCasoTutor } from "@/components/features/DetalleCasoTutor";
import { PantallaPendiente } from "@/components/features/PantallaPendiente";
import { esCasoPropio } from "@/server/servicios/extravio";
import { obtenerSesion } from "@/server/sesion/sesion";
import { aCasoTutor, resolverCaso } from "@/mocks/casos";
import type { EstadoCaso } from "@/mocks/tipos";

export const metadata: Metadata = { title: "Detalle del caso · RUPE" };

/** ?estado=en-curso | localizado | cerrado fuerza la variante de la lámina 2.5 (capturas y pruebas). En curso muestra «En seguimiento», como el ejemplo de la lámina. */
function estadoVariante(real: EstadoCaso, variante: string | undefined): EstadoCaso {
  if (variante === "localizado") return "Localizado";
  if (variante === "cerrado") return "Cerrado";
  if (variante === "en-curso") return "En seguimiento";
  return real;
}

export default async function DetalleCaso({ params, searchParams }: PageProps<"/tutor/casos/[folio]">) {
  const { folio } = await params;
  const { estado } = await searchParams;
  const origen = resolverCaso(folio);
  // Un caso REAL recién registrado por esta persona aún no tiene su detalle conectado (bloque P2b): pantalla pendiente, nunca 404.
  if (!origen && (await esCasoPropio(await obtenerSesion(), folio))) return <PantallaPendiente pantalla="Detalle del caso" href="/tutor" etiquetaVolver="Ir a mis registros" />;
  if (!origen) notFound();
  // Solo se pasa la vista de la persona tutora dueña: sin su nombre, correo ni teléfono, y sin el token del QR.
  return <DetalleCasoTutor caso={aCasoTutor(origen, estadoVariante(origen.estado, typeof estado === "string" ? estado : undefined))} />;
}
