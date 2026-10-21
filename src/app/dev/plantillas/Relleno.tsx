import { cx } from "@/lib/clases";

/** Bloques de relleno con la etiqueta «contenido de la pantalla» para revisar las plantillas. */
export function Relleno({ titulo, bloques = 3, className }: { titulo: string; bloques?: number; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-4", className)}>
      <h1 className="text-h1">{titulo}</h1>
      {Array.from({ length: bloques }, (_, i) => (
        <div key={i} className="flex h-32 items-center justify-center rounded-tarjeta border-2 border-dashed border-border bg-surface text-small text-text-muted">
          contenido de la pantalla
        </div>
      ))}
    </div>
  );
}
