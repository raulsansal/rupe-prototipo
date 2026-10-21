import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/clases";
import { Icono } from "./Icono";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> & {
  seleccionado?: boolean;
  /** Muestra la × para quitar el filtro cuando está seleccionado. */
  quitable?: boolean;
};

/** Chip de filtro seleccionable (botón con aria-pressed). La píldora mide 32 px; el área pulsable, 44 px. */
export function ChipFiltro({ seleccionado = false, quitable = false, className, children, type = "button", ...resto }: Props) {
  return (
    <button type={type} aria-pressed={seleccionado} className={cx("group inline-flex h-tactil items-center disabled:cursor-not-allowed", className)} {...resto}>
      <span
        className={cx(
          "borde-campo box-border inline-flex h-8 items-center gap-1.5 rounded-chip px-4 text-small font-semibold transition-colors motion-reduce:transition-none",
          seleccionado
            ? "border-primary bg-primary text-on-primary"
            : "border-border-strong bg-transparent text-text group-hover:bg-primary-soft group-active:bg-primary-soft",
          "group-disabled:border-border group-disabled:bg-transparent group-disabled:text-disabled-text",
        )}
      >
        {children}
        {seleccionado && quitable && <Icono nombre="close" tamano={16} />}
      </span>
    </button>
  );
}
