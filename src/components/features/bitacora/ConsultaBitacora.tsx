"use client";

import { useState } from "react";
import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Chip } from "@/components/ui/Chip";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { Selector } from "@/components/ui/Selector";
import { filtrarBitacora, SIN_FILTRO_BITACORA, type FiltroBitacora } from "@/lib/bitacora";
import { formatearFechaHora } from "@/lib/formato";
import { TIPOS_ACCION, type AccionBitacora } from "@/mocks/bitacora";

const POR_PAGINA = 8;
const TONO_TIPO = "bg-surface-raised text-text border! border-border-strong!";

/** Los folios no se parten; los demás identificadores (p. ej. «expiracion_token_minutos» o «Estados del animal · 16») se ajustan a la celda. */
const claseId = (id: string) => (id.startsWith("RUPE-") ? "whitespace-nowrap tabular-nums" : "[overflow-wrap:anywhere]");

type Props = {
  acciones: readonly AccionBitacora[];
  /** Capturas y pruebas: página con la que abre la lista. */
  paginaInicial?: number;
  /** Capturas y pruebas: filtro con el que abre la lista (p. ej. uno sin resultados). */
  filtroInicial?: FiltroBitacora;
};

/**
 * ADM-12 (HU 058): bitácora de solo consulta, inmutable (sin editar ni eliminar). Tarjetas en móvil y tabla de ocho columnas en escritorio.
 * El motivo aparece solo en «deshabilitar caso» y «ocultar avistamiento»; el detalle (anterior → nuevo), en cambios de rol, de parámetros y de catálogos.
 */
