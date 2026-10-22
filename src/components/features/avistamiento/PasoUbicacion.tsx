"use client";

import { Alerta } from "@/components/ui/Alerta";
import { AreaTexto } from "@/components/ui/AreaTexto";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { GrupoRadio } from "@/components/ui/GrupoRadio";
import { Icono } from "@/components/ui/Icono";
import { Selector } from "@/components/ui/Selector";
import { FUERA_DE_LA_CIUDAD, type Alcaldia } from "@/mocks/tipos";
import { coordenadasSugeridas, type Coordenadas } from "@/mocks/geografia";
import { MapaIlustrativo } from "../MapaIlustrativo";
import { alcaldiaDelPunto, ALCALDIAS_OPCIONES, formatoCoordenada, LIMITES_TEXTO, NOMBRE_FORMA, type DatosAvistamiento, type Errores, type FormaUbicacion } from "./datos";

export type Actualizar = (cambios: Partial<DatosAvistamiento>, limpiar?: (keyof Errores)[]) => void;

type Props = {
  datos: DatosAvistamiento;
  errores: Errores;
  actualizar: Actualizar;
  fijarErrores: (e: Errores) => void;
};

const FORMAS: FormaUbicacion[] = ["direccion", "mapa", "gps"];
const ID_ERROR_PUNTO = "error-punto";

function Lectura({ punto }: { punto?: Coordenadas }) {
  if (!punto) return null;
  return (
    <p className="text-small" aria-live="polite">
      <span className="font-semibold">Latitud</span> {formatoCoordenada(punto.latitud)} · <span className="font-semibold">Longitud</span> {formatoCoordenada(punto.longitud)}
    </p>
  );
}

