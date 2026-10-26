import type { Metadata } from "next";
import { FormularioAcceso, type ModalAcceso } from "@/components/features/FormularioAcceso";

export const metadata: Metadata = { title: "Iniciar sesión · RUPE" };

/**
 * ACC-01. ?siguiente= ruta interna a la que volver tras iniciar sesión (la valida el servidor). ?estado=bloqueo | deshabilitada | aviso-actualizado (TRA-03)
 * abre el modal correspondiente: variante SOLO DE MAQUETADO para capturas y pruebas; retirar cuando todo el flujo esté conectado.
 */
export default async function PaginaAcceso({ searchParams }: PageProps<"/acceso">) {
  const { estado, siguiente } = await searchParams;
  const modal: ModalAcceso | undefined = estado === "bloqueo" || estado === "deshabilitada" || estado === "aviso-actualizado" ? estado : undefined;
  return <FormularioAcceso modalInicial={modal} siguiente={typeof siguiente === "string" ? siguiente : undefined} />;
}
