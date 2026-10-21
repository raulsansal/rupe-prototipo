type Props = { red: "facebook" | "x" | "instagram"; tamano?: number };

/**
 * Glifos sencillos propios (Material Symbols no incluye marcas). Son formas geométricas simples,
 * no los logotipos oficiales de cada red.
 */
export function IconoRedSocial({ red, tamano = 24 }: Props) {
  const comunes = { width: tamano, height: tamano, viewBox: "0 0 24 24", "aria-hidden": true, focusable: false } as const;
  if (red === "facebook") {
    return (
      <svg {...comunes} fill="currentColor">
        <path d="M13.5 21v-8h2.7l.5-3.2h-3.2V7.7c0-.9.4-1.6 1.7-1.6H17V3.3c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.5H8v3.2h2.6V21z" />
      </svg>
    );
  }
  if (red === "x") {
    return (
      <svg {...comunes} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M5 5l14 14M19 5L5 19" />
      </svg>
    );
  }
  return (
    <svg {...comunes} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
