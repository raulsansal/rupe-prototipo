"use client";

import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { Modal } from "@/components/ui/Modal";
import { etiquetaVersionAviso } from "@/mocks/parametros";

type Props = {
  abierto: boolean;
  /** Escape o clic fuera: no es una decisión; la persona sigue sin poder continuar. */
  onCerrar: () => void;
  /** Acciones: «Aceptar» registra la aceptación y entra; «Rechazar» no entra. */
  onAceptar: () => void;
  onRechazar: () => void;
  /** Etiqueta de la versión vigente (p. ej. «v2.0»); por defecto la del parámetro del maquetado. */
  version?: string;
  /** Mientras se registra la aceptación. */
  enviando?: boolean;
};

/** TRA-03: aviso de privacidad actualizado; reaceptación al iniciar sesión (HU 003). */
export function ModalAvisoActualizado({ abierto, onCerrar, onAceptar, onRechazar, version = etiquetaVersionAviso(), enviando }: Props) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={`Aviso de privacidad actualizado ${version}`}>
      <p className="text-small text-text-muted">Actualizamos el aviso de privacidad. Revisa la nueva versión antes de continuar.</p>
      <Alerta tipo="info" titulo="Para continuar">
        Debes aceptar la nueva versión; queda registrada con su fecha.
      </Alerta>
      <div className="grid grid-cols-2 gap-3">
        <Boton variante="secundario" onClick={onRechazar}>
          Rechazar
        </Boton>
        <Boton onClick={onAceptar} cargando={enviando}>
          Aceptar
        </Boton>
      </div>
    </Modal>
  );
}
