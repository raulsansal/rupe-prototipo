"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { urlConPagina } from "@/lib/clienteAdmin";
import { formatearFechaHora, formatearFechaLocal } from "@/lib/formato";
import type { ListadoDeRegistros } from "@/server/servicios/admin/moderacionRegistros";
import { ModalMotivo } from "./ModalMotivo";
import { useAccionRegistro } from "./useAccionRegistro";

type Registro = ListadoDeRegistros["items"][number];

type Props = {
  listado: ListadoDeRegistros;
  /** Lo que llegó en la URL (texto tal cual) para repetirlo en el formulario. */
  valores: { estado: string; alcaldia: string };
};

const SIN_ACCION = "Cerrado tras una localización confirmada: no puede deshabilitarse ni restaurarse.";
const motivoCerrado = (r: Registro) => (r.puedeDeshabilitar || r.puedeRestaurar ? undefined : r.cierre === "cancelación" ? "Cancelado por la persona tutora: no puede deshabilitarse ni restaurarse." : SIN_ACCION);
const motivoCerradoCorto = (r: Registro) => (motivoCerrado(r) ? (r.cierre === "cancelación" ? "Cancelado por la persona tutora" : "Cerrado tras localización confirmada") : undefined);

/**
 * ADM-04 (HU 018): casos del sistema como tarjetas en móvil y tabla compacta cuando el contenedor mide 48 rem o más. Los datos, los filtros (GET, validados en el servidor) y las páginas
 * vienen del servidor. «Deshabilitar» pide el motivo (MOD-08) y solo existe para casos que no están en «Cerrado»; «Restaurar» solo para los cerrados por deshabilitación y devuelve el caso al
 * estado previo. Cada acción llama a /api/admin/registros/[folio]/moderacion y refresca la pantalla; si el caso ya había cambiado (409) avisa y muestra el estado real.
 */
