import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PantallaPendiente } from "@/components/features/PantallaPendiente";
import { GRUPOS_ADMIN } from "@/components/layout/navegacion";

/** Pantallas del Administrador que ya existen: el resto de las opciones del menú llevan a «Pantalla pendiente», nunca a un 404. */
const CONSTRUIDAS = ["/admin", "/admin/usuarios"];
const PENDIENTES = GRUPOS_ADMIN.flatMap((g) => g.enlaces).filter((e) => !CONSTRUIDAS.includes(e.href));

export const dynamicParams = false;
export const generateStaticParams = () => PENDIENTES.map((e) => ({ seccion: e.href.split("/").pop()! }));

const buscar = (seccion: string) => PENDIENTES.find((e) => e.href === `/admin/${seccion}`);

export async function generateMetadata({ params }: PageProps<"/admin/[seccion]">): Promise<Metadata> {
  const { seccion } = await params;
  return { title: `${buscar(seccion)?.etiqueta ?? "Pantalla pendiente"} · RUPE` };
}

export default async function SeccionPendiente({ params }: PageProps<"/admin/[seccion]">) {
  const { seccion } = await params;
  const enlace = buscar(seccion);
  if (!enlace) notFound();
  return <PantallaPendiente pantalla={enlace.etiqueta} href="/admin" etiquetaVolver="Ir al tablero" />;
}
