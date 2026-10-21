"use client";

import Image from "next/image";
import { useEffect, useId, useState, type ChangeEvent } from "react";
import { cx } from "@/lib/clases";
import { Icono } from "./Icono";

const MAX_BYTES = 4 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png"];

type ErrorFoto = { titulo: string; detalle: string };

type Props = {
  etiqueta: string;
  name?: string;
  requerido?: boolean;
  /** Estado inicial (la galería lo usa para mostrar «con foto» y «error»). */
  vistaPreviaInicial?: string;
  errorInicial?: ErrorFoto;
  className?: string;
};

/** Carga de una fotografía (JPG o PNG, máx. 4 MB), con vista previa 1:1. El recorte es solo de presentación. */
export function CargaFotografia({ etiqueta, name, requerido, vistaPreviaInicial, errorInicial, className }: Props) {
  const id = useId();
  const [vista, setVista] = useState<string | undefined>(vistaPreviaInicial);
  const [error, setError] = useState<ErrorFoto | undefined>(errorInicial);

  useEffect(() => {
    return () => {
      if (vista?.startsWith("blob:")) URL.revokeObjectURL(vista);
    };
  }, [vista]);

  function alElegir(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (!TIPOS.includes(archivo.type)) {
      setVista(undefined);
      return setError({ titulo: "Solo se admite JPG o PNG", detalle: "Elige otra foto" });
    }
    if (archivo.size > MAX_BYTES) {
      setVista(undefined);
      return setError({ titulo: "La foto pesa más de 4 MB", detalle: "Elige otra o redúcela" });
    }
    setError(undefined);
    setVista(URL.createObjectURL(archivo));
  }

  function quitar(e: React.MouseEvent<HTMLButtonElement>) {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (input) input.value = "";
    setVista(undefined);
    setError(undefined);
    e.currentTarget.blur();
  }

  const descripcionId = `${id}-ayuda`;
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <span className="text-small font-semibold">
        {etiqueta}
        {requerido && (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        )}
      </span>
      <div
        className={cx(
          "foco-hijo relative aspect-square w-full max-w-56 overflow-hidden rounded-tarjeta",
          vista ? "border border-border" : cx("border-2 border-dashed", error ? "border-danger bg-danger-bg" : "border-border-strong bg-surface"),
        )}
      >
        <input
          id={id}
          name={name}
          type="file"
          accept="image/jpeg,image/png"
          required={requerido && !vista}
          className="sr-only"
          onChange={alElegir}
          aria-invalid={error ? true : undefined}
          aria-describedby={descripcionId}
        />
        {vista ? (
          <>
            <Image src={vista} alt="Vista previa de la fotografía" fill unoptimized loading="eager" className="object-cover" />
            <button
              type="button"
              aria-label="Quitar fotografía"
              onClick={quitar}
              className="absolute right-1 top-1 inline-flex size-tactil items-center justify-center rounded-full text-text"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-surface">
                <Icono nombre="close" tamano={20} />
              </span>
            </button>
            <label htmlFor={id} className="absolute bottom-2 left-2 inline-flex h-tactil cursor-pointer items-center gap-1.5 rounded-chip bg-surface px-4 text-small font-semibold text-text">
              <Icono nombre="edit" tamano={16} />
              Cambiar
            </label>
          </>
        ) : (
          <label htmlFor={id} className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 p-4 text-center">
            <Icono nombre={error ? "error" : "add_a_photo"} tamano={32} className={error ? "text-danger" : "text-primary"} />
            <span className={cx("text-small font-semibold", error && "text-danger")}>{error ? error.titulo : "Toca para tomar o elegir una foto"}</span>
            <span className={cx("text-caption", error ? "text-danger" : "text-text-muted")}>{error ? error.detalle : "JPG o PNG · máx. 4 MB"}</span>
          </label>
        )}
      </div>
      <p id={descripcionId} className="text-small text-text-muted">
        Una sola fotografía; se muestra recortada en 1:1 solo como vista previa.
      </p>
    </div>
  );
}
