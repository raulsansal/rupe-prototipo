"use client";

import { AreaTexto } from "@/components/ui/AreaTexto";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { CargaFotografia } from "@/components/ui/CargaFotografia";
import { Casilla } from "@/components/ui/Casilla";
import { GrupoRadio } from "@/components/ui/GrupoRadio";
import { Interruptor } from "@/components/ui/Interruptor";
import { Selector } from "@/components/ui/Selector";
import { Grupo, PanelesTema } from "./PanelesTema";

const AVISO = (
  <>
    Acepto el <a href="#aviso" className="font-semibold text-primary underline">Aviso de Privacidad</a>
  </>
);

function Contenido() {
  return (
    <>
      <Grupo titulo="Campo de texto · estados">
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto etiqueta="Nombre del perro" required placeholder="Ej. Max" ayuda="Como lo llamas normalmente" />
          <CampoTexto etiqueta="Nombre del perro (foco)" required defaultValue="Max" data-estado="foco" ayuda="Como lo llamas normalmente" />
          <CampoTexto etiqueta="Nombre del perro (error)" required error="Escribe el nombre del perro" />
          <CampoTexto etiqueta="Folio de consulta" defaultValue="RUPE-K7M4XQ9T" disabled />
          <CampoTexto etiqueta="Fecha del extravío" icono="schedule" defaultValue="18/10/2026" required />
          <CampoTexto etiqueta="Colonia o zona" icono="location_on" placeholder="Ej. Narvarte Poniente" ayuda="Se muestra en la ficha junto con la alcaldía" required />
        </div>
      </Grupo>
      <Grupo titulo="Área de texto con contador y selector">
        <div className="grid gap-4 sm:grid-cols-2">
          <AreaTexto etiqueta="Características distintivas" maxLength={300} defaultValue="Collar rojo con placa, mancha negra en la oreja derecha." ayuda="Ayuda a reconocerlo" />
          <Selector
            etiqueta="Tamaño aproximado"
            defaultValue="mediano"
            opciones={[
              { valor: "pequeño", etiqueta: "Pequeño" },
              { valor: "mediano", etiqueta: "Mediano" },
              { valor: "grande", etiqueta: "Grande" },
            ]}
          />
        </div>
      </Grupo>
      <Grupo titulo="Casillas e interruptor">
        <div className="flex flex-col">
          <Casilla etiqueta={AVISO} defaultChecked />
          <Casilla etiqueta={AVISO} error="Debes aceptarlo para registrar a tu perro" />
          <Casilla etiqueta="Casilla deshabilitada" disabled />
          <Interruptor etiqueta="Notificaciones por correo" defaultChecked />
          <Interruptor etiqueta="Recordatorios" />
          <Interruptor etiqueta="Interruptor deshabilitado" disabled />
        </div>
      </Grupo>
      <Grupo titulo="Opciones de radio">
        <div className="grid gap-4 sm:grid-cols-2">
          <GrupoRadio
            leyenda="Sexo"
            name="sexo"
            defaultValue="Macho"
            opciones={[{ valor: "Macho", etiqueta: "Macho" }, { valor: "Hembra", etiqueta: "Hembra" }, { valor: "No sé", etiqueta: "No sé" }]}
          />
          <GrupoRadio
            leyenda="Tamaño del perro"
            name="tamano"
            variante="tarjetas"
            defaultValue="mediano"
            opciones={[
              { valor: "pequeño", etiqueta: "Pequeño", descripcion: "hasta 10 kg" },
              { valor: "mediano", etiqueta: "Mediano", descripcion: "10 a 25 kg" },
              { valor: "grande", etiqueta: "Grande", descripcion: "más de 25 kg" },
            ]}
          />
        </div>
      </Grupo>
      <Grupo titulo="Carga de fotografía · vacío, con foto y error">
        <div className="grid gap-4 sm:grid-cols-3">
          <CargaFotografia etiqueta="Fotografía del perro" requerido />
          <CargaFotografia etiqueta="Con foto" vistaPreviaInicial="/mocks/perro-ejemplo.svg" />
          <CargaFotografia etiqueta="Con error" errorInicial={{ titulo: "La foto pesa más de 4 MB", detalle: "Elige otra o redúcela" }} />
        </div>
      </Grupo>
    </>
  );
}

export function SeccionFormularios() {
  return (
    <PanelesTema seccion="formularios" titulo="Campos de formulario" lamina="Lámina 4.8 · 48 px de alto, texto de 16 px, radio 8 px, borde border-strong">
      <Contenido />
    </PanelesTema>
  );
}
