import Link from "next/link";

// Marcador de posición: la página principal pública se construye en un bloque posterior.
export default function Inicio() {
  return (
    <>
      <h1 className="text-h1">RUPE</h1>
      <p className="mt-2 text-body text-text-muted">
        Contenido de la pantalla (Bloque 3). Demostración de las plantillas en{" "}
        <Link href="/dev/plantillas" className="font-semibold text-primary underline">
          /dev/plantillas
        </Link>
        .
      </p>
    </>
  );
}
