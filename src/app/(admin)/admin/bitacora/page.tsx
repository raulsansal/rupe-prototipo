import type { Metadata } from "next";
import { ConsultaBitacora } from "@/components/features/bitacora/ConsultaBitacora";
import { exigirSesionDePagina } from "@/server/sesion/pagina";
import { consultarBitacora } from "@/server/servicios/admin/bitacoraAdmin";

export const metadata: Metadata = { title: "Bitácora de acciones · RUPE" };

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** ADM-12 (HU 058). Sale del almacén por el servicio de Administrador; tipo, fechas y página vienen de la URL y el servidor los valida. */
export default async function BitacoraDeAcciones({ searchParams }: PageProps<"/admin/bitacora">) {
  const q = await searchParams;
  const sesion = await exigirSesionDePagina("Administrador");
  const listado = await consultarBitacora(sesion, { tipo: q.tipo, desde: q.desde, hasta: q.hasta, pagina: q.pagina });
  return <ConsultaBitacora listado={listado} valores={{ tipo: texto(q.tipo), desde: texto(q.desde), hasta: texto(q.hasta) }} />;
}
