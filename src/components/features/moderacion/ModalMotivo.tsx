"use client";

import { useState, type ReactNode } from "react";
import { Alerta } from "@/components/ui/Alerta";
import { AreaTexto } from "@/components/ui/AreaTexto";
import { Boton } from "@/components/ui/Boton";
import { Modal } from "@/components/ui/Modal";
import { errorDeMotivo, LIMITE_MOTIVO } from "@/lib/moderacion";

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  /** Qué se modera (folio, ID, nombre del elemento del catálogo…). */
  resumen: ReactNode;
  advertencia: string;
  tituloAdvertencia?: string;
  /** Pide el motivo obligatorio (MOD-08 y MOD-09); sin él es una confirmación simple (p. ej. desactivar un elemento de un catálogo). */
  conMotivo?: boolean;
  textoConfirmar?: string;
  onConfirmar: (motivo: string) => void;
  /** Capturas y pruebas: abre con el error de «motivo obligatorio» ya visible. */
  errorInicial?: boolean;
};

/**
 * MOD-08 (deshabilitar un registro), MOD-09 (ocultar un avistamiento) y la confirmación de desactivar un elemento de un catálogo:
 * resumen, advertencia, motivo obligatorio con su error asociado al campo, «Cancelar» y «Confirmar». Se queda montado cuando
 * está cerrado para que el foco regrese al botón que lo abrió.
 */
export function ModalMotivo({ abierto, onCerrar, titulo, resumen, advertencia, tituloAdvertencia = "Advertencia", conMotivo = false, textoConfirmar = "Confirmar", onConfirmar, errorInicial = false }: Props) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | undefined>(errorInicial ? errorDeMotivo("") : undefined);

  function cerrar() {
    setMotivo("");
    setError(undefined);
    onCerrar();
  }

  function confirmar() {
    const e = conMotivo ? errorDeMotivo(motivo) : undefined;
    if (e) {
      setError(e);
      return document.getElementById("motivo-moderacion")?.focus();
    }
    onConfirmar(motivo.trim());
    setMotivo("");
    setError(undefined);
  }

  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo={titulo}>
      <div className="flex flex-col gap-1">{resumen}</div>
      <Alerta tipo="advertencia" titulo={tituloAdvertencia}>
        {advertencia}
      </Alerta>
      {conMotivo && (
        <AreaTexto
          id="motivo-moderacion"
          etiqueta="Motivo (obligatorio)"
          required
          maxLength={LIMITE_MOTIVO}
          rows={4}
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value);
            setError(undefined);
          }}
          error={error}
        />
      )}
      <div className="mt-1 grid grid-cols-2 gap-3">
        <Boton variante="secundario" onClick={cerrar}>
          Cancelar
        </Boton>
        <Boton onClick={confirmar}>{textoConfirmar}</Boton>
      </div>
    </Modal>
  );
}
