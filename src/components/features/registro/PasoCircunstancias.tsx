"use client";

import { useSyncExternalStore } from "react";
import { AreaTexto } from "@/components/ui/AreaTexto";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { GrupoRadio } from "@/components/ui/GrupoRadio";
import { Selector } from "@/components/ui/Selector";
import { CATEGORIAS_MOTIVO, MOMENTOS_DEL_DIA, MOTIVOS } from "@/mocks/catalogos";
import { ALCALDIAS, type Alcaldia, type MomentoDelDia } from "@/mocks/tipos";
import { hoyLocal } from "../avistamiento/datos";
import { MAXIMOS, type DatosRegistro, type ErroresRegistro } from "./datos";
import type { ActualizarRegistro } from "./PasoDatosPerro";

type Props = { datos: DatosRegistro; errores: ErroresRegistro; actualizar: ActualizarRegistro };

/** TUT-03: circunstancias del extravío (HU 012). Separa lo que será público de lo reservado. */
export function PasoCircunstancias({ datos, errores, actualizar }: Props) {
  const hoy = useSyncExternalStore(
    () => () => {},
    () => hoyLocal(),
    () => undefined,
  );
  const motivo = MOTIVOS.find((m) => String(m.id) === datos.motivoId);
  const categoria = CATEGORIAS_MOTIVO.find((c) => c.id === motivo?.idCategoria);

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="circ-publicos" className="flex min-w-0 flex-col gap-4 rounded-tarjeta border border-border bg-surface p-4">
        <h2 id="circ-publicos" className="text-h3 font-semibold">
          Públicos en la ficha
        </h2>
        <CampoTexto
          etiqueta="Fecha del extravío"
          type="date"
          required
          max={hoy}
          value={datos.fechaExtravio}
          onChange={(e) => actualizar({ fechaExtravio: e.target.value }, ["fecha"])}
          error={errores.fecha}
        />
        <Selector
          etiqueta="Alcaldía"
          required
          marcador="Elige una alcaldía"
          opciones={ALCALDIAS.map((a) => ({ valor: a, etiqueta: a }))}
          value={datos.alcaldia}
          onChange={(e) => actualizar({ alcaldia: e.target.value as Alcaldia | "" }, ["alcaldia"])}
          error={errores.alcaldia}
        />
        <CampoTexto
          etiqueta="Colonia o zona"
          required
          maxLength={MAXIMOS.colonia}
          autoComplete="off"
          value={datos.colonia}
          onChange={(e) => actualizar({ colonia: e.target.value }, ["colonia"])}
          error={errores.colonia}
        />
      </section>

      <section aria-labelledby="circ-reservados" className="flex min-w-0 flex-col gap-4 rounded-tarjeta border-2 border-dashed border-border-strong bg-surface p-4">
        <h2 id="circ-reservados" className="text-h3 font-semibold">
          Reservados: no aparecen en la ficha
        </h2>
        <GrupoRadio
          leyenda="Momento del día"
          name="momento"
          requerido
          value={datos.momento}
          onChange={(e) => actualizar({ momento: e.target.value as MomentoDelDia }, ["momento"])}
          opciones={MOMENTOS_DEL_DIA.map((m) => ({ valor: m.valor, etiqueta: m.etiqueta, descripcion: m.rango }))}
          error={errores.momento}
        />
        <CampoTexto
          etiqueta="Calle o cruce (opcional)"
          maxLength={MAXIMOS.calle}
          autoComplete="off"
          ayuda="Calle y número aproximado, o el cruce más cercano. No se muestra en la ficha."
          value={datos.calle}
          onChange={(e) => actualizar({ calle: e.target.value })}
        />
        <AreaTexto
          etiqueta="Referencias del lugar (opcional)"
          maxLength={MAXIMOS.referencias}
          rows={3}
          ayuda="Por ejemplo, un comercio o un parque cercano. No se muestra en la ficha."
          value={datos.referencias}
          onChange={(e) => actualizar({ referencias: e.target.value })}
        />
        <div className="flex flex-col gap-2">
          <Selector
            etiqueta="Motivo del extravío"
            required
            marcador="Elige un motivo"
            opciones={MOTIVOS.map((m) => ({ valor: String(m.id), etiqueta: m.nombre }))}
            value={datos.motivoId}
            onChange={(e) => actualizar({ motivoId: e.target.value }, ["motivo"])}
            error={errores.motivo}
          />
          <p aria-live="polite" className="min-h-5 rounded-campo bg-surface-raised px-3 py-2 text-small text-text-muted empty:hidden">
            {motivo && (
              <>
                <span className="font-semibold text-text">{categoria?.nombre}.</span> {motivo.descripcion}
              </>
            )}
          </p>
        </div>
        <AreaTexto
          etiqueta="Descripción de las circunstancias (opcional)"
          maxLength={MAXIMOS.descripcion}
          rows={5}
          value={datos.descripcion}
          onChange={(e) => actualizar({ descripcion: e.target.value })}
        />
      </section>
    </div>
  );
}
