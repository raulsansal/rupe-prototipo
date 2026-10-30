import type { Metadata } from "next";
import { GestionUsuarios } from "@/components/features/usuarios/GestionUsuarios";
import { exigirSesionDePagina } from "@/server/sesion/pagina";
import { listarUsuarios } from "@/server/servicios/admin/usuariosAdmin";

export const metadata: Metadata = { title: "Usuarios · RUPE" };

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** ADM-03 y MOD-10. Lee el almacén por el servicio de Administrador; búsqueda, estatus y página vienen de la URL y el servidor los valida. */
export default async function Usuarios({ searchParams }: PageProps<"/admin/usuarios">) {
  const q = await searchParams;
  const sesion = await exigirSesionDePagina("Administrador");
  const listado = await listarUsuarios(sesion, { texto: q.q, estatus: q.estatus, pagina: q.pagina });
  return <GestionUsuarios listado={listado} valores={{ q: texto(q.q), estatus: texto(q.estatus) }} />;
}
