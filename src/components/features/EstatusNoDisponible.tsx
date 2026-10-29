import Link from "next/link";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { PantallaMensaje } from "./PantallaMensaje";

/**
 * HU 038: «folio no encontrado». Se usa IGUAL para un folio inexistente, mal formado, cancelado o deshabilitado (R33): no se revela que el caso existió.
 */
export function EstatusNoDisponible({ hrefConsulta = "/estatus", nivel = 1 }: { hrefConsulta?: string; nivel?: 1 | 2 }) {
  return (
    <PantallaMensaje
      icono="search"
      titulo="Folio no encontrado"
      nivel={nivel}
      acciones={
        <>
          <Link href={hrefConsulta} className={clasesBoton({ tamano: "grande", anchoCompleto: true })}>
            Consultar otro folio
          </Link>
          <Link href="/" className={clasesBoton({ variante: "secundario", tamano: "grande", anchoCompleto: true })}>
            Ir al inicio
          </Link>
        </>
      }
    >
      <p className="text-body text-text-muted">No hay un caso consultable con ese folio. Revisa que esté completo, con el formato RUPE-XXXXXXXX.</p>
    </PantallaMensaje>
  );
}
