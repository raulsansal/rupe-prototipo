import { useId, type InputHTMLAttributes } from "react";
import { cx } from "@/lib/clases";
import { CapaCampo, CLASES_CONTROL, descripcionDe } from "./CapaCampo";
import { Icono, type NombreIcono } from "./Icono";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  /** Ícono al inicio del campo (decorativo). */
  icono?: NombreIcono;
};

export function CampoTexto({ etiqueta, ayuda, error, icono, id, required, className, type = "text", ...resto }: Props) {
  const generado = useId();
  const idCampo = id ?? generado;
  return (
    <CapaCampo id={idCampo} etiqueta={etiqueta} requerido={required} ayuda={ayuda} error={error} className={className}>
      <div className="relative">
        {icono && <Icono nombre={icono} tamano={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />}
        <input
          id={idCampo}
          type={type}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={descripcionDe(idCampo, { ayuda, error })}
          className={cx(CLASES_CONTROL, icono && "pl-11")}
          {...resto}
        />
      </div>
    </CapaCampo>
  );
}
