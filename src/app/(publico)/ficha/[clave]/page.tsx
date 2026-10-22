import type { Metadata } from "next";
import Link from "next/link";
import { FichaPublicaVista } from "@/components/features/FichaPublicaVista";
import { PantallaMensaje } from "@/components/features/PantallaMensaje";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { aFichaPublica, resolverCaso } from "@/mocks/casos";
import type { FichaPublica } from "@/mocks/tipos";

export const metadata: Metadata = { title: "Ficha pública · RUPE" };

/** ?estado=en-curso | localizado | no-disponible fuerza el estado de la pantalla (capturas y pruebas); sin él, manda el estado del caso. */
function aplicarVariante(ficha: FichaPublica, estado: string | undefined): FichaPublica | "no-disponible" {
  if (estado === "no-disponible") return "no-disponible";
  if (estado === "localizado") return { ...ficha, estado: "Localizado" };
  if (estado === "en-curso") return ficha.estado === "Localizado" || ficha.estado === "Cerrado" ? { ...ficha, estado: "En búsqueda" } : ficha;
  return ficha.estado === "Cerrado" ? "no-disponible" : ficha;
}

export default async function PaginaFicha({ params, searchParams }: PageProps<"/ficha/[clave]">) {
  const { clave } = await params;
  const { estado } = await searchParams;
  const origen = resolverCaso(clave);

  // Estado C · folio inexistente.
  if (!origen) {
    return (
      <PantallaMensaje
        icono="search"
        titulo="Folio no encontrado"
        acciones={
          <>
            <Link href="/#buscar-folio" className={clasesBoton({ tamano: "grande", anchoCompleto: true })}>
              Buscar otro folio
            </Link>
            <Link href="/" className={clasesBoton({ variante: "secundario", tamano: "grande", anchoCompleto: true })}>
              Ir al inicio
            </Link>
          </>
        }
      >
        <p className="text-body text-text-muted">No encontramos un caso con ese folio. Revisa que esté completo, con el formato RUPE-XXXXXXXX.</p>
      </PantallaMensaje>
    );
  }

  // El componente recibe solo FichaPublica: lo reservado y los datos de la persona tutora no salen de aquí.
  const ficha = aplicarVariante(aFichaPublica(origen), typeof estado === "string" ? estado : undefined);

  // Estado C · caso cerrado, cancelado o deshabilitado.
  if (ficha === "no-disponible") {
    return (
      <PantallaMensaje icono="info" titulo="Este caso ya no está disponible">
        <p className="text-body text-text-muted">El caso fue cerrado, cancelado o deshabilitado, así que ya no se muestra su ficha ni se reciben avistamientos.</p>
        <p className="w-full rounded-campo border-2 border-dashed border-border p-4 text-small">Gracias por ayudar a que los perros extraviados regresen a casa.</p>
      </PantallaMensaje>
    );
  }
  return <FichaPublicaVista ficha={ficha} hrefAvistamiento={`/ficha/${ficha.folio}/avistamiento`} />;
}
