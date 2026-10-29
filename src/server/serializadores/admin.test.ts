import assert from "node:assert/strict";
import { test } from "node:test";
import { aAvistamientoAdmin, aEntradaBitacora, aRegistroAdminDetalle, aRegistroAdminLista, aUsuarioAdmin, CAMPOS_AVISTAMIENTO_ADMIN, CAMPOS_ENTRADA_BITACORA, CAMPOS_REGISTRO_ADMIN_DETALLE, CAMPOS_REGISTRO_ADMIN_LISTA, CAMPOS_USUARIO_ADMIN } from "./admin";

// Marcas y datos que NUNCA deben salir hacia el Administrador aunque el origen los traiga (el serializador copia solo las llaves permitidas).
const INTRUSOS = { vistoPorTutora: true, relevante: true, ubicacionSimulada: true, telefono: "5500000000", contrasenaHash: "h", tokenPublico: "t", direccionAproximada: "d", coloniaZona: "c", referenciasDelLugar: "r", latitud: 1, longitud: 2, idUsuarioTutora: 9, correoTutora: "x@y.z" };
const RESERVADOS_DEL_EXTRAVIO = ["direccionAproximada", "coloniaZona", "referenciasDelLugar"];
const conIntrusos = (campos: readonly string[]) => ({ ...Object.fromEntries(campos.map((c) => [c, c === "visible" || c === "fallecido" || c === "activo" ? true : c === "historial" || c === "estadosAnimal" ? [] : "x"])), ...INTRUSOS });

test("serializadores de Administrador · solo salen las llaves de la lista permitida (ni marcas internas, ni teléfono, ni hash, ni token, ni ubicación del avistamiento)", () => {
  const casos: Array<[string, (d: never) => object, readonly string[]]> = [
    ["registro lista", aRegistroAdminLista as never, CAMPOS_REGISTRO_ADMIN_LISTA], ["registro detalle", aRegistroAdminDetalle as never, CAMPOS_REGISTRO_ADMIN_DETALLE],
    ["avistamiento", aAvistamientoAdmin as never, CAMPOS_AVISTAMIENTO_ADMIN], ["bitácora", aEntradaBitacora as never, CAMPOS_ENTRADA_BITACORA], ["usuario", aUsuarioAdmin as never, CAMPOS_USUARIO_ADMIN],
  ];
  for (const [nombre, f, campos] of casos) {
    const salida = f(conIntrusos(campos) as never);
    assert.ok(Object.keys(salida).every((k) => campos.includes(k)), `${nombre}: salió una llave no permitida`);
    // El detalle de un registro SÍ lleva dirección, colonia y referencias del EXTRAVÍO (HU 016); el de un avistamiento, nunca.
    const permitidasAqui = nombre === "registro detalle" ? RESERVADOS_DEL_EXTRAVIO : [];
    for (const k of Object.keys(INTRUSOS).filter((x) => !permitidasAqui.includes(x))) assert.ok(!(k in salida), `${nombre}: ${k}`);
  }
  for (const lista of [CAMPOS_AVISTAMIENTO_ADMIN, CAMPOS_ENTRADA_BITACORA, CAMPOS_REGISTRO_ADMIN_LISTA, CAMPOS_USUARIO_ADMIN]) {
    for (const k of Object.keys(INTRUSOS)) assert.ok(!(lista as readonly string[]).includes(k), `la lista permitida incluye ${k}`);
  }
  for (const k of Object.keys(INTRUSOS).filter((x) => !RESERVADOS_DEL_EXTRAVIO.includes(x))) assert.ok(!(CAMPOS_REGISTRO_ADMIN_DETALLE as readonly string[]).includes(k), `el detalle incluye ${k}`);
});
