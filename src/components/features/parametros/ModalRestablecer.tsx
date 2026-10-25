// EXTENSIÓN OPCIONAL a validar con Raúl: MOD-12 (confirmación al restablecer) no está en la HU 054. Para retirarla, borra este archivo
// y el botón «Restablecer valores por defecto» de FormularioParametros.
import { DialogoConfirmacion } from "@/components/ui/DialogoConfirmacion";

type Props = { abierto: boolean; onCerrar: () => void; onConfirmar: () => void };

export function ModalRestablecer({ abierto, onCerrar, onConfirmar }: Props) {
  return (
    <DialogoConfirmacion
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Restablecer valores por defecto"
      descripcion="Los tres parámetros volverán a sus valores por defecto (aviso 1.0, token 60 minutos, archivo 4 MB). Si cambia la versión del aviso, las personas usuarias deberán aceptarlo de nuevo. Se registra en la bitácora."
      textoCancelar="Cancelar"
      textoConfirmar="Confirmar"
      variante="primario"
      icono="restart_alt"
      onConfirmar={onConfirmar}
    />
  );
}
