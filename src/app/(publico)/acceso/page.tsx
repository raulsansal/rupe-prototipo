import type { Metadata } from "next";
import { FormularioAcceso, type ModalAcceso } from "@/components/features/FormularioAcceso";

export const metadata: Metadata = { title: "Iniciar sesión · RUPE" };

/** ACC-01. ?estado=bloqueo | deshabilitada | aviso-actualizado (TRA-03) abre el modal correspondiente (capturas y pruebas). */
export default async function PaginaAcceso({ searchParams }: PageProps<"/acceso">) {
  const { estado } = await searchParams;
  const modal: ModalAcceso | undefined = estado === "bloqueo" || estado === "deshabilitada" || estado === "aviso-actualizado" ? estado : undefined;
  return <FormularioAcceso modalInicial={modal} />;
}
