"use client";

import { useState } from "react";
import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { BotonIcono } from "@/components/ui/BotonIcono";
import { ChipEstado } from "@/components/ui/ChipEstado";
import { DialogoConfirmacion, PanelDialogo } from "@/components/ui/DialogoConfirmacion";
import { EstadoCarga } from "@/components/ui/EstadoCarga";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { IndicadorPasos } from "@/components/ui/IndicadorPasos";
import { TablaPaginada } from "@/components/ui/TablaPaginada";
import { Toast } from "@/components/ui/Toast";
import { formatearFechaCorta } from "@/lib/formato";
import { FICHAS_EJEMPLO } from "@/mocks/registros";
import { Grupo, PanelesTema } from "./PanelesTema";

// Mockup 1.3 (PUB-05.1 a PUB-05.6): seis pasos del reporte de avistamiento, en este orden.
const PASOS_REPORTE = ["Inicio", "Fotografía", "Ubicación", "Fecha y estado", "Comentario", "Confirmar"];
// Mockups del tutor (lámina 2.4): el registro tiene 2 pasos, «Datos del perro» (TUT-02) y «Circunstancias» (TUT-03).
const PASOS_REGISTRO = ["Datos del perro", "Circunstancias"];

function ToastDemo() {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Boton variante="secundario" onClick={() => setVisible(true)}>
        Mostrar aviso temporal
      </Boton>
      {visible && <Toast mensaje="Ficha lista para imprimir" accion={{ etiqueta: "Ver", onClick: () => setVisible(false) }} onCerrar={() => setVisible(false)} />}
    </>
  );
}

function DialogoDemo() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Boton variante="destructivo" onClick={() => setAbierto(true)}>
        Cancelar registro…
      </Boton>
      <DialogoConfirmacion
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        onConfirmar={() => setAbierto(false)}
        titulo="¿Cancelar este registro?"
        descripcion="Dejará de mostrarse en la búsqueda y su ficha ya no será válida. Esta acción no se puede deshacer."
        textoConfirmar="Cancelar registro"
      />
    </>
  );
}

function TablaDemo() {
  const [pagina, setPagina] = useState(1);
  return (
    <TablaPaginada
      titulo="Reportes de extravío"
      filas={[...FICHAS_EJEMPLO]}
      idFila={(f) => f.folio}
      idSeleccionada={FICHAS_EJEMPLO[1].folio}
      columnas={[
        { clave: "folio", encabezado: "Folio", celda: (f) => <span className="font-bold">{f.folio}</span> },
        { clave: "perro", encabezado: "Perro", celda: (f) => f.nombre },
        { clave: "estado", encabezado: "Estado", celda: (f) => <ChipEstado estado={f.estado} /> },
        { clave: "fecha", encabezado: "Fecha", celda: (f) => formatearFechaCorta(f.fechaExtravio) },
      ]}
      acciones={(f) => <BotonIcono icono="more_vert" etiqueta={`Acciones de ${f.nombre}`} />}
      paginaActual={pagina}
      totalPaginas={3}
      resumen={`${(pagina - 1) * 4 + 1}–${pagina * 4} de 48 reportes`}
      onCambiarPagina={(p) => setPagina(Math.min(3, Math.max(1, p)))}
    />
  );
}

function Contenido() {
  return (
    <>
      <Grupo titulo="Alertas en línea">
        <div className="flex flex-col gap-3">
          <Alerta tipo="info" titulo="Aviso">Solo se comparten la fotografía, las características, la fecha, la alcaldía y la colonia o zona del extravío.</Alerta>
          <Alerta tipo="exito" titulo="Listo">Tu reporte se registró con el folio RUPE-K7M4XQ9T.</Alerta>
          <Alerta tipo="advertencia" titulo="Revisa los datos">La fecha del extravío no puede ser posterior a hoy.</Alerta>
          <Alerta tipo="peligro" titulo="No se pudo guardar">Revisa tu conexión e inténtalo de nuevo.</Alerta>
        </div>
      </Grupo>
      <Grupo titulo="Aviso temporal (toast)">
        <div className="flex flex-col items-start gap-3">
          <Toast posicion="enLinea" mensaje="Ficha lista para imprimir" accion={{ etiqueta: "Ver", onClick: () => {} }} />
          <ToastDemo />
        </div>
      </Grupo>
      <Grupo titulo="Diálogo de confirmación (acción destructiva)">
        <div className="mb-3 flex justify-center rounded-tarjeta bg-black/50 p-6">
          <PanelDialogo titulo="¿Cancelar este registro?" descripcion="Dejará de mostrarse en la búsqueda y su ficha ya no será válida. Esta acción no se puede deshacer." textoConfirmar="Cancelar registro" />
        </div>
        <DialogoDemo />
      </Grupo>
      <Grupo titulo="Estado vacío y de carga">
        <div className="flex flex-col gap-3">
          <EstadoVacio titulo="Aún no tienes registros" descripcion="Cuando registres a tu perro, aquí verás su estado y los avistamientos reportados." accion={<Boton icono="add_circle">Registrar perro</Boton>} />
          <EstadoCarga />
        </div>
      </Grupo>
      <Grupo titulo="Pasos del registro (2) y del reporte de avistamiento (6)">
        <div className="flex flex-col gap-6">
          <IndicadorPasos pasos={PASOS_REGISTRO} actual={1} />
          <IndicadorPasos pasos={PASOS_REPORTE} actual={3} />
        </div>
      </Grupo>
      <Grupo titulo="Tabla del administrador y paginación">
        <TablaDemo />
      </Grupo>
    </>
  );
}

export function SeccionRetroalimentacion() {
  return (
    <PanelesTema seccion="retroalimentacion" titulo="Retroalimentación y datos" lamina="Lámina 4.10">
      <Contenido />
    </PanelesTema>
  );
}
