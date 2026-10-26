import Link from "next/link";
import { altDeFoto } from "@/lib/altDeFoto";
import { Alerta } from "@/components/ui/Alerta";
import { ChipEstado } from "@/components/ui/ChipEstado";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { FotoPerro } from "@/components/ui/FotoPerro";
import { Plegable } from "@/components/ui/Plegable";
import type { EstadoCaso } from "@/mocks/tipos";
import type { CasoCreado } from "@/server/servicios/extravio";
import { BotonCopiar } from "./BotonCopiar";
import { QrIlustrativo } from "./QrIlustrativo";

/**
 * TUT-04 (HU 013): registro creado. Solo recibe lo que ve su dueña: folio, estado, resumen del perro, el aviso en la aplicación y, si tiene las notificaciones
 * activas, la vista previa del correo (no se envía nada). Nada reservado del extravío.
 */
export function RegistroCreado({ caso }: { caso: CasoCreado }) {
  const { folio } = caso;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="text-h1">Registro creado</h1>
      <section aria-labelledby="folio-asignado" className="flex flex-col items-center gap-2 rounded-tarjeta border border-border bg-surface p-4 text-center">
        <ChipEstado estado={caso.estado as EstadoCaso} />
        <h2 id="folio-asignado" className="text-small font-bold">
          Folio asignado
        </h2>
        <p className="text-h2 font-extrabold tabular-nums">{folio}</p>
        <BotonCopiar texto={folio} etiqueta="Copiar folio" aviso="Folio copiado" />
      </section>
      <section aria-labelledby="perro-registrado" className="flex items-center gap-3 rounded-tarjeta border border-border bg-surface p-4">
        {caso.fotoUrl && <FotoPerro src={caso.fotoUrl} alt={altDeFoto({ nombre: caso.nombreDelPerro, sexo: caso.sexo, raza: caso.raza, tamano: caso.tamano, color: caso.color })} lado={64} />}
        <div className="min-w-0">
          <h2 id="perro-registrado" className="break-words text-h3 font-semibold">
            {caso.nombreDelPerro}
          </h2>
          <p className="text-small text-text-muted">
            {caso.sexo} · {caso.edadTexto} · {caso.tamano}
          </p>
        </div>
      </section>
      <section aria-labelledby="qr-titulo" className="flex flex-col items-center gap-3 rounded-tarjeta border border-border bg-surface p-4 text-center">
        <h2 id="qr-titulo" className="sr-only">
          Código QR de la ficha
        </h2>
        <QrIlustrativo semilla={`${folio}-1`} className="size-48 rounded-campo border border-border" />
        <p className="text-small text-text-muted">Quien lo escanee abre la ficha pública del caso y desde ahí puede reportar un avistamiento.</p>
      </section>
      <Alerta tipo="exito" titulo="Te avisamos tu folio">
        {caso.aviso}
      </Alerta>
      {caso.correo && (
        <Plegable nivel={2} titulo="Vista previa del correo" descripcion="Así se vería el aviso por correo; en esta versión de prueba no se envía.">
          <div className="flex flex-col gap-2 rounded-campo border border-border bg-surface-raised p-3 text-small">
            <p>
              <span className="font-bold">Asunto: </span>
              {caso.correo.asunto}
            </p>
            {caso.correo.cuerpo.map((linea) => (
              <p key={linea} className="break-words">
                {linea}
              </p>
            ))}
          </div>
        </Plegable>
      )}
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
