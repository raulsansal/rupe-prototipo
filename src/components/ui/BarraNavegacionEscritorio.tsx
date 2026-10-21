import Link from "next/link";
import { cx } from "@/lib/clases";
import { clasesBoton } from "./clasesBoton";
import type { ItemNavegacion } from "./ItemNavegacion";
import { Logo } from "./Logo";

type Props = {
  items: Omit<ItemNavegacion, "icono">[];
  /** href del ítem activo. */
  activo: string;
  accion?: { href: string; etiqueta: string };
  /** Solo galería: la barra se oculta por debajo de 768 px; esto la deja visible para mostrarla en pantallas angostas. */
  forzarVisible?: boolean;
  className?: string;
};

/** Barra de navegación de escritorio (se oculta por debajo de 768 px): logotipo, enlaces y una acción (p. ej. «Entrar»). */
export function BarraNavegacionEscritorio({ items, activo, accion, forzarVisible = false, className }: Props) {
  return (
    <header className={cx("h-16 items-center gap-6 rounded-tarjeta border border-border bg-surface px-4", forzarVisible ? "flex" : "hidden md:flex", className)}>
      <Link href="/" aria-label="RUPE, inicio" className="inline-flex h-tactil items-center rounded-campo">
        <Logo variante="horizontal" ancho={104} />
      </Link>
      <nav aria-label="Navegación principal" className="flex-1">
        <ul className="flex items-center gap-1">
          {items.map((item) => {
            const esActivo = item.href === activo;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={esActivo ? "page" : undefined}
                  className={cx(
                    "inline-flex h-tactil items-center whitespace-nowrap rounded-boton px-4 text-body hover:bg-primary-soft",
                    esActivo ? "bg-primary-soft font-semibold text-primary" : "font-medium text-text",
                  )}
                >
                  {item.etiqueta}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {accion && (
        <Link href={accion.href} className={clasesBoton({ variante: "secundario", className: "whitespace-nowrap" })}>
          {accion.etiqueta}
        </Link>
      )}
    </header>
  );
}
