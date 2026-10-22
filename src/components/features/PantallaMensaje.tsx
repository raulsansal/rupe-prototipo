import type { ReactNode } from "react";
import { Icono, type NombreIcono } from "@/components/ui/Icono";
import { cx } from "@/lib/clases";

type Props = {
  icono: NombreIcono;
  /** Título de la pantalla (h1, o h2 si hay otra pantalla antes). */
  titulo: string;
  nivel?: 1 | 2;
  children?: ReactNode;
  /** Botones o enlaces de acción, apilados. */
  acciones?: ReactNode;
  className?: string;
};

/** Tarjeta de mensaje a pantalla: ícono, título, texto y acciones (TRA-01, TRA-04 y estado C de la ficha). */
export function PantallaMensaje({ icono, titulo, nivel = 1, children, acciones, className }: Props) {
  const Titulo = `h${nivel}` as const;
  return (
    <section className={cx("mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-tarjeta border border-border bg-surface-raised p-6 text-center", className)}>
      <span className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icono nombre={icono} tamano={32} />
      </span>
      <Titulo className="text-h2 font-bold">{titulo}</Titulo>
      {children}
      {acciones && <div className="mt-2 flex w-full flex-col gap-3">{acciones}</div>}
    </section>
  );
}
