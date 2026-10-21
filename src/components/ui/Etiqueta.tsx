import type { ReactNode } from "react";
import { cx } from "@/lib/clases";

type Props = { tono?: "neutra" | "nuevo"; children: ReactNode; className?: string };

const TONOS = {
  neutra: "borde-chip bg-estado-cerrado-bg text-estado-cerrado-fg",
  nuevo: "bg-accent text-on-accent",
} as const;

/** Etiqueta de texto (p. ej. «Administrador», «Nuevo»). */
export function Etiqueta({ tono = "neutra", children, className }: Props) {
  return (
    <span className={cx("box-border inline-flex h-7 items-center whitespace-nowrap rounded-chip px-3 text-small font-medium", TONOS[tono], className)}>
      {children}
    </span>
  );
}
