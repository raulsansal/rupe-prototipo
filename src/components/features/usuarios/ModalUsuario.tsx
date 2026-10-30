"use client";

import { useState } from "react";
import { Alerta } from "@/components/ui/Alerta";
import { Avatar } from "@/components/ui/Avatar";
import { Boton } from "@/components/ui/Boton";
import { Modal } from "@/components/ui/Modal";
import { Selector } from "@/components/ui/Selector";
import { Casilla } from "@/components/ui/Casilla";
import type { Rol } from "@/mocks/usuarios";
import type { UsuarioAdmin } from "@/server/serializadores/admin";

export type AccionUsuario = "rol" | "deshabilitar" | "habilitar";

type Props = {
  usuario: UsuarioAdmin;
  accion: AccionUsuario | null;
  /** Última acción abierta: el contenido no cambia mientras el modal se cierra. */
  accionPrevia: AccionUsuario;
  onCerrar: () => void;
  /** Confirma la acción; para «rol» trae el rol nuevo y, si es la propia cuenta, `confirmarSesionPropia`. */
  onConfirmar: (accion: AccionUsuario, rolNuevo?: Rol, confirmarSesionPropia?: boolean) => void;
  /** Mensaje del servidor si la acción no se pudo completar (el modal sigue abierto). */
  error?: string;
};

const TITULO: Record<AccionUsuario, string> = { rol: "Cambiar rol", deshabilitar: "Deshabilitar cuenta", habilitar: "Habilitar cuenta" };

/** MOD-10: confirmación para cambiar el rol, deshabilitar o habilitar una cuenta. Todo cambio se registra en la bitácora (HU 058). */
export function ModalUsuario({ usuario, accion, accionPrevia, onCerrar, onConfirmar, error: errorServidor }: Props) {
  const [rol, setRol] = useState<Rol>(usuario.rol === "Tutor" ? "Administrador" : "Tutor");
  const [error, setError] = useState<string>();
  const [entiende, setEntiende] = useState(false);
  const [errorCasilla, setErrorCasilla] = useState<string>();
  const a = accion ?? accionPrevia;
  // Sobre la PROPIA cuenta (rol o deshabilitar) la acción cierra la sesión de quien la hace: exige confirmación explícita (confirmarSesionPropia).
  const propia = usuario.esLaPersonaActual && a !== "habilitar";

  function confirmar() {
    if (a === "rol" && rol === usuario.rol) return setError("Elige un rol distinto al actual.");
    if (propia && !entiende) {
      setErrorCasilla("Confirma que entiendes que se cerrará tu sesión.");
      return document.getElementById("confirmar-sesion-propia")?.focus();
    }
    if (a === "rol") return onConfirmar("rol", rol, propia);
    onConfirmar(a, undefined, propia);
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
            El cambio se registra en la bitácora con el rol anterior y el nuevo, y se cierran las sesiones abiertas de la persona para que el nuevo rol valga de inmediato.
          </Alerta>
        </>
      )}
      {a === "deshabilitar" && (
        <Alerta tipo="advertencia" titulo="Advertencia">
          La persona no podrá iniciar sesión y, si tiene sesiones abiertas, se cerrarán.
        </Alerta>
      )}
      {a === "habilitar" && (
        <Alerta tipo="info" titulo="Qué ocurrirá">
          La persona podrá volver a iniciar sesión. La acción se registra en la bitácora.
        </Alerta>
      )}
      {propia && (
        <>
          <Alerta tipo="advertencia" titulo="Es tu propia cuenta">
            Al confirmar se cerrará tu sesión y tendrás que iniciar sesión de nuevo{a === "rol" ? ", ya sin permisos de Administrador si cambias tu rol a Tutor" : ""}.
          </Alerta>
          <Casilla
            id="confirmar-sesion-propia"
            etiqueta="Entiendo que se cerrará mi sesión"
            checked={entiende}
            onChange={(e) => {
              setEntiende(e.target.checked);
              setErrorCasilla(undefined);
            }}
            error={errorCasilla}
          />
        </>
      )}
      {errorServidor && <Alerta tipo="peligro" titulo="No se pudo completar">{errorServidor}</Alerta>}
      <div className="mt-1 grid grid-cols-2 gap-3">
        <Boton variante="secundario" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton onClick={confirmar}>{a === "rol" ? "Guardar cambios" : "Confirmar"}</Boton>
      </div>
    </Modal>
  );
}
