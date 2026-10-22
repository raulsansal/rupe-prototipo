import { Plegable } from "@/components/ui/Plegable";

const PUBLICOS = ["Fotografía", "Nombre", "Sexo", "Raza", "Edad aproximada", "Tamaño", "Color", "Características distintivas", "Fecha del extravío", "Alcaldía", "Colonia o zona", "Folio", "Estado del caso"];
const RESERVADOS = ["Calle o cruce", "Referencias del lugar", "Momento del día", "Motivo", "Descripción de las circunstancias", "Tus datos personales (nombre, correo y teléfono)"];

/**
 * Qué datos se publican en la ficha y cuáles quedan reservados (criterio vigente). Bloque plegable, cerrado al inicio; la
 * línea de resumen se ve siempre. Los dos grupos se distinguen por título y por borde, no solo por color.
 */
export function AvisoPublicoReservado() {
  return (
    <Plegable
      nivel={2}
      titulo="Qué datos serán públicos y cuáles reservados"
      descripcion="Tus datos personales y las circunstancias del extravío nunca aparecen en la ficha."
    >
      <div className="grid gap-3 py-2 md:grid-cols-2">
        <div className="rounded-campo border border-border p-3">
          <h3 className="text-small font-bold">Públicos: aparecen en la ficha</h3>
          <p className="mt-1 text-small text-text-muted">{PUBLICOS.join(" · ")}.</p>
        </div>
        <div className="rounded-campo border-2 border-dashed border-border-strong p-3">
          <h3 className="text-small font-bold">Reservados: nunca aparecen en la ficha</h3>
          <p className="mt-1 text-small text-text-muted">{RESERVADOS.join(" · ")}.</p>
        </div>
      </div>
    </Plegable>
  );
}
