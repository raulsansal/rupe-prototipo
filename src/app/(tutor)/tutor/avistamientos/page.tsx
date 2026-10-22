import type { Metadata } from "next";
import { PantallaPendiente } from "@/components/features/PantallaPendiente";

export const metadata: Metadata = { title: "Avistamientos · RUPE" };

export default function AvistamientosRecibidos() {
  return <PantallaPendiente pantalla="Avistamientos" href="/tutor" etiquetaVolver="Ir a mis registros" />;
}
