"use client";

import Link from "next/link";
import { useState } from "react";
import { Icono } from "@/components/ui/Icono";
import { Paginacion } from "@/components/ui/Paginacion";
import { Pestanas } from "@/components/ui/Pestanas";
import { esCasoActivo, type FichaTutor } from "@/mocks/tipos";
import { TarjetaPerro } from "./TarjetaPerro";

const POR_PAGINA = 6;

type Filtro = "activos" | "localizados" | "todos";

const FILTROS: Record<Filtro, (f: FichaTutor) => boolean> = {
  activos: (f) => esCasoActivo(f.estado),
  localizados: (f) => f.estado === "Localizado",
  todos: () => true,
};

function Panel({ fichas }: { fichas: FichaTutor[] }) {
  const [pagina, setPagina] = useState(1);
  const total = Math.max(1, Math.ceil(fichas.length / POR_PAGINA));
  const visibles = fichas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  return (
    <div className="flex flex-col gap-4">
      {fichas.length === 0 ? (
        <p className="rounded-tarjeta border-2 border-dashed border-border p-6 text-center text-small text-text-muted">No hay registros en esta vista.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visibles.map((f) => (
            <li key={f.folio}>
              <TarjetaPerro ficha={f} href={`/tutor/casos/${f.folio}`} />
            </li>
          ))}
          {pagina === total && (
            <li className="max-md:hidden">
              <Link href="/tutor/registrar" className="flex h-full min-h-32 flex-col items-center justify-center gap-2 rounded-tarjeta border-2 border-dashed border-border-strong bg-surface p-4 text-small font-semibold text-primary hover:bg-primary-soft">
                <Icono nombre="add" tamano={32} />
                Registrar extravío
              </Link>
            </li>
          )}
        </ul>
      )}
      {total > 1 && <Paginacion paginaActual={pagina} totalPaginas={total} onCambiarPagina={setPagina} className="flex justify-center" />}
    </div>
  );
}

/** Lista «Mis registros» (TUT-01) con pestañas Activos / Localizados / Todos, cada una con su contador y su paginación. */
export function ListaRegistros({ fichas }: { fichas: FichaTutor[] }) {
  const de = (f: Filtro) => fichas.filter(FILTROS[f]);
  return (
    <Pestanas
      etiqueta="Filtrar registros por estatus"
      defaultValue="todos"
      pestanas={[
        { id: "activos", etiqueta: "Activos", contador: de("activos").length },
        { id: "localizados", etiqueta: "Localizados", contador: de("localizados").length },
        { id: "todos", etiqueta: "Todos", contador: fichas.length },
      ]}
    >
      {(id) => <Panel key={id} fichas={de(id as Filtro)} />}
    </Pestanas>
  );
}
