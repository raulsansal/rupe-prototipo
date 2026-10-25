import type { Metadata } from "next";
import { FormularioParametros } from "@/components/features/parametros/FormularioParametros";
import { EstadoCarga } from "@/components/ui/EstadoCarga";
import { VALORES_POR_DEFECTO } from "@/lib/parametros";

export const metadata: Metadata = { title: "Parámetros del sistema · RUPE" };

/**
 * ADM-11 (HU 054). Los parámetros de consulta solo fijan variantes (capturas y pruebas): ?estado=cargando; ?variante=aviso (versión cambiada, con el aviso de
 * re-aceptación) | errores (valores inválidos con sus mensajes) | guardado (valores guardados con el mensaje de éxito); ?modal=restablecer abre MOD-12 (extensión opcional).
 */
export default async function ParametrosDelSistema({ searchParams }: PageProps<"/admin/parametros">) {
  const { estado, variante, modal } = await searchParams;
  if (estado === "cargando")
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h1">Parámetros del sistema</h1>
        <div aria-live="polite">
          <EstadoCarga sinFoto etiqueta="Cargando los parámetros…" />
        </div>
      </div>
    );
  const valores = variante === "aviso" ? { ...VALORES_POR_DEFECTO, version_aviso_privacidad: "2.0" } : variante === "guardado" ? { version_aviso_privacidad: "1.1", expiracion_token_minutos: "45", tamano_maximo_archivo_mb: "4.5" } : variante === "errores" ? { ...VALORES_POR_DEFECTO, expiracion_token_minutos: "0", tamano_maximo_archivo_mb: "6" } : { ...VALORES_POR_DEFECTO };
  return <FormularioParametros valoresIniciales={valores} validarAlCargar={variante === "errores"} restablecerAbierto={modal === "restablecer"} guardadoInicial={variante === "guardado"} />;
}
