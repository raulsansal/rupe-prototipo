"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { DialogoConfirmacion } from "@/components/ui/DialogoConfirmacion";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { formatearFechaHora } from "@/lib/formato";
import { PAGINA_PT } from "@/lib/ficha/composicion";
import type { FichaPublica } from "@/mocks/tipos";
import { EscalaHoja } from "./EscalaHoja";
import { FichaBusqueda, type TamanoHoja } from "./FichaBusqueda";
import { ModalCompartir } from "./ModalCompartir";
import { ModalSesionExpirada } from "./ModalSesionExpirada";

const PROPORCION: Record<TamanoHoja, number> = { carta: PAGINA_PT.carta.alto / PAGINA_PT.carta.ancho, "media-carta": PAGINA_PT["media-carta"].alto / PAGINA_PT["media-carta"].ancho };
const HOJAS: { valor: TamanoHoja; etiqueta: string }[] = [
  { valor: "carta", etiqueta: "Carta" },
  { valor: "media-carta", etiqueta: "Media carta" },
];

export type ModalFicha = "visor" | "compartir" | "regenerar";

type Props = {
  /** Solo campos públicos: la vista previa y el visor no reciben nada de la persona tutora. */
  ficha: FichaPublica;
  /** Matriz del QR con el token vigente (solo la lleva el servidor al dueño); null si falta RUPE_URL_PUBLICA. */
  qr: { filas: boolean[][] } | null;
  avisoQr: string | null;
  dominio: string | null;
  enlaceCompartir: string | null;
  /** Fecha (UTC) de generación del QR vigente. */
  fechaQr: string;
  modalInicial?: ModalFicha;
  hojaInicial?: TamanoHoja;
};

async function mensajeDeError(r: Response): Promise<string> {
  try {
    return ((await r.json()) as { error?: { mensaje?: string } }).error?.mensaje ?? "No se pudo completar la acción. Inténtalo de nuevo.";
  } catch {
    return "No se pudo completar la acción. Inténtalo de nuevo.";
  }
}

/**
 * TUT-07: vista previa de la ficha de búsqueda y sus acciones, con PDF y QR reales. «Descargar PDF» baja el archivo generado por el servidor (HU 022) y «Imprimir» usa la
 * impresión del navegador con la hoja marcada para imprimir (misma composición: constantes de lib/ficha/composicion.ts y @page del tamaño exacto).
 */
