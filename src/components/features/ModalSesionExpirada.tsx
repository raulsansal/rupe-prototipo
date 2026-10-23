"use client";

import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { Modal } from "@/components/ui/Modal";

type Props = {
  abierto: boolean;
  /** Escape o clic fuera: el aviso se cierra y la pantalla de fondo sigue a la vista. */
  onCerrar: () => void;
  /** Acción del botón; el Prototipo la conectará a la sesión real (la maqueta lleva a /acceso). */
  onIniciarSesion: () => void;
};

/** TRA-02: «Tu sesión expiró». Modal sobre la pantalla en curso; la sesión dura 8 horas (HU 001). */
export function ModalSesionExpirada({ abierto, onCerrar, onIniciarSesion }: Props) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Tu sesión expiró">
      <Alerta tipo="advertencia" titulo="Sesión cerrada">
        Por seguridad la sesión dura 8 horas; inicia sesión de nuevo para continuar.
      </Alerta>
      <Boton anchoCompleto onClick={onIniciarSesion} autoFocus>
        Iniciar sesión
      </Boton>
    </Modal>
  );
}
