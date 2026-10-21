import { cx } from "@/lib/clases";
import { Icono } from "./Icono";

type Props = {
  paginaActual: number;
  totalPaginas: number;
  onCambiarPagina: (pagina: number) => void;
  className?: string;
};

const celda =
  "inline-flex size-tactil items-center justify-center rounded-campo text-small font-semibold disabled:cursor-not-allowed disabled:text-disabled-text";

/** Paginación con anterior, números y siguiente; la página actual lleva aria-current. */
export function Paginacion({ paginaActual, totalPaginas, onCambiarPagina, className }: Props) {
  return (
    <nav aria-label="Paginación" className={className}>
      <ul className="flex items-center gap-1">
        <li>
          <button type="button" aria-label="Página anterior" disabled={paginaActual <= 1} onClick={() => onCambiarPagina(paginaActual - 1)} className={cx(celda, "borde-campo border-border hover:bg-primary-soft")}>
            <Icono nombre="chevron_left" />
          </button>
        </li>
        {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
          <li key={n}>
            <button
              type="button"
              aria-label={`Página ${n}`}
              aria-current={n === paginaActual ? "page" : undefined}
              onClick={() => onCambiarPagina(n)}
              className={cx(celda, n === paginaActual ? "bg-primary text-on-primary" : "borde-campo border-border hover:bg-primary-soft")}
            >
              {n}
            </button>
          </li>
        ))}
        <li>
          <button type="button" aria-label="Página siguiente" disabled={paginaActual >= totalPaginas} onClick={() => onCambiarPagina(paginaActual + 1)} className={cx(celda, "borde-campo border-border hover:bg-primary-soft")}>
            <Icono nombre="chevron_right" />
          </button>
        </li>
      </ul>
    </nav>
  );
}
