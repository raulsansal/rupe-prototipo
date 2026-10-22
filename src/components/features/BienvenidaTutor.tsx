import Link from "next/link";
import { Icono } from "@/components/ui/Icono";
import { clasesBoton } from "@/components/ui/clasesBoton";

const PASOS = [
  { titulo: "Registra a tu perro", texto: "Captura sus datos y una fotografía, y cuéntanos cómo y dónde se extravió." },
  { titulo: "Recibe tu folio y tu ficha", texto: "RUPE te asigna un folio y genera la ficha de búsqueda con un código QR." },
  { titulo: "Comparte la ficha", texto: "Imprímela, descárgala o compártela en tus redes y grupos vecinales." },
  { titulo: "Recibe avistamientos", texto: "Cuando alguien lo vea, te avisamos y puedes revisar el reporte aquí." },
];

/** TUT-01 sin registros: bienvenida y pasos de uso (lámina 2.3, continuación). */
export function BienvenidaTutor({ nombre }: { nombre: string }) {
  return (
    <section aria-labelledby="bienvenida" className="flex flex-col gap-4 rounded-tarjeta border border-border bg-surface p-4 md:p-6">
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icono nombre="pets" tamano={32} />
      </span>
      <h2 id="bienvenida" className="text-center text-h2 font-bold">
        ¡Hola, {nombre}!
      </h2>
      <p className="text-center text-body text-text-muted">Aquí aparecerán los perros que registres. Mientras no haya ninguno, así funciona RUPE:</p>
      <ol aria-label="Así funciona RUPE" className="flex flex-col divide-y divide-border border-y border-border">
        {PASOS.map((p, i) => (
          <li key={p.titulo} className="flex gap-4 py-3">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-boton border border-border-strong text-small font-bold">
              {i + 1}
            </span>
            <div>
              <h3 className="text-body font-semibold">{p.titulo}</h3>
              <p className="text-small text-text-muted">{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link href="/tutor/registrar" className={clasesBoton({ tamano: "grande", anchoCompleto: true })}>
        Registrar mi primer extravío
      </Link>
    </section>
  );
}
