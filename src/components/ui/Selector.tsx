import { useId, type SelectHTMLAttributes } from "react";
import { cx } from "@/lib/clases";
import { CapaCampo, CLASES_CONTROL, descripcionDe } from "./CapaCampo";
import { Icono } from "./Icono";

export type OpcionSelector = { valor: string; etiqueta: string };

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  etiqueta: string;
  opciones: OpcionSelector[];
  /** Primera opción vacía (p. ej. "Elige una opción"). */
  marcador?: string;
  ayuda?: string;
  error?: string;
};

/** <select> nativo con aspecto del sistema: conserva el teclado y los selectores del dispositivo. */
export function Selector({ etiqueta, opciones, marcador, ayuda, error, id, required, className, ...resto }: Props) {
  const generado = useId();
  const idCampo = id ?? generado;
  return (
    <CapaCampo id={idCampo} etiqueta={etiqueta} requerido={required} ayuda={ayuda} error={error} className={className}>
      <div className="relative">
        <select
          id={idCampo}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={descripcionDe(idCampo, { ayuda, error })}
          className={cx(CLASES_CONTROL, "appearance-none pr-11")}
          {...resto}
        >
          {marcador && <option value="">{marcador}</option>}
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
        <Icono nombre="keyboard_arrow_down" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text" />
      </div>
    </CapaCampo>
  );
}
