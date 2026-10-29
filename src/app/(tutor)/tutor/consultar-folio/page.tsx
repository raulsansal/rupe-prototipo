import type { Metadata } from "next";
import { BuscadorFolio } from "@/components/features/BuscadorFolio";
import { EstatusDelCaso } from "@/components/features/EstatusDelCaso";
import { EstatusNoDisponible } from "@/components/features/EstatusNoDisponible";
import { PATRON_FOLIO } from "@/mocks/tipos";
import { normalizarFolio } from "@/server/dominio/folio";
import { ErrorApp } from "@/server/errores";
import { consultarEstatusPorFolio } from "@/server/servicios/fichas";

export const metadata: Metadata = { title: "Consultar folio · RUPE" };

/**
 * HU 038 para la persona tutora: la MISMA consulta pública de estatus, dentro de su plantilla. `?folio=` repite el folio consultado y muestra el resultado; no da a conocer más que la
 * consulta pública (R33): cancelado, deshabilitado, inexistente y mal formado muestran el mismo «Folio no encontrado».
 */
export default async function ConsultarFolio({ searchParams }: PageProps<"/tutor/consultar-folio">) {
  const { folio } = await searchParams;
  const f = typeof folio === "string" ? normalizarFolio(folio) : "";
  let resultado: { folio: string; estado: Awaited<ReturnType<typeof consultarEstatusPorFolio>>["estado"]; fechaCambioEstado: string } | "no-encontrado" | undefined;
  if (f) {
    resultado = PATRON_FOLIO.test(f)
      ? await consultarEstatusPorFolio(f).catch((e) => {
          if (e instanceof ErrorApp && e.estado === 404) return "no-encontrado" as const;
          throw e;
        })
      : "no-encontrado";
  }
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-h1">Consultar folio</h1>
      <p className="text-body text-text-muted">Escribe el folio de un caso para ver su estatus actual y la fecha del último cambio.</p>
      <section aria-labelledby="titulo-consultar" className="rounded-tarjeta border border-border bg-surface p-4">
        <h2 id="titulo-consultar" className="mb-3 text-h3 font-semibold">
          Folio
        </h2>
        <BuscadorFolio destino="estatus-tutora" valorInicial={f} />
      </section>
      {resultado === "no-encontrado" && <EstatusNoDisponible hrefConsulta="/tutor/consultar-folio" nivel={2} />}
      {resultado && resultado !== "no-encontrado" && <EstatusDelCaso folio={resultado.folio} estado={resultado.estado} fechaCambioEstado={resultado.fechaCambioEstado} hrefConsulta="/tutor/consultar-folio" nivel={2} />}
    </div>
  );
}
