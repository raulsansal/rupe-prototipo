import type { ReactNode } from "react";
import { cx } from "@/lib/clases";
import { Paginacion } from "./Paginacion";

export type ColumnaTabla<T> = { clave: string; encabezado: string; celda: (fila: T) => ReactNode; clases?: string };

type Props<T> = {
  /** Nombre accesible de la tabla. */
  titulo: string;
  columnas: ColumnaTabla<T>[];
  filas: T[];
  idFila: (fila: T) => string;
  /** Fila resaltada (elemento seleccionado). */
  idSeleccionada?: string;
  /** Contenido de la última columna (p. ej. el menú de acciones). */
  acciones?: (fila: T) => ReactNode;
  paginaActual: number;
  totalPaginas: number;
  /** Texto del pie, p. ej. "1–4 de 48 reportes". */
  resumen: string;
  onCambiarPagina: (pagina: number) => void;
};

/**
 * Tabla del administrador con paginación. Cuando su contenedor mide menos de 42 rem (no la pantalla) cada fila se
 * convierte en una tarjeta (cada celda muestra su encabezado con data-etiqueta). Los folios y las fechas nunca
 * se parten; si aun así falta espacio, la tabla se desplaza horizontalmente dentro de su contenedor.
 */
export function TablaPaginada<T>({ titulo, columnas, filas, idFila, idSeleccionada, acciones, paginaActual, totalPaginas, resumen, onCambiarPagina }: Props<T>) {
  return (
    <div className="@container rounded-tarjeta border border-border bg-surface p-3">
      <div className="overflow-x-auto">
      <table className="block w-full whitespace-nowrap text-small @2xl:table">
        <caption className="sr-only">{titulo}</caption>
        <thead className="sr-only @2xl:not-sr-only @2xl:table-header-group">
          <tr className="border-b border-border-strong @2xl:table-row">
            {columnas.map((c) => (
              <th key={c.clave} scope="col" className="px-3 py-2 text-left text-caption font-semibold uppercase tracking-wide text-text-muted">
                {c.encabezado}
              </th>
            ))}
            {acciones && (
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">Acciones</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="block @2xl:table-row-group">
          {filas.map((fila) => {
            const id = idFila(fila);
            return (
              <tr
                key={id}
                aria-selected={id === idSeleccionada || undefined}
                className={cx(
                  "mb-2 block rounded-campo border border-border p-2 @2xl:mb-0 @2xl:table-row @2xl:rounded-none @2xl:border-0 @2xl:border-b @2xl:p-0 @2xl:last:border-b-0",
                  id === idSeleccionada && "bg-primary-soft",
                )}
              >
                {columnas.map((c) => (
                  <td
                    key={c.clave}
                    data-etiqueta={c.encabezado}
                    className={cx(
                      "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 before:text-caption before:font-semibold before:uppercase before:text-text-muted before:content-[attr(data-etiqueta)] @2xl:table-cell @2xl:before:content-none",
                      c.clases,
                    )}
                  >
                    {c.celda(fila)}
                  </td>
                ))}
                {acciones && <td className="flex justify-end px-1 @2xl:table-cell @2xl:text-right">{acciones(fila)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 px-3">
        <p className="text-small text-text-muted">{resumen}</p>
        <Paginacion paginaActual={paginaActual} totalPaginas={totalPaginas} onCambiarPagina={onCambiarPagina} />
      </div>
    </div>
  );
}
