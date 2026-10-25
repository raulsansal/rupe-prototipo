import type { EstadoCaso } from "@/mocks/tipos";
import { Chip } from "./Chip";

// Clases literales para que Tailwind las detecte.
const TONOS: Record<EstadoCaso, string> = {
  Extraviado: "bg-estado-extraviado-bg text-estado-extraviado-fg",
  "En búsqueda": "bg-estado-en-busqueda-bg text-estado-en-busqueda-fg",
  "Avistamiento reportado": "bg-estado-avistamiento-bg text-estado-avistamiento-fg",
  "En seguimiento": "bg-estado-en-seguimiento-bg text-estado-en-seguimiento-fg",
  Localizado: "bg-estado-localizado-bg text-estado-localizado-fg",
  Cerrado: "bg-estado-cerrado-bg text-estado-cerrado-fg",
};

/** Chip del estado del caso: punto + texto, nunca solo color. */
export function ChipEstado({ estado, texto, className }: { estado: EstadoCaso; /** Reemplaza el nombre del estado (p. ej. «Cerrado (deshabilitado)»). */ texto?: string; className?: string }) {
  return (
    <Chip tono={TONOS[estado]} className={className}>
      {texto ?? estado}
    </Chip>
  );
}