export function ModeracionRegistros({ listado, valores }: Props) {
  const router = useRouter();
  const { items, pagina, totalPaginas, total, porPagina, errores } = listado;
  const hayFiltros = Boolean(valores.estado || valores.alcaldia);
  // El modal queda montado (cerrado) con el último folio: así el foco regresa al botón que lo abrió.
  const [ultimo, setUltimo] = useState<string>(items[0]?.folio ?? "");
  const [abierto, setAbierto] = useState(false);
  const { accionar, aviso, setAviso } = useAccionRegistro();
  const registroModal = items.find((r) => r.folio === ultimo) ?? items[0];

  const abrir = (folio: string) => {
    setUltimo(folio);
    setAbierto(true);
  };
  async function confirmar(motivo: string) {
    if (await accionar(ultimo, { accion: "deshabilitar", motivo })) setAbierto(false);
  }

  const estadoChip = (r: Registro) => <ChipEstado estado={r.estado} texto={r.cierre === "deshabilitación" ? "Cerrado (deshabilitado)" : undefined} />;

  function moderacion(r: Registro) {
    if (!r.moderacion) return null;
    return (
      <div className="text-small">
        <p className="break-words">
          <span className="font-semibold">Motivo de moderación:</span> {r.moderacion.motivo}
        </p>
        <p className="text-text-muted">Deshabilitado el {formatearFechaHora(r.moderacion.fechaHora)}</p>
      </div>
    );
  }

  function acciones(r: Registro, compacto: boolean) {
    const folio = r.folio;
    const tamano = compacto ? "compacto" : "estandar";
    const sufijo = compacto ? "-t" : "";
    return (
      <>
        <Link href={`/admin/registros/${folio}`} aria-label={`Ver detalle de ${folio}`} className={clasesBoton({ variante: "secundario", tamano, className: "text-center" })}>
          Ver detalle
        </Link>
        {r.puedeRestaurar ? (
          <Boton tamano={tamano} aria-label={`Restaurar ${folio}`} onClick={() => accionar(folio, { accion: "restaurar" })}>
            Restaurar
          </Boton>
        ) : (
          <Boton
            variante="secundario"
            tamano={tamano}
            disabled={!r.puedeDeshabilitar}
            aria-label={`Deshabilitar ${folio}`}
            aria-describedby={r.puedeDeshabilitar ? undefined : `motivo-${folio}${sufijo}`}
            className={cx(compacto && "text-center")}
            onClick={() => abrir(folio)}
          >
            Deshabilitar
          </Boton>
        )}
        {!r.puedeDeshabilitar && !r.puedeRestaurar && compacto && (
          <p id={`motivo-${folio}${sufijo}`} className="basis-full text-caption text-text-muted">
            {motivoCerradoCorto(r)}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">Moderación de registros</h1>
      <form key={`${valores.estado}|${valores.alcaldia}`} method="get" action="/admin/registros" noValidate aria-label="Filtrar registros" className="grid gap-3 rounded-tarjeta border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] lg:items-end">
        <Selector name="estado" etiqueta="Estado del caso" marcador="Todos" opciones={listado.estados.map((e) => ({ valor: e, etiqueta: e }))} defaultValue={valores.estado} error={errores.estado} />
        <Selector name="alcaldia" etiqueta="Alcaldía" marcador="Todas" opciones={listado.alcaldias.map((a) => ({ valor: String(a.id), etiqueta: a.nombre }))} defaultValue={valores.alcaldia} error={errores.alcaldia} />
        <Link href="/admin/registros" className={clasesBoton({ variante: "secundario" })}>
          Limpiar filtros
        </Link>
        <Boton type="submit">Aplicar filtros</Boton>
      </form>

      {total === 0 ? (
        hayFiltros ? (
          <EstadoVacio icono="pets" titulo="Ningún registro coincide" descripcion="Prueba con otro estado o alcaldía, o limpia los filtros." />
        ) : (
          <EstadoVacio icono="pets" titulo="Aún no hay registros" descripcion="Cuando una persona tutora registre un extravío, aparecerá aquí." />
        )
      ) : (
        <div className="@container flex flex-col gap-4">
          {/* Tarjetas (móvil) */}
          <ul className="flex flex-col gap-3 @3xl:hidden">
            {items.map((r) => {
              const noDisponible = motivoCerrado(r);
              return (
                <li key={r.folio} data-registro={r.folio} className={cx("flex flex-col gap-3 rounded-tarjeta bg-surface p-4", r.cierre === "deshabilitación" ? "border-2 border-dashed border-border-strong" : "border border-border")}>
                  <div className="flex items-center gap-3">
                    <FotoPerro src={r.fotografiaUrl} alt={`Fotografía de ${r.nombre}`} atenuada={r.estado === "Cerrado"} />
                    <div className="min-w-0">
                      <h2 className="break-words text-h3 font-semibold">
                        <span className="whitespace-nowrap tabular-nums">{r.folio}</span> · {r.nombre}
                      </h2>
                      <p className="text-small text-text-muted">Fecha de registro: {formatearFechaLocal(r.fechaRegistro)}</p>
                      <p className="text-small text-text-muted">{r.alcaldia}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">{estadoChip(r)}</div>
                  {moderacion(r)}
                  {noDisponible && (
                    <p id={`motivo-${r.folio}`} className="rounded-campo border-2 border-dashed border-border-strong bg-surface-raised p-3 text-small">
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
                {items.map((r) => (
                  <tr key={r.folio} data-registro={r.folio} className="border-b border-border align-top last:border-b-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <FotoPerro src={r.fotografiaUrl} alt={`Fotografía de ${r.nombre}`} lado={48} atenuada={r.estado === "Cerrado"} />
                        <div className="min-w-0">
                          <p className="font-bold">{r.nombre}</p>
                          <p className="whitespace-nowrap tabular-nums text-text-muted">{r.folio}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">{formatearFechaLocal(r.fechaRegistro)}</td>
                    <td className="px-3 py-2">{r.alcaldia}</td>
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
              {(pagina - 1) * porPagina + 1}–{(pagina - 1) * porPagina + items.length} de {total} registros
            </p>
            <Paginacion paginaActual={pagina} totalPaginas={totalPaginas} onCambiarPagina={(n) => router.push(urlConPagina("/admin/registros", { estado: listado.filtros.estado, alcaldia: listado.filtros.alcaldia === undefined ? undefined : String(listado.filtros.alcaldia) }, n))} />
          </div>
        </div>
      )}

      {registroModal && (
        <ModalMotivo
          abierto={abierto}
          onCerrar={() => setAbierto(false)}
          titulo="Deshabilitar registro"
          resumen={
            <>
              <p className="whitespace-nowrap text-h3 font-bold tabular-nums">{registroModal.folio}</p>
              <p className="text-small text-text-muted">{registroModal.nombre} · {registroModal.alcaldia}</p>
            </>
          }
          advertencia="El registro pasará a «Cerrado», no generará ficha ni aceptará avistamientos y dejará de consultarse por folio."
          conMotivo
          onConfirmar={confirmar}
        />
      )}
      {aviso && <Toast mensaje={aviso} onCerrar={() => setAviso(undefined)} />}
    </div>
  );
}
