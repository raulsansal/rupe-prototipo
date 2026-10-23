"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { ModalAvisoPrivacidad } from "./ModalAvisoPrivacidad";

/** «Leer aviso completo» (PUB-01): abre el aviso completo en un modal de solo lectura (MOD-01). `abiertoInicial` es para capturas. */
export function AvisoPrivacidadResumen({ abiertoInicial = false }: { abiertoInicial?: boolean }) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  return (
    <>
      <Boton variante="secundario" anchoCompleto aria-haspopup="dialog" onClick={() => setAbierto(true)}>
        Leer aviso completo
      </Boton>
      <ModalAvisoPrivacidad abierto={abierto} onCerrar={() => setAbierto(false)} modo="lectura" />
    </>
  );
}