/** Paso 3 (PUB-05.3 / lámina 1.5): tres formas de ubicar; todas exigen un punto confirmado con latitud y longitud (R14). */
export function PasoUbicacion({ datos, errores, actualizar, fijarErrores }: Props) {
  const { forma, punto, confirmado, estadoGps } = datos;
  const alcaldiaPunto = alcaldiaDelPunto(datos);
  const gpsFallido = forma === "gps" && (estadoGps === "denegada" || estadoGps === "error");

  function cambiarForma(nueva: FormaUbicacion) {
    actualizar({ forma: nueva, punto: undefined, confirmado: false, estadoGps: "inicial", precisionGps: undefined }, ["punto", "direccion", "alcaldia"]);
  }

  function ubicarEnMapa() {
    const faltan: Errores = {};
    if (!datos.direccion.trim()) faltan.direccion = "Escribe una dirección aproximada.";
    if (!datos.alcaldiaElegida) faltan.alcaldia = "Elige una alcaldía.";
    if (faltan.direccion || faltan.alcaldia) return fijarErrores(faltan);
    // Maqueta: sin geocodificador; el punto sugerido sale de la alcaldía elegida y se puede arrastrar.
    actualizar({ punto: coordenadasSugeridas(datos.alcaldiaElegida as Alcaldia), confirmado: false }, ["direccion", "alcaldia", "punto"]);
  }

  function confirmar() {
    if (!punto) return fijarErrores({ punto: forma === "mapa" ? "Marca un punto en el mapa y confírmalo para continuar." : "Primero ubica la dirección en el mapa." });
    actualizar({ confirmado: true }, ["punto"]);
  }

  function usarMiUbicacion() {
    if (!("geolocation" in navigator)) return actualizar({ estadoGps: "error" });
    actualizar({ estadoGps: "cargando", punto: undefined, confirmado: false }, ["punto"]);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const redondear = (n: number) => Math.round(n * 1e6) / 1e6;
        actualizar({
          punto: { latitud: redondear(pos.coords.latitude), longitud: redondear(pos.coords.longitude) },
          precisionGps: Math.round(pos.coords.accuracy * 100) / 100,
          confirmado: true, // la lectura del dispositivo es el punto confirmado
          estadoGps: "obtenida",
        });
      },
      (e) => actualizar({ estadoGps: e.code === e.PERMISSION_DENIED ? "denegada" : "error" }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const errorPunto = errores.punto && (
    <p id={ID_ERROR_PUNTO} role="alert" className="flex items-start gap-1 text-small text-danger">
      <Icono nombre="error" tamano={16} className="mt-0.5" />
      {errores.punto}
    </p>
  );

  const resultado = punto && confirmado && (
    <>
      <Alerta tipo="exito" titulo="Punto confirmado">
        Alcaldía del punto: {alcaldiaPunto}.
      </Alerta>
      {forma === "direccion" && datos.alcaldiaElegida && alcaldiaPunto && alcaldiaPunto !== datos.alcaldiaElegida && (
        <Alerta tipo="advertencia" titulo="La alcaldía cambió">
          {alcaldiaPunto === FUERA_DE_LA_CIUDAD ? "El punto queda fuera de la Ciudad de México" : `El punto queda en ${alcaldiaPunto}`}, no en {datos.alcaldiaElegida}. Se guardará la alcaldía del punto.
        </Alerta>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <GrupoRadio
        leyenda="Forma de ubicar"
        ocultarLeyenda
        name="forma-ubicacion"
        variante="tarjetas"
        value={forma}
        onChange={(e) => cambiarForma(e.target.value as FormaUbicacion)}
        opciones={FORMAS.map((f) => ({ valor: f, etiqueta: NOMBRE_FORMA[f] }))}
      />

      {forma === "direccion" && (
        <>
          <CampoTexto
            etiqueta="Dirección aproximada"
            required
            maxLength={LIMITES_TEXTO.direccion}
            autoComplete="off"
            ayuda="Calle y número aproximado, o cruce."
            value={datos.direccion}
            onChange={(e) => actualizar({ direccion: e.target.value, punto: undefined, confirmado: false }, ["direccion"])}
            error={errores.direccion}
          />
          <Selector
            etiqueta="Alcaldía"
            required
            marcador="Elige una alcaldía"
            opciones={ALCALDIAS_OPCIONES}
            value={datos.alcaldiaElegida}
            onChange={(e) => actualizar({ alcaldiaElegida: e.target.value as Alcaldia | "", punto: undefined, confirmado: false }, ["alcaldia"])}
            error={errores.alcaldia}
          />
          <Boton variante="secundario" anchoCompleto onClick={ubicarEnMapa}>
            Ubicar en el mapa
          </Boton>
        </>
      )}

      {forma === "gps" &&
        (gpsFallido ? (
          <>
            <Alerta tipo="advertencia" titulo={estadoGps === "denegada" ? "Permiso de ubicación denegado" : "No pudimos obtener tu ubicación"}>
              {estadoGps === "denegada" ? "Usa la dirección o el mapa para indicar dónde lo viste." : "Revisa que el dispositivo tenga ubicación activada, o usa la dirección o el mapa."}
            </Alerta>
            <div className="grid grid-cols-2 gap-3">
              <Boton variante="secundario" onClick={() => cambiarForma("direccion")}>
                Escribir dirección
              </Boton>
              <Boton variante="secundario" onClick={() => cambiarForma("mapa")}>
                Marcar en mapa
              </Boton>
            </div>
          </>
        ) : (
          <Boton anchoCompleto icono="location_on" cargando={estadoGps === "cargando"} textoCargando="Obteniendo tu ubicación…" onClick={usarMiUbicacion}>
            Usar mi ubicación actual
          </Boton>
        ))}

      {!gpsFallido && (
        <>
          <MapaIlustrativo
            etiqueta={forma === "gps" ? "Mapa ilustrativo con el punto obtenido" : "Mapa ilustrativo para ubicar el punto"}
            punto={punto}
            editable={forma === "mapa" || (forma === "direccion" && Boolean(punto))}
            invalido={Boolean(errores.punto)}
            descritoPor={errores.punto ? ID_ERROR_PUNTO : undefined}
            onCambio={(c) => actualizar({ punto: c, confirmado: false }, ["punto"])}
          />
          <Lectura punto={punto} />
          {forma === "gps" && punto && estadoGps === "obtenida" && datos.precisionGps !== undefined && (
            <p className="rounded-campo border border-border bg-surface px-3 py-3 text-small">
              <span className="font-semibold">Precisión de la lectura:</span> ± {datos.precisionGps} m
            </p>
          )}
          {forma === "mapa" && !confirmado && <Alerta tipo="info" titulo="La alcaldía se determina a partir del punto">Marca dónde lo viste; al confirmar, RUPE toma la alcaldía de ese punto.</Alerta>}
          {forma === "direccion" && punto && !confirmado && <Alerta tipo="info" titulo="Confirma el punto en el mapa para continuar">Arrastra el marcador si no está en el lugar correcto.</Alerta>}
          {errorPunto}
          {forma !== "gps" && !confirmado && (
            <Boton variante={forma === "mapa" ? "secundario" : "primario"} anchoCompleto onClick={confirmar}>
              {forma === "mapa" ? "Confirmar ubicación en mapa" : "Confirmar punto en el mapa"}
            </Boton>
          )}
          {resultado}
          <CampoTexto
            etiqueta="Colonia o zona (opcional)"
            maxLength={LIMITES_TEXTO.colonia}
            autoComplete="off"
            value={datos.colonia}
            onChange={(e) => actualizar({ colonia: e.target.value })}
          />
          <AreaTexto
            etiqueta="Referencias del lugar (opcional)"
            maxLength={LIMITES_TEXTO.referencias}
            rows={3}
            value={datos.referencias}
            onChange={(e) => actualizar({ referencias: e.target.value })}
          />
        </>
      )}
    </div>
  );
}
