import Link from "next/link";
import { cx } from "@/lib/clases";
import { CLASES_BOTON_ICONO } from "./BotonIcono";
import { Icono, type NombreIcono } from "./Icono";
import { InsigniaContador } from "./InsigniaContador";

type Props = {
  href: string;
  icono: NombreIcono;
  /** Nombre accesible del enlace (obligatorio: no hay texto visible). */
  etiqueta: string;
  insignia?: number;
  contorno?: boolean;
  className?: string;
};

/** Enlace cuadrado de 44 px con solo ícono (equivalente de BotonIcono para navegar). */
export function EnlaceIcono({ href, icono, etiqueta, insignia, contorno = false, className }: Props) {
  return (
    <Link
      href={href}
      aria-label={insignia ? `${etiqueta}, ${insignia > 9 ? "más de 9" : insignia} nuevos` : etiqueta}
      className={cx(CLASES_BOTON_ICONO, contorno && "borde-campo border-border bg-surface", className)}
    >
      <Icono nombre={icono} />
      {insignia ? <InsigniaContador valor={insignia} tono="alerta" className="absolute -right-1 -top-1" /> : null}
    </Link>
  );
}
