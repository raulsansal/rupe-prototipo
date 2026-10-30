"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Toast } from "@/components/ui/Toast";
import { formatearFechaCorta, formatearFechaHora } from "@/lib/formato";

type Periodo = { desde: string; hasta: string };

/** «Actualizar tablero» (HU 055): vuelve a pedir los indicadores y lo anuncia. */
export function BotonActualizarTablero() {
  const router = useRouter();
  const [aviso, setAviso] = useState<string>();
  return (
    <>
      <Boton
        variante="secundario"
        icono="refresh"
        onClick={() => {
          router.refresh();
          setAviso("Tablero actualizado");
        }}
      >
        Actualizar tablero
      </Boton>
      {aviso && <Toast mensaje={aviso} onCerrar={() => setAviso(undefined)} />}
    </>
  );
}

/**
 * «Filtrar por periodo» (HU 055): el periodo vive en la URL (?desde, ?hasta) y el SERVIDOR lo valida: si no es válido, la página vuelve con el error del servicio bajo el campo. `limites` son el primer día
 * con datos y hoy (Ciudad de México); `generadoEn` es el instante real del cálculo.
 */
export function FiltroPeriodo({ periodo, limites, generadoEn, errores = {} }: { periodo: Partial<Periodo>; limites: Periodo; generadoEn?: string; errores?: { desde?: string; hasta?: string } }) {
  const router = useRouter();
  const [desde, setDesde] = useState(periodo.desde ?? "");
  const [hasta, setHasta] = useState(periodo.hasta ?? "");

  function aplicar() {
    router.push(`/admin?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`);
  }

  return (
    <section aria-labelledby="titulo-periodo" className="flex flex-col gap-3 rounded-tarjeta border border-border bg-surface p-4">
      <h2 id="titulo-periodo" className="text-small font-bold">
        Filtrar por periodo
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <CampoTexto id="periodo-desde" etiqueta="Desde" type="date" min={limites.desde} max={limites.hasta} value={desde} onChange={(e) => setDesde(e.target.value)} error={errores.desde} />
        <CampoTexto id="periodo-hasta" etiqueta="Hasta" type="date" min={limites.desde} max={limites.hasta} value={hasta} onChange={(e) => setHasta(e.target.value)} error={errores.hasta} />
      </div>
      <Boton anchoCompleto onClick={aplicar}>
        Aplicar periodo
      </Boton>
      {generadoEn && periodo.desde && periodo.hasta && (
        <p className="text-caption text-text-muted">
          Periodo mostrado: {formatearFechaCorta(periodo.desde)} – {formatearFechaCorta(periodo.hasta)} · Última actualización: {formatearFechaHora(generadoEn)}
        </p>
      )}
    </section>
  );
}
