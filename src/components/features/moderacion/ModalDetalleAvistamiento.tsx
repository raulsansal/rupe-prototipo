"use client";

import { Boton } from "@/components/ui/Boton";
import { ChipEstatus } from "@/components/ui/ChipEstatus";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Modal } from "@/components/ui/Modal";
import { formatearFechaHora } from "@/lib/formato";
import { estadosPorCategoria } from "@/mocks/avistamientos";
import { CATEGORIAS_ESTADO_ANIMAL } from "@/mocks/catalogos";
import type { AvistamientoAdmin } from "@/server/serializadores/admin";
import { FotoAvistamiento } from "../avistamientos/FotoAvistamiento";
import { TarjetaDatos } from "../TarjetaDatos";

const AVISO_OCULTA = "Este avistamiento reporta un perro sin vida. La fotografía permanece oculta hasta que decidas verla.";
const AVISO_REVELADA = "Este avistamiento reporta un perro sin vida. La fotografía se muestra porque decidiste verla.";

type Props = {
  avistamiento: AvistamientoAdmin;
  abierto: boolean;
  onCerrar: () => void;
  /** «Ver fotografía» de un «Fallecido»: enlace a esta ruta (con ?foto=visible). El servidor entrega la dirección de la foto SOLO con ese parámetro. */
  hrefRevelar: string;
  /** «Ocultar fotografía»: la misma ruta sin el parámetro. */
  hrefOcultar: string;
};

/**
 * Detalle de solo lectura de un avistamiento para el Administrador (HU 037): fotografía (la de «Fallecido» oculta con aviso previo hasta
 * «Ver fotografía»), ID, folio, fecha y hora, alcaldía, estados del animal por categoría, comentario, estatus y, si está oculto, el motivo.
 * Sin dirección ni referencias: son reservadas a la persona tutora (TUT-10).
 */
export function ModalDetalleAvistamiento({ avistamiento: a, abierto, onCerrar, hrefRevelar, hrefOcultar }: Props) {
  const fallecido = a.fallecido;
  const grupos = estadosPorCategoria(a.estadosAnimal);
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Detalle del avistamiento" tamano="md">
      <FotoAvistamiento key={a.id} src={a.fotografiaUrl} sensible={fallecido} hrefRevelar={hrefRevelar} hrefOcultar={hrefOcultar} aviso={AVISO_OCULTA} avisoRevelada={AVISO_REVELADA} />
      <TarjetaDatos
        id="datos-avistamiento-admin"
        titulo="Datos del avistamiento"
        filas={[
          ["ID", String(a.id)],
          ["Folio", a.folio],
          ["Fecha y hora", formatearFechaHora(a.fechaHora)],
          ["Alcaldía", a.alcaldia],
        ]}
      />
      {CATEGORIAS_ESTADO_ANIMAL.map((c) => {
        if (c.id === 3 && fallecido)
          return (
            <p key={c.id} className="rounded-campo border-2 border-dashed border-border-strong bg-surface-raised p-3 text-small font-semibold">
              Conducta: no aplica con «Fallecido»
            </p>
          );
        const elegidos = grupos[c.id];
        if (elegidos.length === 0) return null;
        return (
          <section key={c.id} aria-labelledby={`cat-admin-${c.id}`} className="rounded-tarjeta border border-border bg-surface p-4">
            <h3 id={`cat-admin-${c.id}`} className="text-small font-bold">
              {c.nombre}
            </h3>
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
        <section aria-labelledby="comentario-admin" className="rounded-tarjeta border border-border bg-surface p-4">
          <h3 id="comentario-admin" className="text-small font-bold">
            Comentario adicional
          </h3>
          <p className="mt-1 break-words text-body">{a.comentario}</p>
        </section>
      )}
      <section aria-labelledby="moderacion-admin" className="flex flex-col gap-2 rounded-tarjeta border border-border bg-surface p-4">
        <h3 id="moderacion-admin" className="text-small font-bold">
          Estatus de moderación
        </h3>
        <div>
          <ChipEstatus estatus={a.visible ? "Visible" : "Oculto"} />
        </div>
        {!a.visible && (
          <>
            <p className="break-words text-small">
              <span className="font-semibold">Motivo de moderación:</span> {a.motivoModeracion}
            </p>
            {a.fechaModeracion && <p className="text-small text-text-muted">Ocultado el {formatearFechaHora(a.fechaModeracion)}</p>}
          </>
        )}
      </section>
      <Boton variante="secundario" anchoCompleto onClick={onCerrar}>
        Cerrar
      </Boton>
    </Modal>
  );
}
