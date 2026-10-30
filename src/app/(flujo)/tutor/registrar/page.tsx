import type { Metadata } from "next";
import { FlujoRegistro } from "@/components/features/registro/FlujoRegistro";
import { ID_RAZA_OTRA } from "@/config/catalogos";
import { exigirSesionDePagina, paraPagina } from "@/server/sesion/pagina";
import { opcionesDeRegistro } from "@/server/servicios/catalogosRegistro";

export const metadata: Metadata = { title: "Registrar extravío · RUPE" };

/** TUT-02 y TUT-03. ?paso=1|2 fija el paso inicial; ?raza=otra abre el paso 1 con la raza «Otra» y la fotografía cargada (capturas). */
export default async function RegistrarExtravio({ searchParams }: PageProps<"/tutor/registrar">) {
  const sesion = await exigirSesionDePagina("Tutor"); // esta ruta no cuelga del layout de (tutor)
  const opciones = await paraPagina(opcionesDeRegistro(sesion)); // solo valores ACTIVOS y el tamaño máximo de la foto
  const { paso, raza } = await searchParams;
  const otra = raza === "otra";
  return (
    <FlujoRegistro
      opciones={opciones}
      inicial={{
        paso: paso === "2" ? 2 : 1,
        datos: otra ? { razaId: String(ID_RAZA_OTRA), fotoUrl: "/mocks/perro-ejemplo.svg" } : {},
      }}
    />
  );
}
