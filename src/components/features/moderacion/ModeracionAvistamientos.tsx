"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { ChipEstatus } from "@/components/ui/ChipEstatus";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { FotoPerro } from "@/components/ui/FotoPerro";
import { Icono } from "@/components/ui/Icono";
import { Paginacion } from "@/components/ui/Paginacion";
import { Selector } from "@/components/ui/Selector";
import { Toast } from "@/components/ui/Toast";
import { cx } from "@/lib/clases";
import { fechaLocalISO, formatearFechaHora } from "@/lib/formato";
import { esFallecido } from "@/mocks/avistamientos";
import type { AvistamientoAdmin } from "@/mocks/moderacion";
import { ModalDetalleAvistamiento } from "./ModalDetalleAvistamiento";
import { ModalMotivo } from "./ModalMotivo";

const POR_PAGINA = 5;

type Filtro = { estatus: "" | "Visible" | "Oculto"; desde: string; hasta: string };
const SIN_FILTRO: Filtro = { estatus: "", desde: "", hasta: "" };

type Modal = { id: number; tipo: "ocultar" | "detalle" };
type Props = {
  avistamientos: readonly AvistamientoAdmin[];
  /** Capturas y pruebas: abre ese modal para ese avistamiento al cargar. */
  modalInicial?: Modal;
  /** Capturas y pruebas: el detalle de un «Fallecido» empieza con la fotografía revelada. */
  fotoVisible?: boolean;
  /** Capturas y pruebas: MOD-09 abre con el error de motivo vacío. */
  errorInicial?: boolean;
  /** Capturas y pruebas: página con la que abre la lista. */
  paginaInicial?: number;
};

/**
 * ADM-05 (HU 037): avistamientos de todos los casos como tarjetas en móvil y tabla compacta en escritorio. «Ocultar» pide el motivo (MOD-09);
 * lo oculto se restaura con su propio botón y la restauración limpia el motivo (decisión D12). Un avistamiento «Fallecido» nunca muestra
 * su fotografía en la lista ni en la tabla. Los cambios solo viven en esta pantalla.
 */
