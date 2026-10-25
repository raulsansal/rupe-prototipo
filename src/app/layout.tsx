import type { Metadata } from "next";
import localFont from "next/font/local";
import { SCRIPT_TEMA_INICIAL } from "@/lib/tema";
import "./globals.css";

// Montserrat alojada en el repositorio (src/app/fonts, licencia OFL): el build no hace peticiones a Google. Una sola carga con las dos
// variantes (normal y cursiva) y el peso variable de 100 a 900; el sistema de diseño usa 400 a 800 en normal y 400 y 600 en cursiva.
const montserrat = localFont({
  variable: "--font-montserrat",
  display: "swap",
  src: [
    { path: "./fonts/montserrat-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/montserrat-latin-wght-italic.woff2", weight: "100 900", style: "italic" },
  ],
});

export const metadata: Metadata = {
  title: "RUPE · Registro Único de Perros Extraviados",
  description: "Registro Único de Perros Extraviados de la Ciudad de México.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${montserrat.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
