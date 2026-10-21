import Link from "next/link";
import { cx } from "@/lib/clases";
import type { GrupoNavegacion } from "./navegacion";

type Props = { grupos: GrupoNavegacion[]; activo: string; onNavegar?: () => void; etiqueta?: string };

/** Grupos de opciones del administrador (cajón en móvil, barra lateral en escritorio). */
export function NavegacionAdmin({ grupos, activo, onNavegar, etiqueta = "Administración" }: Props) {
  return (
    <nav aria-label={etiqueta}>
      {grupos.map((g) => (
        <section key={g.titulo} aria-labelledby={`adm-${g.titulo}`}>
          <h2 id={`adm-${g.titulo}`} className="bg-surface-raised px-4 py-2 text-caption font-bold uppercase tracking-wide text-text-muted">
            {g.titulo}
          </h2>
          <ul>
            {g.enlaces.map((e) => {
              const esActivo = e.href === activo;
              return (
                <li key={e.href} className="border-b border-border">
                  <Link
                    href={e.href}
                    onClick={onNavegar}
                    aria-current={esActivo ? "page" : undefined}
                    className={cx(
                      "flex min-h-tactil items-center px-4 text-small",
                      esActivo ? "bg-primary font-bold text-on-primary" : "font-semibold hover:bg-primary-soft",
                    )}
                  >
                    {e.etiqueta}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
