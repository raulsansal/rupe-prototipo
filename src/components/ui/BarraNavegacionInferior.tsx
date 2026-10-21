import Link from "next/link";
import { cx } from "@/lib/clases";
import { Icono } from "./Icono";
import type { ItemNavegacion } from "./ItemNavegacion";

type Props = {
  items: ItemNavegacion[];
  /** href del ítem activo. */
  activo: string;
  etiqueta?: string;
  className?: string;
};

/** Navegación inferior en móvil: ítems de al menos 56 px; el activo se marca con píldora, color y peso. */
export function BarraNavegacionInferior({ items, activo, etiqueta = "Navegación principal", className }: Props) {
  return (
    <nav aria-label={etiqueta} className={cx("rounded-tarjeta border border-border bg-surface", className)}>
      <ul className="flex">
        {items.map((item) => {
          const esActivo = item.href === activo;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={esActivo ? "page" : undefined}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-tarjeta px-1 py-1.5 text-caption"
              >
                <span className={cx("flex h-8 w-16 items-center justify-center rounded-chip", esActivo ? "bg-primary-soft text-primary" : "text-text-muted")}>
                  <Icono nombre={item.icono} />
                </span>
                <span className={esActivo ? "font-bold text-text" : "font-medium text-text-muted"}>{item.etiqueta}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
