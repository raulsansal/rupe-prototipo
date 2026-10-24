import { Boton, type VarianteBoton } from "@/components/ui/Boton";
import { Grupo, PanelesTema } from "./PanelesTema";

const ESTADOS = [
  { id: "normal", nombre: "Normal", props: {} },
  { id: "hover", nombre: "Hover (escritorio)", props: { "data-estado": "hover" } },
  { id: "foco", nombre: "Foco", props: { "data-estado": "foco" } },
  { id: "presionado", nombre: "Presionado (móvil)", props: { "data-estado": "presionado" } },
  { id: "deshabilitado", nombre: "Deshabilitado", props: { disabled: true } },
  { id: "cargando", nombre: "Cargando", props: { cargando: true, textoCargando: "Guardando…" } },
] as const;

const VARIANTES: { variante: VarianteBoton; texto: string }[] = [
  { variante: "primario", texto: "Guardar y continuar" },
  { variante: "secundario", texto: "Ver ficha" },
  { variante: "terciario", texto: "Cancelar" },
  { variante: "destructivo", texto: "Cancelar registro" },
];

function Contenido() {
  return (
    <>
      {VARIANTES.map(({ variante, texto }) => (
        <Grupo key={variante} titulo={variante}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ESTADOS.map((e) => (
              <div key={e.id} className="flex flex-col items-start gap-1">
                <span className="text-caption text-text-muted">{e.nombre}</span>
                <Boton variante={variante} {...e.props}>
                  {texto}
                </Boton>
              </div>
            ))}
          </div>
        </Grupo>
      ))}
      <Grupo titulo="Con ícono">
        <div className="flex flex-wrap gap-3">
          <Boton icono="print">Ficha</Boton>
          <Boton icono="print" variante="secundario">
            Ficha
          </Boton>
          <Boton icono="print" disabled>
            Ficha
          </Boton>
        </div>
      </Grupo>
      <Grupo titulo="Ancho completo y tamaño grande (52 px, llamada a la acción en móvil)">
        <div className="flex flex-col gap-3">
          <Boton anchoCompleto>Estándar de ancho completo</Boton>
          <Boton anchoCompleto tamano="grande" icono="add_circle">
            Registrar extravío
          </Boton>
        </div>
      </Grupo>
      <Grupo titulo="Tamaño compacto (36 px, solo en tablas de administración marcadas como compactas)">
        <div className="flex flex-wrap gap-2" data-excepcion-tactil="compacto">
          <Boton tamano="compacto" variante="secundario">
            Cambiar rol
          </Boton>
          <Boton tamano="compacto">Habilitar</Boton>
        </div>
      </Grupo>
    </>
  );
}

export function SeccionBotones() {
  return (
    <PanelesTema seccion="botones" titulo="Botones" lamina="Lámina 4.6 · variantes y estados">
      <Contenido />
    </PanelesTema>
  );
}
