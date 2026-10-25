"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AreaTexto } from "@/components/ui/AreaTexto";
import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { ChipEstado } from "@/components/ui/ChipEstado";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { DialogoConfirmacion } from "@/components/ui/DialogoConfirmacion";
import { Icono } from "@/components/ui/Icono";
import { Toast } from "@/components/ui/Toast";
import { cx } from "@/lib/clases";
import { esCasoActivo, type CasoTutor, type EstadoCaso, type MovimientoHistorial, type TipoMovimiento } from "@/mocks/tipos";
import { DatosDelExtravio, DatosDelPerro, DatosReservados } from "./DatosCaso";
import { HistorialEstados } from "./HistorialEstados";
import { ModalCompartir } from "./ModalCompartir";

type Accion = "localizar" | "cerrar" | "cancelar" | "reactivar" | "compartir";

const LIMITE_MOTIVO = 300;

type Confirmacion = {
  titulo: string;
  descripcion: string;
  textoConfirmar: string;
  variante: "destructivo" | "primario";
  icono: "warning" | "check_circle";
  /** Pide un motivo obligatorio (HU 017 y 043). */
  motivo?: boolean;
  nuevo: { estado: EstadoCaso; tipo: TipoMovimiento };
  aviso: string;
};

const CONFIRMACIONES: Record<Exclude<Accion, "compartir">, Confirmacion> = {
  localizar: {
    titulo: "¿Marcar el caso como localizado?",
    descripcion: "El caso dejará de recibir avistamientos y la ficha pública lo mostrará como localizado. Si fue un error, podrás reactivarlo.",
    textoConfirmar: "Marcar como localizado",
    variante: "primario",
    icono: "check_circle",
    nuevo: { estado: "Localizado", tipo: "localización" },
    aviso: "El caso quedó como Localizado",
  },
  cerrar: {
    titulo: "¿Cerrar el caso?",
    descripcion: "El cierre es definitivo: no podrás reactivar el caso ni revertirlo. Después solo podrás consultarlo.",
    textoConfirmar: "Cerrar caso",
    variante: "destructivo",
    icono: "warning",
    nuevo: { estado: "Cerrado", tipo: "cierre confirmado" },
    aviso: "El caso quedó cerrado",
  },
  cancelar: {
    titulo: "¿Cancelar el registro?",
    descripcion: "El caso se cierra y deja de consultarse públicamente con su folio. No se puede revertir. Cuéntanos por qué.",
    textoConfirmar: "Cancelar registro",
    variante: "destructivo",
    icono: "warning",
    motivo: true,
    nuevo: { estado: "Cerrado", tipo: "cancelación" },
    aviso: "El registro fue cancelado",
  },
  reactivar: {
    titulo: "¿Reactivar el caso?",
    descripcion: "El caso volverá a «En seguimiento» y recibirá avistamientos de nuevo. Cuéntanos por qué.",
    textoConfirmar: "Reactivar caso",
    variante: "primario",
    icono: "check_circle",
    motivo: true,
    nuevo: { estado: "En seguimiento", tipo: "reactivación" },
    aviso: "El caso se reactivó: ahora está En seguimiento",
  },
};

const enlaceBoton = clasesBoton({ variante: "secundario", className: "text-center" });

/**
 * TUT-05: detalle del caso para la persona tutora dueña. Las acciones cambian con el estado; las definitivas piden
 * confirmación. Los cambios de estado solo viven en esta pantalla (maqueta): al recargar vuelve al estado de origen.
 * Aquí no se muestran avistamientos: esas pantallas (y la regla de «Ver fotografía» de HU 040) son de otro bloque.
 */
