import { useId, type ChangeEventHandler } from "react";
import { cx } from "@/lib/clases";
import { Icono } from "./Icono";

export type OpcionRadio = { valor: string; etiqueta: string; descripcion?: string; deshabilitada?: boolean };

type Props = {
  leyenda: string;
  name: string;
  opciones: OpcionRadio[];
  /** lista: filas con círculo; tarjetas: pocas opciones, para uso con el pulgar. */
  variante?: "lista" | "tarjetas";
  defaultValue?: string;
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  requerido?: boolean;
  ayuda?: string;
  error?: string;
  className?: string;
};

/** Grupo de opciones de radio (fieldset + legend). Las flechas cambian la opción de forma nativa. */
export function GrupoRadio({ leyenda, name, opciones, variante = "lista", defaultValue, value, onChange, requerido, ayuda, error, className }: Props) {
  const id = useId();
  const nombre = `${id}-${name}`; // evita que dos grupos con el mismo name se mezclen en la página
  const describedBy = [error && `${id}-error`, ayuda && `${id}-ayuda`].filter(Boolean).join(" ") || undefined;
  return (
    <fieldset className={cx("min-w-0", className)} aria-describedby={describedBy} aria-required={requerido || undefined}>
      <legend className="mb-1 text-small font-semibold">
        {leyenda}
        {requerido && (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        )}
      </legend>
      <div className={cx(variante === "tarjetas" ? "grid grid-cols-3 gap-2" : "flex flex-col")}>
        {opciones.map((o) => (
          <label
            key={o.valor}
            className={cx(
              "group foco-hijo flex cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:text-disabled-text",
              variante === "tarjetas"
                ? "borde-campo min-h-tactil flex-col items-center justify-center gap-0.5 rounded-campo border-border-strong bg-surface px-2 py-3 text-center has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
                : "min-h-tactil items-center gap-3 rounded-campo",
            )}
          >
            <input
              type="radio"
              name={nombre}
              value={o.valor}
              defaultChecked={defaultValue !== undefined ? defaultValue === o.valor : undefined}
              checked={value !== undefined ? value === o.valor : undefined}
              onChange={onChange}
              disabled={o.deshabilitada}
              required={requerido}
              className="peer sr-only"
            />
            {variante === "tarjetas" ? (
              <>
                <Icono nombre="check_circle" tamano={20} className="hidden text-primary group-has-[:checked]:block" />
                <span className="text-body font-semibold">{o.etiqueta}</span>
                {o.descripcion && <span className="text-caption text-text-muted">{o.descripcion}</span>}
              </>
            ) : (
              <>
                <span
                  aria-hidden="true"
                  className="borde-campo box-border flex size-6 shrink-0 items-center justify-center rounded-full border-border-strong bg-surface group-has-[:checked]:border-primary group-has-[:disabled]:border-border group-has-[:disabled]:bg-disabled-bg"
                >
                  <span className="hidden size-3 rounded-full bg-primary group-has-[:checked]:block" />
                </span>
                <span className="text-body">{o.etiqueta}</span>
              </>
            )}
          </label>
        ))}
      </div>
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1 text-small text-danger">
          <Icono nombre="error" tamano={16} className="mt-0.5" />
          {error}
        </p>
      ) : (
        ayuda && (
          <p id={`${id}-ayuda`} className="text-small text-text-muted">
            {ayuda}
          </p>
        )
      )}
    </fieldset>
  );
}
