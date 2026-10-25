import type { Metadata } from "next";
import { GestionCatalogo } from "@/components/features/catalogos/GestionCatalogo";
import { EstadoCarga } from "@/components/ui/EstadoCarga";
import { aperturaDeEjemplo, CATALOGOS } from "@/mocks/catalogosAdmin";

export const metadata: Metadata = { title: "Catálogo de razas · RUPE" };

/** Plantilla única de catálogo. ?estado=cargando, ?modal=nuevo | editar | desactivar y ?pagina=N solo fijan variantes (capturas y pruebas). */
export default async function CatalogoRazas({ searchParams }: PageProps<"/admin/razas">) {
  const { estado, modal, pagina } = await searchParams;
  if (estado === "cargando")
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h1">{CATALOGOS["razas"].titulo}</h1>
        <div className="flex flex-col gap-3" aria-live="polite">
          {[0, 1, 2, 3].map((i) => (
            <EstadoCarga key={i} etiqueta="Cargando catálogo…" />
          ))}
        </div>
      </div>
    );
  return <GestionCatalogo tipo="razas" paginaInicial={Number(pagina) || 1} modalInicial={aperturaDeEjemplo("razas", modal)} />;
}
