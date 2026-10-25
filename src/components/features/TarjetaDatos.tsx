import { cx } from "@/lib/clases";

type Props = {
  id: string;
  titulo: string;
  filas: [string, string][];
  /** reservado: borde discontinuo (la distinción no depende solo del color). */
  variante?: "publico" | "reservado";
};

/** Tarjeta de pares «etiqueta / valor» (datos del perro, del extravío, reservados). */
export function TarjetaDatos({ id, titulo, filas, variante = "publico" }: Props) {
  return (
    <section aria-labelledby={id} className={cx("rounded-tarjeta bg-surface p-4", variante === "reservado" ? "border-2 border-dashed border-border-strong" : "border border-border")}>
      <h2 id={id} className="text-h3 font-semibold">
        {titulo}
      </h2>
      <dl className="mt-3 grid grid-cols-[minmax(min-content,2fr)_minmax(0,3fr)] gap-x-4 gap-y-3 text-small">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="col-span-2 grid grid-cols-subgrid">
            <dt className="min-w-0 break-words font-bold">{etiqueta}</dt>
            <dd className="min-w-0 break-words">{valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
