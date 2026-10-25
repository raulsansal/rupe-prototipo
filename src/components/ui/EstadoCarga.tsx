import { cx } from "@/lib/clases";

type Props = { /** Texto para lectores de pantalla. */ etiqueta?: string; className?: string; /** Quita el recuadro de la fotografía (pantallas sin fotos). */ sinFoto?: boolean };

/** Marcador de carga (esqueleto) con la forma de una tarjeta de perro; `sinFoto` lo deja en líneas. */
export function EstadoCarga({ etiqueta = "Cargando…", className, sinFoto }: Props) {
  return (
    <div role="status" aria-busy="true" className={cx("flex items-center gap-4 rounded-tarjeta border border-border bg-surface p-4", className)}>
      {!sinFoto && <span className="size-20 shrink-0 animate-pulse rounded-campo bg-disabled-bg motion-reduce:animate-none" />}
      <span className="flex flex-1 flex-col gap-2" aria-hidden="true">
        <span className="h-3 w-3/4 animate-pulse rounded-chip bg-disabled-bg motion-reduce:animate-none" />
        <span className="h-3 w-full animate-pulse rounded-chip bg-disabled-bg motion-reduce:animate-none" />
        <span className="h-3 w-1/2 animate-pulse rounded-chip bg-disabled-bg motion-reduce:animate-none" />
      </span>
      <span className="sr-only">{etiqueta}</span>
    </div>
  );
}
