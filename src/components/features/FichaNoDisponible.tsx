import Link from "next/link";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { PantallaMensaje } from "./PantallaMensaje";

/**
 * Estado C de PUB-03 (lámina 1.2): una sola pantalla con dos tarjetas apiladas. Se usa tanto para un folio inexistente
 * como para un caso cerrado, cancelado o deshabilitado, con exactamente el mismo contenido: así no se revela que el caso existió.
 */
export function FichaNoDisponible() {
  return (
    <div className="flex flex-col gap-4">
      <PantallaMensaje
        icono="search"
        titulo="Folio no encontrado"
        acciones={
          <>
            <Link href="/#buscar-folio" className={clasesBoton({ tamano: "grande", anchoCompleto: true })}>
              Buscar otro folio
            </Link>
            <Link href="/" className={clasesBoton({ variante: "secundario", tamano: "grande", anchoCompleto: true })}>
              Ir al inicio
            </Link>
          </>
        }
      >
        <p className="text-body text-text-muted">No hay una ficha disponible con ese folio. Revisa que esté completo, con el formato RUPE-XXXXXXXX.</p>
      </PantallaMensaje>
      <PantallaMensaje icono="pets" titulo="Gracias por ayudar a que los perros extraviados regresen a casa" nivel={2} />
    </div>
  );
}
