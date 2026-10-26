import Image from "next/image";
import { altDeFoto } from "@/lib/altDeFoto";
import { Alerta } from "@/components/ui/Alerta";
import type { FichaPublica } from "@/mocks/tipos";

type Props = { ficha: Pick<FichaPublica, "folio" | "nombre" | "fotografiaUrl"> };

const SE_PEDIRA = ["Una fotografía del perro que viste.", "El lugar donde lo viste.", "La fecha, la hora y el estado en que lo viste.", "Un comentario, si quieres agregarlo."];

/** Paso 1 (PUB-05.1): a qué caso se reporta y qué se va a pedir. */
export function PasoInicio({ ficha }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="inicio-folio" className="rounded-tarjeta border border-border bg-surface p-4">
        <h2 id="inicio-folio" className="text-small font-bold">
          Folio del caso
        </h2>
        <p className="mt-1 text-h3 font-semibold">{ficha.folio}</p>
      </section>
      <div className="relative aspect-[4/3] overflow-hidden rounded-tarjeta border border-border bg-disabled-bg">
        <Image src={ficha.fotografiaUrl} alt={altDeFoto(ficha)} fill sizes="(min-width: 672px) 640px, 100vw" className="object-cover" />
      </div>
      <section aria-labelledby="inicio-pedira" className="rounded-tarjeta border border-border bg-surface p-4">
        <h2 id="inicio-pedira" className="text-small font-bold">
          Qué se te pedirá
        </h2>
        <ul className="mt-2 list-disc pl-5 text-small">
          {SE_PEDIRA.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>
      <Alerta tipo="info" titulo="No se pide registro ni datos personales">
        Tu reporte es anónimo: no necesitas crear una cuenta ni escribir tu nombre, correo o teléfono.
      </Alerta>
    </div>
  );
}
