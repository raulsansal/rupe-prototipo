import Image from "next/image";
import { cx } from "@/lib/clases";

type Props = {
  src: string;
  alt: string;
  /** Lado en px (miniatura 1:1 recortada al centro). */
  lado?: number;
  /** Menor énfasis (casos localizados o cerrados). */
  atenuada?: boolean;
  className?: string;
};

/** Miniatura 1:1 de la fotografía de un perro. */
export function FotoPerro({ src, alt, lado = 80, atenuada = false, className }: Props) {
  return (
    <span className={cx("relative block shrink-0 overflow-hidden rounded-campo bg-disabled-bg", className)} style={{ width: lado, height: lado }}>
      {/* Las fotos subidas se sirven por /api/fotografias (con la sesión de su dueña): el optimizador de imágenes no tiene esa cookie, así que se piden tal cual. */}
      <Image src={src} alt={alt} fill sizes={`${lado}px`} loading="eager" unoptimized={src.startsWith("/api/")} className={cx("object-cover", atenuada && "opacity-70 grayscale")} />
    </span>
  );
}
