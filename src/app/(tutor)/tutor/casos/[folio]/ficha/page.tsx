import type { Metadata } from "next";
import Link from "next/link";
import { PantallaMensaje } from "@/components/features/PantallaMensaje";
import { fichaDelTutor } from "@/server/servicios/misRegistros";
import { paraPagina } from "@/server/sesion/pagina";
import { obtenerSesion } from "@/server/sesion/sesion";
import { FichaBusquedaTutor, type ModalFicha } from "@/components/features/FichaBusquedaTutor";
import type { TamanoHoja } from "@/components/features/FichaBusqueda";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { esCasoActivo } from "@/mocks/tipos";

export const metadata: Metadata = { title: "Ficha de búsqueda · RUPE" };

const MODALES: ModalFicha[] = ["visor", "compartir", "regenerar"];

/** TUT-07: lee el caso del almacén con la guarda de dueño. ?modal=visor|compartir|regenerar abre un modal y ?hoja=carta|media-carta elige el tamaño del visor (capturas y pruebas). */
export default async function PaginaFichaBusqueda({ params, searchParams }: PageProps<"/tutor/casos/[folio]/ficha">) {
  const { folio } = await params;
  const { modal, hoja } = await searchParams;
  const ficha = await paraPagina(fichaDelTutor(await obtenerSesion(), folio));
  // La ficha solo se genera con el caso activo (HU 019 y 023).
  if (!esCasoActivo(ficha.estado)) {
    return (
      <PantallaMensaje
        icono="info"
        titulo="La ficha ya no está disponible"
        acciones={
          <Link href={`/tutor/casos/${ficha.folio}`} className={clasesBoton({ tamano: "grande", anchoCompleto: true })}>
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
  return <FichaBusquedaTutor ficha={ficha} modalInicial={modalInicial} hojaInicial={hojaInicial} />;
}
