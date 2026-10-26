import type { ReactNode } from "react";
import { PlantillaAdmin } from "@/components/layout/PlantillaAdmin";
import { exigirSesionDePagina } from "@/server/sesion/pagina";

export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const sesion = await exigirSesionDePagina("Administrador");
  return <PlantillaAdmin sesion={{ nombre: sesion.nombre, rol: "Administrador" }}>{children}</PlantillaAdmin>;
}
