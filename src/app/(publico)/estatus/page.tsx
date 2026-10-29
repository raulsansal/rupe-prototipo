import type { Metadata } from "next";
import { BuscadorFolio } from "@/components/features/BuscadorFolio";

export const metadata: Metadata = { title: "Consultar estatus · RUPE", robots: { index: false } };

/** HU 038: buscador público del estatus de un caso por folio, sin iniciar sesión. */
export default function ConsultarEstatus() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-h1">Consultar estatus de un caso</h1>
      <p className="text-body text-text-muted">Escribe el folio del caso para ver en qué etapa se encuentra. No necesitas iniciar sesión y no se muestra ningún dato personal.</p>
      <section aria-labelledby="titulo-consultar" className="rounded-tarjeta border border-border bg-surface p-4">
        <h2 id="titulo-consultar" className="mb-3 text-h3 font-semibold">
          Folio
        </h2>
        <BuscadorFolio destino="estatus" />
      </section>
    </div>
  );
}
