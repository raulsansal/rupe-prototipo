"use client";

import { useState, type FormEvent } from "react";
import { AreaTexto } from "@/components/ui/AreaTexto";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { GrupoRadio } from "@/components/ui/GrupoRadio";
import { Modal } from "@/components/ui/Modal";
import { Selector } from "@/components/ui/Selector";
import { esProtegido, motivoNoDesactivable, validarCatalogo, type DatosCatalogo, type ErroresCatalogo } from "@/lib/catalogos";
import type { ConfigCatalogo, ElementoCatalogo } from "@/mocks/catalogosAdmin";

type Props = {
  cfg: ConfigCatalogo;
  items: readonly ElementoCatalogo[];
  /** Elemento que se edita; null = alta. */
  elemento: ElementoCatalogo | null;
  abierto: boolean;
  onCerrar: () => void;
  onGuardar: (datos: DatosCatalogo) => void;
};

const ORDEN_CAMPOS = ["nombre", "clave", "idCategoria", "descripcion", "activo"] as const;
const deLa = (cfg: ConfigCatalogo) => (cfg.femenino ? "de la" : "del");

/**
 * MOD-11: alta o edición de un elemento de catálogo; una sola plantilla para alcaldías, razas, motivos y estados del animal (los campos
 * cambian según el catálogo). Editar y elegir «Activa» reactiva un elemento desactivado. «Inactiva» no está disponible para un valor protegido
 * ni para la última opción activa de una categoría: la razón queda a la vista. Cada cambio se registra en la bitácora (HU 058).
 * Se monta de nuevo en cada apertura (clave en el padre) para que el formulario empiece limpio.
 */
export function ModalCatalogo({ cfg, items, elemento, abierto, onCerrar, onGuardar }: Props) {
  const [datos, setDatos] = useState<DatosCatalogo>({
    nombre: elemento?.nombre ?? "",
    clave: elemento?.clave ?? "",
    idCategoria: elemento?.idCategoria !== undefined ? String(elemento.idCategoria) : "",
    descripcion: elemento?.descripcion ?? "",
    activo: elemento?.activo ?? true,
  });
  const [errores, setErrores] = useState<ErroresCatalogo>({});
  const protegido = elemento ? esProtegido(cfg, elemento) : false;
  const bloqueoInactivo = elemento?.activo ? motivoNoDesactivable(cfg, items, elemento) : undefined;
  const activoTxt = cfg.femenino ? "Activa" : "Activo";
  const inactivoTxt = cfg.femenino ? "Inactiva" : "Inactivo";
  const editar = (parcial: Partial<DatosCatalogo>, campo?: keyof ErroresCatalogo) => {
    setDatos((d) => ({ ...d, ...parcial }));
    if (campo) setErrores((e) => ({ ...e, [campo]: undefined }));
  };

  function guardar(ev: FormEvent) {
    ev.preventDefault();
    const e = validarCatalogo(cfg, items, datos, elemento ?? undefined);
    setErrores(e);
    const primero = ORDEN_CAMPOS.find((c) => e[c]);
    if (primero) return document.getElementById(`catalogo-${primero}`)?.focus();
    onGuardar(datos);
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
            opciones={cfg.categorias.map((c) => ({ valor: String(c.id), etiqueta: c.nombre }))}
            value={datos.idCategoria}
            onChange={(e) => editar({ idCategoria: e.target.value }, "idCategoria")}
            error={errores.idCategoria}
          />
        )}
        {cfg.conDescripcion && <AreaTexto id="catalogo-descripcion" etiqueta="Descripción" required maxLength={cfg.longitudDescripcion} rows={3} value={datos.descripcion} onChange={(e) => editar({ descripcion: e.target.value }, "descripcion")} error={errores.descripcion} />}
        <GrupoRadio
          leyenda="Estatus"
          name="estatus"
          variante="tarjetas"
          value={datos.activo ? "1" : "0"}
          onChange={(e) => editar({ activo: e.target.value === "1" }, "activo")}
          opciones={[
            { valor: "1", etiqueta: activoTxt },
            { valor: "0", etiqueta: inactivoTxt, deshabilitada: Boolean(bloqueoInactivo) },
          ]}
          ayuda={bloqueoInactivo ?? (elemento && !elemento.activo ? `Elige «${activoTxt}» y guarda para reactivarlo.` : undefined)}
          error={errores.activo}
        />
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
