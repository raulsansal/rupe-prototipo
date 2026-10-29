import { AreaTexto } from "@/components/ui/AreaTexto";
import { LIMITES_TEXTO, NOTA_CORREO_RESGUARDO, PLACEHOLDER_RESGUARDO } from "./datos";

type Props = {
  valor: string;
  onCambio: (v: string) => void;
  error?: string;
  /** El animal está bajo resguardo de quien reporta (según «Contención y ubicación»): se invita a dejar un correo dentro del comentario. */
  bajoResguardo?: boolean;
};

const ID = "comentario-avistamiento";
const ID_NOTA = "nota-correo-resguardo";

/**
 * Paso 5 (PUB-05.5): comentario opcional de hasta 300 caracteres, con contador. El servidor lo sanea (sin etiquetas ni caracteres de control).
 * Con el animal bajo resguardo el placeholder invita a dejar un correo y una nota permanente (aria-describedby) avisa que la persona tutora lo verá;
 * el correo es texto libre del comentario: no hay campo nuevo ni enlace de correo.
 */
export function PasoComentario({ valor, onCambio, error, bajoResguardo }: Props) {
  const descrito = [error && `${ID}-error`, `${ID}-ayuda`, `${ID}-contador`, bajoResguardo && ID_NOTA].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-3">
      <AreaTexto
        id={ID}
        etiqueta="Comentario adicional (opcional)"
        ayuda="Por ejemplo, hacia dónde iba o cómo se comportaba."
        maxLength={LIMITES_TEXTO.comentario}
        rows={6}
        placeholder={bajoResguardo ? PLACEHOLDER_RESGUARDO : undefined}
        style={bajoResguardo ? { minHeight: "13rem" } : undefined} /* el placeholder largo se lee completo, también a 390 px */
        aria-describedby={descrito}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        error={error}
      />
      {bajoResguardo && (
        <p id={ID_NOTA} className="text-small text-text-muted">
          {NOTA_CORREO_RESGUARDO}
        </p>
      )}
    </div>
  );
}
