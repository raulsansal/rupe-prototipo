"use client";

import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { Modal } from "@/components/ui/Modal";
import { etiquetaVersionAviso } from "@/mocks/parametros";

type Props = {
  abierto: boolean;
  /** Escape o clic fuera: no es una decisión; la persona sigue sin poder continuar. */
  onCerrar: () => void;
  /** Acciones; el Prototipo las conectará a la aceptación registrada (la maqueta: Aceptar → /tutor, Rechazar → /acceso). */
  onAceptar: () => void;
  onRechazar: () => void;
};

/** TRA-03: aviso de privacidad actualizado; reaceptación al iniciar sesión (HU 003). */
export function ModalAvisoActualizado({ abierto, onCerrar, onAceptar, onRechazar }: Props) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={`Aviso de privacidad actualizado ${etiquetaVersionAviso()}`}>
      <p className="text-small text-text-muted">Actualizamos el aviso de privacidad. Revisa la nueva versión antes de continuar.</p>
      <Alerta tipo="info" titulo="Para continuar">
        Debes aceptar la nueva versión; queda registrada con su fecha.
      </Alerta>
      <div className="grid grid-cols-2 gap-3">
        <Boton variante="secundario" onClick={onRechazar}>
          Rechazar
        </Boton>
        <Boton onClick={onAceptar}>Aceptar</Boton>
      </div>
    </Modal>
  );
}
