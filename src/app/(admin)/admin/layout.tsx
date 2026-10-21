import type { ReactNode } from "react";
import { PlantillaAdmin } from "@/components/layout/PlantillaAdmin";
import { SESION_ADMIN_EJEMPLO } from "@/mocks/sesion";

// Sin autenticación en esta fase: la sesión es ficticia.
export default function LayoutAdmin({ children }: { children: ReactNode }) {
  return <PlantillaAdmin sesion={SESION_ADMIN_EJEMPLO}>{children}</PlantillaAdmin>;
}
