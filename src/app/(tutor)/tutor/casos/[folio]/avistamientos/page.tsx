import type { Metadata } from "next";
import { ListaAvistamientos } from "@/components/features/avistamientos/ListaAvistamientos";
import { fechaLocalISO } from "@/lib/formato";
import { altDeFoto } from "@/lib/altDeFoto";
import { avistamientosDelCaso } from "@/server/servicios/misRegistros";
import { paraPagina } from "@/server/sesion/pagina";
import { obtenerSesion } from "@/server/sesion/sesion";

export const metadata: Metadata = { title: "Avistamientos del caso · RUPE" };

/** TUT-08. ?filtros=abiertos muestra los filtros desplegados (capturas y pruebas). */
export default async function AvistamientosDelCaso({ params, searchParams }: PageProps<"/tutor/casos/[folio]/avistamientos">) {
  const { folio } = await params;
  const { filtros } = await searchParams;
  const l = await paraPagina(avistamientosDelCaso(await obtenerSesion(), folio));
  return <ListaAvistamientos folio={l.folio} nombrePerro={l.nombrePerro} altPerro={altDeFoto({ nombre: l.nombrePerro, sexo: l.sexo, raza: l.raza, tamano: l.tamano, color: l.color })} fotografiaPerro={l.fotografiaPerro} registro={fechaLocalISO(l.registro)} items={l.items} filtrosAbiertos={filtros === "abiertos"} />;
}
