import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { SCRIPT_TEMA_INICIAL } from "@/lib/tema";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: "normal",
  display: "swap",
});

// Cursivas: solo 400 y 600 (lámina 4.4). Se carga aparte para no descargar cursivas de más.
const montserratCursiva = Montserrat({
  variable: "--font-montserrat-cursiva",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: "italic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RUPE · Registro Único de Perros Extraviados",
  description: "Registro Único de Perros Extraviados de la Ciudad de México.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${montserrat.variable} ${montserratCursiva.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
