import { cx } from "@/lib/clases";

const COLORES = ["bg-avatar-1", "bg-avatar-2", "bg-avatar-3", "bg-avatar-4", "bg-avatar-5", "bg-avatar-6"] as const;

type Props = { nombre: string; /** 0 a 5; se asigna al azar según el diseño. */ color?: number; className?: string };

/** Primera letra del nombre sobre un fondo pastel; la letra es siempre negra, en ambos modos. */
export function Avatar({ nombre, color = 0, className }: Props) {
  return (
    <span
      role="img"
      aria-label={`Avatar de ${nombre}`}
      className={cx("inline-flex size-10 items-center justify-center rounded-full text-body font-semibold text-black", COLORES[color % COLORES.length], className)}
    >
      {nombre.trim().charAt(0).toUpperCase()}
    </span>
  );
}
