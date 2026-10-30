"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { enviarAdmin, MENSAJE_YA_CAMBIO } from "@/lib/clienteAdmin";

/**
 * Deshabilitar o restaurar un registro por /api/admin/registros/[folio]/moderacion (lista y detalle comparten esta lógica). Una sola petición a la vez; tras el resultado refresca la pantalla con el
 * estado real del servidor. El aviso dice solo lo que ocurrió: éxito, «ya había cambiado» (409) o el error del servidor. Devuelve `true` si el modal puede cerrarse.
 */
export function useAccionRegistro() {
  const router = useRouter();
  const enviando = useRef(false);
  const [aviso, setAviso] = useState<string>();

  async function accionar(folio: string, cuerpo: { accion: "deshabilitar"; motivo: string } | { accion: "restaurar" }): Promise<boolean> {
    if (enviando.current) return false; // doble clic o Enter repetido: una sola petición
    enviando.current = true;
    try {
      const r = await enviarAdmin(`/api/admin/registros/${folio}/moderacion`, "POST", cuerpo);
      if (r.ok) {
        setAviso(cuerpo.accion === "deshabilitar" ? `Registro ${folio} deshabilitado: pasó a «Cerrado»` : `Registro ${folio} restaurado: volvió a «${String(r.datos?.estado ?? "")}»`);
        router.refresh();
        return true;
      }
      if (r.estado === 409) {
        setAviso(`El registro ${folio}: ${MENSAJE_YA_CAMBIO.charAt(0).toLowerCase()}${MENSAJE_YA_CAMBIO.slice(1)}`);
        router.refresh();
        return true;
      }
      if (r.estado === 401 || r.estado === 403 || r.estado === 404) {
        router.refresh(); // la sesión o el registro ya no valen: la página vuelve a validarlos
        return true;
      }
      setAviso(r.mensaje ?? "No se pudo completar la acción.");
      return false;
    } finally {
      enviando.current = false;
    }
  }
  return { accionar, aviso, setAviso };
}
