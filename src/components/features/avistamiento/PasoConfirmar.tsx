import Image from "next/image";
import { Alerta } from "@/components/ui/Alerta";
import { nombresElegidos } from "@/lib/estadoAnimal";
import { formatearFechaCorta } from "@/lib/formato";
import type { FichaPublica } from "@/mocks/tipos";
import { NOTA_UBICACION_SIMULADA, type DatosAvistamiento, type OpcionEstadoAnimal } from "./datos";

type Props = {
  ficha: Pick<FichaPublica, "folio" | "nombre">;
  datos: DatosAvistamiento;
  alcaldias: { id: number; nombre: string }[];
  /** Opciones del catálogo que entrega el servidor (incluye las que el Administrador agregó). */
  estadosAnimal: readonly OpcionEstadoAnimal[];
};

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4">
      <dt className="font-bold">{etiqueta}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** Paso 6 (PUB-05.6): resumen de lo capturado antes de enviar; al enviar se muestra PUB-06 con el ID del reporte. */
export function PasoConfirmar({ ficha, datos, alcaldias, estadosAnimal }: Props) {
  const estados = nombresElegidos(datos.estados, estadosAnimal);
  const alcaldia = alcaldias.find((a) => String(a.id) === datos.alcaldiaElegida)?.nombre;
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="resumen-titulo" className="rounded-tarjeta border border-border bg-surface p-4">
        <h2 id="resumen-titulo" className="text-small font-bold">
          Resumen del reporte
        </h2>
        <div className="mt-3 flex gap-4">
          {datos.fotoUrl ? (
            <div className="relative size-24 shrink-0 overflow-hidden rounded-campo border border-border">
              <Image src={datos.fotoUrl} alt="Fotografía que enviarás" fill unoptimized className="object-cover" />
            </div>
          ) : (
            <p className="flex size-24 shrink-0 items-center justify-center rounded-campo border-2 border-dashed border-border p-2 text-center text-caption text-text-muted">Sin fotografía</p>
          )}
          <dl className="flex min-w-0 flex-1 flex-col gap-1 text-small">
            <Fila etiqueta="Caso">
              {ficha.folio} · {ficha.nombre}
            </Fila>
            <Fila etiqueta="Visto el">{datos.fecha && datos.hora ? `${formatearFechaCorta(datos.fecha)}, ${datos.hora}` : "Sin capturar"}</Fila>
          </dl>
        </div>
        <dl className="mt-3 flex flex-col gap-2 text-small">
          <Fila etiqueta="Dirección aproximada">{datos.direccion || "Sin capturar"}</Fila>
          <Fila etiqueta="Alcaldía">{alcaldia ?? "Sin elegir"}</Fila>
          {datos.colonia && <Fila etiqueta="Colonia o zona">{datos.colonia}</Fila>}
          {datos.referencias && <Fila etiqueta="Referencias">{datos.referencias}</Fila>}
          <Fila etiqueta="Estado del animal">{estados.length ? estados.join(", ") : "Sin capturar"}</Fila>
          <Fila etiqueta="Comentario">{datos.comentario || "Sin comentario"}</Fila>
        </dl>
        <p className="mt-3 text-caption text-text-muted">{NOTA_UBICACION_SIMULADA}.</p>
      </section>
      <Alerta tipo="info" titulo="Qué pasa al enviar">
        Tras el envío, la persona tutora recibe un aviso con tu reporte. Tus datos personales no se piden ni se guardan.
      </Alerta>
    </div>
  );
}
