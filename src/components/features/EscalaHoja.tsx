"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Ancho de una hoja de 612 pt (21.6 cm) a 96 ppp. */
const ANCHO_HOJA = 816;

type Props = {
  /** Alto / ancho de la hoja (792/612 en Carta, 396/612 en Media carta). */
  proporcion: number;
  /**
   * Con `ajustarAlto` la hoja también se reduce para caber en el ALTO del contenedor (que debe tener una altura propia): así el visor muestra la hoja COMPLETA, con el QR y el
   * folio, sin desplazamiento. Sin él solo se ajusta al ancho y la altura sale de la proporción.
   */
  ajustarAlto?: boolean;
  children: ReactNode;
};

/**
 * Muestra la hoja SIEMPRE a su tamaño real (612 pt) y la reduce con `transform: scale` para que quepa en el espacio disponible. Así los textos conservan las proporciones de la
 * lámina 4.11 en cualquier pantalla (a tamaños muy pequeños el navegador impone un tamaño mínimo de letra y desbarataba la composición). Al imprimir no se escala.
 */
export function EscalaHoja({ proporcion, ajustarAlto = false, children }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const [k, setK] = useState<number>();

  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => {
      const porAncho = el.clientWidth / ANCHO_HOJA;
      const porAlto = ajustarAlto && el.clientHeight > 0 ? el.clientHeight / (ANCHO_HOJA * proporcion) : Infinity;
      setK(Math.min(1, porAncho, porAlto));
    };
    medir();
    const o = new ResizeObserver(medir);
    o.observe(el);
    return () => o.disconnect();
  }, [ajustarAlto, proporcion]);

  const escala = k ?? 1;
  return (
    <div ref={caja} className="escala-hoja flex w-full justify-center" style={{ height: ajustarAlto ? "100%" : ANCHO_HOJA * proporcion * escala, visibility: k === undefined ? "hidden" : undefined }}>
      <div className="escala-hoja-caja" style={{ width: ANCHO_HOJA * escala, height: ANCHO_HOJA * proporcion * escala }}>
        <div style={{ width: ANCHO_HOJA, transform: `scale(${escala})`, transformOrigin: "top left" }}>{children}</div>
      </div>
    </div>
  );
}
