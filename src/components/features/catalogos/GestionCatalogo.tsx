"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { ChipEstatus } from "@/components/ui/ChipEstatus";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { Paginacion } from "@/components/ui/Paginacion";
import { Toast } from "@/components/ui/Toast";
import { cx } from "@/lib/clases";
import { desactivarElemento, esProtegido, guardarElemento, motivoNoDesactivable, normalizar, type DatosCatalogo } from "@/lib/catalogos";
import { CATALOGOS, type AperturaCatalogo, type ElementoCatalogo, type TipoCatalogo } from "@/mocks/catalogosAdmin";
import { ModalMotivo } from "../moderacion/ModalMotivo";
import { ModalCatalogo } from "./ModalCatalogo";

const POR_PAGINA = 6;

type Apertura = AperturaCatalogo;
type Props = {
  tipo: TipoCatalogo;
  /** Capturas y pruebas: abre ese modal al cargar. */
  modalInicial?: Apertura;
  /** Capturas y pruebas: página con la que abre la lista. */
  paginaInicial?: number;
};

/**
 * Plantilla única de catálogo (ADM-06 a ADM-09, HU 049 a 052): tarjetas en móvil y tabla compacta cuando el contenedor mide 48 rem o más.
 * Los elementos nunca se eliminan: solo se desactivan, y reactivar se hace con «Editar» (R9). Un valor protegido y la última opción activa
 * de una categoría muestran «Desactivar» deshabilitado con su motivo. Los cambios solo viven en esta pantalla.
 */
