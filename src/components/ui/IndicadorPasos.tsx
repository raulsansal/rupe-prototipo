import { cx } from "@/lib/clases";
import { Icono } from "./Icono";

type Props = {
  pasos: string[];
  /** Paso actual, de 1 a pasos.length. */
  actual: number;
  className?: string;
};

/**
 * Indicador de pasos (p. ej. los seis del reporte de avistamiento): completado con palomita,
 * actual con borde y número, pendiente en gris. En pantallas angostas solo se rotula el paso actual.
 */
export function IndicadorPasos({ pasos, actual, className }: Props) {
  return (
    <div className={className}>
      <p className="mb-2 text-small font-semibold md:hidden" aria-hidden="true">
        Paso {actual} de {pasos.length} · {pasos[actual - 1]}
      </p>
      <ol className="flex items-start">
        {pasos.map((nombre, i) => {
          const n = i + 1;
          const hecho = n < actual;
          const esActual = n === actual;
          return (
            <li key={nombre} aria-current={esActual ? "step" : undefined} className={cx("flex items-start", n < pasos.length && "flex-1")}>
              <span className="flex w-10 flex-col items-center gap-1 md:w-20">
                <span
                  className={cx(
                    "borde-campo box-border flex size-8 items-center justify-center rounded-full text-small font-bold",
                    hecho && "border-primary bg-primary text-on-primary",
                    esActual && "border-primary bg-surface text-primary",
                    !hecho && !esActual && "border-border-strong bg-surface text-text-muted",
                  )}
                >
                  {hecho ? <Icono nombre="check" tamano={20} /> : n}
                </span>
                <span className={cx("hidden text-center text-caption md:block", esActual ? "font-bold" : "text-text-muted")}>{nombre}</span>
                <span className="sr-only">
                  {hecho ? ", completado" : esActual ? ", paso actual" : ", pendiente"}
                </span>
              </span>
              {n < pasos.length && <span aria-hidden="true" className={cx("mt-4 h-0.5 flex-1", hecho ? "bg-primary" : "bg-border")} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
