import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/clases";
import { descripcionDe } from "./CapaCampo";
import { Icono } from "./Icono";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Texto de la casilla; puede incluir un enlace. Toda la fila es pulsable (≥ 44 px). */
  etiqueta: ReactNode;
  error?: string;
  ayuda?: string;
};

export function Casilla({ etiqueta, error, ayuda, id, className, ...resto }: Props) {
  const generado = useId();
  const idCampo = id ?? generado;
  return (
    <div className={className}>
      <label className="group foco-hijo flex min-h-tactil cursor-pointer items-center gap-3 rounded-campo has-[:disabled]:cursor-not-allowed has-[:disabled]:text-disabled-text">
        <input
          id={idCampo}
          type="checkbox"
          className="peer sr-only"
          aria-invalid={error ? true : undefined}
          aria-describedby={descripcionDe(idCampo, { ayuda, error })}
          {...resto}
        />
        <span
          aria-hidden="true"
          className={cx(
            "borde-campo box-border flex size-6 shrink-0 items-center justify-center rounded-md border-border-strong bg-surface text-on-primary",
            "group-has-[:checked]:border-primary group-has-[:checked]:bg-primary",
            "group-has-[[aria-invalid=true]]:border-danger group-has-[:disabled]:border-border group-has-[:disabled]:bg-disabled-bg",
          )}
        >
          <Icono nombre="check" tamano={20} className="hidden group-has-[:checked]:block" />
        </span>
        <span className="text-body">{etiqueta}</span>
      </label>
      {error ? (
        <p id={`${idCampo}-error`} className="ml-9 flex items-start gap-1 text-small text-danger">
          <Icono nombre="error" tamano={16} className="mt-0.5" />
          {error}
        </p>
      ) : (
        ayuda && (
          <p id={`${idCampo}-ayuda`} className="ml-9 text-small text-text-muted">
            {ayuda}
          </p>
        )
      )}
    </div>
  );
}
