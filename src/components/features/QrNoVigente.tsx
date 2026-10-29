import Link from "next/link";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { MENSAJE_QR_NO_VIGENTE } from "@/server/config/mensajes";
import { PantallaMensaje } from "./PantallaMensaje";

/**
 * Canal QR: un código inexistente, mal formado, regenerado o de un caso que no se muestra se ve SIEMPRE igual (no se revela si existió). Propone buscar por folio.
 * No usa el mensaje de «folio no encontrado»: son canales distintos.
 */
export function QrNoVigente() {
  return (
    <PantallaMensaje
      icono="qr_code_2"
      titulo={MENSAJE_QR_NO_VIGENTE}
      acciones={
        <>
          <Link href="/#buscar-folio" className={clasesBoton({ tamano: "grande", anchoCompleto: true })}>
            Buscar por folio
          </Link>
          <Link href="/" className={clasesBoton({ variante: "secundario", tamano: "grande", anchoCompleto: true })}>
            Ir al inicio
          </Link>
        </>
      }
    >
      <p className="text-body text-text-muted">Quizá la persona que registró al perro generó un código nuevo. Si tienes el folio de la ficha, búscala con él; lo encuentras junto al código QR.</p>
    </PantallaMensaje>
  );
}
