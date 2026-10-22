import Image from "next/image";
import Link from "next/link";
import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { ChipEstado } from "@/components/ui/ChipEstado";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { cx } from "@/lib/clases";
import { formatearFechaCorta } from "@/lib/formato";
import type { FichaPublica } from "@/mocks/tipos";
import { BotonCompartir } from "./BotonCompartir";

const TAMANO = { pequeño: "Pequeño", mediano: "Mediano", grande: "Grande" } as const;

function edadAproximada({ edadValor, edadUnidad }: Pick<FichaPublica, "edadValor" | "edadUnidad">): string {
  if (edadUnidad === "meses") return edadValor === 0 ? "Menos de 1 mes" : `${edadValor} ${edadValor === 1 ? "mes" : "meses"}`;
  return `${edadValor} ${edadValor === 1 ? "año" : "años"}`;
}

function Datos({ titulo, filas, id }: { titulo: string; id: string; filas: [string, string][] }) {
  return (
    <section aria-labelledby={id} className="rounded-tarjeta border border-border bg-surface p-4">
      <h2 id={id} className="text-h3 font-semibold">
        {titulo}
      </h2>
      <dl className="mt-3 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 gap-y-3 text-small">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="col-span-2 grid grid-cols-subgrid">
            <dt className="font-bold">{etiqueta}</dt>
            <dd className="min-w-0 break-words">{valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

type Props = {
  /** Solo los campos públicos. El componente lee únicamente estas propiedades: nada más se muestra. */
  ficha: FichaPublica;
  /** Destino de «Reportar avistamiento» (solo se usa si el caso acepta avistamientos). */
  hrefAvistamiento: string;
};

/** PUB-03: ficha pública del caso. Un caso «Localizado» (o «Cerrado») no acepta avistamientos (R13). */
export function FichaPublicaVista({ ficha, hrefAvistamiento }: Props) {
  const { folio, estado, nombre, fotografiaUrl } = ficha;
  const acepta = estado !== "Localizado" && estado !== "Cerrado";
  return (
    <article aria-labelledby="ficha-folio" className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 id="ficha-folio" className="text-h1 whitespace-nowrap">
          {folio}
        </h1>
        <ChipEstado estado={estado} />
      </header>
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div className="relative aspect-square overflow-hidden rounded-tarjeta border border-border bg-disabled-bg">
          <Image src={fotografiaUrl} alt={`Fotografía de ${nombre}`} fill sizes="(min-width: 768px) 384px, 100vw" priority className={cx("object-cover", !acepta && "opacity-70 grayscale")} />
        </div>
        <div className="flex flex-col gap-4">
          <Datos
            id="ficha-datos"
            titulo="Datos del perro"
            filas={[
              ["Nombre", nombre],
              ["Sexo", ficha.sexo],
              ["Raza", ficha.raza],
              ["Edad aproximada", edadAproximada(ficha)],
              ["Tamaño", TAMANO[ficha.tamano]],
              ["Color", ficha.color],
              ["Características distintivas", ficha.caracteristicasDistintivas ?? "Sin características registradas"],
            ]}
          />
          <Datos
            id="ficha-lugar"
            titulo="Fecha y lugar de extravío"
            filas={[
              ["Fecha del extravío", formatearFechaCorta(ficha.fechaExtravio)],
              ["Alcaldía", ficha.alcaldia],
              ["Colonia o zona", ficha.coloniaZona],
            ]}
          />
        </div>
      </div>
      {acepta ? (
        <Link href={hrefAvistamiento} className={clasesBoton({ tamano: "grande", anchoCompleto: true })}>
          Reportar avistamiento
        </Link>
      ) : (
        <>
          <Alerta tipo="info" titulo="Este caso ya no recibe avistamientos">
            {estado === "Localizado" ? `${nombre} fue localizado; ya no se reciben avistamientos.` : "El caso está cerrado; ya no se reciben avistamientos."}
          </Alerta>
          <Boton tamano="grande" anchoCompleto disabled aria-describedby="ficha-sin-avistamientos">
            Reportar avistamiento
          </Boton>
          <p id="ficha-sin-avistamientos" className="sr-only">
            Disponible solo mientras el caso siga en curso.
          </p>
        </>
      )}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <BotonCompartir ruta={`/ficha/${folio}`} titulo={`Ficha de ${nombre} · ${folio}`} />
        <Link href="/#buscar-folio" className={clasesBoton({ variante: "secundario" })}>
          Consultar otro folio
        </Link>
      </div>
    </article>
  );
}
