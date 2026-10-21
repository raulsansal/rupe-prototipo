import type { ReactNode } from "react";
import { cx } from "@/lib/clases";
import { Icono, type NombreIcono } from "./Icono";

type Props = { icono?: NombreIcono; titulo: string; descripcion: string; accion?: ReactNode; className?: string };

/** Estado vacío: ícono grande, título, explicación y una acción. */
export function EstadoVacio({ icono = "pets", titulo, descripcion, accion, className }: Props) {
  return (
    <div className={cx("flex flex-col items-center gap-3 rounded-tarjeta border-2 border-dashed border-border p-8 text-center", className)}>
      <span className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icono nombre={icono} tamano={32} />
      </span>
      <h3 className="text-h3 font-semibold">{titulo}</h3>
      <p className="max-w-xs text-small text-text-muted">{descripcion}</p>
      {accion}
    </div>
  );
}
