"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Toast } from "@/components/ui/Toast";
import { formatearFechaCorta } from "@/lib/formato";
import { errorDePeriodo, HOY_FICTICIO, INICIO_DATOS, type Periodo } from "@/mocks/tablero";

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

/** «Filtrar por periodo» (HU 055): el periodo vive en la URL (?desde, ?hasta) y los indicadores y gráficas lo respetan. */
export function FiltroPeriodo({ periodo }: { periodo: Periodo }) {
  const router = useRouter();
  const [desde, setDesde] = useState(periodo.desde);
  const [hasta, setHasta] = useState(periodo.hasta);
  const [error, setError] = useState<string>();

  function aplicar() {
    const e = errorDePeriodo({ desde, hasta });
    setError(e);
    if (e) return document.getElementById(!desde ? "periodo-desde" : "periodo-hasta")?.focus();
    router.push(`/admin?desde=${desde}&hasta=${hasta}`);
  }

  return (
    <section aria-labelledby="titulo-periodo" className="flex flex-col gap-3 rounded-tarjeta border border-border bg-surface p-4">
      <h2 id="titulo-periodo" className="text-small font-bold">
        Filtrar por periodo
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <CampoTexto id="periodo-desde" etiqueta="Desde" type="date" min={INICIO_DATOS} max={HOY_FICTICIO} value={desde} onChange={(e) => setDesde(e.target.value)} />
        <CampoTexto id="periodo-hasta" etiqueta="Hasta" type="date" min={INICIO_DATOS} max={HOY_FICTICIO} value={hasta} onChange={(e) => setHasta(e.target.value)} error={error} />
      </div>
      <Boton anchoCompleto onClick={aplicar}>
        Aplicar periodo
      </Boton>
      <p className="text-caption text-text-muted">
        Periodo mostrado: {formatearFechaCorta(periodo.desde)} – {formatearFechaCorta(periodo.hasta)} · Última actualización: hoy, 10:42
      </p>
    </section>
  );
}
