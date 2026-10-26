import type { Metadata } from "next";
import Link from "next/link";
import { BienvenidaTutor } from "@/components/features/BienvenidaTutor";
import { ListaRegistros } from "@/components/features/ListaRegistros";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { EstadoCarga } from "@/components/ui/EstadoCarga";
import { aFichaTutor, casosDeLaPersonaTutora } from "@/mocks/casos";
import { obtenerSesion } from "@/server/sesion/sesion";

export const metadata: Metadata = { title: "Mis registros · RUPE" };

/** TUT-01. ?estado=vacio muestra la bienvenida sin registros; ?estado=cargando, el estado de carga. */
export default async function MisRegistros({ searchParams }: PageProps<"/tutor">) {
  const { estado } = await searchParams;
  const vacio = estado === "vacio";
  const primerNombre = ((await obtenerSesion())?.nombre ?? "").split(" ")[0];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">Mis registros</h1>
        {!vacio && (
          <Link href="/tutor/registrar" className={clasesBoton()}>
            Registrar extravío
          </Link>
        )}
      </div>
      {vacio ? (
        <BienvenidaTutor nombre={primerNombre} />
      ) : estado === "cargando" ? (
        <div className="grid gap-3 md:grid-cols-2" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <EstadoCarga key={i} etiqueta="Cargando tus registros…" />
          ))}
        </div>
      ) : (
        <ListaRegistros fichas={casosDeLaPersonaTutora().map(aFichaTutor)} />
      )}
    </div>
  );
}
