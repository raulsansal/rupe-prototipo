"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { Toast } from "@/components/ui/Toast";

type Props = {
  /** Ruta de la ficha (p. ej. /ficha/RUPE-…): se comparte siempre el folio, nunca otro dato. */
  ruta: string;
  titulo: string;
  className?: string;
};

/** «Compartir»: usa el menú de compartir del dispositivo si existe; si no, copia el enlace. */
export function BotonCompartir({ ruta, titulo, className }: Props) {
  const [aviso, setAviso] = useState<string>();

  async function compartir() {
    const url = `${window.location.origin}${ruta}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: titulo, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setAviso("Enlace copiado");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // la persona cerró el menú de compartir
      setAviso("No se pudo compartir el enlace");
    }
  }

  return (
    <>
      <Boton variante="secundario" icono="share" onClick={compartir} className={className}>
        Compartir
      </Boton>
      {aviso && <Toast mensaje={aviso} onCerrar={() => setAviso(undefined)} />}
    </>
  );
}
