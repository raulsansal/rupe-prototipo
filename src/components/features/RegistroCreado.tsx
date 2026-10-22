import Link from "next/link";
import { Alerta } from "@/components/ui/Alerta";
import { ChipEstado } from "@/components/ui/ChipEstado";
import { clasesBoton } from "@/components/ui/clasesBoton";
import type { FichaPublica } from "@/mocks/tipos";
import { BotonCopiar } from "./BotonCopiar";
import { QrIlustrativo } from "./QrIlustrativo";

/** TUT-04: registro creado. Recibe solo la ficha pública: folio, estado y nada reservado. */
export function RegistroCreado({ ficha }: { ficha: Pick<FichaPublica, "folio" | "estado"> }) {
  const { folio, estado } = ficha;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="text-h1">Registro creado</h1>
      <section aria-labelledby="folio-asignado" className="flex flex-col items-center gap-2 rounded-tarjeta border border-border bg-surface p-4 text-center">
        <ChipEstado estado={estado} />
        <h2 id="folio-asignado" className="text-small font-bold">
          Folio asignado
        </h2>
        <p className="text-h2 font-extrabold tabular-nums">{folio}</p>
        <BotonCopiar texto={folio} etiqueta="Copiar folio" aviso="Folio copiado" />
      </section>
      <section aria-labelledby="qr-titulo" className="flex flex-col items-center gap-3 rounded-tarjeta border border-border bg-surface p-4 text-center">
        <h2 id="qr-titulo" className="sr-only">
          Código QR de la ficha
        </h2>
        <QrIlustrativo semilla={`${folio}-1`} className="size-48 rounded-campo border border-border" />
        <p className="text-small text-text-muted">Quien lo escanee abre la ficha pública del caso y desde ahí puede reportar un avistamiento.</p>
      </section>
      <Alerta tipo="info" titulo="Guarda tu folio">
        Úsalo para consultar el estatus de tu caso. Entra a «Ver ficha de búsqueda» para imprimirla o compartirla en redes sociales. Tu información personal permanece reservada.
      </Alerta>
      <Link href={`/tutor/casos/${folio}/ficha`} className={clasesBoton({ tamano: "grande", anchoCompleto: true })}>
        Ver ficha de búsqueda
      </Link>
      <Link href={`/tutor/casos/${folio}`} className={clasesBoton({ variante: "secundario", tamano: "grande", anchoCompleto: true })}>
        Ver detalle del caso
      </Link>
      <Link href="/tutor" className={clasesBoton({ variante: "secundario", tamano: "grande", anchoCompleto: true })}>
        Ir a mis registros
      </Link>
    </div>
  );
}
