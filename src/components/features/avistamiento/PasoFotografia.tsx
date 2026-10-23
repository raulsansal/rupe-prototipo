import { CargaFotografia } from "@/components/ui/CargaFotografia";

type Props = { vistaPreviaInicial?: string; error?: string; onCambio: (vista: string | undefined) => void };

/** Paso 2 (PUB-05.2): una sola fotografía obligatoria (JPG o PNG, máx. 4 MB). */
export function PasoFotografia({ vistaPreviaInicial, error, onCambio }: Props) {
  return <CargaFotografia etiqueta="Fotografía del perro que viste" requerido variante="ancha" ayuda="Una sola fotografía del avistamiento. JPG o PNG, máx. {max} MB. Puedes reemplazarla." vistaPreviaInicial={vistaPreviaInicial} onCambio={onCambio} errorExterno={error} />;
}
