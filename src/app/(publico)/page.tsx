import type { Metadata } from "next";
import Link from "next/link";
import { AvisoPrivacidadResumen } from "@/components/features/AvisoPrivacidadResumen";
import { BuscadorFolio } from "@/components/features/BuscadorFolio";
import { ImagenPrincipal } from "@/components/features/ImagenPrincipal";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { Icono, type NombreIcono } from "@/components/ui/Icono";
import { Plegable } from "@/components/ui/Plegable";
import { etiquetaVersionAviso } from "@/mocks/parametros";

export const metadata: Metadata = { title: "RUPE · Registro Único de Perros Extraviados" };

const PASOS: { icono: NombreIcono; titulo: string; texto: string }[] = [
  { icono: "add_circle", titulo: "Registra el extravío", texto: "La persona tutora crea su cuenta y registra a su perro. RUPE le asigna un folio y genera su ficha de búsqueda con código QR." },
  { icono: "qr_code_2", titulo: "Comparte la ficha", texto: "Cualquier persona puede consultar la ficha con el folio o escaneando el código QR. La ficha nunca muestra datos de la persona tutora." },
  { icono: "notifications", titulo: "Recibe avistamientos", texto: "Quien vea al perro reporta un avistamiento sin registrarse, y la persona tutora recibe un aviso para dar seguimiento." },
];

const PREGUNTAS: { pregunta: string; respuesta: string }[] = [
  { pregunta: "¿Necesito una cuenta para reportar un avistamiento?", respuesta: "No. Reportar un avistamiento no pide registro ni datos personales: solo una fotografía, el lugar, la fecha y hora, y el estado del animal." },
  { pregunta: "¿Qué datos de la persona tutora se muestran?", respuesta: "Ninguno. La ficha pública muestra solo los datos del perro, la fecha de extravío, la alcaldía y la colonia o zona." },
  { pregunta: "¿RUPE sirve para otros animales o se conecta con registros oficiales?", respuesta: "No. RUPE es solo para perros y no está integrado con otros registros oficiales." },
];

const seccion = "flex scroll-mt-20 flex-col gap-3";

/** PUB-01. ?aviso=abierto abre el aviso de privacidad completo (MOD-01, solo lectura) al cargar (capturas y pruebas). */
export default async function PaginaPrincipal({ searchParams }: PageProps<"/">) {
  const { aviso } = await searchParams;
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="titulo-principal" className="flex flex-col gap-4">
        <h1 id="titulo-principal" className="text-h1 max-w-3xl">
          Registro Único de Perros Extraviados de la Ciudad de México
        </h1>
        <p className="max-w-3xl text-body text-text-muted">
          Registra el extravío de tu perro, comparte su ficha y recibe un aviso cuando alguien lo vea. Cualquier persona puede ayudar sin crear una cuenta.
        </p>
        <div className="flex flex-col gap-3 md:flex-row">
          <Link href="/registro" className={clasesBoton({ tamano: "grande", className: "md:flex-1" })}>
            Registrar extravío
          </Link>
          <Link href="#buscar-folio" className={clasesBoton({ variante: "secundario", tamano: "grande", className: "md:flex-1" })}>
            Consultar ficha por folio
          </Link>
        </div>
      </section>

      <ImagenPrincipal className="aspect-[16/9] md:aspect-[21/8]" />

      <section id="buscar-folio" aria-labelledby="titulo-buscar" className="scroll-mt-20 rounded-tarjeta border border-border bg-surface p-4">
        <h2 id="titulo-buscar" className="mb-3 text-h3 font-semibold">
          Buscar por folio
        </h2>
        <BuscadorFolio />
      </section>

      <section id="como-funciona" aria-labelledby="titulo-como-funciona" className={seccion}>
        <h2 id="titulo-como-funciona" className="text-h2 font-bold">
          ¿Cómo funciona RUPE?
        </h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {PASOS.map((p, i) => (
            <li key={p.titulo} className="flex gap-4 rounded-tarjeta border border-border bg-surface p-4 md:flex-col">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Icono nombre={p.icono} />
              </span>
              <div>
                <h3 className="text-h3 font-semibold">
                  <span className="sr-only">Paso {i + 1}: </span>
                  {p.titulo}
                </h3>
                <p className="mt-1 text-small text-text-muted">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="preguntas-frecuentes" aria-labelledby="titulo-preguntas" className={seccion}>
        <h2 id="titulo-preguntas" className="text-h2 font-bold">
          Preguntas frecuentes
        </h2>
        <div className="flex flex-col gap-3">
          {PREGUNTAS.map((p) => (
            <Plegable key={p.pregunta} titulo={p.pregunta} nivel={3}>
              <p className="py-2 text-body">{p.respuesta}</p>
            </Plegable>
          ))}
        </div>
      </section>

      <section id="aviso-de-privacidad" aria-labelledby="titulo-aviso" className="scroll-mt-20 rounded-tarjeta border border-border bg-surface p-4">
        <h2 id="titulo-aviso" className="text-h3 font-semibold">
          Aviso de privacidad {etiquetaVersionAviso()}
        </h2>
        <p className="mb-3 mt-2 text-small text-text-muted">
          Los datos de la persona tutora se usan solo para avisarle de un avistamiento y nunca se publican. Reportar un avistamiento no requiere registro.
        </p>
        <AvisoPrivacidadResumen abiertoInicial={aviso === "abierto"} />
      </section>

      <section id="contacto" aria-labelledby="titulo-contacto" className="scroll-mt-20 rounded-tarjeta border border-border bg-surface p-4">
        <h2 id="titulo-contacto" className="text-h3 font-semibold">
          Contacto
        </h2>
        <p className="mt-2 text-small text-text-muted">
          ¿Tienes dudas o comentarios? Escríbenos a{" "}
          <a href="mailto:contacto@rupe.example" className="font-semibold text-primary underline">
            contacto@rupe.example
          </a>
          .
        </p>
      </section>
    </div>
  );
}
