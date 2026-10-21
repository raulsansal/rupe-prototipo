import type { Metadata } from "next";
import { PlantillaAdmin } from "@/components/layout/PlantillaAdmin";
import { SESION_ADMIN_EJEMPLO } from "@/mocks/sesion";
import { Relleno } from "../Relleno";

export const metadata: Metadata = { title: "PlantillaAdmin · RUPE (solo desarrollo)" };

export default async function DemoAdmin({ searchParams }: { searchParams: Promise<{ menu?: string }> }) {
  const { menu } = await searchParams;
  return (
    <PlantillaAdmin sesion={SESION_ADMIN_EJEMPLO} itemActivo="/admin" menuAbiertoInicial={menu === "abierto"}>
      <Relleno titulo="Tablero" bloques={4} />
    </PlantillaAdmin>
  );
}
