import { Chip } from "@/components/ui/Chip";
import { FotoPerro } from "@/components/ui/FotoPerro";
import { Icono } from "@/components/ui/Icono";
import { formatearFechaHora } from "@/lib/formato";
import { ESTADO_ANIMAL_RESGUARDADO, type Avistamiento } from "@/mocks/tipos";

type Props = { avistamiento: Avistamiento };

/** Tarjeta de un avistamiento recibido. Con el estado «Resguardado / En custodia temporal» muestra su etiqueta. */
export function TarjetaAvistamiento({ avistamiento: a }: Props) {
  const lugar = a.direccionAproximada ?? a.coloniaZona ?? a.alcaldia;
  const resguardado = a.estadosAnimal.includes(ESTADO_ANIMAL_RESGUARDADO);
  return (
    <article className="flex items-center gap-4 rounded-tarjeta border border-border bg-surface p-4">
      <FotoPerro src={a.fotografiaUrl} alt="Fotografía del avistamiento" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <h3 className="flex items-center gap-1.5 text-h3 font-semibold">
          <Icono nombre="location_on" className="shrink-0 text-primary" />
          {lugar}
        </h3>
        <p className="text-small text-text-muted">
          {formatearFechaHora(a.fechaHora)} · {a.alcaldia}
        </p>
        {resguardado && (
          <Chip marcador="home" tono="bg-estado-localizado-bg text-estado-localizado-fg">
            {ESTADO_ANIMAL_RESGUARDADO}
          </Chip>
        )}
      </div>
    </article>
  );
}
