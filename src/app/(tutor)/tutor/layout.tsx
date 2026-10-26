import type { ReactNode } from "react";
import { PlantillaTutor } from "@/components/layout/PlantillaTutor";
import { SESION_TUTOR_EJEMPLO } from "@/mocks/sesion";
import { exigirSesionDePagina } from "@/server/sesion/pagina";

// El nombre sale de la sesión real; la insignia de avisos sigue siendo de los mocks (se conecta en P5).
export default async function LayoutTutor({ children }: { children: ReactNode }) {
  const sesion = await exigirSesionDePagina("Tutor");
  return <PlantillaTutor sesion={{ nombre: sesion.nombre, avisosNuevos: SESION_TUTOR_EJEMPLO.avisosNuevos }}>{children}</PlantillaTutor>;
}
