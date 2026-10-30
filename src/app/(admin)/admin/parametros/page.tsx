import type { Metadata } from "next";
import { FormularioParametros } from "@/components/features/parametros/FormularioParametros";
import { exigirSesionDePagina, paraPagina } from "@/server/sesion/pagina";
import { listarParametros } from "@/server/servicios/admin/parametrosAdmin";

export const metadata: Metadata = { title: "Parámetros del sistema · RUPE" };

/** ADM-11 (HU 054). Lee los parámetros del almacén por el servicio de Administrador; guardar y restablecer llaman a /api/admin/parametros. */
export default async function ParametrosDelSistema() {
  const sesion = await exigirSesionDePagina("Administrador");
  const { parametros } = await paraPagina(listarParametros(sesion));
  return <FormularioParametros parametros={parametros} />;
}
