"use client";

import { useEffect } from "react";
import { PantallaError } from "@/components/features/PantallaError";
import { PlantillaPublica } from "@/components/layout/PlantillaPublica";

// TRA-04. Captura los errores inesperados de cualquier ruta bajo el layout raíz.
export default function ErrorInesperado({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <PlantillaPublica>
      <PantallaError onReintentar={retry} />
    </PlantillaPublica>
  );
}
