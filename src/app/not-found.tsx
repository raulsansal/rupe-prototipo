import type { Metadata } from "next";
import { PantallaNoEncontrada } from "@/components/features/PantallaNoEncontrada";
import { PlantillaPublica } from "@/components/layout/PlantillaPublica";

export const metadata: Metadata = { title: "Página no encontrada · RUPE" };

// TRA-01. Vive fuera de los grupos de rutas, por eso lleva su propia plantilla.
export default function NoEncontrada() {
  return (
    <PlantillaPublica>
      <PantallaNoEncontrada />
    </PlantillaPublica>
  );
}
