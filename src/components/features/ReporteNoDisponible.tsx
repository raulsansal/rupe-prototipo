import Link from "next/link";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { PantallaMensaje } from "./PantallaMensaje";

/** HU 028: el caso ya no admite avistamientos (Localizado o Cerrado, R13). Se muestra EN LUGAR del formulario; vuelve a la ficha. */
export function ReporteNoDisponible({ hrefFicha }: { hrefFicha: string }) {
  return (
    <PantallaMensaje
      icono="info"
      titulo="Este caso ya no recibe avistamientos"
      acciones={
        <>
          <Link href={hrefFicha} className={clasesBoton({ tamano: "grande", anchoCompleto: true })}>
            Volver a la ficha
          </Link>
          <Link href="/" className={clasesBoton({ variante: "secundario", tamano: "grande", anchoCompleto: true })}>
            Ir al inicio
          </Link>
        </>
      }
    >
      <p className="text-body text-text-muted">El perro ya fue localizado o el caso se cerró, así que no se pueden registrar más avistamientos. ¡Gracias por querer ayudar!</p>
    </PantallaMensaje>
  );
}
