import { AreaTexto } from "@/components/ui/AreaTexto";
import { LIMITES_TEXTO } from "./datos";

type Props = { valor: string; onCambio: (v: string) => void };

/** Paso 5 (PUB-05.5): comentario opcional de hasta 300 caracteres, con contador. */
export function PasoComentario({ valor, onCambio }: Props) {
  return (
    <AreaTexto
      etiqueta="Comentario adicional (opcional)"
      ayuda="Por ejemplo, hacia dónde iba o cómo se comportaba."
      maxLength={LIMITES_TEXTO.comentario}
      rows={6}
      value={valor}
      onChange={(e) => onCambio(e.target.value)}
    />
  );
}
