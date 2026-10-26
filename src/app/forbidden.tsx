import type { Metadata } from "next";
import Link from "next/link";
import { PantallaMensaje } from "@/components/features/PantallaMensaje";
import { BotonCerrarSesion } from "@/components/layout/BotonCerrarSesion";
import { PlantillaPublica } from "@/components/layout/PlantillaPublica";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { DESTINO_POR_DEFECTO } from "@/server/sesion/destino";
import { obtenerSesion } from "@/server/sesion/sesion";

export const metadata: Metadata = { title: "Sin acceso · RUPE" };

/**
 * Acceso denegado (HTTP 403), propuesta mínima: el maquetado no trae una pantalla TRA para esto. Se arma con PantallaMensaje, como TRA-01.
 * Se muestra cuando la sesión es válida pero su rol no corresponde a la ruta (p. ej. una persona tutora en /admin).
 */
export default async function AccesoDenegado() {
  const sesion = await obtenerSesion();
  return (
    <PlantillaPublica>
      <PantallaMensaje
        icono="lock"
        titulo="No tienes acceso a esta página"
        acciones={
          <>
            <Link href={sesion ? DESTINO_POR_DEFECTO[sesion.rol] : "/"} className={clasesBoton({ tamano: "grande", anchoCompleto: true })}>
              {sesion ? "Ir a mi página inicial" : "Ir al inicio"}
            </Link>
            {sesion && <BotonCerrarSesion />}
          </>
        }
      >
        <p className="text-body text-text-muted">Tu cuenta no tiene permiso para ver esta pantalla. Si crees que es un error, contacta a quien administra RUPE.</p>
      </PantallaMensaje>
    </PlantillaPublica>
  );
}
