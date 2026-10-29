import type { Metadata } from "next";
import Link from "next/link";
import { PantallaMensaje } from "@/components/features/PantallaMensaje";
import { Alerta } from "@/components/ui/Alerta";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { PATRON_FOLIO } from "@/mocks/tipos";

export const metadata: Metadata = { title: "Reporte enviado · RUPE", robots: { index: false } };

/**
 * PUB-06 (lámina 1.7): tras «Enviar reporte». Solo repite el ID recibido (?id=): NO consulta ningún dato del caso ni de nadie. El enlace «Ver ficha» solo aparece si la ruta trae un folio
 * con formato válido (nunca se arma con un token).
 */
export default async function ReporteEnviado({ params, searchParams }: PageProps<"/ficha/[clave]/avistamiento/enviado">) {
  const { clave } = await params;
  const { id } = await searchParams;
  const folio = clave.toUpperCase();
  const idReporte = typeof id === "string" && /^\d{1,9}$/.test(id) ? id : undefined;
  return (
    <PantallaMensaje
      icono="check_circle"
      titulo="Reporte enviado"
      acciones={
        <>
          {PATRON_FOLIO.test(folio) && (
            <Link href={`/ficha/${folio}`} className={clasesBoton({ tamano: "grande", anchoCompleto: true })}>
              Ver ficha
            </Link>
          )}
          <Link href="/" className={clasesBoton({ variante: PATRON_FOLIO.test(folio) ? "secundario" : "primario", tamano: "grande", anchoCompleto: true })}>
            Ir al inicio
          </Link>
        </>
      }
    >
      <p className="text-body">Gracias por ayudar a que este perro regrese a casa.</p>
      {idReporte && (
        <p className="text-body">
          ID de tu reporte: <strong className="font-bold tabular-nums">{idReporte}</strong>
        </p>
      )}
      <Alerta tipo="info" titulo="Qué sigue" className="w-full text-left">
        La persona tutora recibirá un aviso con tu reporte; no se guardó ningún dato tuyo.
      </Alerta>
    </PantallaMensaje>
  );
}
