import type { Metadata } from "next";
import { DetalleCasoTutor } from "@/components/features/DetalleCasoTutor";
import type { EstadoCaso } from "@/mocks/tipos";
import { casoDelTutor } from "@/server/servicios/misRegistros";
import { paraPagina } from "@/server/sesion/pagina";
import { obtenerSesion } from "@/server/sesion/sesion";

export const metadata: Metadata = { title: "Detalle del caso · RUPE" };

/** ?estado=en-curso | localizado | cerrado fuerza la variante de la lámina 2.5 (SOLO maquetado: capturas y pruebas). En curso muestra «En seguimiento», como el ejemplo de la lámina. */
function estadoVariante(variante: string | undefined): EstadoCaso | undefined {
  if (variante === "localizado") return "Localizado";
  if (variante === "cerrado") return "Cerrado";
  if (variante === "en-curso") return "En seguimiento";
  return undefined;
}

/** TUT-05: lee el caso del ALMACÉN con la guarda de dueño dentro del servicio; solo se pasa la vista de su dueña (sin su nombre, correo ni teléfono, y sin el token del QR). */
export default async function DetalleCaso({ params, searchParams }: PageProps<"/tutor/casos/[folio]">) {
  const { folio } = await params;
  const { estado } = await searchParams;
  const caso = await paraPagina(casoDelTutor(await obtenerSesion(), folio, { estadoForzado: estadoVariante(typeof estado === "string" ? estado : undefined) }));
  return <DetalleCasoTutor caso={caso} />;
}
