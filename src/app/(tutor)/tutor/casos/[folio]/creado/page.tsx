import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RegistroCreado } from "@/components/features/RegistroCreado";
import { ErrorApp } from "@/server/errores";
import { casoRecienCreado } from "@/server/servicios/extravio";
import { obtenerSesion } from "@/server/sesion/sesion";

export const metadata: Metadata = { title: "Registro creado · RUPE" };

/** TUT-04. Lee el caso REAL del almacén; el servicio aplica la guarda de dueño (otra persona, o un folio que no existe, ve 404 igual). */
export default async function PaginaRegistroCreado({ params }: PageProps<"/tutor/casos/[folio]/creado">) {
  const { folio } = await params;
  const caso = await casoRecienCreado(await obtenerSesion(), folio).catch((e) => {
    if (e instanceof ErrorApp && (e.estado === 404 || e.estado === 401 || e.estado === 403)) return undefined; // 404 igual para otra persona o folio inexistente
    throw e;
  });
  if (!caso) notFound();
  return <RegistroCreado caso={caso} />;
}
