import { cx } from "@/lib/clases";
import { Icono } from "./Icono";

type Props = {
  pasos: string[];
  /** Paso actual, de 1 a pasos.length. */
  actual: number;
  /**
   * barra: segmentos con «Paso X de N» y el título del paso (como en los mockups móviles).
   * circulos: círculos con etiquetas. auto: barra por debajo de 768 px y círculos desde 768 px.
   */
  variante?: "auto" | "barra" | "circulos";
  className?: string;
};

function Barra({ pasos, actual, visibilidad }: { pasos: string[]; actual: number; visibilidad: string }) {
  const titulo = pasos[actual - 1];
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={pasos.length}
      aria-valuenow={actual}
      aria-valuetext={`Paso ${actual} de ${pasos.length}: ${titulo}`}
      className={visibilidad}
    >
      <div className="flex gap-1.5" aria-hidden="true">
        {pasos.map((nombre, i) => (
          <span key={nombre} className={cx("h-2 flex-1 rounded-chip", i < actual ? "bg-primary" : "bg-border")} />
        ))}
      </div>
      <p className="mt-2 text-small" aria-hidden="true">
        <span className="text-text-muted">
          Paso {actual} de {pasos.length}
        </span>
        <span className="font-bold"> · {titulo}</span>
      </p>
    </div>
  );
}

function Circulos({ pasos, actual, visibilidad }: { pasos: string[]; actual: number; visibilidad: string }) {
  return (
    <ol className={cx("items-start", visibilidad)}>
      {pasos.map((nombre, i) => {
        const n = i + 1;
        const hecho = n < actual;
        const esActual = n === actual;
        return (
          <li key={nombre} aria-current={esActual ? "step" : undefined} className={cx("flex items-start", n < pasos.length && "flex-1")}>
            <span className="flex w-20 flex-col items-center gap-1">
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
              <span className={cx("text-center text-caption", esActual ? "font-bold" : "text-text-muted")}>{nombre}</span>
              <span className="sr-only">{hecho ? ", completado" : esActual ? ", paso actual" : ", pendiente"}</span>
            </span>
            {n < pasos.length && <span aria-hidden="true" className={cx("mt-4 h-0.5 flex-1", hecho ? "bg-primary" : "bg-border")} />}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Indicador de pasos (p. ej. los seis del reporte de avistamiento o los dos del registro de la persona tutora).
 * Solo se muestra una variante a la vez, así los lectores de pantalla no la leen dos veces.
 */
export function IndicadorPasos({ pasos, actual, variante = "auto", className }: Props) {
  const barra = variante === "barra" ? "block" : variante === "auto" ? "md:hidden" : "hidden";
  const circulos = variante === "circulos" ? "flex" : variante === "auto" ? "hidden md:flex" : "hidden";
  return (
    <div className={className}>
      <Barra pasos={pasos} actual={actual} visibilidad={barra} />
      <Circulos pasos={pasos} actual={actual} visibilidad={circulos} />
    </div>
  );
}
