import type { Metadata } from "next";
import { ModeracionRegistros } from "@/components/features/moderacion/ModeracionRegistros";
import { EstadoCarga } from "@/components/ui/EstadoCarga";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { aRegistroAdminLista, CASOS_MODERACION, FOLIO_MODERACION_ACTIVO } from "@/mocks/moderacion";

export const metadata: Metadata = { title: "Moderación de registros · RUPE" };

/** ADM-04 y MOD-08. ?estado=cargando | vacio y ?modal=deshabilitar [+ ?error=motivo] solo fijan variantes (capturas y pruebas). */
export default async function ModeracionDeRegistros({ searchParams }: PageProps<"/admin/registros">) {
  const { estado, modal, error } = await searchParams;
  if (estado === "cargando")
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h1">Moderación de registros</h1>
        <div className="flex flex-col gap-3" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <EstadoCarga key={i} etiqueta="Cargando registros…" />
          ))}
        </div>
      </div>
    );
  if (estado === "vacio")
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h1">Moderación de registros</h1>
        <EstadoVacio icono="pets" titulo="Aún no hay registros" descripcion="Cuando una persona tutora registre un extravío, aparecerá aquí." />
      </div>
    );
  return <ModeracionRegistros casos={CASOS_MODERACION.map(aRegistroAdminLista)} modalInicial={modal === "deshabilitar" ? FOLIO_MODERACION_ACTIVO : undefined} errorInicial={error === "motivo"} />;
}
