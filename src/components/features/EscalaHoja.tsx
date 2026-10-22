"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Ancho de una hoja de 21.6 cm a 96 ppp. */
const ANCHO_HOJA = 816;

type Props = {
  /** Alto / ancho de la hoja (27.9/21.6 en Carta, 14/21.6 en Media carta). */
  proporcion: number;
  children: ReactNode;
};

/**
 * Muestra la hoja SIEMPRE a su tamaño real (21.6 cm de ancho) y la reduce con `transform: scale` para que quepa en el
 * espacio disponible. Así los textos conservan las proporciones de la lámina 4.11 en cualquier pantalla (a tamaños
 * muy pequeños el navegador impone un tamaño mínimo de letra y desbarataba la composición). Al imprimir no se escala.
 */
export function EscalaHoja({ proporcion, children }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const [k, setK] = useState<number>();

  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setK(Math.min(1, el.clientWidth / ANCHO_HOJA));
    medir();
    const o = new ResizeObserver(medir);
    o.observe(el);
    return () => o.disconnect();
  }, []);

  const escala = k ?? 1;
  return (
    <div ref={caja} className="escala-hoja w-full" style={{ height: ANCHO_HOJA * proporcion * escala, visibility: k === undefined ? "hidden" : undefined }}>
      <div style={{ width: ANCHO_HOJA, transform: `scale(${escala})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}
