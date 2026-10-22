"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { URL_BASE_PUBLICA } from "@/mocks/parametros";
import type { Folio } from "@/mocks/tipos";

type Props = { abierto: boolean; onCerrar: () => void; folio: Folio; nombre: string };

/** MOD-07 Compartir: enlace público de la ficha (nunca datos de la persona tutora) por WhatsApp, Facebook o copiado. */
export function ModalCompartir({ abierto, onCerrar, folio, nombre }: Props) {
  const [aviso, setAviso] = useState<string>();
  const enlace = `${URL_BASE_PUBLICA}/ficha/${folio}`;
  const texto = `Ayúdame a encontrar a ${nombre}. Ficha de búsqueda ${folio}: ${enlace}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setAviso("Enlace copiado");
    } catch {
      setAviso("No se pudo copiar el enlace");
    }
  }

  const clases = clasesBoton({ variante: "secundario", anchoCompleto: true });
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Compartir ficha">
      <p className="text-small text-text-muted">El enlace lleva a la ficha pública del caso, sin tus datos personales.</p>
      <div className="flex flex-col gap-3">
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
      {aviso && <Toast mensaje={aviso} posicion="enLinea" onCerrar={() => setAviso(undefined)} />}
    </Modal>
  );
}
