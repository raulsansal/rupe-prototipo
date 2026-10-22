import type { Metadata } from "next";
import { PantallaPendiente } from "@/components/features/PantallaPendiente";

export const metadata: Metadata = { title: "Consultar folio · RUPE" };

export default function ConsultarFolio() {
  return <PantallaPendiente pantalla="Consultar folio" href="/tutor" etiquetaVolver="Ir a mis registros" />;
}
