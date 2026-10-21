"use client";

import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { cx } from "@/lib/clases";
import { clasesBoton, type OpcionesClases } from "./clasesBoton";
import { Icono, type NombreIcono } from "./Icono";

export type { TamanoBoton, VarianteBoton } from "./clasesBoton";

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  OpcionesClases & {
    icono?: NombreIcono;
    /** Muestra el indicador, conserva el tamaño y bloquea clics repetidos. */
    cargando?: boolean;
    textoCargando?: string;
  };

function Indicador() {
  return (
    <span
      aria-hidden="true"
      className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
    />
  );
}

export function Boton({
  variante = "primario",
  tamano = "estandar",
  anchoCompleto,
  icono,
  cargando = false,
  textoCargando = "Cargando…",
  className,
  children,
  type = "button",
  onClick,
  ...resto
}: Props) {
  function alHacerClic(e: MouseEvent<HTMLButtonElement>) {
    if (cargando) return e.preventDefault();
    onClick?.(e);
  }
  return (
    <button
      type={type}
      aria-busy={cargando || undefined}
      aria-disabled={cargando || undefined}
      onClick={alHacerClic}
      className={cx(clasesBoton({ variante, tamano, anchoCompleto, className }), cargando && "cursor-progress opacity-80")}
      {...resto}
    >
      {cargando ? <Indicador /> : icono && <Icono nombre={icono} tamano={20} />}
      {cargando ? textoCargando : children}
    </button>
  );
}
