import { cx } from "@/lib/clases";

type Props = {
  valor: number;
  /** alerta: rojo para la campana; primaria: contador de pestañas activas; neutra: pestañas inactivas. */
  tono?: "alerta" | "primaria" | "neutra";
  /** Texto para lectores de pantalla (p. ej. "avistamientos"). */
  descripcion?: string;
  className?: string;
};

const TONOS = {
  alerta: "bg-danger text-on-primary",
  primaria: "bg-primary text-on-primary",
  neutra: "bg-estado-cerrado-bg text-estado-cerrado-fg",
} as const;

/** Insignia contador; "9+" a partir de 10. */
export function InsigniaContador({ valor, tono = "primaria", descripcion, className }: Props) {
  return (
    <span
      className={cx(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-chip px-1.5 text-caption font-bold leading-none",
        TONOS[tono],
        className,
      )}
    >
      {valor > 9 ? "9+" : valor}
      {descripcion && <span className="sr-only"> {descripcion}</span>}
    </span>
  );
}
