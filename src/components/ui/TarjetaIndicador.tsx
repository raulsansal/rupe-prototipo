import { cx } from "@/lib/clases";
import { Icono, type NombreIcono } from "./Icono";

type Props = {
  icono: NombreIcono;
  titulo: string;
  valor: string;
  /** Qué cuenta el indicador, en una línea. */
  descripcion: string;
  className?: string;
};

/** Indicador del tablero (lámina 4.13): ícono y título, cifra grande y una descripción. */
export function TarjetaIndicador({ icono, titulo, valor, descripcion, className }: Props) {
  return (
    <article className={cx("flex flex-col gap-1 rounded-tarjeta border border-border bg-surface p-4", className)}>
      <h3 className="flex items-center gap-2 text-small font-semibold">
        <Icono nombre={icono} tamano={20} className="text-primary" />
        {titulo}
      </h3>
      <p className="text-cifra tabular-nums">{valor}</p>
      <p className="text-caption text-text-muted">{descripcion}</p>
    </article>
  );
}