export function ConsultaBitacora({ acciones, paginaInicial = 1, filtroInicial = SIN_FILTRO_BITACORA }: Props) {
  const [borrador, setBorrador] = useState<FiltroBitacora>(filtroInicial);
  const [filtro, setFiltro] = useState<FiltroBitacora>(filtroInicial);
  const [errorFechas, setErrorFechas] = useState<string>();
  const [pagina, setPagina] = useState(paginaInicial);

  const filtradas = filtrarBitacora(filtro, acciones);
  const total = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, total);
  const visibles = filtradas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  function aplicar() {
    if (borrador.desde && borrador.hasta && borrador.hasta < borrador.desde) {
      setErrorFechas("«Hasta» no puede ser anterior a «Desde».");
      return document.getElementById("filtro-bitacora-hasta")?.focus();
    }
    setErrorFechas(undefined);
    setFiltro(borrador);
    setPagina(1);
  }

  const ausente = <span className="text-text-muted">—</span>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">Bitácora de acciones</h1>
      <Alerta tipo="info" titulo="Solo consulta">
        La bitácora es de solo consulta: los registros no pueden editarse ni eliminarse.
      </Alerta>
      <form
        aria-label="Filtrar la bitácora"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar();
        }}
        className="grid gap-3 rounded-tarjeta border border-border bg-surface p-4 lg:grid-cols-[16rem_minmax(0,1fr)_auto_auto] lg:items-start"
      >
        <Selector
          etiqueta="Tipo de acción"
          marcador="Todos"
          opciones={TIPOS_ACCION.map((t) => ({ valor: t, etiqueta: t }))}
          value={borrador.tipo}
          onChange={(e) => setBorrador({ ...borrador, tipo: e.target.value as FiltroBitacora["tipo"] })}
        />
        <fieldset className="grid min-w-0 grid-cols-2 gap-3">
          <legend className="mb-1 text-small font-semibold">Fecha</legend>
          <CampoTexto etiqueta="Desde" type="date" value={borrador.desde} onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })} />
          <CampoTexto id="filtro-bitacora-hasta" etiqueta="Hasta" type="date" value={borrador.hasta} onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })} error={errorFechas} />
        </fieldset>
        <Boton
          variante="secundario"
          className="lg:mt-7"
          onClick={() => {
            setBorrador(SIN_FILTRO_BITACORA);
            setFiltro(SIN_FILTRO_BITACORA);
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

      {filtradas.length === 0 ? (
        <EstadoVacio icono="search" titulo="Sin resultados" descripcion="No hay acciones registradas con los filtros seleccionados. Prueba con otro tipo o rango de fechas, o limpia los filtros." />
      ) : (
        <div className="@container flex flex-col gap-4">
          {/* Tarjetas (móvil) */}
          <ul className="flex flex-col gap-3 @4xl:hidden">
            {visibles.map((a) => (
              <li key={a.id} data-accion={a.id} className="flex flex-col gap-2 rounded-tarjeta border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-h3 font-semibold">Acción {a.id}</h2>
                  <Chip tono={TONO_TIPO}>{a.tipo}</Chip>
                </div>
                <p className="text-small text-text-muted">
                  {formatearFechaHora(a.fechaHora)} · {a.administrador}
                </p>
                <p className="break-words text-small">
                  Entidad afectada: {a.entidad} · <span className={claseId(a.idEntidad)}>{a.idEntidad}</span>
                </p>
                {a.motivo && (
                  <p className="break-words text-small">
                    <span className="font-bold">Motivo</span> {a.motivo}
                  </p>
                )}
                {a.detalle && (
                  <p className="break-words text-small">
                    <span className="font-bold">Detalle</span> {a.detalle}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {/* Tabla de ocho columnas (escritorio) */}
          <div className="@max-4xl:hidden rounded-tarjeta border border-border bg-surface">
            <table data-tabla-compacta data-excepcion-tactil="compacto" className="w-full table-fixed text-small">
              <caption className="sr-only">Acciones administrativas registradas</caption>
              <colgroup>
                <col className="w-12" />
                <col className="w-28" />
                <col className="w-28" />
                <col className="w-28" />
                <col className="w-36" />
                <col />
                <col />
                <col className="w-32" />
              </colgroup>
              <thead>
                <tr className="border-b border-border-strong text-left text-caption font-semibold uppercase tracking-wide text-text-muted">
                  <th scope="col" className="px-2 py-2">ID</th>
                  <th scope="col" className="px-2 py-2">Fecha y hora</th>
                  <th scope="col" className="px-2 py-2">Tipo de acción</th>
                  <th scope="col" className="px-2 py-2">Entidad</th>
                  <th scope="col" className="px-2 py-2">ID de la entidad</th>
                  <th scope="col" className="px-2 py-2">Motivo</th>
                  <th scope="col" className="px-2 py-2">Detalle</th>
                  <th scope="col" className="px-2 py-2">Administrador</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((a) => (
                  <tr key={a.id} data-accion={a.id} className="border-b border-border align-top last:border-b-0">
                    <td className="px-2 py-2 font-bold tabular-nums">{a.id}</td>
                    <td className="min-w-0 px-2 py-2">{formatearFechaHora(a.fechaHora)}</td>
                    <td className="min-w-0 break-words px-2 py-2">{a.tipo}</td>
                    <td className="min-w-0 whitespace-nowrap px-2 py-2">{a.entidad}</td>
                    <td className="min-w-0 px-2 py-2">
                      <span className={claseId(a.idEntidad)}>{a.idEntidad}</span>
                    </td>
                    <td className="min-w-0 break-words px-2 py-2">{a.motivo ?? ausente}</td>
                    <td className="min-w-0 break-words px-2 py-2">{a.detalle ?? ausente}</td>
                    <td className="min-w-0 break-words px-2 py-2">{a.administrador}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className="text-small text-text-muted">
              {(paginaActual - 1) * POR_PAGINA + 1}–{(paginaActual - 1) * POR_PAGINA + visibles.length} de {filtradas.length} acciones
            </p>
            <nav aria-label="Paginación" className="flex items-center gap-3">
              <Boton variante="secundario" disabled={paginaActual <= 1} onClick={() => setPagina(paginaActual - 1)}>
                Anterior
              </Boton>
              <span className="text-small font-semibold">
                Página {paginaActual} de {total}
              </span>
              <Boton variante="secundario" disabled={paginaActual >= total} onClick={() => setPagina(paginaActual + 1)}>
                Siguiente
              </Boton>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
