import Link from "next/link";
import { altDeFoto } from "@/lib/altDeFoto";
import { ChipEstado } from "@/components/ui/ChipEstado";
import { FotoPerro } from "@/components/ui/FotoPerro";
import { Icono } from "@/components/ui/Icono";
import { formatearFechaCorta, formatearFechaLocal } from "@/lib/formato";
import type { FichaTutor } from "@/mocks/tipos";

const TAMANO = { pequeño: "Pequeño", mediano: "Mediano", grande: "Grande" } as const;

type Props = {
  /** Campos públicos de la ficha más la fecha del último cambio de estado: nunca datos de la persona tutora. */
  ficha: FichaTutor;
  href: string;
  /** Solo galería: muestra el estado presionado. */
  "data-estado"?: "presionado";
};

/** Tarjeta de un perro registrado (lista «Mis registros»). Toda la fila es un enlace. */
export function TarjetaPerro({ ficha, href, ...resto }: Props) {
  const cerrado = ficha.estado === "Localizado" || ficha.estado === "Cerrado";
  const hembra = ficha.sexo === "Hembra";
  // «Localizado el {fecha}» solo si el estado es Localizado y se conoce la fecha del cambio; si no, la fecha de extravío.
  const leyenda =
    ficha.estado === "Localizado" && ficha.fechaCambioEstado
      ? `${hembra ? "Localizada" : "Localizado"} el ${formatearFechaLocal(ficha.fechaCambioEstado)}`
      : `${hembra ? "Extraviada" : "Extraviado"} el ${formatearFechaCorta(ficha.fechaExtravio)}`;
  return (
    <Link
      href={href}
      className="flex min-h-tactil items-center gap-4 rounded-tarjeta border border-border bg-surface p-4 transition-colors hover:border-border-strong active:bg-primary-soft data-[estado=presionado]:bg-primary-soft motion-reduce:transition-none"
      {...resto}
    >
      <FotoPerro src={ficha.fotografiaUrl} alt={altDeFoto(ficha)} atenuada={cerrado} />
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="text-h3 font-semibold">{ficha.nombre}</span>
        <span className="text-small text-text-muted">
          {ficha.sexo} · {ficha.raza} · {TAMANO[ficha.tamano]}
        </span>
        <ChipEstado estado={ficha.estado} />
        <span className="flex flex-wrap items-baseline gap-x-2 text-small">
          <span className="whitespace-nowrap font-bold">{ficha.folio}</span>
          <span className="text-text-muted">{leyenda}</span>
        </span>
      </span>
      <Icono nombre="chevron_right" className="shrink-0 text-text-muted" />
    </Link>
  );
}
