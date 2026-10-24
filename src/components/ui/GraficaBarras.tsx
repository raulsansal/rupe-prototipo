import { useId } from "react";
import { cx } from "@/lib/clases";

export type DatoBarra = { nombre: string; valor: number };
export type GrupoBarras = { titulo?: string; barras: DatoBarra[] };

type Props = {
  titulo: string;
  subtitulo?: string;
  grupos: GrupoBarras[];
  /** Texto cuando todos los valores son 0. */
  vacio?: string;
  className?: string;
};

/**
 * Gráfica de barras horizontales (lámina 4.13): etiqueta directa a la izquierda y valor a la derecha, nunca solo color.
 * Las barras usan el token --chart-1. Cada gráfica trae una tabla de datos para lectores de pantalla (sr-only) y su dibujo
 * se oculta a la tecnología de asistencia para no leerla dos veces.
 */
export function GraficaBarras({ titulo, subtitulo, grupos, vacio = "Sin datos en el periodo seleccionado.", className }: Props) {
  const id = useId();
  const todas = grupos.flatMap((g) => g.barras);
  const maximo = Math.max(...todas.map((b) => b.valor), 0);
  return (
    <figure aria-labelledby={`${id}-t`} className={cx("relative rounded-tarjeta border border-border bg-surface p-4", className)}>
      <figcaption>
        <h3 id={`${id}-t`} className="text-h3 font-semibold">
          {titulo}
        </h3>
        {subtitulo && <p className="text-small text-text-muted">{subtitulo}</p>}
      </figcaption>
      {maximo === 0 ? (
        <p className="mt-3 rounded-campo border-2 border-dashed border-border p-4 text-center text-small text-text-muted">{vacio}</p>
      ) : (
        <>
          <div aria-hidden="true" className="mt-3 flex flex-col gap-3">
            {grupos.map((g, i) => (
              <div key={g.titulo ?? i} className="flex flex-col gap-1.5">
                {g.titulo && <p className="mt-1 text-caption font-bold uppercase tracking-wide text-text-muted">{g.titulo}</p>}
                {g.barras.map((b) => (
                  <div key={b.nombre} className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_2.5rem] items-center gap-2 text-small">
                    <span className="min-w-0 break-words leading-tight">{b.nombre}</span>
                    <span className="block h-3.5">
                      {b.valor > 0 && <span className="block h-full rounded-r-chip bg-chart-1" style={{ width: `${Math.max((b.valor / maximo) * 100, 2)}%` }} />}
                    </span>
                    <span className="text-right font-bold tabular-nums">{b.valor}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="sr-only">
          <table>
            <caption>{titulo}</caption>
            <thead>
              <tr>
                <th scope="col">{grupos.some((g) => g.titulo) ? "Categoría y opción" : "Opción"}</th>
                <th scope="col">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {grupos.flatMap((g) => g.barras.map((b) => (
                <tr key={`${g.titulo}-${b.nombre}`}>
                  <th scope="row">{g.titulo ? `${g.titulo}: ${b.nombre}` : b.nombre}</th>
                  <td>{b.valor}</td>
                </tr>
              )))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </figure>
  );
}
