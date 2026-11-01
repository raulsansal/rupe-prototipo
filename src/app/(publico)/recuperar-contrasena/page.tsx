import type { Metadata } from "next";
import { PantallaPendiente } from "@/components/features/PantallaPendiente";

export const metadata: Metadata = { title: "Recuperar contraseña · RUPE" };

// Recuperación de contraseña: estará disponible en una etapa posterior del proyecto.
export default function RecuperarContrasena() {
  return <PantallaPendiente pantalla="Recuperar contraseña" href="/acceso" etiquetaVolver="Volver a iniciar sesión" />;
}
