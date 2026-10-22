"use client";

import { PantallaError } from "@/components/features/PantallaError";
import { PlantillaPublica } from "@/components/layout/PlantillaPublica";

// Demostración de TRA-04 sin provocar un error real. «Reintentar» solo recarga la página de demostración.
export default function DemoError() {
  return (
    <PlantillaPublica>
      <PantallaError onReintentar={() => window.location.reload()} />
    </PlantillaPublica>
  );
}
