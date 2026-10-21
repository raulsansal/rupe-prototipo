import Link from "next/link";
import { cx } from "@/lib/clases";
import type { EnlaceNavegacion } from "./navegacion";

type Props = { enlaces: EnlaceNavegacion[]; activo: string; etiqueta: string; className?: string };

/** Lista horizontal de enlaces del encabezado; el activo se marca con píldora, color y peso. */
export function EnlacesNavegacion({ enlaces, activo, etiqueta, className }: Props) {
  return (
    <nav aria-label={etiqueta} className={className}>
      <ul className="flex items-center gap-1">
        {enlaces.map((e) => {
          const esActivo = e.href === activo;
          return (
            <li key={e.href}>
              <Link
                href={e.href}
                aria-current={esActivo ? "page" : undefined}
                className={cx(
                  "inline-flex h-tactil items-center whitespace-nowrap rounded-boton px-3 text-small hover:bg-primary-soft",
                  esActivo ? "bg-primary-soft font-bold text-primary" : "font-medium text-text",
                )}
              >
                {e.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
