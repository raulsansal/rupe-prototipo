"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { Icono } from "@/components/ui/Icono";

type Props = {
  /**
   * Dirección de la fotografía. En el modo por enlace (`hrefRevelar`) el servidor SOLO la entrega cuando la foto se puede mostrar: así la dirección de un «Fallecido» no viaja en el HTML
   * ni en los datos de Next mientras la persona no pide verla.
   */
  src?: string;
  /** Avistamiento «Fallecido»: la fotografía permanece oculta con un aviso previo hasta que la persona tutora decide verla (HU 040). */
  sensible: boolean;
  /** Modo por enlace (TUT-10): «Ver fotografía» es un enlace a esta ruta (con ?foto=visible) y el servidor entrega `src` solo entonces. */
  hrefRevelar?: string;
  /** Modo por enlace: «Ocultar fotografía» vuelve a esta ruta (sin el parámetro) con `replace`. */
  hrefOcultar?: string;
  /** Modo con estado (moderación del Administrador, con datos del maquetado): empieza con la fotografía revelada. P6: pasará al modo por enlace. */
  reveladaInicial?: boolean;
  /** Redacción del aviso para quien consulta con la fotografía oculta (por defecto, la de la persona tutora). */
  aviso?: string;
  /** Redacción del aviso con la fotografía ya revelada; por defecto, la misma. */
  avisoRevelada?: string;
};

const REDACCION_SOBRIA = "Se reportó un perro sin vida que podría ser el tuyo. Lamentamos esta noticia.";

/**
 * Fotografía del avistamiento (TUT-10). Si es sensible, la imagen ni siquiera se dibuja hasta pedir «Ver fotografía». El foco pasa a la región de la imagen al revelarla
 * y vuelve a «Ver fotografía» al ocultarla. La imagen lleva `unoptimized`: la dirección es una ruta protegida por sesión y el optimizador de Next no la puede leer.
 */
export function FotoAvistamiento({ src, sensible, hrefRevelar, hrefOcultar, reveladaInicial = false, aviso = REDACCION_SOBRIA, avisoRevelada = aviso }: Props) {
  const id = useId();
  const porEnlace = hrefRevelar !== undefined;
  const [revelada, setRevelada] = useState(reveladaInicial);
  const estaRevelada = porEnlace ? src !== undefined : revelada;
  const mostrar = !sensible || estaRevelada;
  const region = useRef<HTMLDivElement>(null);
  const zonaVer = useRef<HTMLDivElement>(null);
  const anterior = useRef(estaRevelada);

  // Foco: al revelar, a la región de la imagen; al ocultar, de vuelta a «Ver fotografía». No se mueve en la carga inicial.
  useEffect(() => {
    if (anterior.current === estaRevelada) return;
    anterior.current = estaRevelada;
    if (estaRevelada) region.current?.focus();
    else zonaVer.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [estaRevelada]);

  return (
    <div className="flex flex-col gap-4">
      {mostrar && src ? (
        <div ref={region} tabIndex={-1} role="group" aria-label="Fotografía del avistamiento" className="relative aspect-[4/3] overflow-hidden rounded-tarjeta border border-border bg-disabled-bg">
          <Image src={src} alt="Fotografía del avistamiento" fill unoptimized sizes="(min-width: 768px) 640px, 100vw" className="object-cover" />
        </div>
      ) : (
        <section aria-labelledby={`${id}-aviso`} className="flex flex-col items-center gap-3 rounded-tarjeta border border-border bg-disabled-bg p-6 text-center">
          <Icono nombre="warning" tamano={32} className="text-warning" />
          <h2 id={`${id}-aviso`} className="text-h3 font-semibold">
            Esta imagen puede resultar sensible
          </h2>
          <p className="text-small">La fotografía de este avistamiento permanece oculta. Puedes verla cuando lo decidas.</p>
          <div ref={zonaVer} className="w-full">
            {porEnlace ? (
              <Link href={hrefRevelar} prefetch={false} scroll={false} className={clasesBoton({ anchoCompleto: true })}>
                Ver fotografía
              </Link>
            ) : (
              <Boton anchoCompleto onClick={() => setRevelada(true)}>
                Ver fotografía
              </Boton>
            )}
          </div>
        </section>
      )}
      {sensible && estaRevelada && (porEnlace ? (
        <Link href={hrefOcultar ?? hrefRevelar} replace prefetch={false} scroll={false} className={clasesBoton({ variante: "secundario", anchoCompleto: true })}>
          Ocultar fotografía
        </Link>
      ) : (
        <Boton variante="secundario" anchoCompleto onClick={() => setRevelada(false)}>
          Ocultar fotografía
        </Boton>
      ))}
      {sensible && (
        <Alerta tipo="info" titulo="Aviso">
          {estaRevelada ? avisoRevelada : aviso}
        </Alerta>
      )}
    </div>
  );
}
