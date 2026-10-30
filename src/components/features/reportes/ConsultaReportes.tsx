"use client";

import { useRef, useState } from "react";
import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { EstadoCarga } from "@/components/ui/EstadoCarga";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { GraficaBarras } from "@/components/ui/GraficaBarras";
import { Selector } from "@/components/ui/Selector";
import { TarjetaIndicador } from "@/components/ui/TarjetaIndicador";
import { Toast } from "@/components/ui/Toast";
import { MENSAJE_SIN_CONEXION } from "@/lib/clienteAdmin";
import { formatearFechaCorta } from "@/lib/formato";
import type { OpcionesDeReporte, ReporteAdmin } from "@/server/serializadores/admin";

type Filtros = { desde: string; hasta: string; alcaldia: string; categoria: string; estadoCaso: string };
type Errores = { desde?: string; hasta?: string; alcaldia?: string; categoria?: string; estadoCaso?: string };
type Resultado = { fase: "inicial" } | { fase: "cargando" } | { fase: "listo"; filtros: Filtros; reporte: ReporteAdmin } | { fase: "error"; mensaje: string };
const SIN_FILTROS: Filtros = { desde: "", hasta: "", alcaldia: "", categoria: "", estadoCaso: "" };
const MENSAJE_DATOS_CAMBIARON = "Los datos cambiaron; genera el reporte de nuevo.";

const CHIP_FILTRO = "inline-flex max-w-full items-center rounded-chip border border-border-strong bg-surface-raised px-3 py-1 text-small";

/** Antes de pedirlo al servidor: el rango es obligatorio (HU 056, regla 1) y «Desde» no puede ser posterior a «Hasta». El servidor vuelve a validar todo. */
function erroresLocales({ desde, hasta }: Filtros): Errores {
  const e: Errores = {};
  if (!desde) e.desde = "El rango de fechas es obligatorio: indica «Desde».";
  if (!hasta) e.hasta = "El rango de fechas es obligatorio: indica «Hasta».";
  if (desde && hasta && desde > hasta) e.hasta = "«Hasta» no puede ser anterior a «Desde».";
  return e;
}

/**
 * ADM-02 (HU 056 y 057): filtros con rango de fechas obligatorio y vista de resultados. El reporte lo calcula el SERVIDOR (GET /api/admin/reportes) y no se almacena. Los botones de exportación piden el archivo al
 * servidor (POST /api/admin/reportes/exportar) con los filtros aplicados y la huella que el servidor dio al generar: el cliente nunca aporta cifras. Si los datos cambiaron (409) hay que generar de nuevo.
 */
