"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { FotoPerro } from "@/components/ui/FotoPerro";
import { Icono } from "@/components/ui/Icono";
import { Plegable } from "@/components/ui/Plegable";
import { Toast } from "@/components/ui/Toast";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { formatearFechaHora } from "@/lib/formato";
import { FiltrosAvistamientos } from "./FiltrosAvistamientos";
import { NOTA_UBICACION_SIMULADA } from "../avistamiento/datos";
import { SelectorVista } from "./SelectorVista";

/** Lo que la lista necesita de cada avistamiento. Un «Fallecido» llega sin fotografía ni estados: solo el aviso sobrio (HU 039). */
export type ItemAvistamiento = {
  id: number;
  fechaHora: string;
  alcaldia: string;
  coloniaZona?: string;
  estados: string[];
  fotografiaUrl?: string;
  fallecido: boolean;
  /** Ubicación estimada por el Prototipo (sin mapa real): se avisa en la tarjeta. */
  ubicacionSimulada?: boolean;
  /** P5 (HU 040): aún no abre su detalle. */
  nuevo?: boolean;
  /** P5 (HU 040): la persona tutora lo marcó como relevante. */
  relevante?: boolean;
};

type Props = {
  folio: string;
  nombrePerro: string;
  fotografiaPerro: string;
  /** Texto alternativo de la foto del perro, armado con los datos del caso (nombre, sexo, raza, tamaño, color). */
  altPerro?: string;
  /** Fecha de registro del caso, AAAA-MM-DD (día de la Ciudad de México). */
  registro: string;
  /** Avistamientos YA filtrados por el servidor (HU 041) y su total sin filtrar. */
  items: ItemAvistamiento[];
  total: number;
  /** Filtros tal como llegaron en la URL, sus errores (calculados en el servidor) y el catálogo de alcaldías. */
  valores: { desde: string; hasta: string; alcaldia: string };
  errores: { desde?: string; hasta?: string; alcaldia?: string };
  alcaldias: { id: number; nombre: string }[];
  filtrosAbiertos?: boolean;
};

/** TUT-08: avistamientos del caso (lista), con filtros por fecha y alcaldía en la URL, validados en el servidor (HU 039 y 041). */
export function ListaAvistamientos({ folio, nombrePerro, altPerro, fotografiaPerro, registro, items, total, valores, errores, alcaldias, filtrosAbiertos = false }: Props) {
  const router = useRouter();
  const [aviso, setAviso] = useState<string>();

  const visibles = items;
  const hayFiltro = Boolean(valores.desde || valores.hasta || valores.alcaldia);
  const hayErrores = Object.keys(errores).length > 0;

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/tutor/casos/${folio}`} className="inline-flex h-tactil w-fit items-center gap-1 text-small font-semibold underline">
        <Icono nombre="arrow_back" tamano={20} />
        Regresar al detalle del caso
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">Avistamientos</h1>
        <Boton
          variante="secundario"
          icono="refresh"
          onClick={() => {
            router.refresh();
            setAviso("Listado actualizado");
          }}
        >
          Actualizar listado
        </Boton>
      </div>
      <p className="w-fit rounded-campo border border-border bg-surface px-3 py-2 text-small">
        Folio <span className="font-bold tabular-nums">{folio}</span>
      </p>
      <SelectorVista folio={folio} activa="lista" mapaDeshabilitado={total === 0} />
      <Plegable nivel={2} titulo="Filtros" defaultAbierto={filtrosAbiertos || hayFiltro || hayErrores}>
        <FiltrosAvistamientos base={`/tutor/casos/${folio}/avistamientos`} desdeMinimo={registro} valores={valores} errores={errores} alcaldias={alcaldias} />
      </Plegable>

      {total === 0 ? (
        <section aria-labelledby="sin-avistamientos" className="flex flex-col items-center gap-3 rounded-tarjeta border border-border bg-surface p-4 text-center">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-campo border border-border bg-disabled-bg">
            <Image src={fotografiaPerro} alt={altPerro ?? `Fotografía de ${nombrePerro}`} unoptimized={fotografiaPerro.startsWith("/api/")} fill sizes="(min-width: 768px) 640px, 100vw" className="object-cover" priority />
          </div>
          <h2 id="sin-avistamientos" className="text-h3 font-semibold">
            {nombrePerro} aún no registra avistamientos.
          </h2>
        </section>
      ) : (
        <section aria-label="Lista de avistamientos" className="flex flex-col gap-3">
          <p aria-live="polite" className="text-small text-text-muted">
            {visibles.length === total ? `${total} ${total === 1 ? "avistamiento" : "avistamientos"}, el más reciente recibido primero.` : `${visibles.length} de ${total} avistamientos con los filtros aplicados.`}
          </p>
          {visibles.length === 0 ? (
            <p className="rounded-tarjeta border-2 border-dashed border-border p-6 text-center text-small text-text-muted">{hayFiltro ? "Ningún avistamiento coincide con los filtros." : "Sin avistamientos."}</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {visibles.map((a) => (
                <li key={a.id}>
                  <article aria-labelledby={`av-${a.id}`} className="flex h-full flex-col gap-3 rounded-tarjeta border border-border bg-surface p-4">
                    <div className="flex gap-4">
                      {a.fotografiaUrl ? (
                        <FotoPerro src={a.fotografiaUrl} alt="Fotografía del avistamiento" />
                      ) : (
                        <span aria-hidden="true" className="flex size-20 shrink-0 items-center justify-center rounded-campo border border-border bg-disabled-bg text-text-muted">
                          <Icono nombre="visibility_off" tamano={32} />
                        </span>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <h2 id={`av-${a.id}`} className="text-h3 font-semibold">
                          {formatearFechaHora(a.fechaHora)}
                        </h2>
                        {(a.nuevo || a.relevante) && (
                          <p className="flex flex-wrap gap-2">
                            {a.nuevo && (
                              <Etiqueta tono="nuevo">
                                <Icono nombre="notifications" tamano={16} className="mr-1" />
                                Nuevo
                              </Etiqueta>
                            )}
                            {a.relevante && (
                              <Etiqueta>
                                <Icono nombre="check_circle" tamano={16} className="mr-1" />
                                Relevante
                              </Etiqueta>
                            )}
                          </p>
                        )}
                        <p className="text-small">{[a.alcaldia, a.coloniaZona].filter(Boolean).join(" · ")}</p>
                        {a.ubicacionSimulada && <p className="text-caption text-text-muted">{NOTA_UBICACION_SIMULADA}</p>}
                        <p className="text-small text-text-muted">{a.fallecido ? "Aviso: avistamiento con estado «Fallecido». Abre el detalle para más información." : a.estados.join(", ")}</p>
                      </div>
                    </div>
                    <Link href={`/tutor/casos/${folio}/avistamientos/${a.id}`} className="mt-auto inline-flex h-boton items-center justify-center rounded-boton border-primary text-small font-semibold text-primary borde-campo hover:bg-primary-soft" aria-label={`Ver detalle del avistamiento del ${formatearFechaHora(a.fechaHora)}`}>
                      Ver detalle
                    </Link>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {aviso && <Toast mensaje={aviso} onCerrar={() => setAviso(undefined)} />}
    </div>
  );
}
