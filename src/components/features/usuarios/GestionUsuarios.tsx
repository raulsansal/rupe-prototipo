"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { ChipEstatus } from "@/components/ui/ChipEstatus";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Paginacion } from "@/components/ui/Paginacion";
import { Selector } from "@/components/ui/Selector";
import { Toast } from "@/components/ui/Toast";
import { cx } from "@/lib/clases";
import { formatearFechaHora } from "@/lib/formato";
import { esUltimoAdministradorActivo, type Rol, type Usuario } from "@/mocks/usuarios";
import { ModalUsuario, type AccionUsuario } from "./ModalUsuario";

const POR_PAGINA = 5;
const MOTIVO_ULTIMO_ADMIN = "Último administrador activo: no se puede deshabilitar ni cambiar su rol.";

const sinAcentos = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Props = {
  usuarios: Usuario[];
  /** Capturas y pruebas: abre el modal de esa acción para ese usuario al cargar. */
  modalInicial?: { id: number; accion: AccionUsuario };
};

/**
 * ADM-03 (HU 008 y 009): usuarios como tarjetas en móvil y tabla (compacta) cuando el contenedor mide 48 rem o más. Los cambios
 * solo viven en esta pantalla (maqueta). El último administrador activo no puede deshabilitarse ni cambiar de rol: sus acciones
 * van deshabilitadas con su motivo a la vista.
 */
export function GestionUsuarios({ usuarios: iniciales, modalInicial }: Props) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([...iniciales]);
  const [consulta, setConsulta] = useState("");
  const [buscado, setBuscado] = useState("");
  const [estatus, setEstatus] = useState<"" | "Activo" | "Inactivo">("");
  const [pagina, setPagina] = useState(1);
  const [modal, setModal] = useState<{ id: number; accion: AccionUsuario } | null>(modalInicial ?? null);
  // El modal queda montado (cerrado) con el último usuario y acción: así el foco regresa al botón que lo abrió.
  const [ultimo, setUltimo] = useState<{ id: number; accion: AccionUsuario }>(modalInicial ?? { id: iniciales[0].id, accion: "rol" });
  const abrir = (m: { id: number; accion: AccionUsuario }) => {
    setUltimo(m);
    setModal(m);
  };
  const [aviso, setAviso] = useState<string>();

  const filtrados = usuarios.filter((u) => {
    const coincide = !buscado || sinAcentos(`${u.nombreCompleto} ${u.correo}`).includes(sinAcentos(buscado));
    return coincide && (!estatus || (estatus === "Activo") === u.activo);
  });
  const total = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, total);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  const usuarioModal = usuarios.find((u) => u.id === ultimo.id) ?? usuarios[0];

  function confirmar(accion: AccionUsuario, rolNuevo?: Rol) {
    if (!modal || (esUltimoAdministradorActivo(usuarios, modal.id) && accion !== "habilitar")) return setModal(null);
    const ahora = new Date().toISOString();
    setUsuarios((lista) => lista.map((u) => (u.id === modal.id ? { ...u, fechaUltimaModificacion: ahora, ...(accion === "rol" ? { rol: rolNuevo! } : { activo: accion === "habilitar" }) } : u)));
    const nombre = usuarioModal.nombreCompleto;
    setAviso(accion === "rol" ? `Rol de ${nombre} actualizado a ${rolNuevo}` : accion === "deshabilitar" ? `Cuenta de ${nombre} deshabilitada; se cerraron sus sesiones` : `Cuenta de ${nombre} habilitada`);
    setModal(null);
  }

  function acciones(u: Usuario, compacto: boolean) {
    const bloqueado = esUltimoAdministradorActivo(usuarios, u.id);
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
      <form
        role="search"
        aria-label="Buscar y filtrar usuarios"
        onSubmit={(e) => {
          e.preventDefault();
          setBuscado(consulta.trim());
          setPagina(1);
        }}
        className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-end"
      >
        <div className="flex items-end gap-2 md:contents">
          <CampoTexto className="min-w-0 flex-1" etiqueta="Buscar usuario" type="search" name="q" placeholder="nombre o correo" autoComplete="off" value={consulta} onChange={(e) => setConsulta(e.target.value)} />
          <Boton type="submit" variante="secundario" className="md:order-3">
            Buscar
          </Boton>
        </div>
        <Selector
          etiqueta="Filtrar por estatus"
          marcador="Todos"
          opciones={[
            { valor: "Activo", etiqueta: "Activo" },
            { valor: "Inactivo", etiqueta: "Inactivo" },
          ]}
          value={estatus}
          onChange={(e) => {
            setEstatus(e.target.value as typeof estatus);
            setPagina(1);
          }}
        />
      </form>

      {filtrados.length === 0 ? (
        <EstadoVacio
          icono="person"
          titulo="Ningún usuario coincide"
          descripcion="Prueba con otro nombre o correo, o quita el filtro de estatus."
          accion={
            <Boton
              variante="secundario"
              onClick={() => {
                setConsulta("");
                setBuscado("");
                setEstatus("");
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
            {visibles.map((u) => {
              const bloqueado = esUltimoAdministradorActivo(usuarios, u.id);
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
                {visibles.map((u) => (
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
              {(paginaActual - 1) * POR_PAGINA + 1}–{(paginaActual - 1) * POR_PAGINA + visibles.length} de {filtrados.length} usuarios
            </p>
            <Paginacion paginaActual={paginaActual} totalPaginas={total} onCambiarPagina={setPagina} />
          </div>
        </div>
      )}

      <ModalUsuario key={`${ultimo.id}-${ultimo.accion}`} usuario={usuarioModal} accion={modal?.accion ?? null} accionPrevia={ultimo.accion} onCerrar={() => setModal(null)} onConfirmar={confirmar} />
      {aviso && <Toast mensaje={aviso} onCerrar={() => setAviso(undefined)} />}
    </div>
  );
}
