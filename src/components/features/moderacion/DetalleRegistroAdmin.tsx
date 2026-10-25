"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { ChipEstado } from "@/components/ui/ChipEstado";
import { Icono } from "@/components/ui/Icono";
import { Toast } from "@/components/ui/Toast";
import { deshabilitar, esDeshabilitado, estadoActual, estadoPrevioADeshabilitacion, motivoCasoCerrado, puedeDeshabilitar, puedeRestaurar, restaurar } from "@/lib/moderacion";
import type { RegistroAdmin } from "@/mocks/moderacion";
import type { MovimientoHistorial } from "@/mocks/tipos";
import { DatosDelExtravio, DatosDelPerro, DatosReservados } from "../DatosCaso";
import { HistorialEstados } from "../HistorialEstados";
import { ModalMotivo } from "./ModalMotivo";

type Props = {
  caso: RegistroAdmin;
  /** Capturas y pruebas: abre MOD-08 al cargar. */
  modalInicial?: boolean;
};

/**
 * TUT-05 en variante Administrador: la misma pantalla que ve la persona tutora, en solo lectura (HU 016 y lámina 2.5), con los mismos bloques de
 * datos (perro, extravío y reservados) y el historial de estados; nunca datos de la persona tutora. La única acción es la de moderación
 * (lámina 3.4): deshabilitar (con motivo) o restaurar.
 */
export function DetalleRegistroAdmin({ caso, modalInicial = false }: Props) {
  const [historial, setHistorial] = useState<MovimientoHistorial[]>(caso.historial);
  const [abierto, setAbierto] = useState(modalInicial);
  const [aviso, setAviso] = useState<string>();
  const estado = estadoActual(historial);
  const noDisponible = motivoCasoCerrado(historial);

  function confirmar(motivo: string) {
    setHistorial((h) => deshabilitar(h, motivo, new Date().toISOString()));
    setAviso(`Registro ${caso.folio} deshabilitado: pasó a «Cerrado»`);
    setAbierto(false);
    setTimeout(() => document.getElementById("detalle-folio")?.focus(), 0);
  }

  function restaurarRegistro() {
    const previo = estadoPrevioADeshabilitacion(historial);
    setHistorial((h) => restaurar(h, new Date().toISOString()));
    setAviso(`Registro ${caso.folio} restaurado: volvió a «${previo}»`);
    setTimeout(() => document.getElementById("detalle-folio")?.focus(), 0);
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/registros" className="inline-flex h-tactil w-fit items-center gap-1 text-small font-semibold underline">
        <Icono nombre="arrow_back" tamano={20} />
        Regresar a moderación de registros
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-small font-bold">Folio</p>
          <h1 id="detalle-folio" tabIndex={-1} className="whitespace-nowrap text-h1 tabular-nums focus:outline-none!">
            {caso.folio}
          </h1>
        </div>
        <ChipEstado estado={estado} texto={esDeshabilitado(historial) ? "Cerrado (deshabilitado)" : undefined} />
      </div>
      <p className="rounded-campo border-2 border-dashed border-border-strong bg-surface-raised p-3 text-small">Vista de la persona Administrador: solo consulta.</p>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
          <div className="contents lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
            <div className="relative order-1 aspect-[4/3] overflow-hidden rounded-tarjeta border border-border bg-disabled-bg lg:order-none lg:aspect-square lg:max-w-[420px]">
              <Image src={caso.fotografiaUrl} alt={`Fotografía de ${caso.nombre}`} fill sizes="(min-width: 1280px) 420px, (min-width: 1024px) 30vw, 100vw" className="object-cover" priority />
            </div>
            <div className="order-2 lg:order-none">
              <DatosDelPerro caso={caso} />
            </div>
          </div>
          <div className="order-3 lg:order-none">
            <DatosDelExtravio caso={caso} />
          </div>
          <div className="order-4 lg:order-none">
            <DatosReservados caso={caso} />
          </div>
        </div>
        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <div className="order-5 lg:order-none">
            <HistorialEstados historial={historial} />
          </div>
          <div className="order-6 flex flex-col gap-4 lg:order-none">
            {puedeRestaurar(historial) ? (
              <Boton anchoCompleto onClick={restaurarRegistro}>
                Restaurar registro
              </Boton>
            ) : (
              <>
                <Boton variante="secundario" anchoCompleto disabled={!puedeDeshabilitar(historial)} aria-describedby={noDisponible ? "motivo-detalle" : undefined} className={noDisponible ? "border-dashed" : undefined} onClick={() => setAbierto(true)}>
                  Deshabilitar registro
                </Boton>
                {noDisponible && (
                  <p id="motivo-detalle" className="rounded-campo border-2 border-dashed border-border-strong bg-surface-raised p-3 text-small">
                    {noDisponible}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <ModalMotivo
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Deshabilitar registro"
        resumen={
          <>
            <p className="whitespace-nowrap text-h3 font-bold tabular-nums">{caso.folio}</p>
            <p className="text-small text-text-muted">{caso.nombre} · {caso.alcaldia}</p>
          </>
        }
        advertencia="El registro pasará a «Cerrado», no generará ficha ni aceptará avistamientos y dejará de consultarse por folio."
        conMotivo
        onConfirmar={confirmar}
      />
      {aviso && <Toast mensaje={aviso} onCerrar={() => setAviso(undefined)} />}
    </div>
  );
}
