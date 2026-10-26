import type { Metadata } from "next";
import { DemoSesionExpirada } from "@/components/features/DemoSesionExpirada";
import { aFichaTutor, CASOS_ORIGEN } from "@/mocks/casos";

export const metadata: Metadata = { title: "TRA-02 · RUPE (solo desarrollo)" };

export default function DemoTra02() {
  return <DemoSesionExpirada fichas={[...CASOS_ORIGEN].sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro)).map(aFichaTutor)} />;
}
