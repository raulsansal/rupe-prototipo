import type { ReactNode } from "react";
import { cx } from "@/lib/clases";
import { Icono, type NombreIcono } from "./Icono";

export type TipoAlerta = "info" | "exito" | "advertencia" | "peligro";

const TIPOS: Record<TipoAlerta, { icono: NombreIcono; clases: string; role: "status" | "alert" }> = {
  info: { icono: "info", clases: "border-info bg-info-bg [--color-alerta:var(--info)]", role: "status" },
  exito: { icono: "check_circle", clases: "border-success bg-success-bg [--color-alerta:var(--success)]", role: "status" },
  advertencia: { icono: "warning", clases: "border-warning bg-warning-bg [--color-alerta:var(--warning)]", role: "alert" },
  peligro: { icono: "error", clases: "border-danger bg-danger-bg [--color-alerta:var(--danger)]", role: "alert" },
};

type Props = { tipo: TipoAlerta; titulo: string; children: ReactNode; className?: string };

/** Alerta en línea: ícono + título + texto + borde del color del tipo (nunca solo color). */
export function Alerta({ tipo, titulo, children, className }: Props) {
  const { icono, clases, role } = TIPOS[tipo];
  return (
    <div role={role} className={cx("flex gap-3 rounded-campo border-l-4 p-4", clases, className)}>
      <Icono nombre={icono} className="mt-0.5 text-(--color-alerta)" />
      <div>
        <p className="text-small font-bold">{titulo}</p>
        <p className="text-small">{children}</p>
      </div>
    </div>
  );
}
