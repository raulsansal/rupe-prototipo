"use client";

import { useState } from "react";
import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { GraficaBarras } from "@/components/ui/GraficaBarras";
import { Selector } from "@/components/ui/Selector";
import { TarjetaIndicador } from "@/components/ui/TarjetaIndicador";
import { Toast } from "@/components/ui/Toast";
import { formatearFechaCorta } from "@/lib/formato";
import { erroresDeFiltros, generarReporte, SIN_FILTROS, type ErroresFiltros, type FiltrosReporte } from "@/lib/reportes";
import { CATEGORIAS_MOTIVO } from "@/mocks/catalogos";
import { ALCALDIAS, ESTADOS_CASO } from "@/mocks/tipos";

type Props = {
  /** Capturas y pruebas: filtros con los que abre la pantalla. */
  filtrosIniciales?: FiltrosReporte;
  /** Capturas y pruebas: abre como si ya se hubiera pulsado «Generar reporte» con esos filtros. */
  generarAlCargar?: boolean;
};

const CHIP_FILTRO = "inline-flex max-w-full items-center rounded-chip border border-border-strong bg-surface-raised px-3 py-1 text-small";

/**
 * ADM-02 (HU 056 y 057): filtros con rango de fechas obligatorio y vista de resultados. El reporte se calcula en pantalla y no se almacena.
 * La exportación a PDF o Excel está simulada en el maquetado y usa los mismos filtros que la pantalla.
 */
