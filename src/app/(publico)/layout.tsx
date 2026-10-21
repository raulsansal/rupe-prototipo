import type { ReactNode } from "react";
import { PlantillaPublica } from "@/components/layout/PlantillaPublica";

export default function LayoutPublico({ children }: { children: ReactNode }) {
  return <PlantillaPublica>{children}</PlantillaPublica>;
}
