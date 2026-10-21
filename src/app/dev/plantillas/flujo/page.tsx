import type { Metadata } from "next";
import { PlantillaFlujo } from "@/components/layout/PlantillaFlujo";

export const metadata: Metadata = { title: "PlantillaFlujo · RUPE (solo desarrollo)" };

// Pasos del reporte de avistamiento (mockup 1.3). El registro de la persona tutora usa «Datos del perro» y «Circunstancias».
const PASOS = ["Inicio", "Fotografía", "Ubicación", "Fecha y estado", "Comentario", "Confirmar"];

export default function DemoFlujo() {
  return (
    <PlantillaFlujo pasos={PASOS} pasoActual={3} titulo="Ubicación" regresar={{ href: "/dev/plantillas" }} hrefSalir="/dev/plantillas">
      <div className="flex flex-col gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="flex h-32 items-center justify-center rounded-tarjeta border-2 border-dashed border-border bg-surface text-small text-text-muted">
            contenido de la pantalla
          </div>
        ))}
      </div>
    </PlantillaFlujo>
  );
}
