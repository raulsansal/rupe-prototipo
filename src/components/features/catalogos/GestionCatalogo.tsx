"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { REGLAS_CATALOGO } from "@/config/catalogos";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { ChipEstatus } from "@/components/ui/ChipEstatus";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { Paginacion } from "@/components/ui/Paginacion";
import { Toast } from "@/components/ui/Toast";
import { cx } from "@/lib/clases";
import { enviarAdmin, MENSAJE_YA_CAMBIO, urlConPagina } from "@/lib/clienteAdmin";
import type { CatalogoAdmin } from "@/server/serializadores/admin";
import type { ListadoDeCatalogo } from "@/server/servicios/admin/catalogosAdmin";
import { ModalMotivo } from "../moderacion/ModalMotivo";
import { ModalCatalogo, type DatosFormulario, type ResultadoGuardado } from "./ModalCatalogo";

type Apertura = { accion: "nuevo" } | { accion: "editar" | "desactivar"; id: number };
type Props = {
  listado: ListadoDeCatalogo;
  /** Lo que llegó en la URL (texto tal cual) para repetirlo en el formulario. */
  valores: { q: string };
};

/**
 * Plantilla única de catálogo (ADM-06 a ADM-09, HU 049 a 052): tarjetas en móvil y tabla compacta cuando el contenedor mide 48 rem o más. La lista, la búsqueda y las páginas de 6 vienen del
 * servidor por la URL. Los elementos nunca se eliminan: solo se desactivan, y reactivar se hace con «Editar» (R9). Un valor protegido y la última opción activa muestran «Desactivar»
 * deshabilitado con el motivo que entrega el servidor. Cada acción llama a /api/admin/catalogos y refresca con el estado real.
 */
