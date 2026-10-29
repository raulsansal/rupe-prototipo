"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { Icono } from "@/components/ui/Icono";
import { fechaLocalISO, formatearFechaHora } from "@/lib/formato";
import { FondoMapa } from "../MapaIlustrativo";
import { FiltroFechas, SIN_FILTRO, type Filtro } from "./FiltroFechas";
import { NOTA_UBICACION_SIMULADA } from "../avistamiento/datos";
import { SelectorVista } from "./SelectorVista";

/** Un avistamiento en el mapa. Sin estados ni fotografía: aquí solo hay fecha, lugar y coordenadas. */
export type PuntoAvistamiento = { id: number; fechaHora: string; alcaldia: string; coloniaZona?: string; latitud: number; longitud: number; ubicacionSimulada?: boolean };

type Props = {
  folio: string;
  registro: string;
  /** En orden cronológico: el número de cada marcador es su posición (HU 047 y 048). */
  puntos: PuntoAvistamiento[];
  /** Capturas y pruebas: abre la ruta al cargar. */
  rutaInicial?: boolean;
  filtroAbiertoInicial?: boolean;
};

/**
 * TUT-09: MAQUETA del mapa. Es un dibujo (sin librería ni servicio de mapas) con marcadores numerados ficticios; cada marcador
 * enlaza al detalle. «Ver ruta» une los puntos en orden cronológico solo como referencia visual y exige 2 o más (HU 048).
 */
export function MapaAvistamientos({ folio, registro, puntos, rutaInicial = false, filtroAbiertoInicial = false }: Props) {
  const ids = useId();
  const [filtro, setFiltro] = useState<Filtro>(SIN_FILTRO);
  const [filtroAbierto, setFiltroAbierto] = useState(filtroAbiertoInicial);
  const [ruta, setRuta] = useState(rutaInicial);

  const numerados = puntos.map((p, i) => ({ ...p, n: i + 1 }));
  const visibles = numerados.filter((p) => {
    const dia = fechaLocalISO(p.fechaHora);
    return (!filtro.desde || dia >= filtro.desde) && (!filtro.hasta || dia <= filtro.hasta);
  });
  const puedeRuta = visibles.length >= 2;
  const verRuta = ruta && puedeRuta;

  // Encuadre: la caja que contiene los puntos visibles, con margen; un solo punto queda al centro.
  const lat = visibles.map((p) => p.latitud);
  const lon = visibles.map((p) => p.longitud);
  const spanLat = Math.max(Math.max(...lat) - Math.min(...lat), 0.012);
  const spanLon = Math.max(Math.max(...lon) - Math.min(...lon), 0.012);
  const cLat = (Math.max(...lat) + Math.min(...lat)) / 2;
  const cLon = (Math.max(...lon) + Math.min(...lon)) / 2;
  const pos = (p: { latitud: number; longitud: number }) => ({ x: 50 + ((p.longitud - cLon) / (spanLon * 1.5)) * 100, y: 50 - ((p.latitud - cLat) / (spanLat * 1.5)) * 100 });

  const botones = (
    <div className="grid grid-cols-2 gap-3">
      <Boton variante="secundario" aria-expanded={filtroAbierto} aria-controls={`${ids}-filtro`} onClick={() => setFiltroAbierto((a) => !a)}>
        Filtrar por fecha
      </Boton>
      <Boton aria-pressed={verRuta} aria-describedby={`${ids}-mensaje`} disabled={!puedeRuta} onClick={() => setRuta((r) => !r)}>
        {verRuta ? "Ocultar ruta" : "Ver ruta"}
      </Boton>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/tutor/casos/${folio}`} className="inline-flex h-tactil w-fit items-center gap-1 text-small font-semibold underline">
        <Icono nombre="arrow_back" tamano={20} />
        Regresar al detalle del caso
      </Link>
      <h1 className="text-h1">Avistamientos</h1>
      <SelectorVista folio={folio} activa="mapa" />
      {/* Móvil: botones, filtro, mapa, aviso y lista (con `order`). Desde 1024 px el envoltorio `contents` pasa a ser la columna
          derecha, que apila lista, botones, filtro y aviso con el espaciado normal, sin huecos. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="order-3 flex flex-col gap-1 lg:col-start-1 lg:row-start-1">
          <div role="group" aria-label={`Mapa ilustrativo con ${visibles.length} ${visibles.length === 1 ? "avistamiento" : "avistamientos"}${verRuta ? " y la ruta" : ""}`} className="relative aspect-[4/3] w-full overflow-hidden rounded-tarjeta border-2 border-border-strong bg-primary-soft lg:aspect-[5/4]">
            <FondoMapa />
            {verRuta && (
              <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false" className="pointer-events-none absolute inset-0 size-full">
                <polyline points={visibles.map((p) => `${pos(p).x},${pos(p).y}`).join(" ")} fill="none" className="stroke-text" strokeWidth="2.5" strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </svg>
            )}
            {visibles.map((p) => (
              <Link
                key={p.id}
                href={`/tutor/casos/${folio}/avistamientos/${p.id}`}
                aria-label={`Avistamiento ${p.n}: ${formatearFechaHora(p.fechaHora)}, ${p.alcaldia}. Ver detalle`}
                className="absolute inline-flex size-tactil -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-surface bg-primary text-small font-bold text-on-primary shadow-sm hover:bg-primary-hover"
                style={{ left: `${pos(p).x}%`, top: `${pos(p).y}%` }}
              >
                {p.n}
              </Link>
            ))}
            {visibles.length === 0 && <p className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-campo bg-surface p-3 text-center text-small">Ningún avistamiento en ese periodo.</p>}
          </div>
          <p className="text-caption text-text-muted">Mapa ilustrativo de la maqueta: no usa datos ni servicios de mapas reales.</p>
          {visibles.some((p) => p.ubicacionSimulada) && <p className="text-caption text-text-muted">{NOTA_UBICACION_SIMULADA}: algunos puntos son estimados.</p>}
        </div>
        <div className="contents lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-4">
          <div className="order-1 lg:order-2">{botones}</div>
          <div id={`${ids}-filtro`} hidden={!filtroAbierto} className="order-2 rounded-tarjeta border border-border bg-surface px-4 lg:order-3">
            <FiltroFechas prefijoId="filtro-mapa" desdeMinimo={registro} aplicado={filtro} onAplicar={setFiltro} conAlcaldia={false} />
          </div>
          <p id={`${ids}-mensaje`} className="order-4 rounded-campo border-2 border-dashed border-border-strong bg-surface-raised p-3 text-small font-semibold">
            La ruta es solo una referencia visual; requiere al menos 2 avistamientos.
          </p>
          <section aria-labelledby={`${ids}-lista`} className="order-5 rounded-tarjeta border border-border bg-surface p-4 lg:order-1">
            <h2 id={`${ids}-lista`} className="text-h3 font-semibold">
              Avistamientos del caso
            </h2>
            <ol className="mt-3 flex flex-col gap-2">
              {[...visibles].reverse().map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-boton bg-primary text-small font-bold text-on-primary">
                    {p.n}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-small font-bold">{formatearFechaHora(p.fechaHora)}</p>
                    <p className="break-words text-caption text-text-muted">{[p.alcaldia, p.coloniaZona].filter(Boolean).join(" · ")}</p>
                  </div>
                  <Link href={`/tutor/casos/${folio}/avistamientos/${p.id}`} aria-label={`Ver detalle del avistamiento ${p.n}`} className="inline-flex h-tactil shrink-0 items-center rounded-boton border-primary px-3 text-small font-semibold text-primary borde-campo hover:bg-primary-soft">
                    Ver detalle
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
