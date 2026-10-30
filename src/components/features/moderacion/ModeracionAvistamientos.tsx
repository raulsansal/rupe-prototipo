"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { ChipEstatus } from "@/components/ui/ChipEstatus";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { FotoPerro } from "@/components/ui/FotoPerro";
import { Icono } from "@/components/ui/Icono";
import { Paginacion } from "@/components/ui/Paginacion";
import { Selector } from "@/components/ui/Selector";
import { Toast } from "@/components/ui/Toast";
import { cx } from "@/lib/clases";
import { enviarAdmin, MENSAJE_YA_CAMBIO, urlConPagina } from "@/lib/clienteAdmin";
import { formatearFechaHora } from "@/lib/formato";
import type { ListadoDeAvistamientos } from "@/server/servicios/admin/moderacionAvistamientos";
import { ModalDetalleAvistamiento } from "./ModalDetalleAvistamiento";
import { ModalMotivo } from "./ModalMotivo";

type Avistamiento = ListadoDeAvistamientos["items"][number];

type Props = {
  listado: ListadoDeAvistamientos;
  /** Lo que llegó en la URL (texto tal cual) para repetirlo en el formulario. */
  valores: { estatus: string; desde: string; hasta: string };
  /** Avistamiento cuyo detalle pide la URL (?detalle=): lo entrega el servicio de Administrador; la dirección de la foto de un «Fallecido» viene solo con ?foto=visible. */
  detalle?: Avistamiento;
};

/**
 * ADM-05 (HU 037): avistamientos de todos los casos como tarjetas en móvil y tabla compacta en escritorio. Datos, filtros (GET, validados en el servidor) y páginas vienen del servidor; el
 * detalle se abre por la URL (?detalle=ID). «Ocultar» pide el motivo (MOD-09) y llama a /api/admin/avistamientos/[id]/moderacion; lo oculto se restaura con su propio botón y la restauración limpia
 * el motivo (decisión D12). Un avistamiento «Fallecido» nunca muestra su fotografía en la lista ni en la tabla.
 */
