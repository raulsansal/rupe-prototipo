import { formatearFechaCorta } from "@/lib/formato";
import { edadAproximada, etiquetaTamano } from "@/lib/perro";
import { MOMENTOS_DEL_DIA } from "@/mocks/catalogos";
import type { CasoTutor } from "@/mocks/tipos";
import { TarjetaDatos } from "./TarjetaDatos";

type Caso = Pick<CasoTutor, "nombre" | "sexo" | "raza" | "razaEspecificada" | "edadValor" | "edadUnidad" | "tamano" | "color" | "caracteristicasDistintivas">;
type Extravio = Pick<CasoTutor, "fechaExtravio" | "alcaldia" | "coloniaZona">;
type Reservados = Pick<CasoTutor, "momentoDelDia" | "direccionAproximada" | "referenciasDelLugar" | "motivo" | "descripcionCircunstancias">;

/** Tarjetas de datos de un caso, compartidas por TUT-05 (persona tutora) y su variante de solo lectura para el Administrador (HU 016). */
export function DatosDelPerro({ caso }: { caso: Caso }) {
  return (
    <TarjetaDatos
      id="datos-perro"
      titulo="Datos del perro"
      filas={[
        ["Nombre", caso.nombre],
        ["Sexo", caso.sexo],
        ["Raza", caso.razaEspecificada ? `Otra: ${caso.razaEspecificada}` : caso.raza],
        ["Edad", edadAproximada(caso)],
        ["Tamaño", etiquetaTamano(caso.tamano)],
        ["Color", caso.color],
        ["Características distintivas", caso.caracteristicasDistintivas ?? "Sin características registradas"],
      ]}
    />
  );
}

export function DatosDelExtravio({ caso }: { caso: Extravio }) {
  return (
    <TarjetaDatos
      id="datos-extravio"
      titulo="Datos del extravío · públicos en la ficha"
      filas={[
        ["Fecha del extravío", formatearFechaCorta(caso.fechaExtravio)],
        ["Alcaldía", caso.alcaldia],
        ["Colonia o zona", caso.coloniaZona],
      ]}
    />
  );
}

export function DatosReservados({ caso }: { caso: Reservados }) {
  const momento = MOMENTOS_DEL_DIA.find((m) => m.valor === caso.momentoDelDia)?.etiqueta ?? caso.momentoDelDia;
  return (
    <TarjetaDatos
      id="datos-reservados"
      variante="reservado"
      titulo="Datos reservados · no aparecen en la ficha"
      filas={[
        ["Momento del día", momento],
        ["Calle o cruce", caso.direccionAproximada ?? "No registrada"],
        ["Referencias del lugar", caso.referenciasDelLugar ?? "No registradas"],
        ["Motivo", caso.motivo],
        ["Descripción de las circunstancias", caso.descripcionCircunstancias ?? "No registrada"],
      ]}
    />
  );
}
