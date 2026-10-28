import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import type { TamanoHoja } from "@/components/features/FichaBusqueda";
import { FichaBusquedaTutor, type ModalFicha } from "@/components/features/FichaBusquedaTutor";
import { Alerta } from "@/components/ui/Alerta";
import { Boton } from "@/components/ui/Boton";
import { clasesBoton } from "@/components/ui/clasesBoton";
import { esCasoActivo } from "@/mocks/tipos";
import { basePublicaDeCabeceras } from "@/server/config/urlPublica";
import { fichaDeBusquedaDelTutor, MENSAJE_NO_ACTIVO } from "@/server/servicios/fichaBusqueda";
import { fichaDelTutor } from "@/server/servicios/misRegistros";
import { paraPagina } from "@/server/sesion/pagina";
import { obtenerSesion } from "@/server/sesion/sesion";

export const metadata: Metadata = { title: "Ficha de búsqueda · RUPE" };

const MODALES: ModalFicha[] = ["visor", "compartir", "regenerar"];

/**
 * TUT-07: lee el caso del almacén con la guarda de dueño (404 uniforme). Con el caso en curso muestra la vista previa con el QR real; con Localizado o Cerrado (incluidos
 * cancelado y deshabilitado) muestra el aviso y las acciones deshabilitadas, sin vista previa (el caso conserva su último QR). ?modal=visor|compartir|regenerar abre un modal y
 * ?hoja=carta|media-carta elige el tamaño del visor (capturas y pruebas).
 */
export default async function PaginaFichaBusqueda({ params, searchParams }: PageProps<"/tutor/casos/[folio]/ficha">) {
  const { folio } = await params;
  const { modal, hoja } = await searchParams;
  const sesion = await obtenerSesion();
  const ficha = await paraPagina(fichaDelTutor(sesion, folio));
  if (!esCasoActivo(ficha.estado)) {
    const motivo = "Disponible solo mientras el caso sigue en curso";
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <h1 className="text-h1">Ficha de búsqueda</h1>
        <Alerta tipo="info" titulo="La ficha ya no está disponible">
          {MENSAJE_NO_ACTIVO} El caso conserva el último código QR que se generó.
        </Alerta>
        <section aria-label="Acciones de la ficha" className="flex flex-col gap-3 rounded-tarjeta border border-border bg-surface-raised p-4">
          <Boton anchoCompleto icono="print" disabled aria-describedby="motivo-ficha">
            Imprimir ficha de búsqueda
          </Boton>
          <div className="grid grid-cols-2 gap-3">
            <Boton variante="secundario" icono="share" disabled aria-describedby="motivo-ficha">
              Compartir
            </Boton>
            <Boton variante="secundario" icono="refresh" disabled aria-describedby="motivo-ficha">
              Regenerar QR
            </Boton>
          </div>
          <p id="motivo-ficha" className="text-small text-text-muted">
            {motivo}: Imprimir, Compartir y Regenerar QR están deshabilitados.
          </p>
          <Link href={`/tutor/casos/${ficha.folio}`} className={clasesBoton({ tamano: "grande", anchoCompleto: true })}>
            Regresar al detalle del caso
          </Link>
        </section>
      </div>
    );
  }
  const vista = await paraPagina(fichaDeBusquedaDelTutor(sesion, folio, basePublicaDeCabeceras(await headers())));
  const modalInicial = MODALES.find((m) => m === modal);
  const hojaInicial: TamanoHoja = hoja === "media-carta" ? "media-carta" : "carta";
  // La vista previa recibe solo FichaPublica y la matriz del QR: nada reservado ni de la persona tutora.
  return <FichaBusquedaTutor ficha={vista.ficha} qr={vista.qr} avisoQr={vista.avisoQr} dominio={vista.dominio} enlaceCompartir={vista.enlaceCompartir} fechaQr={vista.fechaQr} modalInicial={modalInicial} hojaInicial={hojaInicial} />;
}
