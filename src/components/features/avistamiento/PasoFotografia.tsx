import { CargaFotografia } from "@/components/ui/CargaFotografia";

type Props = { vistaPreviaInicial?: string; error?: string; onCambio: (vista: string | undefined) => void };

/** Paso 2 (PUB-05.2): una sola fotografía obligatoria (JPG o PNG, máx. 4 MB). */
export function PasoFotografia({ vistaPreviaInicial, error, onCambio }: Props) {
  return <CargaFotografia etiqueta="Fotografía del perro que viste" requerido vistaPreviaInicial={vistaPreviaInicial} onCambio={onCambio} errorExterno={error} />;
}
