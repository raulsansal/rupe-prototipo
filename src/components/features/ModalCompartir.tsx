"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import type { Folio } from "@/mocks/tipos";

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  folio: Folio;
  nombre: string;
  /** Enlace público de la ficha (<base>/ficha/<FOLIO>): lleva el folio, no el token del QR, para que no se invalide al regenerar. Lo da el servidor. */
  enlace: string | null;
};

/** MOD-07 Compartir: enlace público de la ficha (nunca datos de la persona tutora) por WhatsApp, Facebook o copiado. */
export function ModalCompartir({ abierto, onCerrar, folio, nombre, enlace }: Props) {
  const [aviso, setAviso] = useState<string>();
  const texto = `Ayúdame a encontrar a ${nombre}. Ficha de búsqueda ${folio}: ${enlace ?? ""}`;

  async function copiar() {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace);
      setAviso("Enlace copiado");
    } catch {
      // Contextos no seguros (http fuera de localhost): respaldo con el campo de texto seleccionado.
      const campo = document.getElementById("enlace-ficha") as HTMLInputElement | null;
      campo?.select();
      setAviso(document.execCommand?.("copy") ? "Enlace copiado" : "No se pudo copiar: selecciona el enlace y cópialo");
    }
  }

  const clases = clasesBoton({ variante: "secundario", anchoCompleto: true });
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Compartir ficha">
      <p className="text-small text-text-muted">El enlace lleva a la ficha pública del caso, sin tus datos personales.</p>
      {enlace ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-small font-semibold">
            Enlace de la ficha
            <input id="enlace-ficha" readOnly value={enlace} onFocus={(e) => e.currentTarget.select()} className="h-tactil rounded-boton border border-border-strong bg-surface px-3 text-body font-normal" />
          </label>
          <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer" className={clases}>
            WhatsApp <span className="sr-only">(se abre en una pestaña nueva)</span>
          </a>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(enlace)}`} target="_blank" rel="noopener noreferrer" className={clases}>
            Facebook <span className="sr-only">(se abre en una pestaña nueva)</span>
          </a>
          <Boton variante="secundario" icono="link" anchoCompleto onClick={copiar}>
            Copiar enlace
          </Boton>
          <Boton variante="secundario" anchoCompleto onClick={onCerrar}>
            Cerrar
          </Boton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p role="note" className="text-small">Configura RUPE_URL_PUBLICA para generar el enlace de la ficha.</p>
          <Boton variante="secundario" anchoCompleto onClick={onCerrar}>
            Cerrar
          </Boton>
        </div>
      )}
      {aviso && <Toast mensaje={aviso} posicion="enLinea" onCerrar={() => setAviso(undefined)} />}
    </Modal>
  );
}