export function ModeracionAvistamientos({ listado, valores, detalle }: Props) {
  const router = useRouter();
  const enviando = useRef(false);
  const { items, pagina, totalPaginas, total, porPagina, errores, filtros } = listado;
  const hayFiltros = Boolean(valores.estatus || valores.desde || valores.hasta);
  const parametros = { estatus: filtros.estatus, desde: filtros.desde, hasta: filtros.hasta };
  const base = urlConPagina("/admin/avistamientos", parametros, pagina);
  const conDetalle = (id: number, foto = false) => `${base}${base.includes("?") ? "&" : "?"}detalle=${id}${foto ? "&foto=visible" : ""}`;
  // El modal de ocultar queda montado (cerrado) con el último avistamiento: así el foco regresa al botón que lo abrió.
  const [ultimo, setUltimo] = useState<number>(items[0]?.id ?? 0);
  const [ocultando, setOcultando] = useState(false);
  const [aviso, setAviso] = useState<string>();
  const actual = items.find((a) => a.id === ultimo) ?? items[0];

  async function enviar(id: number, cuerpo: { accion: "ocultar"; motivo: string } | { accion: "restaurar" }): Promise<boolean> {
    if (enviando.current) return false; // doble clic o Enter repetido: una sola petición
    enviando.current = true;
    try {
      const r = await enviarAdmin(`/api/admin/avistamientos/${id}/moderacion`, "POST", cuerpo);
      if (r.ok) {
        setAviso(cuerpo.accion === "ocultar" ? `Avistamiento ${id} ocultado: dejó de verse en el historial de la persona tutora` : `Avistamiento ${id} restaurado: vuelve a verse en el historial de la persona tutora`);
        router.refresh();
        return true;
      }
      if (r.estado === 409) {
        setAviso(`El avistamiento ${id}: ${MENSAJE_YA_CAMBIO.charAt(0).toLowerCase()}${MENSAJE_YA_CAMBIO.slice(1)}`);
        router.refresh();
        return true;
      }
      if (r.estado === 401 || r.estado === 403 || r.estado === 404) {
        router.refresh();
        return true;
      }
      setAviso(r.mensaje ?? "No se pudo completar la acción.");
      return false;
    } finally {
      enviando.current = false;
    }
  }

  const abrirOcultar = (id: number) => {
    setUltimo(id);
    setOcultando(true);
  };
  async function ocultar(motivo: string) {
    if (await enviar(ultimo, { accion: "ocultar", motivo })) setOcultando(false);
  }

  function cerrarDetalle() {
    const id = detalle?.id;
    router.push(base);
    setTimeout(() => document.querySelector<HTMLElement>(`[data-avistamiento="${id}"] [data-ver-detalle]`)?.focus(), 150); // el foco vuelve al enlace que lo abrió
  }

  function miniatura(a: Avistamiento, lado: number) {
    // La fotografía de un «Fallecido» nunca se muestra en listas: solo en el detalle, tras «Ver fotografía».
    if (a.fallecido || !a.fotografiaUrl)
      return (
        <span aria-label="Fotografía oculta: contenido sensible" role="img" className="flex shrink-0 items-center justify-center rounded-campo border border-border bg-disabled-bg text-text-muted" style={{ width: lado, height: lado }}>
          <Icono nombre="visibility_off" tamano={lado > 60 ? 28 : 20} />
        </span>
      );
    return <FotoPerro src={a.fotografiaUrl} alt="Fotografía del avistamiento" lado={lado} atenuada={!a.visible} />;
  }

  function moderacion(a: Avistamiento) {
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

  function acciones(a: Avistamiento, compacto: boolean) {
    const tamano = compacto ? "compacto" : "estandar";
    return (
      <>
        <Link href={conDetalle(a.id)} prefetch={false} scroll={false} data-ver-detalle aria-label={`Ver detalle del avistamiento ${a.id}`} className={clasesBoton({ variante: "secundario", tamano, className: "text-center" })}>
          Ver detalle
        </Link>
        {a.visible ? (
          <Boton variante="secundario" tamano={tamano} aria-label={`Ocultar el avistamiento ${a.id}`} onClick={() => abrirOcultar(a.id)}>
            Ocultar
          </Boton>
        ) : (
          <Boton tamano={tamano} aria-label={`Restaurar el avistamiento ${a.id}`} onClick={() => enviar(a.id, { accion: "restaurar" })}>
            Restaurar
          </Boton>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">Moderación de avistamientos</h1>
      <form key={`${valores.estatus}|${valores.desde}|${valores.hasta}`} method="get" action="/admin/avistamientos" noValidate aria-label="Filtrar avistamientos" className="grid gap-3 rounded-tarjeta border border-border bg-surface p-4 lg:grid-cols-[14rem_minmax(0,1fr)_auto_auto] lg:items-start">
        <Selector
          name="estatus"
          etiqueta="Estatus"
          marcador="Todos"
          opciones={[
            { valor: "visible", etiqueta: "Visible" },
            { valor: "oculto", etiqueta: "Oculto" },
          ]}
          defaultValue={valores.estatus}
          error={errores.estatus}
        />
        <fieldset className="grid min-w-0 grid-cols-2 gap-3">
          <legend className="mb-1 text-small font-semibold">Fecha</legend>
          <CampoTexto name="desde" etiqueta="Desde" type="date" defaultValue={valores.desde} error={errores.desde} />
          <CampoTexto id="filtro-av-hasta" name="hasta" etiqueta="Hasta" type="date" defaultValue={valores.hasta} error={errores.hasta} />
        </fieldset>
        <Link href="/admin/avistamientos" className={clasesBoton({ variante: "secundario", className: "lg:mt-7" })}>
          Limpiar filtros
        </Link>
        <Boton type="submit" className="lg:mt-7">
          Aplicar filtros
        </Boton>
      </form>

      {total === 0 ? (
        hayFiltros ? (
          <EstadoVacio icono="visibility" titulo="Ningún avistamiento coincide" descripcion="Prueba con otro estatus o rango de fechas, o limpia los filtros." />
        ) : (
          <EstadoVacio icono="visibility" titulo="Aún no hay avistamientos" descripcion="Cuando alguien reporte un avistamiento, aparecerá aquí." />
        )
      ) : (
        <div className="@container flex flex-col gap-4">
          {/* Tarjetas (móvil) */}
          <ul className="flex flex-col gap-3 @3xl:hidden">
            {items.map((a) => (
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
                {items.map((a) => (
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
              {(pagina - 1) * porPagina + 1}–{(pagina - 1) * porPagina + items.length} de {total} avistamientos
            </p>
            <Paginacion paginaActual={pagina} totalPaginas={totalPaginas} onCambiarPagina={(n) => router.push(urlConPagina("/admin/avistamientos", parametros, n))} />
          </div>
        </div>
      )}

      {actual && (
        <ModalMotivo
          abierto={ocultando}
          onCerrar={() => setOcultando(false)}
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
          onConfirmar={ocultar}
        />
      )}
      {detalle && <ModalDetalleAvistamiento avistamiento={detalle} abierto onCerrar={cerrarDetalle} hrefRevelar={conDetalle(detalle.id, true)} hrefOcultar={conDetalle(detalle.id)} />}
      {aviso && <Toast mensaje={aviso} onCerrar={() => setAviso(undefined)} />}
    </div>
  );
}
