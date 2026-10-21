import Link from "next/link";

// Marcador de posición del Bloque 0; la página principal pública se construye en el Bloque 1.
export default function Inicio() {
  return (
    <main className="p-6">
      <p className="text-body">
        RUPE · Bloque 0 (fundaciones). Ver{" "}
        <Link href="/dev/fundaciones" className="font-semibold text-primary underline">
          /dev/fundaciones
        </Link>
        .
      </p>
    </main>
  );
}
