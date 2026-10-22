import Link from "next/link";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { PantallaMensaje } from "./PantallaMensaje";

/** TRA-01: página no encontrada (cualquier rol, cualquier punto del sistema). */
export function PantallaNoEncontrada() {
  return (
    <PantallaMensaje
      icono="search"
      titulo="Página no encontrada"
      acciones={
        <>
          <Link href="/" className={clasesBoton({ tamano: "grande", anchoCompleto: true })}>
            Ir al inicio
          </Link>
          <Link href="/#buscar-folio" className={clasesBoton({ variante: "secundario", tamano: "grande", anchoCompleto: true })}>
            Consultar un folio
          </Link>
        </>
      }
    >
      <p className="text-body text-text-muted">La página que buscas no existe o cambió de lugar. Revisa la dirección o vuelve al inicio.</p>
    </PantallaMensaje>
  );
}
