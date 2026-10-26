import { clasesBoton } from "@/components/ui/clasesBoton";
import { Icono } from "@/components/ui/Icono";

/**
 * «Cerrar sesión» (HU 007): un formulario POST sin JavaScript. El servidor invalida solo la sesión actual, borra la cookie y responde 303 a «/».
 * Se ve igual que el enlace de antes; para los lectores de pantalla es un botón.
 */
export function BotonCerrarSesion({ className }: { className?: string }) {
  return (
    <form method="post" action="/api/acceso/cerrar" className={className}>
      <button type="submit" className={clasesBoton({ variante: "secundario", anchoCompleto: true })}>
        <Icono nombre="logout" tamano={20} />
        Cerrar sesión
      </button>
    </form>
  );
}
