import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp, respuestaDeError } from "../errores";
import { AHORA, nuevoContexto } from "../pruebas/auxiliares";
import { CAMPOS_CONSULTA_ESTATUS } from "../serializadores/publico";
import type { SesionActual } from "../sesion/guardas";
import { cerrarCaso, marcarLocalizado, reactivarCaso } from "./cambioDeEstado";
import { consultarEstatusPorFolio } from "./fichas";

const MAX = "RUPE-K7M4XQ9T"; // Rosa, En búsqueda
const NALA = "RUPE-Y9F4LK2E"; // En seguimiento
const LUNA = "RUPE-P3H8WD5N"; // Avistamiento reportado
const TOBY = "RUPE-B6R2TZ7C"; // Localizado
const ROCKY = "RUPE-3HN8WD2B"; // Cerrado por cierre confirmado
const SIMBA = "RUPE-F7L3MN6Y"; // Cerrado por cancelación
const KIRA = "RUPE-D5W2QK8X"; // Cerrado por deshabilitación
const ROSA: SesionActual = { idUsuario: 2, rol: "Tutor", nombre: "Rosa Hernández Ficticia" };
const huella = async (e: ErrorApp) => {
  const r = respuestaDeError(e);
  return JSON.stringify({ estado: r.status, cuerpo: await r.clone().text(), cabeceras: [...r.headers.entries()].sort() });
};
const falla = (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => (e instanceof ErrorApp ? e : undefined));

test("HU 038 y R33 · estatus público por estado: Activo y Localizado se muestran; Cerrado por cierre confirmado muestra «Cerrado»; Cancelado, Deshabilitado e inexistente = el MISMO 404 byte por byte", async () => {
  const { ctx } = nuevoContexto();
  for (const [folio, estado] of [[MAX, "En búsqueda"], [LUNA, "Avistamiento reportado"], [NALA, "En seguimiento"], [TOBY, "Localizado"], [ROCKY, "Cerrado"]] as const) assert.equal((await consultarEstatusPorFolio(folio, ctx)).estado, estado, folio);
  const huellas = await Promise.all([SIMBA, KIRA, "RUPE-ZZZZZZZZ", "rupe-zzzzzzzz", "RUPE-3HN8WD2C"].map(async (f) => huella((await falla(consultarEstatusPorFolio(f, ctx)))!)));
  assert.equal(new Set(huellas).size, 1, "cancelado, deshabilitado e inexistente no se distinguen");
  assert.equal((await falla(consultarEstatusPorFolio(SIMBA, ctx)))?.estado, 404);
});

test("HU 038 · la respuesta lleva SOLO folio, estado y fecha del último cambio de estatus; el folio no distingue mayúsculas (R26); ningún dato personal", async () => {
  const { ctx } = nuevoContexto();
  const r = await consultarEstatusPorFolio(TOBY.toLowerCase(), ctx);
  assert.deepEqual(Object.keys(r).sort(), [...CAMPOS_CONSULTA_ESTATUS].sort());
  assert.equal(r.folio, TOBY);
  assert.equal(r.fechaCambioEstado, "2026-10-09T18:20:00Z", "la fecha del último movimiento (localización de Toby)");
  assert.ok(!/Rosa|rosa\.|@|Hern|tutor|token|calle|direcci/i.test(JSON.stringify(r)));
});

test("HU 038 · el estatus sigue al historial: cada cambio de estado de la tutora se ve en la consulta pública con su fecha", async () => {
  const { ctx } = nuevoContexto();
  assert.equal((await consultarEstatusPorFolio(MAX, ctx)).estado, "En búsqueda");
  await marcarLocalizado(ROSA, MAX, ctx);
  assert.deepEqual(await consultarEstatusPorFolio(MAX, ctx), { folio: MAX, estado: "Localizado", fechaCambioEstado: AHORA.toISOString() });
  await reactivarCaso(ROSA, MAX, "Fue un error", ctx);
  assert.equal((await consultarEstatusPorFolio(MAX, ctx)).estado, "En seguimiento");
  await marcarLocalizado(ROSA, MAX, ctx);
  await cerrarCaso(ROSA, MAX, ctx);
  assert.equal((await consultarEstatusPorFolio(MAX, ctx)).estado, "Cerrado", "cierre confirmado: se muestra «Cerrado»");
});