export function DetalleCasoTutor({ caso }: { caso: CasoTutor }) {
  const [estado, setEstado] = useState<EstadoCaso>(caso.estado);
  const [historial, setHistorial] = useState<MovimientoHistorial[]>(caso.historial);
  const [accion, setAccion] = useState<Accion | null>(null);
  // El diálogo de confirmación queda montado (cerrado) para que el foco regrese al botón que lo abrió.
  const [ultimaConfirmacion, setUltimaConfirmacion] = useState<keyof typeof CONFIRMACIONES>("localizar");
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState<string>();
  const [aviso, setAviso] = useState<string>();

  const folio = caso.folio;
  const activo = esCasoActivo(estado);
  const base = `/tutor/casos/${folio}`;
  const confirmacion = CONFIRMACIONES[ultimaConfirmacion];
  const abrir = (a: Accion) => {
    if (a !== "compartir") setUltimaConfirmacion(a);
    setAccion(a);
  };

  function cerrarDialogo() {
    setAccion(null);
    setMotivo("");
    setErrorMotivo(undefined);
  }

  function confirmar() {
    if (confirmacion.motivo && !motivo.trim()) {
      setErrorMotivo("Escribe el motivo para continuar.");
      return document.getElementById("motivo-accion")?.focus();
    }
    const { estado: nuevo, tipo } = confirmacion.nuevo;
    setHistorial((h) => [...h, { consecutivo: h.length + 1, fechaHora: new Date().toISOString(), tipo, estado: nuevo, motivo: confirmacion.motivo ? motivo.trim() : undefined }]);
    setEstado(nuevo);
    setAviso(confirmacion.aviso);
    cerrarDialogo();
    // El botón que abrió el diálogo ya no existe con el estado nuevo: el foco va al encabezado del caso.
    setTimeout(() => document.getElementById("detalle-folio")?.focus(), 0);
  }

  const acciones = (
    <section aria-labelledby="acciones-titulo" className="flex flex-col gap-3 rounded-tarjeta border border-border bg-surface-raised p-4">
      <h2 id="acciones-titulo" className="sr-only">
        Acciones del caso
      </h2>
      {activo ? (
        <>
          <Link href={`${base}/ficha`} className={clasesBoton({ anchoCompleto: true })}>
            Ver ficha de búsqueda
          </Link>
          <div className="grid grid-cols-2 gap-3">
            <Link href={`${base}/avistamientos`} className={enlaceBoton}>
              Ver avistamientos
            </Link>
            <Link href={`${base}/mapa`} className={enlaceBoton}>
              Ver mapa
            </Link>
            <Link href={`${base}/editar`} className={enlaceBoton}>
              Editar registro
            </Link>
            <Link href={`${base}/notificaciones`} className={enlaceBoton}>
              Notificaciones del caso
            </Link>
          </div>
          <Boton variante="secundario" anchoCompleto onClick={() => abrir("compartir")}>
            Compartir estatus
          </Boton>
          <Boton variante="secundario" anchoCompleto onClick={() => abrir("localizar")}>
            Marcar como localizado
          </Boton>
          <Boton variante="secundario" anchoCompleto className="border-dashed" onClick={() => abrir("cancelar")}>
            Cancelar registro
          </Boton>
        </>
      ) : estado === "Localizado" ? (
        <>
          <Alerta tipo="info" titulo="El caso ya no recibe avistamientos">
            Si fue un error, puedes reactivarlo; si ya terminó, ciérralo.
          </Alerta>
          <div className="grid grid-cols-2 gap-3">
            <Link href={`${base}/avistamientos`} className={enlaceBoton}>
              Ver avistamientos
            </Link>
            <Link href={`${base}/mapa`} className={enlaceBoton}>
              Ver mapa
            </Link>
          </div>
          <Boton variante="secundario" anchoCompleto onClick={() => abrir("compartir")}>
            Compartir estatus
          </Boton>
          <Boton anchoCompleto onClick={() => abrir("reactivar")}>
            Reactivar caso
          </Boton>
          <Boton variante="secundario" anchoCompleto onClick={() => abrir("cerrar")}>
            Cerrar caso
          </Boton>
        </>
      ) : (
        <>
          <Alerta tipo="info" titulo="Caso cerrado: solo consulta">
            El cierre es definitivo: ya no se puede editar ni reactivar.
          </Alerta>
          <div className="grid grid-cols-2 gap-3">
            <Link href={`${base}/avistamientos`} className={enlaceBoton}>
              Ver avistamientos
            </Link>
            <Link href={`${base}/mapa`} className={enlaceBoton}>
              Ver mapa
            </Link>
          </div>
        </>
      )}
    </section>
  );

  const historialVista = <HistorialEstados historial={historial} />;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/tutor" className="inline-flex h-tactil w-fit items-center gap-1 text-small font-semibold underline">
        <Icono nombre="arrow_back" tamano={20} />
        Regresar a mis registros
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-small font-bold">Folio</p>
          <h1 id="detalle-folio" tabIndex={-1} className="text-h1 tabular-nums focus:outline-none!">
            {folio}
          </h1>
        </div>
        <ChipEstado estado={estado} />
      </div>
      {/* Móvil: una columna con `order` (foto, acciones, datos, extravío, reservados, historial). Desde 1024 px, los envoltorios `contents`
          se vuelven columnas reales: izquierda = foto junto a «Datos del perro», extravío y reservados; derecha = acciones e historial. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
          <div className="contents lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
            <div
              data-foto-caso
              className={cx("relative order-1 aspect-[4/3] overflow-hidden rounded-tarjeta border border-border bg-disabled-bg lg:order-none lg:aspect-square lg:max-w-[420px]", !activo && "opacity-90")}
            >
              <Image src={caso.fotografiaUrl} alt={`Fotografía de ${caso.nombre}`} fill sizes="(min-width: 1280px) 420px, (min-width: 1024px) 30vw, 100vw" className="object-cover" priority />
            </div>
            <div className="order-3 lg:order-none">
              <DatosDelPerro caso={caso} />
            </div>
          </div>
          <div className="order-4 lg:order-none">
            <DatosDelExtravio caso={caso} />
          </div>
          <div className="order-5 lg:order-none">
            <DatosReservados caso={caso} />
          </div>
        </div>
        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <div className="order-2 lg:order-none">{acciones}</div>
          <div className="order-6 lg:order-none">{historialVista}</div>
        </div>
      </div>

      <ModalCompartir abierto={accion === "compartir"} onCerrar={cerrarDialogo} folio={folio} nombre={caso.nombre} />
      <DialogoConfirmacion
          abierto={accion !== null && accion !== "compartir"}
          onCerrar={cerrarDialogo}
          titulo={confirmacion.titulo}
          descripcion={confirmacion.descripcion}
          textoConfirmar={confirmacion.textoConfirmar}
          variante={confirmacion.variante}
          icono={confirmacion.icono}
          onConfirmar={confirmar}
        >
          {confirmacion.motivo && (
            <AreaTexto
              id="motivo-accion"
              etiqueta="Motivo"
              required
              maxLength={LIMITE_MOTIVO}
              rows={3}
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                setErrorMotivo(undefined);
              }}
              error={errorMotivo}
            />
          )}
        </DialogoConfirmacion>
      {aviso && <Toast mensaje={aviso} onCerrar={() => setAviso(undefined)} />}
    </div>
  );
}
