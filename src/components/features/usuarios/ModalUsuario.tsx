"use client";

import { useState } from "react";
import { Alerta } from "@/components/ui/Alerta";
import { Avatar } from "@/components/ui/Avatar";
import { Boton } from "@/components/ui/Boton";
import { Modal } from "@/components/ui/Modal";
import { Selector } from "@/components/ui/Selector";
import type { Rol, Usuario } from "@/mocks/usuarios";

export type AccionUsuario = "rol" | "deshabilitar" | "habilitar";

type Props = {
  usuario: Usuario;
  accion: AccionUsuario | null;
  /** Última acción abierta: el contenido no cambia mientras el modal se cierra. */
  accionPrevia: AccionUsuario;
  onCerrar: () => void;
  /** Confirma la acción; para «rol» trae el rol nuevo. */
  onConfirmar: (accion: AccionUsuario, rolNuevo?: Rol) => void;
};

const TITULO: Record<AccionUsuario, string> = { rol: "Cambiar rol", deshabilitar: "Deshabilitar cuenta", habilitar: "Habilitar cuenta" };

/** MOD-10: confirmación para cambiar el rol, deshabilitar o habilitar una cuenta. Todo cambio se registra en la bitácora (HU 058). */
export function ModalUsuario({ usuario, accion, accionPrevia, onCerrar, onConfirmar }: Props) {
  const [rol, setRol] = useState<Rol>(usuario.rol === "Tutor" ? "Administrador" : "Tutor");
  const [error, setError] = useState<string>();
  const a = accion ?? accionPrevia;

  function confirmar() {
    if (a === "rol") {
      if (rol === usuario.rol) return setError("Elige un rol distinto al actual.");
      return onConfirmar("rol", rol);
    }
    onConfirmar(a);
  }

  return (
    <Modal abierto={accion !== null} onCerrar={onCerrar} titulo={TITULO[a]}>
      <div className="flex items-center gap-3">
        <Avatar nombre={usuario.nombreCompleto} />
        <div className="min-w-0">
          <p className="break-words text-small font-bold">{usuario.nombreCompleto}</p>
          <p className="break-all text-caption text-text-muted">{usuario.correo}</p>
        </div>
      </div>
      {a === "rol" && (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-small font-semibold">Rol actual</span>
            <p className="flex h-campo items-center rounded-campo border border-border bg-disabled-bg px-3 text-body">{usuario.rol}</p>
          </div>
          <Selector
            etiqueta="Seleccionar rol"
            opciones={[
              { valor: "Administrador", etiqueta: "Administrador" },
              { valor: "Tutor", etiqueta: "Tutor" },
            ]}
            value={rol}
            onChange={(e) => {
              setRol(e.target.value as Rol);
              setError(undefined);
            }}
            error={error}
          />
          <Alerta tipo="info" titulo="Bitácora">
            El cambio se registra en la bitácora con el rol anterior y el nuevo.
          </Alerta>
        </>
      )}
      {a === "deshabilitar" && (
        <Alerta tipo="advertencia" titulo="Advertencia">
          La persona no podrá iniciar sesión y se cerrarán sus sesiones activas.
        </Alerta>
      )}
      {a === "habilitar" && (
        <Alerta tipo="info" titulo="Qué ocurrirá">
          La persona podrá volver a iniciar sesión. La acción se registra en la bitácora.
        </Alerta>
      )}
      <div className="mt-1 grid grid-cols-2 gap-3">
        <Boton variante="secundario" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton onClick={confirmar}>{a === "rol" ? "Guardar cambios" : "Confirmar"}</Boton>
      </div>
    </Modal>
  );
}
