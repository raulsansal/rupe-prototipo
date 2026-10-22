"use client";

import Link from "next/link";
import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { PantallaMensaje } from "./PantallaMensaje";

/** TRA-04: error inesperado o sin conexión. «Reintentar» vuelve a intentar la acción. */
export function PantallaError({ onReintentar }: { onReintentar: () => void }) {
  return (
    <PantallaMensaje
      icono="warning"
      titulo="Algo salió mal"
      acciones={
        <>
          <Boton tamano="grande" anchoCompleto onClick={onReintentar}>
            Reintentar
          </Boton>
          <Link href="/" className={clasesBoton({ variante: "secundario", tamano: "grande", anchoCompleto: true })}>
            Ir al inicio
          </Link>
        </>
      }
    >
      <Alerta tipo="info" titulo="No pudimos completar la acción" className="w-full text-left">
        Revisa tu conexión e inténtalo de nuevo. Tus datos capturados se conservan.
      </Alerta>
    </PantallaMensaje>
  );
}
