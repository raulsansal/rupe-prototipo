import { useId } from "react";
import { cx } from "@/lib/clases";

export type SegmentoBarra = {
  nombre: string;
  valor: number;
  /** Clase de fondo con un token (p. ej. "bg-barra-estado-extraviado"); debe escribirse completa para que Tailwind la detecte. */
  claseColor: string;
};

type Props = { titulo: string; subtitulo?: string; segmentos: SegmentoBarra[]; vacio?: string; className?: string };

/**
 * Barra apilada con leyenda directa (nombre y valor de cada segmento): el color nunca es la única señal. Los segmentos se
 * separan con una línea del color de la superficie. Incluye tabla para lectores de pantalla.
 */
export function BarraApilada({ titulo, subtitulo, segmentos, vacio = "Sin datos en el periodo seleccionado.", className }: Props) {
  const id = useId();
  const total = segmentos.reduce((s, x) => s + x.valor, 0);
  return (
    <figure aria-labelledby={`${id}-t`} className={cx("relative rounded-tarjeta border border-border bg-surface p-4", className)}>
      <figcaption>
        <h3 id={`${id}-t`} className="text-h3 font-semibold">
          {titulo}
        </h3>
        {subtitulo && <p className="text-small text-text-muted">{subtitulo ?? ""} · total: {total}</p>}
      </figcaption>
      {total === 0 ? (
        <p className="mt-3 rounded-campo border-2 border-dashed border-border p-4 text-center text-small text-text-muted">{vacio}</p>
      ) : (
        <>
          <div aria-hidden="true" className="mt-3 flex h-6 overflow-hidden rounded-chip">
            {segmentos.filter((s) => s.valor > 0).map((s) => (
              <span key={s.nombre} className={cx("h-full border-r-[3px] border-surface last:border-r-0", s.claseColor)} style={{ flexGrow: s.valor, flexBasis: 0, minWidth: 6 }} />
            ))}
          </div>
          <ul aria-hidden="true" className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-small min-[420px]:grid-cols-2">
            {segmentos.map((s) => (
              <li key={s.nombre} className="flex items-center gap-2">
                <span className={cx("size-3 shrink-0 rounded-sm", s.claseColor)} />
                <span className="min-w-0 flex-1">{s.nombre}</span>
                <span className="font-bold tabular-nums">{s.valor}</span>
              </li>
            ))}
          </ul>
          <div className="sr-only">
          <table>
            <caption>{titulo}</caption>
            <thead>
              <tr>
                <th scope="col">Estado</th>
                <th scope="col">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {segmentos.map((s) => (
                <tr key={s.nombre}>
                  <th scope="row">{s.nombre}</th>
                  <td>{s.valor}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </figure>
  );
}
