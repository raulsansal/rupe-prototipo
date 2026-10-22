"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { Toast } from "@/components/ui/Toast";

type Props = { texto: string; etiqueta: string; aviso: string; className?: string };

/** Copia un texto al portapapeles y lo avisa con un Toast (role="status"). */
export function BotonCopiar({ texto, etiqueta, aviso, className }: Props) {
  const [mensaje, setMensaje] = useState<string>();
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setMensaje(aviso);
    } catch {
      setMensaje("No se pudo copiar");
    }
  }
  return (
    <>
      <Boton variante="secundario" icono="content_copy" onClick={copiar} className={className}>
        {etiqueta}
      </Boton>
      {mensaje && <Toast mensaje={mensaje} onCerrar={() => setMensaje(undefined)} />}
    </>
  );
}
