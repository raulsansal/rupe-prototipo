import Image from "next/image";
import { Alerta } from "@/components/ui/Alerta";
import { nombresElegidos } from "@/lib/estadoAnimal";
import { formatearFechaCorta } from "@/lib/formato";
import type { FichaPublica } from "@/mocks/tipos";
import { alcaldiaDelPunto, formatoCoordenada, NOMBRE_FORMA, type DatosAvistamiento } from "./datos";

type Props = {
  ficha: Pick<FichaPublica, "folio" | "nombre">;
  datos: DatosAvistamiento;
};

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4">
      <dt className="font-bold">{etiqueta}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** Paso 6 (PUB-05.6): resumen de lo capturado antes de enviar; al enviar se muestra PUB-06. */
export function PasoConfirmar({ ficha, datos }: Props) {
  const estados = nombresElegidos(datos.estados);
  const alcaldia = alcaldiaDelPunto(datos);
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
          <Fila etiqueta="Ubicación">{NOMBRE_FORMA[datos.forma]}</Fila>
          {datos.direccion && datos.forma === "direccion" && <Fila etiqueta="Dirección aproximada">{datos.direccion}</Fila>}
          <Fila etiqueta="Alcaldía">{alcaldia ?? "Sin confirmar"}</Fila>
          {datos.punto && (
            <Fila etiqueta="Punto confirmado">
              {formatoCoordenada(datos.punto.latitud)}, {formatoCoordenada(datos.punto.longitud)}
              {datos.forma === "gps" && datos.precisionGps !== undefined && ` (± ${datos.precisionGps} m)`}
            </Fila>
          )}
          {datos.colonia && <Fila etiqueta="Colonia o zona">{datos.colonia}</Fila>}
          {datos.referencias && <Fila etiqueta="Referencias">{datos.referencias}</Fila>}
          <Fila etiqueta="Estado del animal">{estados.length ? estados.join(", ") : "Sin capturar"}</Fila>
          <Fila etiqueta="Comentario">{datos.comentario || "Sin comentario"}</Fila>
        </dl>
      </section>
      <Alerta tipo="info" titulo="Qué pasa al enviar">
        Tras el envío, la persona tutora recibe un aviso con tu reporte. Tus datos personales no se piden ni se guardan.
      </Alerta>
    </div>
  );
}