export function FichaBusquedaTutor({ ficha, qr, avisoQr, dominio, enlaceCompartir, fechaQr, modalInicial, hojaInicial = "carta" }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalFicha | null>(modalInicial ?? null);
  const [hoja, setHoja] = useState<TamanoHoja>(hojaInicial);
  const [aviso, setAviso] = useState<string>();
  const [errorVisor, setErrorVisor] = useState<string>();
  const [descargando, setDescargando] = useState(false);
  const [sesionExpirada, setSesionExpirada] = useState(false);
  const cerrar = () => setModal(null);
  const dominioHoja = dominio ?? "el sitio de RUPE";
  const sinQr = qr === null;

  async function regenerar() {
    setModal(null);
    try {
      const r = await fetch(`/api/casos/${ficha.folio}/qr/regenerar`, { method: "POST" });
      if (r.status === 401) return setSesionExpirada(true);
      if (!r.ok) return setAviso(await mensajeDeError(r));
      const { fechaRegeneracion } = (await r.json()) as { fechaRegeneracion: string };
      router.refresh();
      setAviso(`Código QR regenerado el ${formatearFechaHora(fechaRegeneracion)}: el anterior ya no es válido`);
    } catch {
      setAviso("No se pudo regenerar el código QR. Revisa tu conexión e inténtalo de nuevo.");
    }
  }

  async function descargar() {
    setErrorVisor(undefined);
    setDescargando(true);
    try {
      const r = await fetch(`/api/casos/${ficha.folio}/ficha?hoja=${hoja}`);
      if (r.status === 401) return setSesionExpirada(true);
      if (!r.ok) return setErrorVisor(await mensajeDeError(r));
      const url = URL.createObjectURL(await r.blob());
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `ficha-${ficha.folio}-${hoja}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setAviso("Ficha descargada");
    } catch {
      setErrorVisor("No se pudo descargar la ficha. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-h1">Ficha de búsqueda</h1>
      <Alerta tipo="info" titulo="Qué no incluye la ficha">
        La ficha no incluye tus datos personales ni la calle, las referencias, el motivo o la descripción del extravío.
      </Alerta>
      {avisoQr && (
        <Alerta tipo="advertencia" titulo="Falta la dirección pública del sitio">
          {avisoQr} Mientras tanto no se puede descargar, imprimir ni compartir la ficha.
        </Alerta>
      )}
      <section aria-labelledby="vista-previa" className="flex flex-col gap-3 rounded-tarjeta border border-border bg-surface p-4">
        <h2 id="vista-previa" className="text-small font-bold">
          Vista previa de la ficha de búsqueda
        </h2>
        <div className="mx-auto w-full max-w-md">
          <EscalaHoja proporcion={PROPORCION.carta}>
            <FichaBusqueda ficha={ficha} tamano="carta" qr={qr} dominio={dominioHoja} />
          </EscalaHoja>
        </div>
        <p className="text-small text-text-muted">Código QR vigente desde el {formatearFechaHora(fechaQr)}.</p>
      </section>
      <section aria-label="Acciones de la ficha" className="flex flex-col gap-3 rounded-tarjeta border border-border bg-surface-raised p-4">
        <Boton anchoCompleto icono="print" disabled={sinQr} onClick={() => setModal("visor")}>
          Imprimir ficha de búsqueda
        </Boton>
        <div className="grid grid-cols-2 gap-3">
          <Boton variante="secundario" icono="share" disabled={enlaceCompartir === null} onClick={() => setModal("compartir")}>
            Compartir
          </Boton>
          <Boton variante="secundario" icono="refresh" onClick={() => setModal("regenerar")}>
            Regenerar QR
          </Boton>
        </div>
        <Link href={`/tutor/casos/${ficha.folio}/editar`} className={clasesBoton({ variante: "secundario", anchoCompleto: true })}>
          Regresar a editar
        </Link>
        <Link href={`/tutor/casos/${ficha.folio}`} className={clasesBoton({ variante: "secundario", anchoCompleto: true })}>
          Regresar al detalle del caso
        </Link>
      </section>

      <Modal abierto={modal === "visor"} onCerrar={cerrar} titulo="Tu ficha de búsqueda en PDF" tamano="lg">
        <div role="group" aria-label="Tamaño de hoja" className="grid grid-cols-2 gap-3">
          {HOJAS.map((h) => (
            <Boton key={h.valor} variante={hoja === h.valor ? "primario" : "secundario"} aria-pressed={hoja === h.valor} onClick={() => setHoja(h.valor)}>
              {h.etiqueta}
            </Boton>
          ))}
        </div>
        {/* La hoja se escala al ALTO disponible: Carta y Media carta se ven completas (QR, folio y pie) sin desplazarse. */}
        <section aria-label="Visor del PDF generado" className="rounded-tarjeta border border-border bg-disabled-bg p-2" style={{ height: "max(16rem, calc(100dvh - 17.5rem))" }}>
          {/* Solo con el visor abierto: la hoja para imprimir fija el tamaño de página de la impresión. */}
          {modal === "visor" && (
            <EscalaHoja key={hoja} proporcion={PROPORCION[hoja]} ajustarAlto>
              <FichaBusqueda ficha={ficha} tamano={hoja} qr={qr} dominio={dominioHoja} paraImprimir />
            </EscalaHoja>
          )}
        </section>
        {errorVisor && <Alerta tipo="peligro" titulo="No se pudo descargar">{errorVisor}</Alerta>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Boton icono="download" cargando={descargando} textoCargando="Generando PDF…" onClick={descargar}>
            Descargar PDF
          </Boton>
          <Boton icono="print" onClick={() => window.print()}>
            Imprimir
          </Boton>
          <Boton variante="secundario" onClick={cerrar}>
            Regresar a la ficha
          </Boton>
        </div>
      </Modal>

      <ModalCompartir abierto={modal === "compartir"} onCerrar={cerrar} folio={ficha.folio} nombre={ficha.nombre} enlace={enlaceCompartir} />

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
      <ModalSesionExpirada abierto={sesionExpirada} onCerrar={() => setSesionExpirada(false)} onIniciarSesion={() => router.push(`/acceso?siguiente=${encodeURIComponent(`/tutor/casos/${ficha.folio}/ficha`)}`)} />
      {aviso && <Toast mensaje={aviso} onCerrar={() => setAviso(undefined)} />}
    </div>
  );
}
