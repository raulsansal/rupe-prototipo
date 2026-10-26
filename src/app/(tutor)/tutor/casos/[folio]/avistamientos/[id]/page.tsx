import type { Metadata } from "next";
import Link from "next/link";
import { FotoAvistamiento } from "@/components/features/avistamientos/FotoAvistamiento";
import { MapaIlustrativo } from "@/components/features/MapaIlustrativo";
import { TarjetaDatos } from "@/components/features/TarjetaDatos";
import { Alerta } from "@/components/ui/Alerta";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Icono } from "@/components/ui/Icono";
import { formatearFechaHora } from "@/lib/formato";
import { estadosPorCategoria } from "@/mocks/avistamientos";
import { CATEGORIAS_ESTADO_ANIMAL } from "@/mocks/catalogos";
import { avistamientoDelCaso } from "@/server/servicios/misRegistros";
import { paraPagina } from "@/server/sesion/pagina";
import { obtenerSesion } from "@/server/sesion/sesion";

export const metadata: Metadata = { title: "Detalle del avistamiento · RUPE" };

/**
 * TUT-10. Solo la persona tutora dueña ve estos datos, incluidos la dirección aproximada y las referencias (reservadas frente al
 * público). El visitante permanece anónimo: no hay ningún dato suyo. ?foto=visible revela la fotografía de un «Fallecido» al cargar.
 */
export default async function DetalleAvistamiento({ params, searchParams }: PageProps<"/tutor/casos/[folio]/avistamientos/[id]">) {
  const { folio, id } = await params;
  const { foto } = await searchParams;
  const a = await paraPagina(avistamientoDelCaso(await obtenerSesion(), folio, id));

  const fallecido = a.fallecido;
  const grupos = estadosPorCategoria(a.estadosAnimal);
  const lista = `/tutor/casos/${a.folio}/avistamientos`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link href={lista} className="inline-flex h-tactil w-fit items-center gap-1 text-small font-semibold underline">
        <Icono nombre="arrow_back" tamano={20} />
        Regresar al listado
      </Link>
      <h1 className="text-h1">Detalle del avistamiento</h1>
      <p className="w-fit rounded-campo border border-border bg-surface px-3 py-2 text-small">
        Folio <span className="font-bold tabular-nums">{a.folio}</span>
      </p>
      <FotoAvistamiento src={a.fotografiaUrl} sensible={fallecido} reveladaInicial={foto === "visible"} />
      <TarjetaDatos
        id="datos-avistamiento"
        titulo="Datos del avistamiento"
        filas={[
          ["Fecha y hora", formatearFechaHora(a.fechaHora)],
          ["Alcaldía", a.alcaldia],
          ["Colonia o zona", a.coloniaZona ?? "No registrada"],
          ["Dirección aproximada", a.direccionAproximada ?? "No registrada"],
          ["Referencias", a.referencias ?? "No registradas"],
        ]}
      />
      <MapaIlustrativo etiqueta="Mapa ilustrativo con el punto del avistamiento" punto={{ latitud: a.latitud, longitud: a.longitud }} />
      {CATEGORIAS_ESTADO_ANIMAL.map((c) => {
        const elegidos = grupos[c.id];
        if (c.id === 3 && fallecido)
          return (
            <p key={c.id} className="rounded-campo border-2 border-dashed border-border-strong bg-surface-raised p-3 text-small font-semibold">
              Conducta: no aplica con «Fallecido»
            </p>
          );
        if (elegidos.length === 0) return null;
        return (
          <section key={c.id} aria-labelledby={`cat-${c.id}`} className="rounded-tarjeta border border-border bg-surface p-4">
            <h2 id={`cat-${c.id}`} className="text-small font-bold">
              {c.nombre}
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {elegidos.map((e) => (
                <li key={e}>
                  <Etiqueta className="min-h-7 h-auto! whitespace-normal! py-1">{e}</Etiqueta>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {a.comentario && (
        <section aria-labelledby="comentario" className="rounded-tarjeta border border-border bg-surface p-4">
          <h2 id="comentario" className="text-small font-bold">
            Comentario adicional
          </h2>
          <p className="mt-1 break-words text-body">{a.comentario}</p>
        </section>
      )}
      <Alerta tipo="info" titulo="Quien reportó permanece anónimo">
        El reporte no incluye ningún dato de la persona que lo envió.
      </Alerta>
      <Link href={lista} className={clasesBoton({ variante: "secundario", anchoCompleto: true })}>
        Regresar al listado
      </Link>
    </div>
  );
}
