import type { Metadata } from "next";
import type { AccionUsuario } from "@/components/features/usuarios/ModalUsuario";
import { GestionUsuarios } from "@/components/features/usuarios/GestionUsuarios";
import { EstadoCarga } from "@/components/ui/EstadoCarga";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { USUARIOS_INICIALES } from "@/mocks/usuarios";

export const metadata: Metadata = { title: "Usuarios · RUPE" };

/** ADM-03 y MOD-10. ?estado=cargando | vacio y ?modal=rol | deshabilitar | habilitar solo fijan variantes (capturas y pruebas). */
export default async function Usuarios({ searchParams }: PageProps<"/admin/usuarios">) {
  const { estado, modal } = await searchParams;
  if (estado === "cargando")
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h1">Usuarios</h1>
        <div className="flex flex-col gap-3" aria-live="polite">
          {[0, 1, 2, 3].map((i) => (
            <EstadoCarga key={i} etiqueta="Cargando usuarios…" />
          ))}
        </div>
      </div>
    );
  if (estado === "vacio")
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h1">Usuarios</h1>
        <EstadoVacio icono="person" titulo="Aún no hay usuarios" descripcion="Cuando alguien cree una cuenta, aparecerá aquí." />
      </div>
    );
  // Usuarios de ejemplo de cada modal: 5 es una persona tutora activa; 3, una cuenta inactiva.
  const inicial = modal === "rol" || modal === "deshabilitar" ? { id: 5, accion: modal as AccionUsuario } : modal === "habilitar" ? { id: 3, accion: "habilitar" as AccionUsuario } : undefined;
  return <GestionUsuarios usuarios={[...USUARIOS_INICIALES]} modalInicial={inicial} />;
}
