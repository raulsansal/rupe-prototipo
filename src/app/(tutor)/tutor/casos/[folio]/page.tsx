import type { Metadata } from "next";
import { headers } from "next/headers";
import { DetalleCasoTutor } from "@/components/features/DetalleCasoTutor";
import { basePublicaDeCabeceras } from "@/server/config/urlPublica";
import { ErrorApp } from "@/server/errores";
import { casoDelTutor } from "@/server/servicios/misRegistros";
import { enlaceDeEstatus } from "@/server/servicios/seguimiento";
import { paraPagina } from "@/server/sesion/pagina";
import { obtenerSesion } from "@/server/sesion/sesion";

export const metadata: Metadata = { title: "Detalle del caso · RUPE" };

/**
 * TUT-05: lee el caso del ALMACÉN con la guarda de dueño dentro del servicio; solo se pasa la vista de su dueña (sin su nombre, correo ni teléfono, y sin el token del QR). Estado e historial
 * son los reales (P5 retiró ?estado=). «Compartir estatus» lleva el enlace público de ESTATUS por folio (nunca el token): en cualquier estado salvo Cerrado.
 */
export default async function DetalleCaso({ params }: PageProps<"/tutor/casos/[folio]">) {
  const { folio } = await params;
  const sesion = await obtenerSesion();
  const caso = await paraPagina(casoDelTutor(sesion, folio));
  const enlace = await enlaceDeEstatus(sesion, folio, basePublicaDeCabeceras(await headers())).catch((e) => {
    if (e instanceof ErrorApp && e.estado === 409) return null; // Cerrado: no se comparte (la pantalla ya no ofrece el botón)
    throw e;
  });
  return <DetalleCasoTutor caso={caso} enlaceCompartir={enlace} />;
}
