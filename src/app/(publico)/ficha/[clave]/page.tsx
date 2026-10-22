import type { Metadata } from "next";
import { FichaPublicaVista } from "@/components/features/FichaPublicaVista";
import { FichaNoDisponible } from "@/components/features/FichaNoDisponible";
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

  // Estado C: un folio inexistente se ve y responde igual que un caso cerrado, cancelado o deshabilitado.
  if (!origen) return <FichaNoDisponible />;

  // El componente recibe solo FichaPublica: lo reservado y los datos de la persona tutora no salen de aquí.
  const ficha = aplicarVariante(aFichaPublica(origen), typeof estado === "string" ? estado : undefined);

  if (ficha === "no-disponible") return <FichaNoDisponible />;
  return <FichaPublicaVista ficha={ficha} hrefAvistamiento={`/ficha/${ficha.folio}/avistamiento`} />;
}
