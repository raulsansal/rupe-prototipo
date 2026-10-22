import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FlujoAvistamiento } from "@/components/features/avistamiento/FlujoAvistamiento";
import { estadoInicial } from "@/components/features/avistamiento/variantes";
import { aceptaAvistamientos, aFichaPublica, resolverCaso } from "@/mocks/casos";

export const metadata: Metadata = { title: "Reportar avistamiento · RUPE" };

const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** ?paso, ?ubicacion, ?caso y ?datos solo fijan el estado inicial para capturas y pruebas (ver CLAUDE.md). */
export default async function PaginaAvistamiento({ params, searchParams }: PageProps<"/ficha/[clave]/avistamiento">) {
  const { clave } = await params;
  const q = await searchParams;
  const origen = resolverCaso(clave);
  // Un folio inexistente o un caso que no acepta avistamientos (R13) vuelve a la ficha, que explica por qué.
  if (!origen || !aceptaAvistamientos(origen.estado)) redirect(`/ficha/${clave}`);
  const { folio, nombre, fotografiaUrl } = aFichaPublica(origen);
  const inicial = estadoInicial({ paso: primero(q.paso), ubicacion: primero(q.ubicacion), caso: primero(q.caso), datos: primero(q.datos) });
  return <FlujoAvistamiento ficha={{ folio, nombre, fotografiaUrl }} inicial={inicial} />;
}
