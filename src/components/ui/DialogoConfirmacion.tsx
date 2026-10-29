"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Boton } from "./Boton";
import { Icono, type NombreIcono } from "./Icono";

type PanelProps = {
  idTitulo?: string;
  idDescripcion?: string;
  titulo: string;
  descripcion: string;
  textoConfirmar: string;
  textoCancelar?: string;
  onConfirmar?: () => void;
  onCancelar?: () => void;
  /** destructivo (por defecto) para acciones definitivas; primario para las que se pueden revertir. */
  variante?: "destructivo" | "primario";
  icono?: NombreIcono;
  /** Contenido extra bajo la descripción (p. ej. un campo de motivo). */
  children?: ReactNode;
  /** El botón de confirmar muestra el progreso y no responde mientras la acción se envía (evita el doble envío). */
  cargando?: boolean;
};

/** Contenido del diálogo (también se muestra suelto en la galería). Botón destructivo a la derecha. */
export function PanelDialogo({ idTitulo, idDescripcion, titulo, descripcion, textoConfirmar, textoCancelar = "Volver", onConfirmar, onCancelar, variante = "destructivo", icono = "warning", children, cargando }: PanelProps) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3 rounded-tarjeta bg-surface-raised p-6 text-text">
      <span className={variante === "destructivo" ? "flex size-10 items-center justify-center rounded-full bg-danger-bg text-danger" : "flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary"}>
        <Icono nombre={icono} />
      </span>
      <h2 id={idTitulo} className="text-h3 font-semibold">
        {titulo}
      </h2>
      <p id={idDescripcion} className="text-body text-text-muted">
        {descripcion}
      </p>
      {children}
      <div className="mt-2 flex flex-wrap justify-between gap-3">
        <Boton variante="secundario" onClick={onCancelar} autoFocus>
          {textoCancelar}
        </Boton>
        <Boton variante={variante} onClick={onConfirmar} cargando={cargando}>
          {textoConfirmar}
        </Boton>
      </div>
    </div>
  );
}

type Props = Omit<PanelProps, "idTitulo" | "idDescripcion" | "onCancelar"> & {
  abierto: boolean;
  /** Se llama al cerrar por «Volver» o con Escape. */
  onCerrar: () => void;
};

/**
 * Diálogo de confirmación con <dialog> nativo: showModal() atrapa el foco, Escape lo cierra y el foco
 * regresa al elemento que lo abrió. El foco inicial va a «Volver» (la opción segura).
 */
export function DialogoConfirmacion({ abierto, onCerrar, ...panel }: Props) {
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
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-d`}
      onClose={onCerrar}
      onClick={(e) => e.target === ref.current && onCerrar()} // clic en el fondo oscurecido
      className="m-auto max-h-[calc(100dvh-2rem)] overflow-y-auto w-[calc(100%-2rem)] max-w-sm bg-transparent p-0 backdrop:bg-scrim"
    >
      <PanelDialogo idTitulo={`${id}-t`} idDescripcion={`${id}-d`} onCancelar={onCerrar} {...panel} />
    </dialog>
  );
}
