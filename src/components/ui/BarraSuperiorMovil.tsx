import { Logo } from "./Logo";
import { BotonIcono } from "./BotonIcono";

type Props = { onAbrirMenu?: () => void; menuAbierto?: boolean };

/** Barra superior en móvil: logotipo y botón de menú. */
export function BarraSuperiorMovil({ onAbrirMenu, menuAbierto = false }: Props) {
  return (
    <header className="flex h-16 items-center justify-between rounded-tarjeta border border-border bg-surface pl-4 pr-2">
      <Logo variante="horizontal" ancho={104} />
      <BotonIcono icono="menu" etiqueta="Menú" aria-expanded={menuAbierto} onClick={onAbrirMenu} />
    </header>
  );
}