export function GestionCatalogo({ listado, valores }: Props) {
  const router = useRouter();
  const enviando = useRef(false);
  const { tipo, items, categorias, pagina, totalPaginas, total, porPagina, filtros } = listado;
  const cfg = REGLAS_CATALOGO[tipo];
  // Los modales quedan montados (cerrados) con el último elemento: así el foco regresa al botón que los abrió.
  const [apertura, setApertura] = useState<Apertura | null>(null);
  const [ultima, setUltima] = useState<Apertura>({ accion: "nuevo" });
  const [version, setVersion] = useState(0); // el formulario de MOD-11 se monta de nuevo en cada apertura
  const [aviso, setAviso] = useState<string>();

  const estatusTxt = (e: CatalogoAdmin) => (cfg.femenino ? (e.activo ? "Activa" : "Inactiva") : e.activo ? "Activo" : "Inactivo");
  const reactivado = cfg.femenino ? "reactivada" : "reactivado";
  const desactivado = cfg.femenino ? "desactivada" : "desactivado";
  const elementoUltima = "id" in ultima ? items.find((e) => e.id === ultima.id) : undefined;
  const hayBusqueda = Boolean(valores.q || filtros.texto);

  const abrir = (a: Apertura) => {
    if (a.accion !== "desactivar") setVersion((v) => v + 1);
    setUltima(a);
    setApertura(a);
  };

  async function guardar(datos: DatosFormulario): Promise<ResultadoGuardado> {
    if (enviando.current) return { ok: false }; // doble clic o Enter repetido: una sola petición
    enviando.current = true;
    try {
      const editando = ultima.accion === "editar" && "id" in ultima ? ultima.id : undefined;
      const r = editando === undefined ? await enviarAdmin(`/api/admin/catalogos/${tipo}`, "POST", datos) : await enviarAdmin(`/api/admin/catalogos/${tipo}/${editando}`, "PUT", datos);
      if (r.ok) {
        const nombre = String((r.datos?.item as { nombre?: string } | undefined)?.nombre ?? datos.nombre);
        setAviso(editando === undefined ? `Se agregó «${nombre}»` : r.datos?.sinCambios ? "No hay cambios por guardar: no se guardó nada" : r.datos?.reactivado ? `«${nombre}» quedó ${reactivado}` : `Se guardaron los cambios de «${nombre}»`);
        setApertura(null);
        router.refresh();
        return { ok: true };
      }
      if (r.estado === 401 || r.estado === 403 || r.estado === 404) {
        setApertura(null);
        router.refresh();
        return { ok: true };
      }
      return { ok: false, campos: r.campos, codigo: r.codigo, mensaje: r.mensaje ?? "No se pudo guardar. Inténtalo de nuevo." };
    } finally {
      enviando.current = false;
    }
  }

  async function desactivar() {
    if (!("id" in ultima) || enviando.current) return;
    enviando.current = true;
    try {
      const r = await enviarAdmin(`/api/admin/catalogos/${tipo}/${ultima.id}/desactivar`, "POST", undefined);
      if (r.ok) setAviso(`«${elementoUltima?.nombre}» quedó ${desactivado}; los registros existentes se conservan`);
      else if (r.codigo === "YA_DESACTIVADO") setAviso(`«${elementoUltima?.nombre}» ${MENSAJE_YA_CAMBIO.charAt(0).toLowerCase()}${MENSAJE_YA_CAMBIO.slice(1)}`);
      else setAviso(r.estado === 409 ? (r.mensaje ?? MENSAJE_YA_CAMBIO) : (r.mensaje ?? "No se pudo desactivar. Inténtalo de nuevo."));
      setApertura(null);
      router.refresh();
    } finally {
      enviando.current = false;
    }
  }

  function acciones(e: CatalogoAdmin, compacto: boolean) {
    const bloqueo = e.activo ? e.motivoNoDesactivable : undefined;
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
      <form key={valores.q} method="get" action={cfg.ruta} role="search" aria-label={`Buscar en ${cfg.titulo.toLowerCase()}`} className="flex items-end gap-2">
        <CampoTexto className="min-w-0 flex-1" etiqueta="Buscar" type="search" name="q" placeholder="nombre" autoComplete="off" defaultValue={valores.q} />
        <Boton type="submit" variante="secundario">
          Buscar
        </Boton>
      </form>

      {total === 0 ? (
        <EstadoVacio
          icono="pets"
          titulo={hayBusqueda ? "Ningún elemento coincide" : "Aún no hay elementos"}
          descripcion={hayBusqueda ? "Prueba con otro nombre." : `Agrega ${cfg.femenino ? "la primera" : "el primero"} con «${cfg.agregar}».`}
          accion={
            hayBusqueda ? (
              <Link href={cfg.ruta} className={clasesBoton({ variante: "secundario" })}>
                Limpiar búsqueda
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="@container flex flex-col gap-4">
          {/* Tarjetas (móvil) */}
          <ul className="flex flex-col gap-3 @3xl:hidden">
            {items.map((e) => (
              <li key={e.id} data-elemento={e.id} className={cx("flex flex-col gap-3 rounded-tarjeta bg-surface p-4", e.activo ? "border border-border" : "border-2 border-dashed border-border-strong")}>
                <div className="flex flex-col gap-1">
                  <h2 className="break-words text-h3 font-semibold">{e.nombre}</h2>
                  {e.protegido && (
                    <div>
                      <ChipEstatus estatus="Valor protegido" />
                    </div>
                  )}
                  {cfg.conClave && <p className="text-small text-text-muted">{e.clave ? `Clave geoestadística: ${e.clave}` : "Clave geoestadística: sin clave"}</p>}
                  {cfg.conCategoria && <p className="text-small text-text-muted">Categoría: {e.categoria}</p>}
                  {cfg.conDescripcion && <p className="break-words text-small">{e.descripcion}</p>}
                </div>
                <div>
                  <ChipEstatus estatus={estatusTxt(e) as "Activa" | "Inactiva" | "Activo" | "Inactivo"} />
                </div>
                {e.activo && e.motivoNoDesactivable && (
                  <p id={`motivo-${cfg.tipo}-${e.id}`} className="rounded-campo border-2 border-dashed border-border-strong bg-surface-raised p-3 text-small">
                    {e.motivoNoDesactivable}
                  </p>
                )}
                <div className={cx("grid gap-3", e.activo ? "grid-cols-2" : "grid-cols-1")}>{acciones(e, false)}</div>
              </li>
            ))}
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
                {items.map((e) => (
                  <tr key={e.id} data-elemento={e.id} className="border-b border-border align-top last:border-b-0">
                    <td className="px-3 py-2">
                      <p className="break-words font-bold">{e.nombre}</p>
                      {e.protegido && <ChipEstatus estatus="Valor protegido" className="mt-1" />}
                    </td>
                    {cfg.conClave && <td className="px-3 py-2 tabular-nums">{e.clave ?? "—"}</td>}
                    {cfg.conCategoria && <td className="px-3 py-2">{e.categoria}</td>}
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
              {(pagina - 1) * porPagina + 1}–{(pagina - 1) * porPagina + items.length} de {total} elementos
            </p>
            <Paginacion paginaActual={pagina} totalPaginas={totalPaginas} onCambiarPagina={(n) => router.push(urlConPagina(cfg.ruta, { q: filtros.texto }, n))} />
          </div>
        </div>
      )}

      <ModalCatalogo
        key={version}
        cfg={cfg}
        categorias={categorias}
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
        advertencia="Dejará de ofrecerse en los formularios nuevos; los registros existentes se conservan."
        onConfirmar={desactivar}
      />
      {aviso && <Toast mensaje={aviso} onCerrar={() => setAviso(undefined)} />}
    </div>
  );
}
