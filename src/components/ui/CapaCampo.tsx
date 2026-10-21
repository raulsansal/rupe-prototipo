import type { ReactNode } from "react";
import { cx } from "@/lib/clases";
import { Icono } from "./Icono";

/** Clases comunes de los controles de texto: 48 px, 16 px, radio 8, borde border-strong de 1.5 px. */
export const CLASES_CONTROL =
  "borde-campo block h-campo w-full rounded-campo border-border-strong bg-surface px-3 text-body text-text placeholder:text-text-muted focus-visible:outline-offset-0 focus-visible:border-focus-ring aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled-text data-[estado=foco]:border-focus-ring";

type DescripcionCampo = { ayuda?: string; error?: string; contador?: boolean };

/** Valor de aria-describedby: el error (si hay) y la ayuda / contador asociados al control. */
export function descripcionDe(id: string, { ayuda, error, contador }: DescripcionCampo): string | undefined {
  const ids = [error && `${id}-error`, ayuda && `${id}-ayuda`, contador && `${id}-contador`].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

type Props = DescripcionCampo & {
  id: string;
  etiqueta: string;
  requerido?: boolean;
  /** Contenido del contador (p. ej. "58/300"); lleva el id `${id}-contador`. */
  textoContador?: string;
  children: ReactNode;
  className?: string;
};

/** Etiqueta siempre visible + control + mensaje de ayuda o error asociado. */
export function CapaCampo({ id, etiqueta, requerido, ayuda, error, textoContador, children, className }: Props) {
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-small font-semibold">
        {etiqueta}
        {requerido && (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        )}
      </label>
      {children}
      {(error || ayuda || textoContador) && (
        <div className="flex items-start justify-between gap-3 text-small">
          <div aria-live="polite">
            {error ? (
              <p id={`${id}-error`} className="flex items-start gap-1 text-danger">
                <Icono nombre="error" tamano={16} className="mt-0.5" />
                {error}
              </p>
            ) : (
              ayuda && (
                <p id={`${id}-ayuda`} className="text-text-muted">
                  {ayuda}
                </p>
              )
            )}
          </div>
          {textoContador && (
            <p id={`${id}-contador`} className="shrink-0 text-text-muted">
              {textoContador}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
