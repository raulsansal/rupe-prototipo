"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/clases";
import { InsigniaContador } from "./InsigniaContador";

export type Pestana = { id: string; etiqueta: string; contador?: number };

type Props = {
  pestanas: Pestana[];
  /** Nombre accesible de la lista de pestañas. */
  etiqueta: string;
  defaultValue?: string;
  onCambio?: (id: string) => void;
  /** Contenido del panel de la pestaña activa. */
  children?: (idActiva: string) => ReactNode;
  className?: string;
};

/** Pestañas con contador. Flechas, Inicio y Fin mueven y activan la pestaña (foco itinerante). */
export function Pestanas({ pestanas, etiqueta, defaultValue, onCambio, children, className }: Props) {
  const base = useId();
  const [activa, setActiva] = useState(defaultValue ?? pestanas[0].id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function seleccionar(id: string, enfocar = false) {
    setActiva(id);
    onCambio?.(id);
    if (enfocar) refs.current[id]?.focus();
    // Si las pestañas se desplazan, la activa queda a la vista.
    refs.current[id]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function alTeclear(e: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const ultimo = pestanas.length - 1;
    const destino =
      e.key === "ArrowRight" ? (indice === ultimo ? 0 : indice + 1)
      : e.key === "ArrowLeft" ? (indice === 0 ? ultimo : indice - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? ultimo
      : null;
    if (destino === null) return;
    e.preventDefault();
    seleccionar(pestanas[destino].id, true);
  }

  return (
    <div className={className}>
      <div role="tablist" aria-label={etiqueta} className="flex overflow-x-auto border-b border-border">
        {pestanas.map((p, i) => {
          const esActiva = p.id === activa;
          return (
            <button
              key={p.id}
              ref={(el) => {
                refs.current[p.id] = el;
              }}
              id={`${base}-tab-${p.id}`}
              role="tab"
              type="button"
              aria-selected={esActiva}
              aria-controls={`${base}-panel-${p.id}`}
              tabIndex={esActiva ? 0 : -1}
              onClick={() => seleccionar(p.id)}
              onKeyDown={(e) => alTeclear(e, i)}
              className={cx(
                "-mb-px inline-flex h-tactil min-w-0 flex-1 items-center justify-center gap-1.5 border-b-[3px] px-2 text-small sm:flex-none sm:gap-2 sm:px-4 sm:text-body",
                esActiva ? "border-primary font-bold text-primary" : "border-transparent font-normal text-text-muted hover:text-text",
              )}
            >
              {p.etiqueta}
              {p.contador !== undefined && <InsigniaContador valor={p.contador} tono={esActiva ? "primaria" : "neutra"} />}
            </button>
          );
        })}
      </div>
      {children && (
        <div role="tabpanel" id={`${base}-panel-${activa}`} aria-labelledby={`${base}-tab-${activa}`} tabIndex={0} className="pt-4">
          {children(activa)}
        </div>
      )}
    </div>
  );
}
