"use client";

import Link from "next/link";
import { useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { ChipEstado } from "@/components/ui/ChipEstado";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { FotoPerro } from "@/components/ui/FotoPerro";
import { Paginacion } from "@/components/ui/Paginacion";
import { Selector } from "@/components/ui/Selector";
import { Toast } from "@/components/ui/Toast";
import { cx } from "@/lib/clases";
import { formatearFechaHora, formatearFechaLocal } from "@/lib/formato";
import { deshabilitacionVigente, deshabilitar, esDeshabilitado, estadoActual, estadoPrevioADeshabilitacion, motivoCasoCerrado, motivoCasoCerradoCorto, puedeDeshabilitar, puedeRestaurar, restaurar } from "@/lib/moderacion";
import type { RegistroAdminLista } from "@/mocks/moderacion";
import { ALCALDIAS, ESTADOS_CASO, type MovimientoHistorial } from "@/mocks/tipos";
import { ModalMotivo } from "./ModalMotivo";

const POR_PAGINA = 5;

type Registro = { caso: RegistroAdminLista; historial: MovimientoHistorial[] };
type Filtro = { estado: string; alcaldia: string };
const SIN_FILTRO: Filtro = { estado: "", alcaldia: "" };

type Props = {
  casos: readonly RegistroAdminLista[];
  /** Capturas y pruebas: abre MOD-08 para ese folio al cargar. */
  modalInicial?: string;
  /** Capturas y pruebas: MOD-08 abre con el error de motivo vacío. */
  errorInicial?: boolean;
};

/**
 * ADM-04 (HU 018): casos del sistema como tarjetas en móvil y tabla compacta cuando el contenedor mide 48 rem o más. «Deshabilitar» pide
 * el motivo (MOD-08) y solo existe para casos que no están en «Cerrado»; «Restaurar» solo para los cerrados por deshabilitación y devuelve
 * el caso al estado previo. Las acciones no disponibles se muestran deshabilitadas con su motivo. Los cambios solo viven en esta pantalla.
 */
export function ModeracionRegistros({ casos, modalInicial, errorInicial }: Props) {
  const [registros, setRegistros] = useState<Registro[]>(() => casos.map((c) => ({ caso: c, historial: c.historial })));
  const [borrador, setBorrador] = useState<Filtro>(SIN_FILTRO);
  const [filtro, setFiltro] = useState<Filtro>(SIN_FILTRO);
  const [pagina, setPagina] = useState(1);
  // El modal queda montado (cerrado) con el último folio: así el foco regresa al botón que lo abrió.
  const [ultimo, setUltimo] = useState<string>(modalInicial ?? casos[0].folio);
  const [abierto, setAbierto] = useState(Boolean(modalInicial));
  const [aviso, setAviso] = useState<string>();

  const filtrados = registros.filter((r) => (!filtro.estado || estadoActual(r.historial) === filtro.estado) && (!filtro.alcaldia || r.caso.alcaldia === filtro.alcaldia));
  const total = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, total);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  const registroModal = registros.find((r) => r.caso.folio === ultimo)!;

  const abrir = (folio: string) => {
    setUltimo(folio);
    setAbierto(true);
  };

  function confirmar(motivo: string) {
    setRegistros((lista) => lista.map((r) => (r.caso.folio === ultimo ? { ...r, historial: deshabilitar(r.historial, motivo, new Date().toISOString()) } : r)));
    setAviso(`Registro ${ultimo} deshabilitado: pasó a «Cerrado»`);
    setAbierto(false);
  }

  function restaurarRegistro(folio: string) {
    const r = registros.find((x) => x.caso.folio === folio)!;
    const previo = estadoPrevioADeshabilitacion(r.historial);
    setRegistros((lista) => lista.map((x) => (x.caso.folio === folio ? { ...x, historial: restaurar(x.historial, new Date().toISOString()) } : x)));
    setAviso(`Registro ${folio} restaurado: volvió a «${previo}»`);
  }

  function estadoChip(r: Registro) {
    const estado = estadoActual(r.historial);
    return <ChipEstado estado={estado} texto={esDeshabilitado(r.historial) ? "Cerrado (deshabilitado)" : undefined} />;
  }

  function moderacion(r: Registro) {
    const d = deshabilitacionVigente(r.historial);
    if (!d) return null;
    return (
      <div className="text-small">
        <p className="break-words">
          <span className="font-semibold">Motivo de moderación:</span> {d.motivo}
        </p>
        <p className="text-text-muted">Deshabilitado el {formatearFechaHora(d.fechaHora)}</p>
      </div>
    );
  }

  function acciones(r: Registro, compacto: boolean) {
    const folio = r.caso.folio;
    const tamano = compacto ? "compacto" : "estandar";
    const sufijo = compacto ? "-t" : "";
    return (
      <>
        <Link href={`/admin/registros/${folio}`} aria-label={`Ver detalle de ${folio}`} className={clasesBoton({ variante: "secundario", tamano, className: "text-center" })}>
          Ver detalle
        </Link>
        {puedeRestaurar(r.historial) ? (
          <Boton tamano={tamano} aria-label={`Restaurar ${folio}`} onClick={() => restaurarRegistro(folio)}>
            Restaurar
          </Boton>
        ) : (
          <Boton variante="secundario" tamano={tamano} disabled={!puedeDeshabilitar(r.historial)} aria-label={`Deshabilitar ${folio}`} aria-describedby={puedeDeshabilitar(r.historial) ? undefined : `motivo-${folio}${sufijo}`} className={cx(!puedeDeshabilitar(r.historial) && "border-dashed")} onClick={() => abrir(folio)}>
            Deshabilitar
          </Boton>
        )}
        {!puedeDeshabilitar(r.historial) && !puedeRestaurar(r.historial) && compacto && (
          <p id={`motivo-${folio}${sufijo}`} className="basis-full text-caption text-text-muted">
            {motivoCasoCerradoCorto(r.historial)}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">Moderación de registros</h1>
      <form
        aria-label="Filtrar registros"
        onSubmit={(e) => {
          e.preventDefault();
          setFiltro(borrador);
          setPagina(1);
        }}
        className="grid gap-3 rounded-tarjeta border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] lg:items-end"
      >
        <Selector etiqueta="Estado del caso" marcador="Todos" opciones={ESTADOS_CASO.map((e) => ({ valor: e, etiqueta: e }))} value={borrador.estado} onChange={(e) => setBorrador({ ...borrador, estado: e.target.value })} />
        <Selector etiqueta="Alcaldía" marcador="Todas" opciones={ALCALDIAS.map((a) => ({ valor: a, etiqueta: a }))} value={borrador.alcaldia} onChange={(e) => setBorrador({ ...borrador, alcaldia: e.target.value })} />
        <Boton
          variante="secundario"
          onClick={() => {
            setBorrador(SIN_FILTRO);
            setFiltro(SIN_FILTRO);
            setPagina(1);
          }}
        >
          Limpiar filtros
        </Boton>
        <Boton type="submit">Aplicar filtros</Boton>
      </form>

      {filtrados.length === 0 ? (
        <EstadoVacio icono="pets" titulo="Ningún registro coincide" descripcion="Prueba con otro estado o alcaldía, o limpia los filtros." />
      ) : (
        <div className="@container flex flex-col gap-4">
          {/* Tarjetas (móvil) */}
          <ul className="flex flex-col gap-3 @3xl:hidden">
            {visibles.map((r) => {
              const noDisponible = motivoCasoCerrado(r.historial);
              return (
                <li key={r.caso.folio} data-registro={r.caso.folio} className={cx("flex flex-col gap-3 rounded-tarjeta bg-surface p-4", esDeshabilitado(r.historial) ? "border-2 border-dashed border-border-strong" : "border border-border")}>
                  <div className="flex items-center gap-3">
                    <FotoPerro src={r.caso.fotografiaUrl} alt={`Fotografía de ${r.caso.nombre}`} atenuada={estadoActual(r.historial) === "Cerrado"} />
                    <div className="min-w-0">
                      <h2 className="break-words text-h3 font-semibold">
                        <span className="whitespace-nowrap tabular-nums">{r.caso.folio}</span> · {r.caso.nombre}
                      </h2>
                      <p className="text-small text-text-muted">Fecha de registro: {formatearFechaLocal(r.caso.fechaRegistro)}</p>
                      <p className="text-small text-text-muted">{r.caso.alcaldia}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">{estadoChip(r)}</div>
                  {moderacion(r)}
                  {noDisponible && (
                    <p id={`motivo-${r.caso.folio}`} className="rounded-campo border-2 border-dashed border-border-strong bg-surface-raised p-3 text-small">
                      {noDisponible}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">{acciones(r, false)}</div>
                </li>
              );
            })}
          </ul>
          {/* Tabla compacta (escritorio) */}
          <div className="@max-3xl:hidden rounded-tarjeta border border-border bg-surface">
            <table data-tabla-compacta data-excepcion-tactil="compacto" className="w-full text-small">
              <caption className="sr-only">Registros de extravío</caption>
              <thead>
                <tr className="border-b border-border-strong text-left text-caption font-semibold uppercase tracking-wide text-text-muted">
                  <th scope="col" className="px-3 py-2">Registro</th>
                  <th scope="col" className="px-3 py-2">Fecha de registro</th>
                  <th scope="col" className="px-3 py-2">Alcaldía</th>
                  <th scope="col" className="px-3 py-2">Estado</th>
                  <th scope="col" className="px-3 py-2">Moderación</th>
                  <th scope="col" className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => (
                  <tr key={r.caso.folio} data-registro={r.caso.folio} className="border-b border-border align-top last:border-b-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <FotoPerro src={r.caso.fotografiaUrl} alt={`Fotografía de ${r.caso.nombre}`} lado={48} atenuada={estadoActual(r.historial) === "Cerrado"} />
                        <div className="min-w-0">
                          <p className="font-bold">{r.caso.nombre}</p>
                          <p className="whitespace-nowrap tabular-nums text-text-muted">{r.caso.folio}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">{formatearFechaLocal(r.caso.fechaRegistro)}</td>
                    <td className="px-3 py-2">{r.caso.alcaldia}</td>
                    <td className="px-3 py-2">{estadoChip(r)}</td>
                    <td className="max-w-56 px-3 py-2">{moderacion(r) ?? <span className="text-text-muted">—</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex max-w-48 flex-wrap gap-2">{acciones(r, true)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className="text-small text-text-muted">
              {(paginaActual - 1) * POR_PAGINA + 1}–{(paginaActual - 1) * POR_PAGINA + visibles.length} de {filtrados.length} registros
            </p>
            <Paginacion paginaActual={paginaActual} totalPaginas={total} onCambiarPagina={setPagina} />
          </div>
        </div>
      )}

      <ModalMotivo
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Deshabilitar registro"
        resumen={
          <>
            <p className="whitespace-nowrap text-h3 font-bold tabular-nums">{registroModal.caso.folio}</p>
            <p className="text-small text-text-muted">{registroModal.caso.nombre} · {registroModal.caso.alcaldia}</p>
          </>
        }
        advertencia="El registro pasará a «Cerrado», no generará ficha ni aceptará avistamientos y dejará de consultarse por folio."
        conMotivo
        errorInicial={errorInicial}
        onConfirmar={confirmar}
      />
      {aviso && <Toast mensaje={aviso} onCerrar={() => setAviso(undefined)} />}
    </div>
  );
}
