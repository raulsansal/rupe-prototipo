import Link from "next/link";
import { cx } from "@/lib/clases";

type Props = {
  folio: string;
  activa: "lista" | "mapa";
  /** Sin avistamientos no hay nada que ubicar: «Mapa» se muestra deshabilitado. */
  mapaDeshabilitado?: boolean;
};

const base = "inline-flex h-boton items-center justify-center rounded-boton text-small font-semibold";

/** Selector «Lista / Mapa» que comunica TUT-08 con TUT-09 (dos enlaces; el activo lleva aria-current). */
export function SelectorVista({ folio, activa, mapaDeshabilitado = false }: Props) {
  const ruta = `/tutor/casos/${folio}`;
  return (
    <nav aria-label="Vista de los avistamientos" className="grid grid-cols-2 gap-3">
      <Link href={`${ruta}/avistamientos`} aria-current={activa === "lista" ? "page" : undefined} className={cx(base, "borde-campo", activa === "lista" ? "border-primary bg-primary text-on-primary" : "border-primary text-primary hover:bg-primary-soft")}>
        Lista
      </Link>
      {mapaDeshabilitado ? (
        <span aria-disabled="true" className={cx(base, "border-2 border-dashed border-border bg-disabled-bg text-disabled-text")}>
          Mapa
        </span>
      ) : (
        <Link href={`${ruta}/mapa`} aria-current={activa === "mapa" ? "page" : undefined} className={cx(base, "borde-campo", activa === "mapa" ? "border-primary bg-primary text-on-primary" : "border-primary text-primary hover:bg-primary-soft")}>
          Mapa
        </Link>
      )}
    </nav>
  );
}
