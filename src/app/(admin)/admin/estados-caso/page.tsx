import type { Metadata } from "next";
import { Alerta } from "@/components/ui/Alerta";
import { ESTADOS_CASO_CATALOGO } from "@/mocks/estadosCaso";

export const metadata: Metadata = { title: "Catálogo de estados del caso · RUPE" };

const CHIP_ORDEN = "borde-chip box-border inline-flex min-h-6 items-center rounded-chip bg-surface-raised px-2.5 py-0.5 text-caption font-semibold text-text border! border-border-strong!";

/**
 * ADM-10 (HU 053): catálogo de solo lectura. Los 6 estados los define el sistema: sin agregar, editar, desactivar, buscar ni paginar.
 * El chip de orden acompaña al nombre del estado, no lo sustituye.
 */
export default function CatalogoEstadosDelCaso() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">Catálogo de estados del caso</h1>
      <Alerta tipo="info" titulo="Solo consulta">
        Estos 6 estados los define el sistema; solo consulta. No se pueden agregar, editar, desactivar ni eliminar.
      </Alerta>
      <div className="@container">
        {/* Tarjetas (móvil) */}
        <ol className="flex flex-col gap-3 @3xl:hidden">
          {ESTADOS_CASO_CATALOGO.map((e) => (
            <li key={e.orden} data-estado-caso={e.nombre} className="flex items-center gap-3 rounded-tarjeta border border-border bg-surface p-4">
              <span className={CHIP_ORDEN}>Orden {e.orden}</span>
              <h2 className="break-words text-h3 font-semibold">{e.nombre}</h2>
            </li>
          ))}
        </ol>
        {/* Tabla (escritorio) */}
        <div className="@max-3xl:hidden rounded-tarjeta border border-border bg-surface">
          <table className="w-full text-body">
            <caption className="sr-only">Estados del caso</caption>
            <thead>
              <tr className="border-b border-border-strong text-left text-caption font-semibold uppercase tracking-wide text-text-muted">
                <th scope="col" className="w-40 px-4 py-3">Orden</th>
                <th scope="col" className="px-4 py-3">Estado del caso</th>
              </tr>
            </thead>
            <tbody>
              {ESTADOS_CASO_CATALOGO.map((e) => (
                <tr key={e.orden} data-estado-caso={e.nombre} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 tabular-nums">{e.orden}</td>
                  <th scope="row" className="px-4 py-3 text-left font-semibold">{e.nombre}</th>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-small text-text-muted">El orden solo determina cómo se presentan los estados en pantallas y reportes; no define las transiciones válidas.</p>
    </div>
  );
}
