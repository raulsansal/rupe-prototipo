import { Chip } from "./Chip";

export type Estatus = "Activo" | "Inactivo" | "Visible" | "Oculto" | "Valor protegido";

const TONOS: Record<Estatus, string> = {
  Activo: "bg-estado-localizado-bg text-estado-localizado-fg",
  Inactivo: "bg-estado-cerrado-bg text-estado-cerrado-fg",
  Visible: "bg-estado-localizado-bg text-estado-localizado-fg",
  Oculto: "bg-estado-avistamiento-bg text-estado-avistamiento-fg",
  "Valor protegido": "bg-estado-en-seguimiento-bg text-estado-en-seguimiento-fg",
};

/** Chip de estatus de cuentas, catálogos y avistamientos. */
export function ChipEstatus({ estatus, className }: { estatus: Estatus; className?: string }) {
  return (
    <Chip tono={TONOS[estatus]} className={className}>
      {estatus}
    </Chip>
  );
}
