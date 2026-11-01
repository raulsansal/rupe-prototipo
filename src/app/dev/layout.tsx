import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { esSitioPublico } from "@/server/config/urlPublica";

/** Galerías y demos de desarrollo: con `RUPE_URL_PUBLICA` https (demostración por túnel) responden 404. `connection()` las lee en cada petición, no al compilar. */
export default async function LayoutDev({ children }: { children: ReactNode }) {
  await connection();
  if (esSitioPublico()) notFound();
  return children;
}
