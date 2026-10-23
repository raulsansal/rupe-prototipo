"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Selector } from "@/components/ui/Selector";
import { ALCALDIAS, FUERA_DE_LA_CIUDAD } from "@/mocks/tipos";

export type Filtro = { desde: string; hasta: string; alcaldia: string };
export const SIN_FILTRO: Filtro = { desde: "", hasta: "", alcaldia: "" };

type Props = {
  /** Fecha de registro del caso (AAAA-MM-DD): el rango no puede ser anterior (HU 041). */
  desdeMinimo: string;
  aplicado: Filtro;
  onAplicar: (f: Filtro) => void;
  /** TUT-09 solo filtra por fecha (HU 047). */
  conAlcaldia?: boolean;
  prefijoId: string;
};

/** Panel de filtros de avistamientos: fechas (opcionales y combinables) y, en el listado, alcaldía o zona. */
export function FiltroFechas({ desdeMinimo, aplicado, onAplicar, conAlcaldia = true, prefijoId }: Props) {
  const [f, setF] = useState<Filtro>(aplicado);
  const [errores, setErrores] = useState<{ desde?: string; hasta?: string }>({});

  function aplicar() {
    const e: typeof errores = {};
    if (f.desde && f.desde < desdeMinimo) e.desde = "La fecha no puede ser anterior al registro del caso.";
    if (f.hasta && f.hasta < desdeMinimo) e.hasta = "La fecha no puede ser anterior al registro del caso.";
    if (!e.hasta && f.desde && f.hasta && f.hasta < f.desde) e.hasta = "«Hasta» no puede ser anterior a «Desde».";
    setErrores(e);
    if (e.desde) return document.getElementById(`${prefijoId}-desde`)?.focus();
    if (e.hasta) return document.getElementById(`${prefijoId}-hasta`)?.focus();
    onAplicar(f);
  }

  function limpiar() {
    setF(SIN_FILTRO);
    setErrores({});
    onAplicar(SIN_FILTRO);
  }

  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="grid grid-cols-2 gap-3">
        <CampoTexto id={`${prefijoId}-desde`} etiqueta="Desde" type="date" min={desdeMinimo} value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} error={errores.desde} />
        <CampoTexto id={`${prefijoId}-hasta`} etiqueta="Hasta" type="date" min={desdeMinimo} value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} error={errores.hasta} />
      </div>
      {conAlcaldia && (
        <Selector
          etiqueta="Alcaldía o zona"
          marcador="Todas"
          opciones={[...ALCALDIAS, FUERA_DE_LA_CIUDAD].map((a) => ({ valor: a, etiqueta: a }))}
          value={f.alcaldia}
          onChange={(e) => setF({ ...f, alcaldia: e.target.value })}
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Boton variante="secundario" onClick={limpiar}>
          Limpiar filtros
        </Boton>
        <Boton onClick={aplicar}>Aplicar filtros</Boton>
      </div>
    </div>
  );
}
