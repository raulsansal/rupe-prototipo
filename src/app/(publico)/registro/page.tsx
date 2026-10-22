import type { Metadata } from "next";
import { PantallaPendiente } from "@/components/features/PantallaPendiente";

export const metadata: Metadata = { title: "Crear cuenta · RUPE" };

// ACC-02: se construye en un bloque posterior.
export default function Registro() {
  return <PantallaPendiente pantalla="Crear cuenta de persona tutora" href="/acceso" etiquetaVolver="Volver a iniciar sesión" />;
}
