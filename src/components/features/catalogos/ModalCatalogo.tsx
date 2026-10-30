"use client";

import { useRef, useState, type FormEvent } from "react";
import { Alerta } from "@/components/ui/Alerta";
import { AreaTexto } from "@/components/ui/AreaTexto";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { GrupoRadio } from "@/components/ui/GrupoRadio";
import { Modal } from "@/components/ui/Modal";
import { Selector } from "@/components/ui/Selector";
import type { ReglasCatalogo } from "@/config/catalogos";
import type { CatalogoAdmin } from "@/server/serializadores/admin";

/** Lo que se manda al servidor: el servidor valida, sanea (R34) y señala cada campo. `activo: true` solo al reactivar. */
export type DatosFormulario = { nombre: string; clave?: string; idCategoria?: string; descripcion?: string; activo?: true };
export type ResultadoGuardado = { ok: boolean; campos?: Record<string, string>; codigo?: string; mensaje?: string };

type Props = {
  cfg: ReglasCatalogo;
  categorias: readonly { id: number; nombre: string }[];
  /** Elemento que se edita; null = alta. */
  elemento: CatalogoAdmin | null;
  abierto: boolean;
  onCerrar: () => void;
  onGuardar: (datos: DatosFormulario) => Promise<ResultadoGuardado>;
};

const ORDEN_CAMPOS = ["nombre", "clave", "idCategoria", "descripcion", "activo"] as const;
type Campo = (typeof ORDEN_CAMPOS)[number];
const deLa = (cfg: ReglasCatalogo) => (cfg.femenino ? "de la" : "del");
/** Códigos de conflicto que se explican en el campo que los causa, no en un aviso general. */
const CAMPO_DE_CODIGO: Record<string, Campo> = { NOMBRE_DUPLICADO: "nombre", CLAVE_DUPLICADA: "clave", ULTIMA_ACTIVA_DE_CATEGORIA: "idCategoria" };

/**
 * MOD-11: alta o edición de un elemento de catálogo; una sola plantilla para alcaldías, razas, motivos y estados del animal (los campos cambian según el catálogo). Editar NO desactiva
 * (para eso está «Desactivar»): el campo «Estatus» solo aparece al editar un elemento desactivado, para reactivarlo. El servidor valida (422 por campo, 409 de nombre o clave repetidos,
 * protegidos, última opción activa…) y cada error se muestra en lenguaje claro junto al campo. Se monta de nuevo en cada apertura (clave en el padre) para empezar limpio.
 */
export function ModalCatalogo({ cfg, categorias, elemento, abierto, onCerrar, onGuardar }: Props) {
  const [datos, setDatos] = useState({
    nombre: elemento?.nombre ?? "",
    clave: elemento?.clave ?? "",
    idCategoria: elemento?.idCategoria !== undefined ? String(elemento.idCategoria) : "",
    descripcion: elemento?.descripcion ?? "",
    reactivar: false,
  });
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
  const [general, setGeneral] = useState<string>();
  const enviando = useRef(false);
  const protegido = elemento?.protegido ?? false;
  const inactivo = elemento ? !elemento.activo : false;
  const activoTxt = cfg.femenino ? "Activa" : "Activo";
  const inactivoTxt = cfg.femenino ? "Inactiva" : "Inactivo";
  const editar = (parcial: Partial<typeof datos>, campo?: Campo) => {
    setDatos((d) => ({ ...d, ...parcial }));
    setGeneral(undefined);
    if (campo) setErrores((e) => ({ ...e, [campo]: undefined }));
  };

  async function guardar(ev: FormEvent) {
    ev.preventDefault();
    if (enviando.current) return;
    enviando.current = true;
    try {
      const r = await onGuardar({
        nombre: datos.nombre,
        ...(cfg.conClave && !protegido ? { clave: datos.clave } : {}),
        ...(cfg.conCategoria ? { idCategoria: datos.idCategoria } : {}),
        ...(cfg.conDescripcion ? { descripcion: datos.descripcion } : {}),
        ...(inactivo && datos.reactivar ? { activo: true as const } : {}),
      });
      if (r.ok) return;
      const campos: Partial<Record<Campo, string>> = {};
      for (const c of ORDEN_CAMPOS) if (r.campos?.[c]) campos[c] = r.campos[c];
      const deCodigo = r.codigo ? CAMPO_DE_CODIGO[r.codigo] : undefined;
      if (deCodigo && !campos[deCodigo] && r.mensaje) campos[deCodigo] = r.mensaje;
      setErrores(campos);
      const primero = ORDEN_CAMPOS.find((c) => campos[c]);
      if (primero) document.getElementById(`catalogo-${primero}`)?.focus();
      else setGeneral(r.mensaje);
    } finally {
      enviando.current = false;
    }
  }

  const titulo = `${elemento ? "Editar" : "Agregar"} ${cfg.singular}`;
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo} tamano="md">
      <form onSubmit={guardar} noValidate className="flex flex-col gap-3">
        <CampoTexto id="catalogo-nombre" etiqueta={`Nombre ${deLa(cfg)} ${cfg.singular}`} required maxLength={cfg.longitudNombre} autoComplete="off" value={datos.nombre} onChange={(e) => editar({ nombre: e.target.value }, "nombre")} error={errores.nombre} />
        {cfg.conClave && (
          <CampoTexto
            id="catalogo-clave"
            etiqueta="Clave geoestadística"
            required={!protegido}
            maxLength={5}
            inputMode="numeric"
            autoComplete="off"
            placeholder="5 caracteres"
            disabled={protegido}
            value={protegido ? "" : datos.clave}
            ayuda={protegido ? "Esta opción no lleva clave." : undefined}
            onChange={(e) => editar({ clave: e.target.value }, "clave")}
            error={errores.clave}
          />
        )}
        {cfg.conCategoria && (
          <Selector
            id="catalogo-idCategoria"
            etiqueta={cfg.etiquetaCategoria ?? "Categoría"}
            required
            marcador="Elige una categoría"
            opciones={categorias.map((c) => ({ valor: String(c.id), etiqueta: c.nombre }))}
            value={datos.idCategoria}
            onChange={(e) => editar({ idCategoria: e.target.value }, "idCategoria")}
            error={errores.idCategoria}
          />
        )}
        {cfg.conDescripcion && <AreaTexto id="catalogo-descripcion" etiqueta="Descripción" required maxLength={cfg.longitudDescripcion} rows={3} value={datos.descripcion} onChange={(e) => editar({ descripcion: e.target.value }, "descripcion")} error={errores.descripcion} />}
        {inactivo && (
          <GrupoRadio
            leyenda="Estatus"
            name="estatus"
            variante="tarjetas"
            value={datos.reactivar ? "1" : "0"}
            onChange={(e) => editar({ reactivar: e.target.value === "1" }, "activo")}
            opciones={[
              { valor: "0", etiqueta: inactivoTxt },
              { valor: "1", etiqueta: activoTxt },
            ]}
            ayuda={`Elige «${activoTxt}» y guarda para reactivar ${cfg.femenino ? "la" : "el"} ${cfg.singular}.`}
            error={errores.activo}
          />
        )}
        {general && (
          <Alerta tipo="peligro" titulo="No se pudo guardar">
            {general}
          </Alerta>
        )}
        <div className="mt-1 grid grid-cols-2 gap-3">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit">Guardar cambios</Boton>
        </div>
      </form>
    </Modal>
  );
}
