"use client";

import { useState, useSyncExternalStore } from "react";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Icono } from "@/components/ui/Icono";
import { CATEGORIAS_ESTADO_ANIMAL } from "@/mocks/catalogos";
import { CategoriaEstadoAnimal } from "./CategoriaEstadoAnimal";
import { hoyLocal, type DatosAvistamiento, type Errores, type OpcionEstadoAnimal } from "./datos";
import type { Actualizar } from "./PasoUbicacion";

type Props = {
  datos: DatosAvistamiento;
  errores: Errores;
  actualizar: Actualizar;
  /** Opciones ACTIVAS del catálogo, de la misma fuente que valida el servidor. */
  estadosAnimal: readonly OpcionEstadoAnimal[];
  /** Categorías abiertas al cargar: las obligatorias; las capturas de variantes abren todas. */
  abrirTodas?: boolean;
};

/** Paso 4 (PUB-05.4 / lámina 1.6): fecha, hora y estado del animal con las reglas de selección del catálogo (R3). */
export function PasoEstadoAnimal({ datos, errores, actualizar, estadosAnimal, abrirTodas }: Props) {
  const [abiertas, setAbiertas] = useState<Record<number, boolean>>(() => Object.fromEntries(CATEGORIAS_ESTADO_ANIMAL.map((c) => [c.id, abrirTodas || c.obligatoria])));
  // «Hoy» solo se conoce en el navegador de la persona: en el servidor es undefined, para no desajustar la hidratación.
  const hoy = useSyncExternalStore(
    () => () => {},
    () => hoyLocal(),
    () => undefined,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <CampoTexto etiqueta="Fecha" type="date" required max={hoy} value={datos.fecha} onChange={(e) => actualizar({ fecha: e.target.value }, ["fecha", "hora"])} error={errores.fecha} />
        <CampoTexto etiqueta="Hora" type="time" required value={datos.hora} onChange={(e) => actualizar({ hora: e.target.value }, ["hora"])} error={errores.hora} />
      </div>
      {errores.estados && (
        // Error del paso entero (no se sabe en qué categoría está): recibe el foco al fallar el envío.
        <p id="error-estados" tabIndex={-1} data-invalido="true" role="alert" className="flex items-start gap-1 text-small text-danger">
          <Icono nombre="error" tamano={16} className="mt-0.5" />
          {errores.estados}
        </p>
      )}
      {CATEGORIAS_ESTADO_ANIMAL.map((c) => {
        const clave = `cat${c.id}` as "cat1" | "cat2" | "cat3" | "cat4";
        return (
          <CategoriaEstadoAnimal
            key={c.id}
            categoria={c}
            opciones={estadosAnimal}
            seleccion={datos.estados}
            onCambio={(estados) => actualizar({ estados }, [clave, "estados"])}
            abierta={abiertas[c.id] || Boolean(errores[clave])} /* con error, la categoría se muestra abierta */
            onAlternar={(abierta) => setAbiertas((a) => ({ ...a, [c.id]: abierta }))}
            error={errores[clave]}
          />
        );
      })}
    </div>
  );
}
