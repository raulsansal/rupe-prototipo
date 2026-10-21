import type { ReactNode } from "react";
import { PlantillaTutor } from "@/components/layout/PlantillaTutor";
import { SESION_TUTOR_EJEMPLO } from "@/mocks/sesion";

// Sin autenticación en esta fase: la sesión es ficticia.
export default function LayoutTutor({ children }: { children: ReactNode }) {
  return <PlantillaTutor sesion={SESION_TUTOR_EJEMPLO}>{children}</PlantillaTutor>;
}
