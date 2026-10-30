"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { ChipEstatus } from "@/components/ui/ChipEstatus";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Paginacion } from "@/components/ui/Paginacion";
import { Selector } from "@/components/ui/Selector";
import { Toast } from "@/components/ui/Toast";
import { cx } from "@/lib/clases";
import { enviarAdmin, MENSAJE_YA_CAMBIO, urlConPagina } from "@/lib/clienteAdmin";
import { formatearFechaHora } from "@/lib/formato";
import type { Rol } from "@/mocks/usuarios";
import type { UsuarioAdmin } from "@/server/serializadores/admin";
import type { ListadoDeUsuarios } from "@/server/servicios/admin/usuariosAdmin";
import { ModalUsuario, type AccionUsuario } from "./ModalUsuario";

const MOTIVO_ULTIMO_ADMIN = "Último administrador activo: no se puede deshabilitar ni cambiar su rol.";

type Props = {
  listado: ListadoDeUsuarios;
  /** Lo que llegó en la URL (texto tal cual) para repetirlo en el formulario. */
  valores: { q: string; estatus: string };
};

/**
 * ADM-03 (HU 008 y 009): usuarios como tarjetas en móvil y tabla (compacta) cuando el contenedor mide 48 rem o más. Búsqueda, filtro de estatus y páginas de 5 viven en la URL y el servidor los
 * valida. Cada acción llama a /api/admin/usuarios y refresca con el estado real. El último administrador activo no puede deshabilitarse ni cambiar de rol (R21): sus acciones van deshabilitadas
 * con su motivo a la vista. Sobre la propia cuenta el modal pide confirmación explícita y, al confirmar, la sesión se cierra y se lleva a iniciar sesión.
 */
