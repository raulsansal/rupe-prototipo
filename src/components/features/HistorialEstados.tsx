import { cx } from "@/lib/clases";
import { formatearFechaHora } from "@/lib/formato";
import type { MovimientoHistorial, TipoMovimiento } from "@/mocks/tipos";

export const TEXTO_MOVIMIENTO: Record<TipoMovimiento, string> = {
  registro: "Registro creado",
  "ficha generada": "Ficha de búsqueda generada",
  "avistamiento recibido": "Avistamiento recibido",
  "avistamiento revisado": "Avistamiento revisado",
  localización: "Marcado como localizado",
  reactivación: "Caso reactivado",
  "cierre confirmado": "Cierre confirmado",
  cancelación: "Registro cancelado",
  deshabilitación: "Caso deshabilitado",
  restauración: "Caso restaurado",
};

/** Historial de estados del caso (TUT-05 y su variante Administrador): del movimiento más reciente al más antiguo. */
export function HistorialEstados({ historial }: { historial: MovimientoHistorial[] }) {
  const ultimo = historial.length - 1;
  return (
    <section aria-labelledby="historial-titulo" className="rounded-tarjeta border border-border bg-surface p-4">
      <h2 id="historial-titulo" className="text-h3 font-semibold">
        Historial de estados
      </h2>
      <ol className="mt-3 flex flex-col">
        {[...historial].reverse().map((m, i) => (
          <li key={m.consecutivo} className="relative flex gap-3 pb-4 last:pb-0">
            {i < historial.length - 1 && <span aria-hidden="true" className="absolute left-[7px] top-4 h-full w-0.5 bg-border-strong" />}
            <span aria-hidden="true" className={cx("relative mt-1 box-border size-4 shrink-0 rounded-full border-2 border-border-strong", m.consecutivo === ultimo + 1 ? "bg-primary" : "bg-surface")} />
            <div className="min-w-0 text-small">
              <p className="font-bold">
                {m.estado}
                {m.consecutivo === ultimo + 1 && <span className="ml-2 font-normal text-text-muted">(actual)</span>}
              </p>
              <p>{TEXTO_MOVIMIENTO[m.tipo]}</p>
              <p className="text-text-muted">{formatearFechaHora(m.fechaHora)}</p>
              {m.motivo && <p className="mt-1 break-words">Motivo: {m.motivo}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
