"use client";

import { useId, useState, type ReactNode } from "react";
import { cx } from "@/lib/clases";
import { Icono } from "./Icono";

type Props = {
  titulo: ReactNode;
  /** Adorno junto al título (p. ej. «Obligatoria»). */
  insignia?: ReactNode;
  /** Texto de apoyo bajo el título, visible abierto o cerrado. */
  descripcion?: ReactNode;
  /** Texto que solo se ve con el bloque cerrado (p. ej. «Resumen: sin selección»). */
  resumen?: ReactNode;
  /** Modo controlado; sin él, el bloque lleva su propio estado. */
  abierto?: boolean;
  defaultAbierto?: boolean;
  onCambio?: (abierto: boolean) => void;
  /** Nivel del encabezado que envuelve el botón. */
  nivel?: 2 | 3 | 4;
  children: ReactNode;
  className?: string;
};

/**
 * Bloque plegable (acordeón de un elemento): botón con aria-expanded + panel. El panel se conserva montado
 * (atributo hidden) para no perder lo que la persona haya capturado dentro.
 */
export function Plegable({ titulo, insignia, descripcion, resumen, abierto, defaultAbierto = false, onCambio, nivel = 3, children, className }: Props) {
  const id = useId();
  const [interno, setInterno] = useState(defaultAbierto);
  const estaAbierto = abierto ?? interno;
  const Encabezado = `h${nivel}` as const;

  function alternar() {
    const siguiente = !estaAbierto;
    setInterno(siguiente);
    onCambio?.(siguiente);
  }

  return (
    <div className={cx("rounded-tarjeta border border-border bg-surface", className)}>
      <Encabezado className="text-h3 font-semibold">
        <button
          type="button"
          aria-expanded={estaAbierto}
          aria-controls={`${id}-panel`}
          onClick={alternar}
          className="flex min-h-14 w-full items-center gap-3 rounded-tarjeta px-4 py-3 text-left"
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            <span>{titulo}</span>
            {insignia}
          </span>
          <Icono nombre="keyboard_arrow_down" className={cx("shrink-0 transition-transform motion-reduce:transition-none", estaAbierto && "rotate-180")} />
        </button>
      </Encabezado>
      {descripcion && <p className="-mt-1 px-4 pb-3 text-small text-text-muted">{descripcion}</p>}
      {!estaAbierto && resumen && <p className="px-4 pb-3 text-small text-text-muted">{resumen}</p>}
      <div id={`${id}-panel`} hidden={!estaAbierto} className="border-t border-border px-4 py-2">
        {children}
      </div>
    </div>
  );
}
