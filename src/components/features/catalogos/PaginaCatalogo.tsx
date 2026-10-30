import { GestionCatalogo } from "@/components/features/catalogos/GestionCatalogo";
import type { TipoCatalogo } from "@/config/catalogos";
import { exigirSesionDePagina, paraPagina } from "@/server/sesion/pagina";
import { listarCatalogo } from "@/server/servicios/admin/catalogosAdmin";

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/**
 * Cuerpo común de las páginas de catálogo (ADM-06 a ADM-09). Lee el almacén por el servicio de Administrador (que vuelve a exigir el rol); la búsqueda (`q`) y la página (`pagina`)
 * vienen de la URL y el servidor las valida: una página inválida se corrige a la 1 y una que se pasa del final, a la última.
 */
export async function PaginaCatalogo({ tipo, searchParams }: { tipo: TipoCatalogo; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const sesion = await exigirSesionDePagina("Administrador");
  const listado = await paraPagina(listarCatalogo(sesion, tipo, { texto: q.q, pagina: q.pagina }));
  return <GestionCatalogo listado={listado} valores={{ q: texto(q.q) }} />;
}