export function ModeracionAvistamientos({ avistamientos: iniciales, modalInicial, fotoVisible, errorInicial, paginaInicial = 1 }: Props) {
  const [lista, setLista] = useState<AvistamientoAdmin[]>([...iniciales]);
  const [borrador, setBorrador] = useState<Filtro>(SIN_FILTRO);
  const [filtro, setFiltro] = useState<Filtro>(SIN_FILTRO);
  const [errorFechas, setErrorFechas] = useState<string>();
  const [pagina, setPagina] = useState(paginaInicial);
  // Los modales quedan montados (cerrados) con el último avistamiento: así el foco regresa al botón que los abrió.
  const [ultimo, setUltimo] = useState<number>(modalInicial?.id ?? iniciales[0].id);
  const [modal, setModal] = useState<Modal["tipo"] | null>(modalInicial?.tipo ?? null);
  const [aviso, setAviso] = useState<string>();

  const filtrados = lista.filter((a) => {
    const dia = fechaLocalISO(a.fechaHora);
    return (!filtro.estatus || (filtro.estatus === "Visible") === a.visible) && (!filtro.desde || dia >= filtro.desde) && (!filtro.hasta || dia <= filtro.hasta);
  });
  const total = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, total);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  const actual = lista.find((a) => a.id === ultimo)!;

  const abrir = (id: number, tipo: Modal["tipo"]) => {
    setUltimo(id);
    setModal(tipo);
  };

  function aplicar() {
    if (borrador.desde && borrador.hasta && borrador.hasta < borrador.desde) {
      setErrorFechas("«Hasta» no puede ser anterior a «Desde».");
      return document.getElementById("filtro-av-hasta")?.focus();
    }
    setErrorFechas(undefined);
    setFiltro(borrador);
    setPagina(1);
  }

  function ocultar(motivo: string) {
    setLista((l) => l.map((a) => (a.id === ultimo ? { ...a, visible: false, motivoModeracion: motivo, fechaModeracion: new Date().toISOString() } : a)));
    setAviso(`Avistamiento ${ultimo} ocultado: dejó de verse en el historial de la persona tutora`);
    setModal(null);
  }

  function restaurar(id: number) {
    // Restaurar limpia el motivo de moderación (D12).
    setLista((l) => l.map((a) => (a.id === id ? { ...a, visible: true, motivoModeracion: undefined, fechaModeracion: undefined } : a)));
    setAviso(`Avistamiento ${id} restaurado: vuelve a verse en el historial de la persona tutora`);
  }

  function miniatura(a: AvistamientoAdmin, lado: number) {
    // La fotografía de un «Fallecido» nunca se muestra en listas: solo en el detalle, tras «Ver fotografía».
    if (esFallecido(a))
      return (
        <span aria-label="Fotografía oculta: contenido sensible" role="img" className="flex shrink-0 items-center justify-center rounded-campo border border-border bg-disabled-bg text-text-muted" style={{ width: lado, height: lado }}>
          <Icono nombre="visibility_off" tamano={lado > 60 ? 28 : 20} />
        </span>
      );
    return <FotoPerro src={a.fotografiaUrl} alt="Fotografía del avistamiento" lado={lado} atenuada={!a.visible} />;
  }

  function moderacion(a: AvistamientoAdmin) {
    if (a.visible) return null;
    return (
      <div className="text-small">
        <p className="break-words">
          <span className="font-semibold">Motivo de moderación:</span> {a.motivoModeracion}
        </p>
        {a.fechaModeracion && <p className="text-text-muted">Ocultado el {formatearFechaHora(a.fechaModeracion)}</p>}
      </div>
    );
  }

  function acciones(a: AvistamientoAdmin, compacto: boolean) {
    const tamano = compacto ? "compacto" : "estandar";
    return (
      <>
        <Boton variante="secundario" tamano={tamano} aria-label={`Ver detalle del avistamiento ${a.id}`} onClick={() => abrir(a.id, "detalle")}>
          Ver detalle
        </Boton>
        {a.visible ? (
          <Boton variante="secundario" tamano={tamano} aria-label={`Ocultar el avistamiento ${a.id}`} onClick={() => abrir(a.id, "ocultar")}>
            Ocultar
          </Boton>
        ) : (
          <Boton tamano={tamano} aria-label={`Restaurar el avistamiento ${a.id}`} onClick={() => restaurar(a.id)}>
            Restaurar
          </Boton>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">Moderación de avistamientos</h1>
      <form
        aria-label="Filtrar avistamientos"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar();
        }}
        className="grid gap-3 rounded-tarjeta border border-border bg-surface p-4 lg:grid-cols-[14rem_minmax(0,1fr)_auto_auto] lg:items-start"
      >
        <Selector
          etiqueta="Estatus"
          marcador="Todos"
          opciones={[
            { valor: "Visible", etiqueta: "Visible" },
            { valor: "Oculto", etiqueta: "Oculto" },
          ]}
          value={borrador.estatus}
          onChange={(e) => setBorrador({ ...borrador, estatus: e.target.value as Filtro["estatus"] })}
        />
        <fieldset className="grid min-w-0 grid-cols-2 gap-3">
          <legend className="mb-1 text-small font-semibold">Fecha</legend>
          <CampoTexto etiqueta="Desde" type="date" value={borrador.desde} onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })} />
          <CampoTexto id="filtro-av-hasta" etiqueta="Hasta" type="date" value={borrador.hasta} onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })} error={errorFechas} />
        </fieldset>
        <Boton
          variante="secundario"
          className="lg:mt-7"
          onClick={() => {
            setBorrador(SIN_FILTRO);
            setFiltro(SIN_FILTRO);
            setErrorFechas(undefined);
            setPagina(1);
          }}
        >
          Limpiar filtros
        </Boton>
        <Boton type="submit" className="lg:mt-7">
          Aplicar filtros
        </Boton>
      </form>

      {filtrados.length === 0 ? (
        <EstadoVacio icono="visibility" titulo="Ningún avistamiento coincide" descripcion="Prueba con otro estatus o rango de fechas, o limpia los filtros." />
      ) : (
        <div className="@container flex flex-col gap-4">
          {/* Tarjetas (móvil) */}
          <ul className="flex flex-col gap-3 @3xl:hidden">
            {visibles.map((a) => (
              <li key={a.id} data-avistamiento={a.id} className={cx("flex flex-col gap-3 rounded-tarjeta bg-surface p-4", a.visible ? "border border-border" : "border-2 border-dashed border-border-strong")}>
                <div className="flex items-center gap-3">
                  {miniatura(a, 80)}
                  <div className="min-w-0">
                    <h2 className="break-words text-h3 font-semibold">
                      ID {a.id} · <span className="whitespace-nowrap tabular-nums">{a.folio}</span>
                    </h2>
                    <p className="text-small text-text-muted">
                      {formatearFechaHora(a.fechaHora)} · {a.alcaldia}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ChipEstatus estatus={a.visible ? "Visible" : "Oculto"} />
                </div>
                {moderacion(a)}
                <div className="grid grid-cols-2 gap-3">{acciones(a, false)}</div>
              </li>
            ))}
          </ul>
          {/* Tabla compacta (escritorio) */}
          <div className="@max-3xl:hidden rounded-tarjeta border border-border bg-surface">
            <table data-tabla-compacta data-excepcion-tactil="compacto" className="w-full text-small">
              <caption className="sr-only">Avistamientos</caption>
              <thead>
                <tr className="border-b border-border-strong text-left text-caption font-semibold uppercase tracking-wide text-text-muted">
                  <th scope="col" className="px-3 py-2">Avistamiento</th>
                  <th scope="col" className="px-3 py-2">Fecha y hora</th>
                  <th scope="col" className="px-3 py-2">Alcaldía</th>
                  <th scope="col" className="px-3 py-2">Estatus</th>
                  <th scope="col" className="px-3 py-2">Moderación</th>
                  <th scope="col" className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((a) => (
                  <tr key={a.id} data-avistamiento={a.id} className="border-b border-border align-top last:border-b-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        {miniatura(a, 48)}
                        <div className="min-w-0">
                          <p className="font-bold">ID {a.id}</p>
                          <p className="whitespace-nowrap tabular-nums text-text-muted">{a.folio}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">{formatearFechaHora(a.fechaHora)}</td>
                    <td className="px-3 py-2">{a.alcaldia}</td>
                    <td className="px-3 py-2">
                      <ChipEstatus estatus={a.visible ? "Visible" : "Oculto"} />
                    </td>
                    <td className="max-w-56 px-3 py-2">{moderacion(a) ?? <span className="text-text-muted">—</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex max-w-48 flex-wrap gap-2">{acciones(a, true)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className="text-small text-text-muted">
              {(paginaActual - 1) * POR_PAGINA + 1}–{(paginaActual - 1) * POR_PAGINA + visibles.length} de {filtrados.length} avistamientos
            </p>
            <Paginacion paginaActual={paginaActual} totalPaginas={total} onCambiarPagina={setPagina} />
          </div>
        </div>
      )}

      <ModalMotivo
        abierto={modal === "ocultar"}
        onCerrar={() => setModal(null)}
        titulo="Ocultar avistamiento"
        resumen={
          <div className="flex items-center gap-3">
            {miniatura(actual, 64)}
            <div className="min-w-0">
              <p className="text-h3 font-bold">ID {actual.id}</p>
              <p className="text-small text-text-muted">
                <span className="whitespace-nowrap tabular-nums">{actual.folio}</span> · {formatearFechaHora(actual.fechaHora)} · {actual.alcaldia}
              </p>
            </div>
          </div>
        }
        tituloAdvertencia="Aviso"
        advertencia="Dejará de verse en el historial de la persona tutora; no se elimina."
        conMotivo
        errorInicial={errorInicial}
        onConfirmar={ocultar}
      />
      <ModalDetalleAvistamiento avistamiento={actual} abierto={modal === "detalle"} onCerrar={() => setModal(null)} fotoVisible={fotoVisible} />
      {aviso && <Toast mensaje={aviso} onCerrar={() => setAviso(undefined)} />}
    </div>
  );
}