export function ConsultaReportes({ opciones }: { opciones: OpcionesDeReporte }) {
  const [borrador, setBorrador] = useState<Filtros>(SIN_FILTROS);
  const [errores, setErrores] = useState<Errores>({});
  const [resultado, setResultado] = useState<Resultado>({ fase: "inicial" });
  const [obsoleto, setObsoleto] = useState(false);
  const [exportando, setExportando] = useState<"pdf" | "xlsx">();
  const [errorExportar, setErrorExportar] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const peticion = useRef(0);

  async function generar() {
    const e = erroresLocales(borrador);
    setErrores(e);
    setObsoleto(false);
    setErrorExportar(undefined);
    if (e.desde || e.hasta) {
      peticion.current++;
      setResultado({ fase: "inicial" });
      return document.getElementById(e.desde ? "reporte-desde" : "reporte-hasta")?.focus();
    }
    const mia = ++peticion.current;
    const aplicados = borrador;
    setResultado({ fase: "cargando" });
    try {
      const q = new URLSearchParams(Object.entries(aplicados).filter(([, v]) => v));
      const r = await fetch(`/api/admin/reportes?${q}`);
      const json = (await r.json().catch(() => undefined)) as (ReporteAdmin & { error?: { mensaje?: string; campos?: Errores } }) | undefined;
      if (mia !== peticion.current) return; // llegó otra petición después: esta respuesta ya no vale
      if (r.ok && json) return setResultado({ fase: "listo", filtros: aplicados, reporte: json });
      if (r.status === 422 && json?.error?.campos) {
        setErrores(json.error.campos);
        setResultado({ fase: "inicial" });
        return document.getElementById(json.error.campos.desde ? "reporte-desde" : json.error.campos.hasta ? "reporte-hasta" : "")?.focus();
      }
      setResultado({ fase: "error", mensaje: json?.error?.mensaje ?? "No se pudo generar el reporte. Inténtalo de nuevo." });
    } catch {
      if (mia === peticion.current) setResultado({ fase: "error", mensaje: MENSAJE_SIN_CONEXION });
    }
  }

  function limpiar() {
    peticion.current++;
    setBorrador(SIN_FILTROS);
    setErrores({});
    setResultado({ fase: "inicial" });
    setObsoleto(false);
    setErrorExportar(undefined);
  }

  async function exportar(formato: "pdf" | "xlsx") {
    if (resultado.fase !== "listo" || resultado.reporte.sinDatos) return;
    setExportando(formato);
    setErrorExportar(undefined);
    try {
      const r = await fetch("/api/admin/reportes/exportar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ formato, filtros: resultado.filtros, huella: resultado.reporte.huella }) });
      if (r.ok) {
        const archivo = await r.blob();
        const nombre = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") ?? "")?.[1] ?? `reporte-rupe.${formato}`;
        const url = URL.createObjectURL(archivo);
        const a = document.createElement("a");
        a.href = url;
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        setAviso(`Se descargó ${nombre}.`);
      } else {
        const json = (await r.json().catch(() => undefined)) as { error?: { codigo?: string; mensaje?: string } } | undefined;
        if (r.status === 409 && json?.error?.codigo === "DATOS_CAMBIARON") {
          setObsoleto(true);
          setErrorExportar(MENSAJE_DATOS_CAMBIARON);
        } else setErrorExportar(json?.error?.mensaje ?? "No se pudo exportar el reporte. Inténtalo de nuevo.");
      }
    } catch {
      setErrorExportar(MENSAJE_SIN_CONEXION);
    } finally {
      setExportando(undefined);
    }
  }

  const reporte = resultado.fase === "listo" ? resultado.reporte : undefined;
  const cargando = resultado.fase === "cargando";
  const conDatos = reporte && !reporte.sinDatos ? reporte : undefined;
  const sinExportar = !conDatos || obsoleto || exportando !== undefined;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">Reportes</h1>
      <form
        aria-label="Filtros del reporte"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void generar();
        }}
        className="flex flex-col gap-3 rounded-tarjeta border border-border bg-surface p-4"
      >
        <h2 className="text-h3 font-semibold">Filtros del reporte</h2>
        <fieldset className="grid min-w-0 grid-cols-2 gap-3 lg:max-w-xl">
          <legend className="mb-1 text-small font-semibold">Rango de fechas *</legend>
          <CampoTexto id="reporte-desde" etiqueta="Desde" type="date" required value={borrador.desde} error={errores.desde} onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })} />
          <CampoTexto id="reporte-hasta" etiqueta="Hasta" type="date" required value={borrador.hasta} error={errores.hasta} onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })} />
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Selector etiqueta="Alcaldía · opcional" marcador="Todas" opciones={opciones.alcaldias.map((a) => ({ valor: String(a.id), etiqueta: a.nombre }))} value={borrador.alcaldia} error={errores.alcaldia} onChange={(e) => setBorrador({ ...borrador, alcaldia: e.target.value })} />
          <Selector etiqueta="Categoría de motivo · opcional" marcador="Todas" opciones={opciones.categorias.map((c) => ({ valor: String(c.id), etiqueta: c.nombre }))} value={borrador.categoria} error={errores.categoria} onChange={(e) => setBorrador({ ...borrador, categoria: e.target.value })} />
          <Selector etiqueta="Estado del caso · opcional" marcador="Todos" opciones={opciones.estadosCaso.map((e) => ({ valor: e, etiqueta: e }))} value={borrador.estadoCaso} error={errores.estadoCaso} onChange={(e) => setBorrador({ ...borrador, estadoCaso: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <Boton variante="secundario" onClick={limpiar}>
            Limpiar filtros
          </Boton>
          <Boton type="submit" disabled={cargando}>
            Generar reporte
          </Boton>
        </div>
      </form>

      {cargando && (
        <div className="flex flex-col gap-3" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <EstadoCarga sinFoto key={i} etiqueta="Generando el reporte…" />
          ))}
        </div>
      )}

      {resultado.fase === "error" && (
        <Alerta tipo="peligro" titulo="No se pudo generar el reporte">
          {resultado.mensaje}
        </Alerta>
      )}

      {reporte?.sinDatos && (
        <>
          <Alerta tipo="info" titulo="Sin datos">
            No hay datos en el periodo y filtros seleccionados; modifica los filtros e inténtalo de nuevo.
          </Alerta>
          <Exportacion deshabilitado onExportar={exportar} />
        </>
      )}

      {conDatos && resultado.fase === "listo" && (
        <section aria-label="Resultados del reporte" className="flex flex-col gap-4">
          <div className="rounded-tarjeta border border-border bg-surface p-4">
            <h2 className="text-h3 font-semibold">Filtros aplicados</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              <li className={CHIP_FILTRO}>
                Periodo: {formatearFechaCorta(conDatos.filtros.desde)} – {formatearFechaCorta(conDatos.filtros.hasta)}
              </li>
              <li className={CHIP_FILTRO}>Alcaldía: {conDatos.filtros.alcaldia?.nombre ?? "todas"}</li>
              <li className={CHIP_FILTRO}>Categoría: {conDatos.filtros.categoria?.nombre ?? "todas"}</li>
              <li className={CHIP_FILTRO}>Estado: {conDatos.filtros.estadoCaso ?? "todos"}</li>
            </ul>
            <p className="mt-2 text-caption text-text-muted">El archivo exportado conserva estos filtros.</p>
          </div>
          <Exportacion deshabilitado={sinExportar} onExportar={exportar} />
          {errorExportar && (
            <Alerta tipo={obsoleto ? "advertencia" : "peligro"} titulo={obsoleto ? "Los datos cambiaron" : "No se pudo exportar"}>
              {errorExportar}
            </Alerta>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <TarjetaIndicador icono="pets" titulo="Número de casos" valor={String(conDatos.totalCasos)} descripcion="Registrados en el periodo, con los filtros" />
            <TarjetaIndicador icono="check_circle" titulo="Casos localizados" valor={String(conDatos.casosLocalizados)} descripcion="«Localizado» o cierre confirmado" />
            <TarjetaIndicador icono="trending_up" titulo="Tasa de recuperación" valor={conDatos.tasaRecuperacion === null ? "—" : `${conDatos.tasaRecuperacion.toFixed(1)} %`} descripcion="Localizados sobre el total, sin cancelados ni deshabilitados" />
            <TarjetaIndicador icono="visibility_off" titulo="Avistamientos ocultos (aparte)" valor={String(conDatos.avistamientosOcultos)} descripcion="Ocultos por moderación; no entran en las cuentas" />
          </div>
          <p className="text-caption text-text-muted">La tasa no cuenta casos cancelados ni deshabilitados. Las cuentas de avistamientos solo incluyen los visibles.</p>
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
            <div className="contents lg:flex lg:flex-col lg:gap-3">
              <GraficaBarras className="order-1" titulo="Casos por categoría de motivo" grupos={[{ barras: conDatos.porMotivo }]} />
              <GraficaBarras className="order-3" titulo="Casos cerrados por tipo de cierre" grupos={[{ barras: conDatos.cierres }]} />
              <GraficaBarras className="order-5" titulo="Avistamientos por alcaldía del avistamiento" subtitulo="Según la ubicación del avistamiento, no la del caso; incluye «Fuera de la Ciudad de México»" grupos={[{ barras: conDatos.porAlcaldiaAvistamiento }]} />
            </div>
            <div className="contents lg:flex lg:flex-col lg:gap-3">
              <GraficaBarras className="order-2" titulo="Casos por estado del caso" grupos={[{ barras: conDatos.porEstadoCaso }]} />
              <GraficaBarras className="order-4" titulo="Avistamientos por estado del animal" subtitulo="Agrupados por categoría · un avistamiento con varios estados se cuenta en cada uno" grupos={conDatos.porEstadoAnimal.map((g) => ({ titulo: g.categoria, barras: g.barras }))} />
            </div>
          </div>
          <p className="text-caption text-text-muted">Reporte generado en pantalla: no se almacena en el sistema.</p>
        </section>
      )}
      {resultado.fase === "inicial" && !errores.desde && !errores.hasta && <EstadoVacio icono="bar_chart" titulo="Genera un reporte" descripcion="Elige el rango de fechas, ajusta los filtros opcionales y pulsa «Generar reporte»." />}
      {aviso && <Toast mensaje={aviso} onCerrar={() => setAviso(undefined)} />}
    </div>
  );
}

function Exportacion({ deshabilitado, onExportar }: { deshabilitado?: boolean; onExportar: (f: "pdf" | "xlsx") => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:max-w-md">
      <Boton variante="secundario" icono="picture_as_pdf" disabled={deshabilitado} onClick={() => onExportar("pdf")}>
        Exportar a PDF
      </Boton>
      <Boton variante="secundario" icono="table_chart" disabled={deshabilitado} onClick={() => onExportar("xlsx")}>
        Exportar a Excel
      </Boton>
    </div>
  );
}
