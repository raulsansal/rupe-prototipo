import type { Metadata } from "next";
import { FormularioRegistro } from "@/components/features/FormularioRegistro";
import { crearRepositorios } from "@/server/memoria/repos";

export const metadata: Metadata = { title: "Crear cuenta · RUPE" };

/** ACC-02. ?estado=aviso abre el aviso de privacidad completo (MOD-01) al cargar (capturas y pruebas). */
export default async function Registro({ searchParams }: PageProps<"/registro">) {
  const { estado } = await searchParams;
  const versionAviso = await crearRepositorios().parametros.valor("version_aviso_privacidad");
  return <FormularioRegistro avisoAbiertoInicial={estado === "aviso"} versionAviso={versionAviso} />;
}
