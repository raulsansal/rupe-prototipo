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
  /** Solo el modo «ficha» lo usa (texto de WhatsApp); el modo «estatus» no comparte ningún dato del caso salvo el folio. */
  nombre?: string;
  /** Enlace público (<base>/ficha/<FOLIO> o <base>/estatus/<FOLIO>): lleva el folio, nunca el token del QR. Lo da el servidor. */
  enlace: string | null;
  /** «ficha»: ficha de búsqueda (WhatsApp, Facebook y copiar). «estatus» (HU 046): enlace público de consulta de estatus (solo WhatsApp y copiar). */
  modo?: "ficha" | "estatus";
};

/** MOD-07 Compartir: enlace público de la ficha o del estatus (nunca datos de la persona tutora) por WhatsApp, Facebook (solo la ficha) o copiado. */
export function ModalCompartir({ abierto, onCerrar, folio, nombre, enlace, modo = "ficha" }: Props) {
  const [aviso, setAviso] = useState<string>();
  const esEstatus = modo === "estatus";
  const idCampo = esEstatus ? "enlace-estatus" : "enlace-ficha";
  const texto = esEstatus ? `Consulta el estatus del caso ${folio}: ${enlace ?? ""}` : `Ayúdame a encontrar a ${nombre}. Ficha de búsqueda ${folio}: ${enlace ?? ""}`;

  async function copiar() {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace);
      setAviso("Enlace copiado");
    } catch {
      // Contextos no seguros (http fuera de localhost): respaldo con el campo de texto seleccionado.
      const campo = document.getElementById(idCampo) as HTMLInputElement | null;
      campo?.select();
      setAviso(document.execCommand?.("copy") ? "Enlace copiado" : "No se pudo copiar: selecciona el enlace y cópialo");
    }
  }

  const clases = clasesBoton({ variante: "secundario", anchoCompleto: true });
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={esEstatus ? "Compartir estatus" : "Compartir ficha"}>
      <p className="text-small text-text-muted">{esEstatus ? "El enlace lleva a la consulta pública del estatus del caso por su folio: solo muestra el estatus y la fecha del último cambio, sin tus datos personales." : "El enlace lleva a la ficha pública del caso, sin tus datos personales."}</p>
      {enlace ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-small font-semibold">
            {esEstatus ? "Enlace del estatus" : "Enlace de la ficha"}
            <input id={idCampo} readOnly value={enlace} onFocus={(e) => e.currentTarget.select()} className="h-tactil rounded-boton border border-border-strong bg-surface px-3 text-body font-normal" />
          </label>
          <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer" className={clases}>
            {esEstatus ? "Compartir por WhatsApp" : "WhatsApp"} <span className="sr-only">(se abre en una pestaña nueva)</span>
          </a>
          {!esEstatus && (
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(enlace)}`} target="_blank" rel="noopener noreferrer" className={clases}>
              Facebook <span className="sr-only">(se abre en una pestaña nueva)</span>
            </a>
          )}
          <Boton variante="secundario" icono="link" anchoCompleto onClick={copiar}>
            Copiar enlace
          </Boton>
          <Boton variante="secundario" anchoCompleto onClick={onCerrar}>
            Cerrar
          </Boton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p role="note" className="text-small">Configura RUPE_URL_PUBLICA para generar el enlace {esEstatus ? "del estatus" : "de la ficha"}.</p>
          <Boton variante="secundario" anchoCompleto onClick={onCerrar}>
            Cerrar
          </Boton>
        </div>
      )}
      {aviso && <Toast mensaje={aviso} posicion="enLinea" onCerrar={() => setAviso(undefined)} />}
    </Modal>
  );
}
