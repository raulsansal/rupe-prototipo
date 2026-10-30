import type { Metadata } from "next";
import { ModeracionAvistamientos } from "@/components/features/moderacion/ModeracionAvistamientos";
import { ErrorApp } from "@/server/errores";
import { exigirSesionDePagina } from "@/server/sesion/pagina";
import { detalleAvistamiento, listarAvistamientos } from "@/server/servicios/admin/moderacionAvistamientos";

export const metadata: Metadata = { title: "Moderación de avistamientos · RUPE" };

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/**
 * ADM-05 y MOD-09. Lee el almacén por los servicios de Administrador. Filtros y página vienen de la URL (validados en el servidor); el detalle se abre con ?detalle=ID. La dirección de la
 * fotografía de un avistamiento «Fallecido» se entrega SOLO con ?foto=visible: sin él no está en el HTML, ni en los datos de Next, ni en el listado.
 */
export default async function ModeracionDeAvistamientos({ searchParams }: PageProps<"/admin/avistamientos">) {
  const q = await searchParams;
  const sesion = await exigirSesionDePagina("Administrador");
  const listado = await listarAvistamientos(sesion, { estatus: q.estatus, desde: q.desde, hasta: q.hasta, pagina: q.pagina });
  const id = texto(q.detalle);
  // Un detalle pedido que no existe no rompe la lista: simplemente no se abre.
  const detalle = id ? await detalleAvistamiento(sesion, id, { verFoto: q.foto === "visible" }).catch((e) => (e instanceof ErrorApp && e.estado === 404 ? undefined : Promise.reject(e))) : undefined;
  return <ModeracionAvistamientos listado={listado} valores={{ estatus: texto(q.estatus), desde: texto(q.desde), hasta: texto(q.hasta) }} detalle={detalle} />;
}