export function GestionUsuarios({ listado, valores }: Props) {
  const router = useRouter();
  const enviando = useRef(false);
  const { items: usuarios, pagina, totalPaginas, total, porPagina, errores, filtros } = listado;
  const [modal, setModal] = useState<{ id: number; accion: AccionUsuario } | null>(null);
  // El modal queda montado (cerrado) con el último usuario y acción: así el foco regresa al botón que lo abrió.
  const [ultimo, setUltimo] = useState<{ id: number; accion: AccionUsuario }>({ id: usuarios[0]?.id ?? 0, accion: "rol" });
  const [aviso, setAviso] = useState<string>();
  const [errorModal, setErrorModal] = useState<string>();
  const abrir = (m: { id: number; accion: AccionUsuario }) => {
    setUltimo(m);
    setErrorModal(undefined);
    setModal(m);
  };
  const usuarioModal = usuarios.find((u) => u.id === ultimo.id) ?? usuarios[0];

  async function confirmar(accion: AccionUsuario, rolNuevo?: Rol, confirmarSesionPropia?: boolean) {
    if (!modal || enviando.current) return; // doble clic o Enter repetido: una sola petición
    enviando.current = true;
    const nombre = usuarioModal.nombreCompleto;
    try {
      const r =
        accion === "rol"
          ? await enviarAdmin(`/api/admin/usuarios/${modal.id}/rol`, "PUT", { rol: rolNuevo, ...(confirmarSesionPropia ? { confirmarSesionPropia: true } : {}) })
          : await enviarAdmin(`/api/admin/usuarios/${modal.id}/estatus`, "POST", { accion, ...(confirmarSesionPropia ? { confirmarSesionPropia: true } : {}) });
      if (r.ok) {
        const cerradas = Number(r.datos?.sesionesCerradas ?? 0);
        if (r.datos?.cerroSuPropiaSesion) return router.push("/acceso"); // su sesión quedó cerrada: a iniciar sesión
        const sesiones = cerradas === 0 ? "; no tenía sesiones abiertas" : cerradas === 1 ? "; se cerró su sesión abierta" : `; se cerraron sus ${cerradas} sesiones abiertas`;
        setAviso(accion === "rol" ? `Rol de ${nombre} actualizado a ${rolNuevo}${cerradas > 0 ? sesiones : ""}` : accion === "deshabilitar" ? `Cuenta de ${nombre} deshabilitada${sesiones}` : `Cuenta de ${nombre} habilitada`);
        setModal(null);
        router.refresh();
        return;
      }
      if (r.estado === 409 && r.codigo !== "CONFIRMACION_REQUERIDA") {
        setAviso(r.codigo === "SIN_CAMBIO" ? `La cuenta de ${nombre} ${MENSAJE_YA_CAMBIO.charAt(0).toLowerCase()}${MENSAJE_YA_CAMBIO.slice(1)}` : (r.mensaje ?? MENSAJE_YA_CAMBIO));
        setModal(null);
        router.refresh();
        return;
      }
      if (r.estado === 401 || r.estado === 403 || r.estado === 404) {
        setModal(null);
        router.refresh();
        return;
      }
      setErrorModal(r.mensaje ?? "No se pudo completar la acción.");
    } finally {
      enviando.current = false;
    }
  }

  function acciones(u: UsuarioAdmin, compacto: boolean) {
    const bloqueado = u.esUltimoAdministradorActivo;
    const motivo = `motivo-${u.id}${compacto ? "-t" : ""}`; // la tarjeta lleva su propio aviso con ese id
    const tamano = compacto ? "compacto" : "estandar";
    return (
      <>
        <Boton variante="secundario" tamano={tamano} disabled={bloqueado} aria-label={`Cambiar rol de ${u.nombreCompleto}`} aria-describedby={bloqueado ? motivo : undefined} className={cx(bloqueado && "border-dashed")} onClick={() => abrir({ id: u.id, accion: "rol" })}>
          Cambiar rol
        </Boton>
        {u.activo ? (
          <Boton variante="secundario" tamano={tamano} disabled={bloqueado} aria-label={`Deshabilitar a ${u.nombreCompleto}`} aria-describedby={bloqueado ? motivo : undefined} className={cx(bloqueado && "border-dashed")} onClick={() => abrir({ id: u.id, accion: "deshabilitar" })}>
            Deshabilitar
          </Boton>
        ) : (
          <Boton tamano={tamano} aria-label={`Habilitar a ${u.nombreCompleto}`} onClick={() => abrir({ id: u.id, accion: "habilitar" })}>
            Habilitar
          </Boton>
        )}
        {bloqueado && compacto && (
          <p id={motivo} className="basis-full text-caption text-text-muted">
            Último administrador activo
          </p>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">Usuarios</h1>
      <form key={`${valores.q}|${valores.estatus}`} method="get" action="/admin/usuarios" role="search" aria-label="Buscar y filtrar usuarios" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-end">
        <div className="flex items-end gap-2 md:contents">
          <CampoTexto className="min-w-0 flex-1" etiqueta="Buscar usuario" type="search" name="q" placeholder="nombre o correo" autoComplete="off" defaultValue={valores.q} />
          <Boton type="submit" variante="secundario" className="md:order-3">
            Buscar
          </Boton>
        </div>
        <Selector
          name="estatus"
          etiqueta="Filtrar por estatus"
          marcador="Todos"
          opciones={[
            { valor: "activo", etiqueta: "Activo" },
            { valor: "inactivo", etiqueta: "Inactivo" },
          ]}
          defaultValue={valores.estatus}
          error={errores.estatus}
        />
      </form>

      {total === 0 ? (
        valores.q || valores.estatus ? (
          <EstadoVacio
            icono="person"
            titulo="Ningún usuario coincide"
            descripcion="Prueba con otro nombre o correo, o quita el filtro de estatus."
            accion={
              <Link href="/admin/usuarios" className={clasesBoton({ variante: "secundario" })}>
                Limpiar búsqueda
              </Link>
            }
          />
        ) : (
          <EstadoVacio icono="person" titulo="Aún no hay usuarios" descripcion="Cuando alguien cree una cuenta, aparecerá aquí." />
        )
      ) : (
        <div className="@container flex flex-col gap-4">
          {/* Tarjetas (móvil) */}
          <ul className="flex flex-col gap-3 @3xl:hidden">
            {usuarios.map((u) => {
              const bloqueado = u.esUltimoAdministradorActivo;
              return (
                <li key={u.id} data-usuario={u.id} className={cx("flex flex-col gap-3 rounded-tarjeta bg-surface p-4", u.activo ? "border border-border" : "border-2 border-dashed border-border-strong")}>
                  <div className="flex items-center gap-3">
                    <Avatar nombre={u.nombreCompleto} />
                    <div className="min-w-0">
                      <h2 className="break-words text-h3 font-semibold">{u.nombreCompleto}</h2>
                      <p className="break-all text-small text-text-muted">{u.correo}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Etiqueta>Rol: {u.rol}</Etiqueta>
                    <ChipEstatus estatus={u.activo ? "Activo" : "Inactivo"} />
                  </div>
                  <p className="text-small text-text-muted">Última modificación: {formatearFechaHora(u.fechaUltimaModificacion)}</p>
                  {bloqueado && (
                    <p id={`motivo-${u.id}`} className="rounded-campo border-2 border-dashed border-border-strong bg-surface-raised p-3 text-small">
                      {MOTIVO_ULTIMO_ADMIN}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 [&>button]:flex-1">{acciones(u, false)}</div>
                </li>
              );
            })}
          </ul>
          {/* Tabla compacta (escritorio) */}
          <div className="@max-3xl:hidden rounded-tarjeta border border-border bg-surface">
            <table data-tabla-compacta className="w-full text-small">
              <caption className="sr-only">Usuarios</caption>
              <thead>
                <tr className="border-b border-border-strong text-left text-caption font-semibold uppercase tracking-wide text-text-muted">
                  <th scope="col" className="px-3 py-2">Usuario</th>
                  <th scope="col" className="px-3 py-2">Rol</th>
                  <th scope="col" className="px-3 py-2">Estatus</th>
                  <th scope="col" className="px-3 py-2">Última modificación</th>
                  <th scope="col" className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} data-usuario={u.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <Avatar nombre={u.nombreCompleto} />
                        <div className="min-w-0">
                          <p className="font-bold">{u.nombreCompleto}</p>
                          <p className="text-text-muted">{u.correo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">{u.rol}</td>
                    <td className="px-3 py-2">
                      <ChipEstatus estatus={u.activo ? "Activo" : "Inactivo"} />
                    </td>
                    <td className="px-3 py-2">{formatearFechaHora(u.fechaUltimaModificacion)}</td>
                    <td className="px-3 py-2">
                      <div className="flex max-w-48 flex-wrap gap-2">{acciones(u, true)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className="text-small text-text-muted">
              {(pagina - 1) * porPagina + 1}–{(pagina - 1) * porPagina + usuarios.length} de {total} usuarios
            </p>
            <Paginacion paginaActual={pagina} totalPaginas={totalPaginas} onCambiarPagina={(n) => router.push(urlConPagina("/admin/usuarios", { q: filtros.texto, estatus: filtros.estatus }, n))} />
          </div>
        </div>
      )}

      {usuarioModal && <ModalUsuario key={`${ultimo.id}-${ultimo.accion}`} usuario={usuarioModal} accion={modal?.accion ?? null} accionPrevia={ultimo.accion} onCerrar={() => setModal(null)} onConfirmar={confirmar} error={errorModal} />}
      {aviso && <Toast mensaje={aviso} onCerrar={() => setAviso(undefined)} />}
    </div>
  );
}
