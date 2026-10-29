import { CargaFotografia } from "@/components/ui/CargaFotografia";

type Props = { vistaPreviaInicial?: string; error?: string; onCambio: (vista: string | undefined, archivo?: Blob) => void };

/** Paso 2 (PUB-05.2, HU 029): una sola fotografía obligatoria (JPG o PNG, máx. 4 MB), reducida en el navegador antes de enviarla; el servidor la vuelve a procesar sin EXIF. */
export function PasoFotografia({ vistaPreviaInicial, error, onCambio }: Props) {
  return <CargaFotografia etiqueta="Fotografía del perro que viste" requerido variante="ancha" reducir ayuda="Una sola fotografía del avistamiento. JPG o PNG, máx. {max} MB. Puedes reemplazarla." vistaPreviaInicial={vistaPreviaInicial} errorExterno={error} onCambio={onCambio} />;
}
