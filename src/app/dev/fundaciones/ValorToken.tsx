"use client";

/** Muestra el valor real del token CSS tal como lo ve el navegador en el tema del contenedor. */
export function ValorToken({ variable }: { variable: string }) {
  return (
    <span
      className="font-mono text-caption uppercase"
      ref={(el) => {
        if (el) el.textContent = getComputedStyle(el).getPropertyValue(`--${variable}`).trim();
      }}
    />
  );
}
