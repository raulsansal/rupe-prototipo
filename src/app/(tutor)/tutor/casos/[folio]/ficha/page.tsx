import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PantallaMensaje } from "@/components/features/PantallaMensaje";
import { PantallaPendiente } from "@/components/features/PantallaPendiente";
import { esCasoPropio } from "@/server/servicios/extravio";
import { obtenerSesion } from "@/server/sesion/sesion";
import { FichaBusquedaTutor, type ModalFicha } from "@/components/features/FichaBusquedaTutor";
import type { TamanoHoja } from "@/components/features/FichaBusqueda";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { aFichaPublica, resolverCaso } from "@/mocks/casos";
import { esCasoActivo } from "@/mocks/tipos";

export const metadata: Metadata = { title: "Ficha de búsqueda · RUPE" };

const MODALES: ModalFicha[] = ["visor", "compartir", "regenerar"];

/** TUT-07. ?modal=visor|compartir|regenerar abre un modal y ?hoja=carta|media-carta elige el tamaño del visor (capturas y pruebas). */
export default async function PaginaFichaBusqueda({ params, searchParams }: PageProps<"/tutor/casos/[folio]/ficha">) {
  const { folio } = await params;
  const { modal, hoja } = await searchParams;
  const origen = resolverCaso(folio);
  // Un caso REAL recién registrado por esta persona aún no tiene su ficha conectada (bloques P3 y P4): pantalla pendiente, nunca 404.
  if (!origen && (await esCasoPropio(await obtenerSesion(), folio))) return <PantallaPendiente pantalla="Ficha de búsqueda" href="/tutor" etiquetaVolver="Ir a mis registros" />;
  if (!origen) notFound();
  // La ficha solo se genera con el caso activo (HU 019 y 023).
  if (!esCasoActivo(origen.estado)) {
    return (
      <PantallaMensaje
        icono="info"
        titulo="La ficha ya no está disponible"
        acciones={
          <Link href={`/tutor/casos/${origen.folio}`} className={clasesBoton({ tamano: "grande", anchoCompleto: true })}>
            Regresar al detalle del caso
          </Link>
        }
      >
        <p className="text-body text-text-muted">La ficha de búsqueda solo se puede ver, imprimir o compartir mientras el caso sigue en curso.</p>
      </PantallaMensaje>
    );
  }
  const modalInicial = MODALES.find((m) => m === modal);
  const hojaInicial: TamanoHoja = hoja === "media-carta" ? "media-carta" : "carta";
  // La vista previa recibe solo FichaPublica: nada reservado ni de la persona tutora.
  return <FichaBusquedaTutor ficha={aFichaPublica(origen)} modalInicial={modalInicial} hojaInicial={hojaInicial} />;
}
