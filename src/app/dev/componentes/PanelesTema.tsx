import type { ReactNode } from "react";

const TEMAS = [
  { id: "light", nombre: "Modo claro" },
  { id: "dark", nombre: "Modo oscuro" },
] as const;

type Props = {
  seccion: string;
  titulo: string;
  lamina: string;
  children: ReactNode;
  /** Bloque que ocupa todo el ancho de la sección (un panel claro y otro oscuro, apilados). */
  anchoCompleto?: { titulo: string; contenido: ReactNode };
};

/**
 * Sección de la galería (una por lámina): el mismo contenido en un panel claro y otro oscuro.
 * Cada panel define su propio [data-theme], así que los tokens se resuelven por panel aunque la página esté en el otro tema.
 */
export function PanelesTema({ seccion, titulo, lamina, children, anchoCompleto }: Props) {
  return (
    <section data-seccion={seccion} aria-labelledby={`t-${seccion}`} className="mt-10">
      <h2 id={`t-${seccion}`} className="mb-1 text-h2 font-semibold">
        {titulo}
      </h2>
      <p className="mb-4 text-small text-text-muted">{lamina}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {TEMAS.map((t) => (
          <div key={t.id} data-theme={t.id} className="min-w-0 rounded-tarjeta border border-border bg-background p-4 text-text">
            <h3 className="mb-4 text-h3 font-semibold">{t.nombre}</h3>
            <div className="flex flex-col gap-6">{children}</div>
          </div>
        ))}
      </div>
      {anchoCompleto && (
        <div className="mt-4 grid gap-4">
          {TEMAS.map((t) => (
            <div key={t.id} data-theme={t.id} className="min-w-0 rounded-tarjeta border border-border bg-background p-4 text-text">
              <h3 className="mb-4 text-h3 font-semibold">
                {t.nombre} · {anchoCompleto.titulo}
              </h3>
              {anchoCompleto.contenido}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <h4 className="mb-2 text-caption font-semibold uppercase tracking-wide text-text-muted">{titulo}</h4>
      {children}
    </div>
  );
}
