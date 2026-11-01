import { CargaFotografia } from "@/components/ui/CargaFotografia";

type Props = { maximoMb: number; vistaPreviaInicial?: string; error?: string; onCambio: (vista: string | undefined, archivo?: Blob) => void };

/** Paso 2 (PUB-05.2, HU 029): una sola fotografía obligatoria (JPG o PNG, con el tamaño máximo del parámetro), reducida en el navegador antes de enviarla; el servidor la vuelve a procesar sin EXIF. */
export function PasoFotografia({ maximoMb, vistaPreviaInicial, error, onCambio }: Props) {
  return <CargaFotografia etiqueta="Fotografía del perro que viste" requerido variante="ancha" reducir maximoMb={maximoMb} ayuda="Usa una foto horizontal o cuadrada, con el perro completo. Una sola fotografía por reporte. JPG o PNG, máx. {max} MB. Puedes cambiarla antes de enviar." vistaPreviaInicial={vistaPreviaInicial} errorExterno={error} onCambio={onCambio} />;
}
