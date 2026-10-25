import type { Metadata } from "next";
import { ConsultaBitacora } from "@/components/features/bitacora/ConsultaBitacora";
import { EstadoCarga } from "@/components/ui/EstadoCarga";
import { BITACORA, TIPOS_ACCION } from "@/mocks/bitacora";

export const metadata: Metadata = { title: "Bitácora de acciones · RUPE" };

/** ADM-12 (HU 058). ?estado=cargando | vacio y ?pagina=N solo fijan variantes (capturas y pruebas); «vacio» abre con un tipo y fechas sin acciones. */
export default async function BitacoraDeAcciones({ searchParams }: PageProps<"/admin/bitacora">) {
  const { estado, pagina } = await searchParams;
  if (estado === "cargando")
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h1">Bitácora de acciones</h1>
        <div className="flex flex-col gap-3" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <EstadoCarga sinFoto key={i} etiqueta="Cargando la bitácora…" />
          ))}
        </div>
      </div>
    );
  const filtroInicial = estado === "vacio" ? { tipo: TIPOS_ACCION[7], desde: "2026-10-17", hasta: "2026-10-18" } : undefined;
  return <ConsultaBitacora acciones={BITACORA} paginaInicial={Number(pagina) || 1} filtroInicial={filtroInicial} />;
}
