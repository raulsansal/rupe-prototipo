"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlantillaTutor } from "@/components/layout/PlantillaTutor";
import { SESION_TUTOR_EJEMPLO } from "@/mocks/sesion";
import type { FichaTutor } from "@/mocks/tipos";
import { ListaRegistros } from "./ListaRegistros";
import { ModalSesionExpirada } from "./ModalSesionExpirada";

/** Demostración de TRA-02: «Mis registros» de fondo, con la barra inferior, y el modal encima. Solo desarrollo. */
export function DemoSesionExpirada({ fichas }: { fichas: FichaTutor[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(true);
  return (
    <PlantillaTutor sesion={SESION_TUTOR_EJEMPLO} itemActivo="/tutor">
      <h1 className="mb-4 text-h1">Mis registros</h1>
      <ListaRegistros fichas={fichas} />
      <ModalSesionExpirada abierto={abierto} onCerrar={() => setAbierto(false)} onIniciarSesion={() => router.push("/acceso")} />
    </PlantillaTutor>
  );
}
