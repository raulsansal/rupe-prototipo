import type { ReactNode } from "react";
import { cx } from "@/lib/clases";
import { Icono, type NombreIcono } from "./Icono";

type Props = {
  /** Clases de fondo y color de texto, con tokens (p. ej. "bg-estado-localizado-bg text-estado-localizado-fg"). */
  tono: string;
  /** Punto de color (por defecto) o un ícono. El chip siempre lleva texto. */
  marcador?: "punto" | NombreIcono;
  children: ReactNode;
  className?: string;
};

/** Base de los chips de estado y de estatus: 24 px de alto, radio total, texto 12/600, borde fino solo en oscuro. */
export function Chip({ tono, marcador = "punto", children, className }: Props) {
  return (
    <span
      className={cx(
        "borde-chip box-border inline-flex min-h-6 max-w-full items-center gap-1.5 rounded-chip px-2.5 py-0.5 text-caption font-semibold",
        tono,
        className,
      )}
    >
      {marcador === "punto" ? (
        <span aria-hidden="true" className="size-[7px] shrink-0 rounded-full bg-current" />
      ) : (
        <Icono nombre={marcador} tamano={16} />
      )}
      {children}
    </span>
  );
}
