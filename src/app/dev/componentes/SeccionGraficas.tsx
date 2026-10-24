import { BarraApilada } from "@/components/ui/BarraApilada";
import { GraficaBarras } from "@/components/ui/GraficaBarras";
import { TarjetaIndicador } from "@/components/ui/TarjetaIndicador";
import { Grupo, PanelesTema } from "./PanelesTema";

function Contenido() {
  return (
    <>
      <Grupo titulo="Indicadores">
        <div className="grid grid-cols-2 gap-3">
          <TarjetaIndicador icono="pets" titulo="Casos activos" valor="106" descripcion="Extraviado, En búsqueda, Avistamiento reportado o En seguimiento" />
          <TarjetaIndicador icono="schedule" titulo="Promedio de localización" valor="6.2 días" descripcion="Del registro a la localización" />
        </div>
      </Grupo>
      <Grupo titulo="Gráfica de barras (token --chart-1, con etiqueta y valor)">
        <GraficaBarras
          titulo="Casos cerrados por tipo de cierre"
          subtitulo="Según la fecha del movimiento de cierre"
          grupos={[{ barras: [{ nombre: "Cierre confirmado", valor: 3 }, { nombre: "Cancelación", valor: 2 }, { nombre: "Deshabilitación", valor: 1 }] }]}
        />
      </Grupo>
      <Grupo titulo="Barra apilada con leyenda (colores de los chips de estado)">
        <BarraApilada
          titulo="Casos por estado del caso"
          subtitulo="Estado actual"
          segmentos={[
            { nombre: "Extraviado", valor: 14, claseColor: "bg-estado-extraviado-fg" },
            { nombre: "En búsqueda", valor: 44, claseColor: "bg-estado-en-busqueda-fg" },
            { nombre: "Localizado", valor: 41, claseColor: "bg-estado-localizado-fg" },
          ]}
        />
      </Grupo>
      <Grupo titulo="Sin datos">
        <GraficaBarras titulo="Avistamientos por alcaldía" grupos={[{ barras: [{ nombre: "Cuauhtémoc", valor: 0 }] }]} />
      </Grupo>
    </>
  );
}

export function SeccionGraficas() {
  return (
    <PanelesTema seccion="graficas" titulo="Gráficas del tablero" lamina="Lámina 4.13">
      <Contenido />
    </PanelesTema>
  );
}
