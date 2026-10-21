import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/clases";
import { Icono, type NombreIcono } from "./Icono";
import { InsigniaContador } from "./InsigniaContador";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  icono: NombreIcono;
  /** Nombre accesible del botón (obligatorio: no hay texto visible). */
  etiqueta: string;
  /** Contador sobre el ícono (p. ej. avistamientos nuevos). */
  insignia?: number;
  contorno?: boolean;
};

/** Botón cuadrado de 44 px con solo ícono. */
export function BotonIcono({ icono, etiqueta, insignia, contorno = false, className, type = "button", ...resto }: Props) {
  return (
    <button
      type={type}
      aria-label={insignia ? `${etiqueta}, ${insignia > 9 ? "más de 9" : insignia} nuevos` : etiqueta}
      className={cx(
        "relative inline-flex size-tactil shrink-0 items-center justify-center rounded-boton text-text transition-colors hover:bg-primary-soft active:bg-primary-soft motion-reduce:transition-none disabled:cursor-not-allowed disabled:text-disabled-text",
        contorno && "borde-campo border-border bg-surface",
        className,
      )}
      {...resto}
    >
      <Icono nombre={icono} />
      {insignia ? <InsigniaContador valor={insignia} tono="alerta" className="absolute -right-1 -top-1" /> : null}
    </button>
  );
}
