import Link from "next/link";
import { ChipEstado } from "@/components/ui/ChipEstado";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { formatearFechaHora } from "@/lib/formato";
import type { EstadoCaso } from "@/mocks/tipos";
import { PantallaMensaje } from "./PantallaMensaje";

type Props = {
  folio: string;
  estado: EstadoCaso;
  /** Instante (UTC) del último cambio de estatus; se muestra en hora de la Ciudad de México. */
  fechaCambioEstado: string;
  /** Destino de «Consultar otro folio» (la consulta pública o la de la persona tutora). */
  hrefConsulta?: string;
  /** h1 en su propia pantalla; h2 cuando va dentro de otra (la consulta de la persona tutora). */
  nivel?: 1 | 2;
};

/**
 * HU 038: consulta pública del estatus de un caso. Solo el folio, el estatus (según el catálogo de estados) y la fecha del último cambio: NUNCA datos de la persona tutora ni del perro.
 * Un caso cerrado por cierre confirmado se muestra «Cerrado»; cancelado, deshabilitado e inexistente no llegan aquí (R33).
 */
export function EstatusDelCaso({ folio, estado, fechaCambioEstado, hrefConsulta = "/estatus", nivel = 1 }: Props) {
  return (
    <PantallaMensaje
      icono="search"
      titulo="Estatus del caso"
      nivel={nivel}
      acciones={
        <>
          <Link href={hrefConsulta} className={clasesBoton({ tamano: "grande", anchoCompleto: true })}>
            Consultar otro folio
          </Link>
          <Link href="/" className={clasesBoton({ variante: "secundario", tamano: "grande", anchoCompleto: true })}>
            Ir al inicio
          </Link>
        </>
      }
    >
      <dl className="flex w-full flex-col gap-3 text-left">
        <div className="flex flex-col gap-1">
          <dt className="text-small font-bold">Folio</dt>
          <dd className="text-h3 font-semibold tabular-nums">{folio}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-small font-bold">Estatus</dt>
          <dd>
            <ChipEstado estado={estado} />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-small font-bold">Último cambio</dt>
          <dd className="text-body tabular-nums">{formatearFechaHora(fechaCambioEstado)}</dd>
        </div>
      </dl>
      <p className="text-small text-text-muted">Esta consulta solo muestra el estatus del caso: no incluye datos personales.</p>
    </PantallaMensaje>
  );
}
