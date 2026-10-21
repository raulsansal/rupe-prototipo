import type { Metadata } from "next";
import { PlantillaTutor } from "@/components/layout/PlantillaTutor";
import { SESION_TUTOR_EJEMPLO } from "@/mocks/sesion";
import { Relleno } from "../Relleno";

export const metadata: Metadata = { title: "PlantillaTutor · RUPE (solo desarrollo)" };

export default function DemoTutor() {
  return (
    <PlantillaTutor sesion={SESION_TUTOR_EJEMPLO} itemActivo="/tutor">
      <Relleno titulo="Mis registros" bloques={4} />
    </PlantillaTutor>
  );
}
