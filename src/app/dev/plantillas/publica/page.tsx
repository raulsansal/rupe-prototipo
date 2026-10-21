import type { Metadata } from "next";
import { PlantillaPublica } from "@/components/layout/PlantillaPublica";
import { Relleno } from "../Relleno";

export const metadata: Metadata = { title: "PlantillaPublica · RUPE (solo desarrollo)" };

export default async function DemoPublica({ searchParams }: { searchParams: Promise<{ menu?: string }> }) {
  const { menu } = await searchParams;
  return (
    <PlantillaPublica menuAbiertoInicial={menu === "abierto"} rutaActiva="/">
      <Relleno titulo="Título principal" bloques={4} />
    </PlantillaPublica>
  );
}
