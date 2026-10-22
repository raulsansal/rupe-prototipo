import type { Metadata } from "next";
import Link from "next/link";
import { PantallaMensaje } from "@/components/features/PantallaMensaje";
import { Alerta } from "@/components/ui/Alerta";
import { clasesBoton } from "@/components/ui/clasesBoton";

export const metadata: Metadata = { title: "Reporte enviado · RUPE" };

/** PUB-06 (lámina 1.7): pantalla mínima tras «Enviar reporte». No muestra datos del caso ni de nadie. */
export default async function ReporteEnviado({ params }: PageProps<"/ficha/[clave]/avistamiento/enviado">) {
  const { clave } = await params;
  return (
    <PantallaMensaje
      icono="check_circle"
      titulo="Reporte enviado"
      acciones={
        <>
          <Link href={`/ficha/${clave}`} className={clasesBoton({ tamano: "grande", anchoCompleto: true })}>
            Ver ficha
          </Link>
          <Link href="/" className={clasesBoton({ variante: "secundario", tamano: "grande", anchoCompleto: true })}>
            Ir al inicio
          </Link>
        </>
      }
    >
      <p className="text-body">Gracias por ayudar a que este perro regrese a casa.</p>
      <Alerta tipo="info" titulo="Qué sigue" className="w-full text-left">
        La persona tutora recibirá un aviso con tu reporte; no se guardó ningún dato tuyo.
      </Alerta>
    </PantallaMensaje>
  );
}
