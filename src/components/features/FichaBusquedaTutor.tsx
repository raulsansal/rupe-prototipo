"use client";

import Link from "next/link";
import { useState } from "react";
import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { DialogoConfirmacion } from "@/components/ui/DialogoConfirmacion";
import { GrupoRadio } from "@/components/ui/GrupoRadio";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { clasesBoton } from "@/components/ui/clasesBoton";
import type { FichaPublica } from "@/mocks/tipos";
import { FichaBusqueda, type TamanoHoja } from "./FichaBusqueda";
import { ModalCompartir } from "./ModalCompartir";

export type ModalFicha = "visor" | "compartir" | "regenerar";

type Props = {
  /** Solo campos públicos: la vista previa y el visor no reciben nada de la persona tutora. */
  ficha: FichaPublica;
  modalInicial?: ModalFicha;
  hojaInicial?: TamanoHoja;
};

/**
 * TUT-07: vista previa de la ficha de búsqueda y sus acciones. El «visor del PDF» es simulado (no se genera un PDF):
 * «Imprimir» usa la impresión del navegador con la hoja marcada para imprimir y «Descargar PDF» solo avisa.
 */
export function FichaBusquedaTutor({ ficha, modalInicial, hojaInicial = "carta" }: Props) {
  const [modal, setModal] = useState<ModalFicha | null>(modalInicial ?? null);
  const [hoja, setHoja] = useState<TamanoHoja>(hojaInicial);
  const [versionQr, setVersionQr] = useState(1);
  const [aviso, setAviso] = useState<string>();
  const [avisoVisor, setAvisoVisor] = useState<string>();
  const cerrar = () => setModal(null);

  function regenerar() {
    setVersionQr((v) => v + 1);
    setModal(null);
    setAviso("Código QR regenerado: el anterior ya no es válido");
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-h1">Ficha de búsqueda</h1>
      <Alerta tipo="info" titulo="Qué no incluye la ficha">
        La ficha no incluye tus datos personales ni la calle, las referencias, el motivo o la descripción del extravío.
      </Alerta>
      <section aria-labelledby="vista-previa" className="flex flex-col gap-3 rounded-tarjeta border border-border bg-surface p-4">
        <h2 id="vista-previa" className="text-small font-bold">
          Vista previa de la ficha de búsqueda
        </h2>
        <div className="mx-auto w-full max-w-md">
          <FichaBusqueda ficha={ficha} tamano="carta" versionQr={versionQr} />
        </div>
      </section>
      <section aria-label="Acciones de la ficha" className="flex flex-col gap-3 rounded-tarjeta border border-border bg-surface-raised p-4">
        <Boton anchoCompleto icono="print" onClick={() => setModal("visor")}>
          Imprimir ficha de búsqueda
        </Boton>
        <div className="grid grid-cols-2 gap-3">
          <Boton variante="secundario" icono="share" onClick={() => setModal("compartir")}>
            Compartir
          </Boton>
          <Boton variante="secundario" icono="refresh" onClick={() => setModal("regenerar")}>
            Regenerar QR
          </Boton>
        </div>
        <Link href={`/tutor/casos/${ficha.folio}`} className={clasesBoton({ variante: "secundario", anchoCompleto: true })}>
          Regresar al detalle del caso
        </Link>
      </section>

      <Modal abierto={modal === "visor"} onCerrar={cerrar} titulo="Tu ficha de búsqueda en PDF" tamano="lg">
        <p className="text-small text-text-muted">Vista simulada del documento: en esta fase no se genera un PDF.</p>
        <GrupoRadio
          leyenda="Tamaño de hoja"
          name="hoja"
          variante="tarjetas"
          value={hoja}
          onChange={(e) => setHoja(e.target.value as TamanoHoja)}
          opciones={[
            { valor: "carta", etiqueta: "Carta" },
            { valor: "media-carta", etiqueta: "Media carta" },
          ]}
        />
        <section aria-label="Visor del PDF generado" className="rounded-tarjeta border border-border bg-disabled-bg p-3">
          <p className="mb-2 text-center text-small font-bold">Visor del PDF generado</p>
          <div className="mx-auto w-full max-w-xl">
            {/* Solo con el visor abierto: la hoja para imprimir fija el tamaño de página de la impresión. */}
            {modal === "visor" && <FichaBusqueda ficha={ficha} tamano={hoja} versionQr={versionQr} paraImprimir />}
          </div>
        </section>
        <div className="grid grid-cols-2 gap-3">
          <Boton icono="download" onClick={() => setAvisoVisor("Descarga simulada: en esta fase no se genera un PDF")}>
            Descargar PDF
          </Boton>
          <Boton icono="print" onClick={() => window.print()}>
            Imprimir
          </Boton>
        </div>
        <Boton variante="secundario" anchoCompleto onClick={cerrar}>
          Regresar a la ficha
        </Boton>
        {avisoVisor && <Toast mensaje={avisoVisor} posicion="enLinea" onCerrar={() => setAvisoVisor(undefined)} />}
      </Modal>

      <ModalCompartir abierto={modal === "compartir"} onCerrar={cerrar} folio={ficha.folio} nombre={ficha.nombre} />

      <DialogoConfirmacion
        abierto={modal === "regenerar"}
        onCerrar={cerrar}
        titulo="Regenerar código QR"
        descripcion="El QR anterior dejará de ser válido de inmediato. El folio, los datos del registro y el enlace de consulta no cambian."
        textoConfirmar="Regenerar QR"
        textoCancelar="Regresar"
        variante="primario"
        icono="warning"
        onConfirmar={regenerar}
      />
      {aviso && <Toast mensaje={aviso} onCerrar={() => setAviso(undefined)} />}
    </div>
  );
}