export function ConsultaReportes({ filtrosIniciales = SIN_FILTROS, generarAlCargar = false }: Props) {
  const [borrador, setBorrador] = useState<FiltrosReporte>(filtrosIniciales);
  const inicial = generarAlCargar ? erroresDeFiltros(filtrosIniciales) : {};
  const [errores, setErrores] = useState<ErroresFiltros>(inicial);
  // Filtros con los que se generó el resultado en pantalla: son los que conserva la exportación.
  const [aplicados, setAplicados] = useState<FiltrosReporte | undefined>(generarAlCargar && !inicial.desde && !inicial.hasta ? filtrosIniciales : undefined);
  const [aviso, setAviso] = useState<string>();

  const reporte = aplicados ? generarReporte(aplicados) : undefined;

  function generar() {
    const e = erroresDeFiltros(borrador);
    setErrores(e);
    if (e.desde || e.hasta) {
      setAplicados(undefined);
      return document.getElementById(e.desde ? "reporte-desde" : "reporte-hasta")?.focus();
    }
    setAplicados(borrador);
  }

  function limpiar() {
    setBorrador(SIN_FILTROS);
    setErrores({});
    setAplicados(undefined);
  }

  // TODO Prototipo: generar el archivo PDF o Excel real con los filtros aplicados; en el maquetado solo se confirma de forma ficticia.
  function exportar(formato: "PDF" | "Excel") {
    setAviso(`Exportación simulada a ${formato}: el archivo conservaría los filtros aplicados. En el maquetado no se genera ningún archivo.`);
  }

  const etiquetaCategoria = (id: string) => CATEGORIAS_MOTIVO.find((c) => String(c.id) === id)?.nombre;
  const hayResultado = !!reporte;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">Reportes</h1>
      <form
        aria-label="Filtros del reporte"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          generar();
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
          <Selector etiqueta="Alcaldía · opcional" marcador="Todas" opciones={ALCALDIAS.map((a) => ({ valor: a, etiqueta: a }))} value={borrador.alcaldia} onChange={(e) => setBorrador({ ...borrador, alcaldia: e.target.value })} />
          <Selector etiqueta="Categoría de motivo · opcional" marcador="Todas" opciones={CATEGORIAS_MOTIVO.map((c) => ({ valor: String(c.id), etiqueta: c.nombre }))} value={borrador.categoria} onChange={(e) => setBorrador({ ...borrador, categoria: e.target.value })} />
          <Selector etiqueta="Estado del caso · opcional" marcador="Todos" opciones={ESTADOS_CASO.map((e) => ({ valor: e, etiqueta: e }))} value={borrador.estadoCaso} onChange={(e) => setBorrador({ ...borrador, estadoCaso: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <Boton variante="secundario" onClick={limpiar}>
            Limpiar filtros
          </Boton>
          <Boton type="submit">Generar reporte</Boton>
        </div>
      </form>

      {aplicados && !reporte && (
        <>
          <Alerta tipo="info" titulo="Sin datos">
            No hay datos en el periodo y filtros seleccionados; modifica los filtros e inténtalo de nuevo.
          </Alerta>
          <Exportacion deshabilitado onExportar={exportar} />
        </>
      )}

      {hayResultado && aplicados && (
        <section aria-label="Resultados del reporte" className="flex flex-col gap-4">
          <div className="rounded-tarjeta border border-border bg-surface p-4">
            <h2 className="text-h3 font-semibold">Filtros aplicados</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              <li className={CHIP_FILTRO}>
                Periodo: {formatearFechaCorta(aplicados.desde)} – {formatearFechaCorta(aplicados.hasta)}
              </li>
              <li className={CHIP_FILTRO}>Alcaldía: {aplicados.alcaldia || "todas"}</li>
              <li className={CHIP_FILTRO}>Categoría: {etiquetaCategoria(aplicados.categoria) ?? "todas"}</li>
              <li className={CHIP_FILTRO}>Estado: {aplicados.estadoCaso || "todos"}</li>
            </ul>
            <p className="mt-2 text-caption text-text-muted">El archivo exportado conserva estos filtros.</p>
          </div>
          <Exportacion onExportar={exportar} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <TarjetaIndicador icono="pets" titulo="Número de casos" valor={String(reporte.totalCasos)} descripcion="Registrados en el periodo, con los filtros" />
            <TarjetaIndicador icono="check_circle" titulo="Casos localizados" valor={String(reporte.casosLocalizados)} descripcion="«Localizado» o cierre confirmado" />
            <TarjetaIndicador icono="trending_up" titulo="Tasa de recuperación" valor={reporte.tasaRecuperacion === null ? "—" : `${reporte.tasaRecuperacion.toFixed(1)} %`} descripcion="Localizados sobre el total, sin cancelados ni deshabilitados" />
            <TarjetaIndicador icono="visibility_off" titulo="Avistamientos ocultos (aparte)" valor={String(reporte.avistamientosOcultos)} descripcion="Ocultos por moderación; no entran en las cuentas" />
          </div>
          <p className="text-caption text-text-muted">La tasa no cuenta casos cancelados ni deshabilitados. Las cuentas de avistamientos solo incluyen los visibles.</p>
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
            <div className="contents lg:flex lg:flex-col lg:gap-3">
              <GraficaBarras className="order-1" titulo="Casos por categoría de motivo" grupos={[{ barras: reporte.porMotivo }]} />
              <GraficaBarras className="order-3" titulo="Casos cerrados por tipo de cierre" grupos={[{ barras: reporte.cierres }]} />
              <GraficaBarras className="order-5" titulo="Avistamientos por alcaldía del avistamiento" subtitulo="Según la ubicación del avistamiento, no la del caso; incluye «Fuera de la Ciudad de México»" grupos={[{ barras: reporte.porAlcaldiaAvistamiento }]} />
            </div>
            <div className="contents lg:flex lg:flex-col lg:gap-3">
              <GraficaBarras className="order-2" titulo="Casos por estado del caso" grupos={[{ barras: reporte.porEstadoCaso }]} />
              <GraficaBarras className="order-4" titulo="Avistamientos por estado del animal" subtitulo="Agrupados por categoría · un avistamiento con varios estados se cuenta en cada uno" grupos={reporte.porEstadoAnimal.map((g) => ({ titulo: g.categoria, barras: g.barras }))} />
            </div>
          </div>
          <p className="text-caption text-text-muted">Reporte generado en pantalla: no se almacena en el sistema. Datos ficticios.</p>
        </section>
      )}
      {!aplicados && !errores.desde && !errores.hasta && <EstadoVacio icono="bar_chart" titulo="Genera un reporte" descripcion="Elige el rango de fechas, ajusta los filtros opcionales y pulsa «Generar reporte»." />}
      {aviso && <Toast mensaje={aviso} onCerrar={() => setAviso(undefined)} />}
    </div>
  );
}

function Exportacion({ deshabilitado, onExportar }: { deshabilitado?: boolean; onExportar: (f: "PDF" | "Excel") => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:max-w-md">
      <Boton variante="secundario" icono="picture_as_pdf" disabled={deshabilitado} onClick={() => onExportar("PDF")}>
        Exportar a PDF
      </Boton>
      <Boton variante="secundario" icono="table_chart" disabled={deshabilitado} onClick={() => onExportar("Excel")}>
        Exportar a Excel
      </Boton>
    </div>
  );
}
