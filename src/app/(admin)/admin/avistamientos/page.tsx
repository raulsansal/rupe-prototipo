import type { Metadata } from "next";
import { ModeracionAvistamientos } from "@/components/features/moderacion/ModeracionAvistamientos";
import { EstadoCarga } from "@/components/ui/EstadoCarga";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { AVISTAMIENTOS_MODERACION, ID_AVISTAMIENTO_FALLECIDO, ID_AVISTAMIENTO_OCULTO, ID_AVISTAMIENTO_VISIBLE } from "@/mocks/moderacion";

export const metadata: Metadata = { title: "Moderación de avistamientos · RUPE" };

/**
 * ADM-05 y MOD-09. ?estado=cargando | vacio y ?modal=ocultar | detalle | detalle-fallecido | detalle-oculto solo fijan variantes (capturas y pruebas);
 * ?foto=visible revela la fotografía del detalle «Fallecido», ?error=motivo abre MOD-09 con el error y ?pagina=N abre esa página.
 */
export default async function ModeracionDeAvistamientos({ searchParams }: PageProps<"/admin/avistamientos">) {
  const { estado, modal, foto, error, pagina } = await searchParams;
  if (estado === "cargando")
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h1">Moderación de avistamientos</h1>
        <div className="flex flex-col gap-3" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <EstadoCarga key={i} etiqueta="Cargando avistamientos…" />
          ))}
        </div>
      </div>
    );
  if (estado === "vacio")
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h1">Moderación de avistamientos</h1>
        <EstadoVacio icono="visibility" titulo="Aún no hay avistamientos" descripcion="Cuando alguien reporte un avistamiento, aparecerá aquí." />
      </div>
    );
  const inicial =
    modal === "ocultar" ? { id: ID_AVISTAMIENTO_VISIBLE, tipo: "ocultar" as const } : modal === "detalle" ? { id: ID_AVISTAMIENTO_VISIBLE, tipo: "detalle" as const } : modal === "detalle-fallecido" ? { id: ID_AVISTAMIENTO_FALLECIDO, tipo: "detalle" as const } : modal === "detalle-oculto" ? { id: ID_AVISTAMIENTO_OCULTO, tipo: "detalle" as const } : undefined;
  return <ModeracionAvistamientos avistamientos={AVISTAMIENTOS_MODERACION} modalInicial={inicial} fotoVisible={foto === "visible"} errorInicial={error === "motivo"} paginaInicial={Number(pagina) || 1} />;
}
