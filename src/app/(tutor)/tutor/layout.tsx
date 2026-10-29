import type { ReactNode } from "react";
import { PlantillaTutor } from "@/components/layout/PlantillaTutor";
import { contarAvistamientosNuevos } from "@/server/servicios/seguimiento";
import { exigirSesionDePagina } from "@/server/sesion/pagina";

// El nombre y la insignia de la campana salen de la sesión real: la insignia cuenta los avistamientos NUEVOS y VISIBLES de todos los casos de la persona (P5); baja al abrir el detalle de cada uno
// (el detalle llama a router.refresh(), que vuelve a ejecutar este layout).
export default async function LayoutTutor({ children }: { children: ReactNode }) {
  const sesion = await exigirSesionDePagina("Tutor");
  return <PlantillaTutor sesion={{ nombre: sesion.nombre, avisosNuevos: await contarAvistamientosNuevos(sesion) }}>{children}</PlantillaTutor>;
}
