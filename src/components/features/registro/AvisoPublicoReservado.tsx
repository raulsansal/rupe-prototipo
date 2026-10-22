import { Icono } from "@/components/ui/Icono";

const PUBLICOS = ["Fotografía", "Nombre", "Sexo", "Raza", "Edad aproximada", "Tamaño", "Color", "Características distintivas", "Fecha del extravío", "Alcaldía", "Colonia o zona", "Folio", "Estado del caso"];
const RESERVADOS = ["Calle o cruce", "Referencias del lugar", "Momento del día", "Motivo", "Descripción de las circunstancias", "Tus datos personales (nombre, correo y teléfono)"];

/** Qué datos se publican en la ficha y cuáles quedan reservados (criterio vigente). Se distinguen por título y por borde, no solo por color. */
export function AvisoPublicoReservado() {
  return (
    <section aria-labelledby="aviso-publico" className="flex flex-col gap-3 rounded-tarjeta border border-border bg-surface p-4">
      <h2 id="aviso-publico" className="flex items-center gap-2 text-small font-bold">
        <Icono nombre="info" tamano={20} className="text-info" />
        Qué datos serán públicos y cuáles reservados
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-campo border border-border p-3">
          <h3 className="text-small font-bold">Públicos: aparecen en la ficha</h3>
          <p className="mt-1 text-small text-text-muted">{PUBLICOS.join(" · ")}.</p>
        </div>
        <div className="rounded-campo border-2 border-dashed border-border-strong p-3">
          <h3 className="text-small font-bold">Reservados: nunca aparecen en la ficha</h3>
          <p className="mt-1 text-small text-text-muted">{RESERVADOS.join(" · ")}.</p>
        </div>
      </div>
    </section>
  );
}
