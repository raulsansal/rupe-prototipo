import type { Metadata } from "next";
import { ModeracionRegistros } from "@/components/features/moderacion/ModeracionRegistros";
import { exigirSesionDePagina } from "@/server/sesion/pagina";
import { listarRegistros } from "@/server/servicios/admin/moderacionRegistros";

export const metadata: Metadata = { title: "Moderación de registros · RUPE" };

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** ADM-04 y MOD-08. Lee el almacén por el servicio de Administrador (que exige la sesión por sí mismo); filtros y página vienen de la URL y el servidor los valida. */
export default async function ModeracionDeRegistros({ searchParams }: PageProps<"/admin/registros">) {
  const q = await searchParams;
  const sesion = await exigirSesionDePagina("Administrador");
  const listado = await listarRegistros(sesion, { estado: q.estado, alcaldia: q.alcaldia, pagina: q.pagina });
  return <ModeracionRegistros listado={listado} valores={{ estado: texto(q.estado), alcaldia: texto(q.alcaldia) }} />;
}
