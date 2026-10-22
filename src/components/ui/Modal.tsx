"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "@/lib/clases";

type Props = {
  abierto: boolean;
  /** Se llama al cerrar por cualquier vía: Escape, clic fuera o un botón que llame a `onCerrar`. */
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
  tamano?: "sm" | "md" | "lg";
  className?: string;
};

const ANCHOS = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl" } as const;

/**
 * Ventana modal con <dialog> nativo: showModal() atrapa el foco y pone el resto de la página inerte, Escape la
 * cierra, un clic en el fondo oscurecido la cierra y el foco regresa al elemento que la abrió.
 */
export function Modal({ abierto, onCerrar, titulo, children, tamano = "sm", className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onClose={onCerrar}
      onClick={(e) => e.target === ref.current && onCerrar()}
      className={cx("m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-tarjeta bg-surface-raised p-0 text-text backdrop:bg-scrim", ANCHOS[tamano], className)}
    >
      <div className="flex flex-col gap-3 p-6">
        <h2 id={id} className="text-h2 font-bold">
          {titulo}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
