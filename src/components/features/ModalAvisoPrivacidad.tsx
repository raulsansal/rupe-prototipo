"use client";

import { Boton } from "@/components/ui/Boton";
import { Modal } from "@/components/ui/Modal";
import { useEtiquetaVersionAviso } from "@/components/layout/VersionAviso";

/** Texto del aviso de privacidad (ilustrativo en la maqueta; el definitivo lo redacta la institución responsable). */
export function TextoAvisoPrivacidad() {
  return (
    <div className="flex flex-col gap-2 text-small">
      <p>Texto ilustrativo de la maqueta. El aviso definitivo lo redactará la institución responsable.</p>
      <p>Los datos de la persona tutora (nombre, correo y teléfono) se usan para avisarle de un avistamiento y nunca se publican en la ficha.</p>
      <p>La ficha pública muestra solo la fotografía, el nombre, el sexo, la raza, la edad aproximada, el tamaño, el color, las características distintivas, la fecha de extravío, la alcaldía, la colonia o zona, el folio y el estado del caso.</p>
      <p>Quien reporta un avistamiento lo hace sin cuenta; el reporte solo contiene la fotografía, el lugar, la fecha, el estado del animal y un comentario opcional.</p>
      <p>Cuando cambie la versión del aviso, las personas con cuenta deberán aceptarla de nuevo al iniciar sesión; queda registrada la versión y la fecha de aceptación.</p>
    </div>
  );
}

type Props = {
  abierto: boolean;
  /** Se llama al cerrar por cualquier vía (Escape, clic fuera, «Cerrar»). En modo registro equivale a no decidir. */
  onCerrar: () => void;
  /**
   * lectura: solo se lee y se cierra (PUB-01).
   * registro: «Rechazar» y «Aceptar» (ACC-02); sin decisión el registro no se completa (HU 003).
   */
  modo: "lectura" | "registro";
  onAceptar?: () => void;
  onRechazar?: () => void;
  /** Etiqueta de la versión vigente (p. ej. «v1.0»); por defecto la del parámetro real (la entrega el layout raíz). */
  version?: string;
};

/** MOD-01: aviso de privacidad completo, con la versión del parámetro `version_aviso_privacidad`. */
export function ModalAvisoPrivacidad({ abierto, onCerrar, modo, onAceptar, onRechazar, version }: Props) {
  const vigente = useEtiquetaVersionAviso();
  const etiqueta = version ?? vigente;
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={`Aviso de privacidad ${etiqueta}`} tamano="md">
      <TextoAvisoPrivacidad />
      {modo === "registro" ? (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Boton variante="secundario" onClick={onRechazar}>
            Rechazar
          </Boton>
          <Boton onClick={onAceptar}>Aceptar</Boton>
        </div>
      ) : (
        <Boton anchoCompleto className="mt-2" onClick={onCerrar} autoFocus>
          Cerrar
        </Boton>
      )}
    </Modal>
  );
}
