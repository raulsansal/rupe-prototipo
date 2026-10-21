"use client";

import { useId, useState, type ChangeEvent, type TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/clases";
import { CapaCampo, CLASES_CONTROL, descripcionDe } from "./CapaCampo";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  /** Límite de caracteres; si se da, se muestra el contador "n/máx". */
  maxLength?: number;
};

export function AreaTexto({ etiqueta, ayuda, error, id, required, maxLength, className, defaultValue, value, onChange, rows = 3, ...resto }: Props) {
  const generado = useId();
  const idCampo = id ?? generado;
  const [escritos, setEscritos] = useState(String(value ?? defaultValue ?? "").length);
  const longitud = value !== undefined ? String(value).length : escritos;

  function alCambiar(e: ChangeEvent<HTMLTextAreaElement>) {
    setEscritos(e.target.value.length);
    onChange?.(e);
  }

  return (
    <CapaCampo
      id={idCampo}
      etiqueta={etiqueta}
      requerido={required}
      ayuda={ayuda}
      error={error}
      textoContador={maxLength ? `${longitud}/${maxLength}` : undefined}
      className={className}
    >
      <textarea
        id={idCampo}
        required={required}
        rows={rows}
        maxLength={maxLength}
        defaultValue={defaultValue}
        value={value}
        onChange={alCambiar}
        aria-invalid={error ? true : undefined}
        aria-describedby={descripcionDe(idCampo, { ayuda, error, contador: Boolean(maxLength) })}
        className={cx(CLASES_CONTROL, "h-auto min-h-24 resize-y py-3")}
        {...resto}
      />
    </CapaCampo>
  );
}
