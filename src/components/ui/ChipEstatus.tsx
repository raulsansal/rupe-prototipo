import { Chip } from "./Chip";

export type Estatus = "Activo" | "Inactivo" | "Activa" | "Inactiva" | "Visible" | "Oculto" | "Valor protegido";

const TONOS: Record<Estatus, string> = {
  Activo: "bg-estado-localizado-bg text-estado-localizado-fg",
  Inactivo: "bg-estado-cerrado-bg text-estado-cerrado-fg",
  Activa: "bg-estado-localizado-bg text-estado-localizado-fg",
  Inactiva: "bg-estado-cerrado-bg text-estado-cerrado-fg",
  Visible: "bg-estado-localizado-bg text-estado-localizado-fg",
  Oculto: "bg-estado-avistamiento-bg text-estado-avistamiento-fg",
  // Neutro y con borde en ambos modos (como la etiqueta de la lámina 3.3): no usa los colores de estado del caso. Lleva candado y texto.
  "Valor protegido": "bg-surface text-text border! border-border-strong!",
};

const MARCADORES: Partial<Record<Estatus, "lock">> = { "Valor protegido": "lock" };

/** Chip de estatus de cuentas, catálogos (Activa/Inactiva en femenino) y avistamientos. */
export function ChipEstatus({ estatus, className }: { estatus: Estatus; className?: string }) {
  return (
    <Chip tono={TONOS[estatus]} marcador={MARCADORES[estatus]} className={className}>
      {estatus}
    </Chip>
  );
}
