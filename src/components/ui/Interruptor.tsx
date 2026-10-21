import type { InputHTMLAttributes } from "react";
import { cx } from "@/lib/clases";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> & {
  etiqueta: string;
};

/** Interruptor (role="switch"). El estado se dice con texto ("Sí" / "No"), no solo con color. */
export function Interruptor({ etiqueta, className, ...resto }: Props) {
  return (
    <label className={cx("group foco-hijo flex min-h-tactil cursor-pointer items-center gap-3 rounded-campo has-[:disabled]:cursor-not-allowed has-[:disabled]:text-disabled-text", className)}>
      <input type="checkbox" role="switch" className="peer sr-only" {...resto} />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-full bg-border-strong transition-colors group-has-[:checked]:bg-primary group-has-[:disabled]:bg-disabled-bg motion-reduce:transition-none"
      >
        <span className="absolute left-1 top-1 size-5 rounded-full bg-surface transition-transform group-has-[:checked]:translate-x-5 group-has-[:checked]:bg-on-primary motion-reduce:transition-none" />
      </span>
      <span className="text-body">{etiqueta}</span>
      <span aria-hidden="true" className="ml-auto text-small font-semibold">
        <span className="group-has-[:checked]:hidden">No</span>
        <span className="hidden group-has-[:checked]:inline">Sí</span>
      </span>
    </label>
  );
}
