"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/lib/clases";
import { Icono } from "./Icono";

type Props = {
  mensaje: string;
  accion?: { etiqueta: string; onClick: () => void };
  /** Si se da, el aviso se cierra solo tras `duracion` ms (5 s por defecto); se pausa con el puntero o el foco encima. */
  onCerrar?: () => void;
  duracion?: number;
  /** fija: abajo de la pantalla; enLinea: dentro del flujo (galería). */
  posicion?: "fija" | "enLinea";
};

/** Aviso temporal: se anuncia a lectores de pantalla (role="status") y admite una acción. */
export function Toast({ mensaje, accion, onCerrar, duracion = 5000, posicion = "fija" }: Props) {
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const alCerrar = useRef(onCerrar);
  useEffect(() => {
    alCerrar.current = onCerrar;
  });

  function armar() {
    if (!alCerrar.current) return;
    temporizador.current = setTimeout(() => alCerrar.current?.(), duracion);
  }
  function pausar() {
    clearTimeout(temporizador.current);
  }
  useEffect(() => {
    armar();
    return pausar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensaje, duracion]);

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={pausar}
      onMouseLeave={armar}
      onFocus={pausar}
      onBlur={armar}
      className={cx(
        "flex min-h-12 w-full max-w-md items-center gap-3 rounded-campo bg-text px-4 py-2 text-small text-background shadow-lg",
        posicion === "fija" && "fixed inset-x-4 bottom-4 z-50 mx-auto",
      )}
    >
      <Icono nombre="check_circle" tamano={20} />
      <span className="flex-1">{mensaje}</span>
      {accion && (
        <button type="button" onClick={accion.onClick} className="inline-flex h-tactil items-center rounded-boton px-3 font-bold underline">
          {accion.etiqueta}
        </button>
      )}
    </div>
  );
}
