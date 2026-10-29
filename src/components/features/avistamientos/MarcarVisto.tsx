"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * HU 040, regla 3: al ABRIR el detalle de un avistamiento nuevo se marca como visto y, si el caso está en «Avistamiento reportado», pasa a «En seguimiento». La escritura la hace este componente
 * con un POST al MONTARSE (solo si el avistamiento es nuevo), nunca el servidor al renderizar: así un prefetch o una lectura no marcan nada. El servicio es idempotente (el doble montaje de
 * desarrollo, o repetir la petición, no duplica movimientos). Al terminar se refresca la pantalla: el estado del caso, la insignia «Nuevo» y la campana se actualizan con datos reales.
 */
export function MarcarVisto({ folio, id, nuevo }: { folio: string; id: number; nuevo: boolean }) {
  const router = useRouter();
  const enviado = useRef(false);
  useEffect(() => {
    if (!nuevo || enviado.current) return;
    enviado.current = true;
    fetch(`/api/casos/${folio}/avistamientos/${id}/visto`, { method: "POST" })
      .then(() => router.refresh())
      .catch(() => {
        enviado.current = false; // sin conexión: se reintenta al volver a abrir el detalle
      });
  }, [folio, id, nuevo, router]);
  return null;
}
