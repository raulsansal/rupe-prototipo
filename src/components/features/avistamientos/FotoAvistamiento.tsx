"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { Icono } from "@/components/ui/Icono";

type Props = {
  src: string;
  /** Avistamiento «Fallecido»: la fotografía permanece oculta con un aviso previo hasta que la persona tutora decide verla (HU 040). */
  sensible: boolean;
  /** Solo capturas y pruebas: empieza con la fotografía revelada. */
  reveladaInicial?: boolean;
  /** Redacción del aviso para quien consulta con la fotografía oculta (por defecto, la de la persona tutora). */
  aviso?: string;
  /** Redacción del aviso con la fotografía ya revelada; por defecto, la misma. */
  avisoRevelada?: string;
};

const REDACCION_SOBRIA = "Se reportó un perro sin vida que podría ser el tuyo. Lamentamos esta noticia.";

/** Fotografía del avistamiento (TUT-10). Si es sensible, la imagen ni siquiera se dibuja hasta pulsar «Ver fotografía». */
export function FotoAvistamiento({ src, sensible, reveladaInicial = false, aviso = REDACCION_SOBRIA, avisoRevelada = aviso }: Props) {
  const id = useId();
  const [revelada, setRevelada] = useState(reveladaInicial);
  const mostrar = !sensible || revelada;

  return (
    <div className="flex flex-col gap-4">
      {mostrar ? (
        <div className="relative aspect-[4/3] overflow-hidden rounded-tarjeta border border-border bg-disabled-bg">
          <Image src={src} alt="Fotografía del avistamiento" fill sizes="(min-width: 768px) 640px, 100vw" className="object-cover" />
        </div>
      ) : (
        <section aria-labelledby={`${id}-aviso`} className="flex flex-col items-center gap-3 rounded-tarjeta border border-border bg-disabled-bg p-6 text-center">
          <Icono nombre="warning" tamano={32} className="text-warning" />
          <h2 id={`${id}-aviso`} className="text-h3 font-semibold">
            Esta imagen puede resultar sensible
          </h2>
          <p className="text-small">La fotografía de este avistamiento permanece oculta. Puedes verla cuando lo decidas.</p>
          <Boton anchoCompleto onClick={() => setRevelada(true)}>
            Ver fotografía
          </Boton>
        </section>
      )}
      {sensible && revelada && (
        <Boton variante="secundario" anchoCompleto onClick={() => setRevelada(false)}>
          Ocultar fotografía
        </Boton>
      )}
      {sensible && (
        <Alerta tipo="info" titulo="Aviso">
          {revelada ? avisoRevelada : aviso}
        </Alerta>
      )}
    </div>
  );
}
