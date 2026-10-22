import Link from "next/link";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { PantallaMensaje } from "./PantallaMensaje";

type Props = {
  /** Destino del botón para volver. */
  href: string;
  /** Texto del botón (p. ej. «Regresar al detalle del caso»). */
  etiquetaVolver: string;
  /** Nombre de la pantalla pendiente, para el título. */
  pantalla?: string;
};

/** Marcador de una pantalla que aún no existe: evita un 404 al seguir un enlace de las pantallas ya construidas. */
export function PantallaPendiente({ href, etiquetaVolver, pantalla }: Props) {
  return (
    <PantallaMensaje
      icono="schedule"
      titulo={pantalla ?? "Pantalla pendiente"}
      acciones={
        <Link href={href} className={clasesBoton({ tamano: "grande", anchoCompleto: true })}>
          {etiquetaVolver}
        </Link>
      }
    >
      <p className="text-body text-text-muted">Esta pantalla se construye en un bloque posterior.</p>
    </PantallaMensaje>
  );
}
