import type { Metadata } from "next";
import { ListaAvistamientos } from "@/components/features/avistamientos/ListaAvistamientos";
import { diaCDMX } from "@/server/dominio/filtrosAvistamientos";
import { altDeFoto } from "@/lib/altDeFoto";
import { listadoDeAvistamientos } from "@/server/servicios/misRegistros";
import { paraPagina } from "@/server/sesion/pagina";
import { obtenerSesion } from "@/server/sesion/sesion";

export const metadata: Metadata = { title: "Avistamientos del caso · RUPE" };

const texto = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

/**
 * TUT-08 y HU 041. Los filtros viven en la URL (`?desde=&hasta=&alcaldia=`) y el servidor los valida y aplica; `?filtros=abiertos` solo despliega el panel (capturas y pruebas). El listado va
 * por fecha de recepción descendente y solo trae los avistamientos visibles.
 */
export default async function AvistamientosDelCaso({ params, searchParams }: PageProps<"/tutor/casos/[folio]/avistamientos">) {
  const { folio } = await params;
  const q = await searchParams;
  const valores = { desde: texto(q.desde), hasta: texto(q.hasta), alcaldia: texto(q.alcaldia) };
  const l = await paraPagina(listadoDeAvistamientos(await obtenerSesion(), folio, valores));
  return (
    <ListaAvistamientos
      folio={l.folio}
      nombrePerro={l.nombrePerro}
      altPerro={altDeFoto({ nombre: l.nombrePerro, sexo: l.sexo, raza: l.raza, tamano: l.tamano, color: l.color })}
      fotografiaPerro={l.fotografiaPerro}
      registro={diaCDMX(l.registro)}
      items={l.items}
      total={l.total}
      valores={valores}
      errores={l.errores}
      alcaldias={l.alcaldias}
      filtrosAbiertos={q.filtros === "abiertos"}
    />
  );
}
