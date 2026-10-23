"use client";

import { useId, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { Icono } from "@/components/ui/Icono";
import { cx } from "@/lib/clases";
import { coordenadasAPunto, puntoACoordenadas, type Coordenadas, type Punto } from "@/mocks/geografia";

type Props = {
  /** Nombre accesible del mapa. */
  etiqueta: string;
  punto?: Coordenadas;
  /** Con `editable`, un toque o arrastre coloca el marcador y las flechas lo mueven (Enter lo coloca en el centro). */
  editable?: boolean;
  onCambio?: (c: Coordenadas) => void;
  /** Marca el mapa como pendiente de corregir (error de validación). */
  invalido?: boolean;
  /** id de otro elemento (p. ej. el mensaje de error) que también describe el mapa. */
  descritoPor?: string;
  className?: string;
};

/** Dibujo de fondo del mapa ilustrativo (calles, parque y río); solo tokens de color. */
export function FondoMapa() {
  return (
    <svg viewBox="0 0 500 300" preserveAspectRatio="none" aria-hidden="true" focusable="false" className="absolute inset-0 size-full">
      <rect width="500" height="300" className="fill-primary-soft" />
      <path d="M40 40 H170 V120 H40 Z M330 160 H470 V270 H330 Z" className="fill-success-bg" />
      <path d="M0 215 C90 190 150 250 260 225 S420 150 500 170" className="stroke-info-bg" strokeWidth="26" fill="none" />
      <g className="stroke-surface" strokeWidth="9" fill="none" strokeLinecap="round">
        <path d="M0 150 H500 M0 70 H500 M200 0 V300 M330 0 V300 M90 0 V300 M0 255 H500" />
        <path d="M0 290 L500 20" strokeWidth="14" />
      </g>
      <g className="stroke-border-strong" strokeWidth="1.5" fill="none" opacity="0.35">
        <path d="M0 110 H500 M145 0 V300 M265 0 V300 M0 190 H500" />
      </g>
    </svg>
  );
}

const limitar = (n: number) => Math.min(1, Math.max(0, n));
const PASO = 0.02;

/**
 * Mapa ILUSTRATIVO (dibujo, no un mapa real) con un marcador. Convierte el punto en latitud y longitud con una
 * regla fija (src/mocks/geografia.ts). Solo tokens de color.
 */
export function MapaIlustrativo({ etiqueta, punto, editable = false, onCambio, invalido, descritoPor, className }: Props) {
  const ayudaId = useId();
  const caja = useRef<HTMLDivElement>(null);
  const arrastrando = useRef(false);
  const p: Punto | undefined = punto && { x: limitar(coordenadasAPunto(punto).x), y: limitar(coordenadasAPunto(punto).y) };

  function desdePuntero(e: PointerEvent) {
    const r = caja.current!.getBoundingClientRect();
    onCambio?.(puntoACoordenadas({ x: limitar((e.clientX - r.left) / r.width), y: limitar((e.clientY - r.top) / r.height) }));
  }
  function alBajar(e: PointerEvent) {
    if (!editable) return;
    arrastrando.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    desdePuntero(e);
  }
  function alMover(e: PointerEvent) {
    if (editable && arrastrando.current) desdePuntero(e);
  }
  function alSoltar() {
    arrastrando.current = false;
  }
  function alTeclear(e: KeyboardEvent) {
    if (!editable) return;
    const paso = e.shiftKey ? PASO * 5 : PASO;
    const mover: Record<string, [number, number]> = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] };
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!p) onCambio?.(puntoACoordenadas({ x: 0.5, y: 0.5 }));
    } else if (mover[e.key]) {
      e.preventDefault();
      const base = p ?? { x: 0.5, y: 0.5 };
      onCambio?.(puntoACoordenadas({ x: limitar(base.x + mover[e.key][0]), y: limitar(base.y + mover[e.key][1]) }));
    }
  }

  return (
    <div className={className}>
      <div
        ref={caja}
        role="group"
        aria-label={etiqueta}
        aria-describedby={[descritoPor, editable && ayudaId].filter(Boolean).join(" ") || undefined}
        data-invalido={invalido ? "true" : undefined}
        tabIndex={editable ? 0 : undefined}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onKeyDown={alTeclear}
        className={cx(
          "relative aspect-[5/3] w-full overflow-hidden rounded-tarjeta border-2 bg-primary-soft",
          invalido ? "border-danger" : "border-border-strong",
          editable && "cursor-crosshair touch-none",
        )}
      >
        <FondoMapa />
        {p && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-danger"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          >
            <Icono nombre="location_on" tamano={44} />
          </span>
        )}
      </div>
      {editable && (
        <p id={ayudaId} className="sr-only">
          Toca el mapa o arrastra para colocar el marcador. Con teclado, Enter coloca el marcador y las flechas lo mueven.
        </p>
      )}
      <p className="mt-1 text-caption text-text-muted">Mapa ilustrativo: no es un mapa real.</p>
    </div>
  );
}
