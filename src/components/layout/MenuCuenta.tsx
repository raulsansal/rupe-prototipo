"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { BotonCerrarSesion } from "./BotonCerrarSesion";

type Props = {
  nombre: string;
  /** Rol que se muestra junto al nombre (p. ej. «Administrador»). */
  rol?: string;
  /** Solo demostración: abre el panel al cargar. */
  abiertoInicial?: boolean;
};

/** Botón con el avatar que abre un panel con el nombre de la persona y «Cerrar sesión» (formulario POST). Escape lo cierra y devuelve el foco. */
export function MenuCuenta({ nombre, rol, abiertoInicial = false }: Props) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const id = useId();
  const boton = useRef<HTMLButtonElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function alTeclear(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setAbierto(false);
      boton.current?.focus();
    }
    function alPulsarFuera(e: PointerEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("pointerdown", alPulsarFuera);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("pointerdown", alPulsarFuera);
    };
  }, [abierto]);

  return (
    <div ref={contenedor} className="relative">
      <button
        ref={boton}
        type="button"
        aria-expanded={abierto}
        aria-controls={id}
        aria-label={`Cuenta de ${nombre}`}
        onClick={() => setAbierto((a) => !a)}
        className="inline-flex size-tactil items-center justify-center rounded-full"
      >
        <Avatar nombre={nombre} />
      </button>
      {abierto && (
        <div id={id} className="absolute right-0 top-full z-50 mt-2 flex w-64 flex-col gap-3 rounded-tarjeta border border-border bg-surface-raised p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <Avatar nombre={nombre} />
            <div className="flex min-w-0 flex-col items-start gap-1">
              <p className="text-small font-bold">{nombre}</p>
              {rol && <Etiqueta>{rol}</Etiqueta>}
            </div>
          </div>
          <BotonCerrarSesion />
        </div>
      )}
    </div>
  );
}