export function GestionCatalogo({ tipo, modalInicial, paginaInicial = 1 }: Props) {
  const cfg = CATALOGOS[tipo];
  const [items, setItems] = useState<ElementoCatalogo[]>([...cfg.elementos]);
  const [consulta, setConsulta] = useState("");
  const [buscado, setBuscado] = useState("");
  const [pagina, setPagina] = useState(paginaInicial);
  // Los modales quedan montados (cerrados) con el último elemento: así el foco regresa al botón que los abrió.
  const [apertura, setApertura] = useState<Apertura | null>(modalInicial ?? null);
  const [ultima, setUltima] = useState<Apertura>(modalInicial ?? { accion: "nuevo" });
  const [version, setVersion] = useState(0); // el formulario de MOD-11 se monta de nuevo en cada apertura
  const [aviso, setAviso] = useState<string>();

  const nombreCategoria = (id?: number) => cfg.categorias.find((c) => c.id === id)?.nombre;
  const filtrados = items.filter((e) => !buscado || normalizar(e.nombre).includes(normalizar(buscado)));
  const total = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, total);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  const elementoUltima = "id" in ultima ? items.find((e) => e.id === ultima.id) : undefined;
  const estatusTxt = (e: ElementoCatalogo) => (cfg.femenino ? (e.activo ? "Activa" : "Inactiva") : e.activo ? "Activo" : "Inactivo");
  const reactivado = cfg.femenino ? "reactivada" : "reactivado";
  const desactivado = cfg.femenino ? "desactivada" : "desactivado";

  const abrir = (a: Apertura) => {
    if (a.accion !== "desactivar") setVersion((v) => v + 1);
    setUltima(a);
    setApertura(a);
  };

  function guardar(datos: DatosCatalogo) {
    const editando = "id" in ultima && ultima.accion === "editar" ? items.find((e) => e.id === ultima.id) : undefined;
    setItems((l) => guardarElemento(cfg, l, datos, editando));
    setAviso(!editando ? `Se agregó «${datos.nombre.trim()}»` : !editando.activo && datos.activo ? `«${datos.nombre.trim()}» quedó ${reactivado}` : `Se guardaron los cambios de «${datos.nombre.trim()}»`);
    setApertura(null);
  }

  function desactivar() {
    if (!("id" in ultima)) return;
    setItems((l) => desactivarElemento(cfg, l, ultima.id));
    setAviso(`«${elementoUltima?.nombre}» quedó ${desactivado}; los registros existentes se conservan`);
    setApertura(null);
  }

  function acciones(e: ElementoCatalogo, compacto: boolean) {
    const bloqueo = e.activo ? motivoNoDesactivable(cfg, items, e) : undefined;
    const tamano = compacto ? "compacto" : "estandar";
    const idMotivo = `motivo-${cfg.tipo}-${e.id}${compacto ? "-t" : ""}`;
    return (
      <>
        <Boton variante="secundario" tamano={tamano} aria-label={`Editar ${e.nombre}`} onClick={() => abrir({ accion: "editar", id: e.id })}>
          Editar
        </Boton>
        {e.activo && (
          <Boton variante="secundario" tamano={tamano} disabled={Boolean(bloqueo)} aria-label={`Desactivar ${e.nombre}`} aria-describedby={bloqueo ? idMotivo : undefined} className={cx(bloqueo && "border-dashed")} onClick={() => abrir({ accion: "desactivar", id: e.id })}>
            Desactivar
          </Boton>
        )}
        {bloqueo && compacto && (
          <p id={idMotivo} className="basis-full text-caption text-text-muted">
            {bloqueo}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">{cfg.titulo}</h1>
        <Boton className="max-md:w-full" onClick={() => abrir({ accion: "nuevo" })}>
          {cfg.agregar}
        </Boton>
      </div>
      <form
        role="search"
        aria-label={`Buscar en ${cfg.titulo.toLowerCase()}`}
        onSubmit={(ev) => {
          ev.preventDefault();
          setBuscado(consulta.trim());
          setPagina(1);
        }}
        className="flex items-end gap-2"
      >
        <CampoTexto className="min-w-0 flex-1" etiqueta="Buscar" type="search" name="q" placeholder="nombre" autoComplete="off" value={consulta} onChange={(ev) => setConsulta(ev.target.value)} />
        <Boton type="submit" variante="secundario">
          Buscar
        </Boton>
      </form>

      {filtrados.length === 0 ? (
        <EstadoVacio
          icono="pets"
          titulo="Ningún elemento coincide"
          descripcion="Prueba con otro nombre."
          accion={
            <Boton
              variante="secundario"
              onClick={() => {
                setConsulta("");
                setBuscado("");
              }}
            >
              Limpiar búsqueda
            </Boton>
          }
        />
      ) : (
        <div className="@container flex flex-col gap-4">
          {/* Tarjetas (móvil) */}
          <ul className="flex flex-col gap-3 @3xl:hidden">
            {visibles.map((e) => {
              const bloqueo = e.activo ? motivoNoDesactivable(cfg, items, e) : undefined;
              return (
                <li key={e.id} data-elemento={e.id} className={cx("flex flex-col gap-3 rounded-tarjeta bg-surface p-4", e.activo ? "border border-border" : "border-2 border-dashed border-border-strong")}>
                  <div className="flex flex-col gap-1">
                    <h2 className="break-words text-h3 font-semibold">{e.nombre}</h2>
                    {esProtegido(cfg, e) && (
                      <div>
                        <ChipEstatus estatus="Valor protegido" />
                      </div>
                    )}
                    {cfg.conClave && <p className="text-small text-text-muted">{e.clave ? `Clave geoestadística: ${e.clave}` : "Clave geoestadística: sin clave"}</p>}
                    {cfg.conCategoria && <p className="text-small text-text-muted">Categoría: {nombreCategoria(e.idCategoria)}</p>}
                    {cfg.conDescripcion && <p className="break-words text-small">{e.descripcion}</p>}
                  </div>
                  <div>
                    <ChipEstatus estatus={estatusTxt(e) as "Activa" | "Inactiva" | "Activo" | "Inactivo"} />
                  </div>
                  {bloqueo && (
                    <p id={`motivo-${cfg.tipo}-${e.id}`} className="rounded-campo border-2 border-dashed border-border-strong bg-surface-raised p-3 text-small">
                      {bloqueo}
                    </p>
                  )}
                  <div className={cx("grid gap-3", e.activo ? "grid-cols-2" : "grid-cols-1")}>{acciones(e, false)}</div>
                </li>
              );
            })}
          </ul>
          {/* Tabla compacta (escritorio) */}
          <div className="@max-3xl:hidden rounded-tarjeta border border-border bg-surface">
            <table data-tabla-compacta data-excepcion-tactil="compacto" className="w-full text-small">
              <caption className="sr-only">{cfg.titulo}</caption>
              <thead>
                <tr className="border-b border-border-strong text-left text-caption font-semibold uppercase tracking-wide text-text-muted">
                  <th scope="col" className="px-3 py-2">Nombre</th>
                  {cfg.conClave && <th scope="col" className="px-3 py-2">Clave geoestadística</th>}
                  {cfg.conCategoria && <th scope="col" className="px-3 py-2">Categoría</th>}
                  {cfg.conDescripcion && <th scope="col" className="px-3 py-2">Descripción</th>}
                  <th scope="col" className="px-3 py-2">Estatus</th>
                  <th scope="col" className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((e) => (
                  <tr key={e.id} data-elemento={e.id} className="border-b border-border align-top last:border-b-0">
                    <td className="px-3 py-2">
                      <p className="break-words font-bold">{e.nombre}</p>
                      {esProtegido(cfg, e) && <ChipEstatus estatus="Valor protegido" className="mt-1" />}
                    </td>
                    {cfg.conClave && <td className="px-3 py-2 tabular-nums">{e.clave ?? "—"}</td>}
                    {cfg.conCategoria && <td className="px-3 py-2">{nombreCategoria(e.idCategoria)}</td>}
                    {cfg.conDescripcion && <td className="max-w-72 px-3 py-2">{e.descripcion}</td>}
                    <td className="px-3 py-2">
                      <ChipEstatus estatus={estatusTxt(e) as "Activa" | "Inactiva" | "Activo" | "Inactivo"} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex max-w-48 flex-wrap gap-2">{acciones(e, true)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className="text-small text-text-muted">
              {(paginaActual - 1) * POR_PAGINA + 1}–{(paginaActual - 1) * POR_PAGINA + visibles.length} de {filtrados.length} elementos
            </p>
            <Paginacion paginaActual={paginaActual} totalPaginas={total} onCambiarPagina={setPagina} />
          </div>
        </div>
      )}

      <ModalCatalogo
        key={version}
        cfg={cfg}
        items={items}
        elemento={ultima.accion === "editar" ? (elementoUltima ?? null) : null}
        abierto={apertura !== null && apertura.accion !== "desactivar"}
        onCerrar={() => setApertura(null)}
        onGuardar={guardar}
      />
      <ModalMotivo
        abierto={apertura?.accion === "desactivar"}
        onCerrar={() => setApertura(null)}
        titulo={`Desactivar ${cfg.singular}`}
        resumen={<p className="break-words text-h3 font-bold">{elementoUltima?.nombre}</p>}
        advertencia="Dejará de ofrecerse en los formularios; los registros existentes se conservan."
        onConfirmar={desactivar}
      />
      {aviso && <Toast mensaje={aviso} onCerrar={() => setAviso(undefined)} />}
    </div>
  );
}
