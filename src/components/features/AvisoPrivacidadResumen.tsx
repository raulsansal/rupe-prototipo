"use client";

import { useId, useState } from "react";
import { Boton } from "@/components/ui/Boton";

/** «Leer aviso completo»: despliega el texto en la misma página (el aviso no tiene una página aparte). Texto ilustrativo. */
export function AvisoPrivacidadResumen() {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Boton variante="secundario" anchoCompleto aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto((a) => !a)}>
        {abierto ? "Ocultar aviso completo" : "Leer aviso completo"}
      </Boton>
      <div id={id} hidden={!abierto} className="mt-3 flex flex-col gap-2 text-small">
        <p>Texto ilustrativo de la maqueta. El aviso definitivo lo redactará la institución responsable.</p>
        <p>Los datos de la persona tutora (nombre, correo y teléfono) se usan para avisarle de un avistamiento y nunca se publican en la ficha.</p>
        <p>Quien reporta un avistamiento lo hace sin cuenta; el reporte solo contiene la fotografía, el lugar, la fecha, el estado del animal y un comentario opcional.</p>
        <p>Cuando cambie la versión del aviso, las personas con cuenta deberán aceptarla de nuevo al iniciar sesión.</p>
      </div>
    </>
  );
}
