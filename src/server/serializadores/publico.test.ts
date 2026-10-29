import assert from "node:assert/strict";
import { test } from "node:test";
import { CASOS_ORIGEN } from "../../mocks/casos";
import { USUARIOS_INICIALES } from "../../mocks/usuarios";
import { nuevoContexto } from "../pruebas/auxiliares";
import { consultarEstatusPorFolio, consultarFichaPorFolio } from "../servicios/fichas";
import { registrarAvistamiento } from "../servicios/avistamientos";
import { jpeg } from "../pruebas/imagenes";
import { CAMPOS_CONFIRMACION_REPORTE, CAMPOS_CONSULTA_ESTATUS, CAMPOS_FICHA_PUBLICA } from "./publico";

const { ctx, almacen } = nuevoContexto();

/** Todo lo reservado de un caso y de la persona tutora: ninguno de estos textos puede salir por una función pública. */
function reservadosDe(idCaso: number): string[] {
  const caso = almacen.casos.find((c) => c.idCasoExtravio === idCaso)!;
  const perro = almacen.perros.find((p) => p.idPerro === caso.idPerro)!;
  const dueno = almacen.usuarios.find((u) => u.idUsuario === perro.idUsuario)!;
  const motivo = almacen.motivos.find((m) => m.idMotivo === caso.idMotivo)!;
  return [caso.direccionAproximada, caso.referenciasDelLugar, caso.descripcionCircunstancias, motivo.nombre, dueno.nombreCompleto, dueno.correo, dueno.telefono, ...CASOS_ORIGEN.map((c) => c.tokenPublico), ...almacen.qr.map((q) => q.tokenPublico)].filter((v): v is string => Boolean(v));
}

test("D6 · la ficha pública trae exactamente las columnas P (ni una más) para cada caso visible", async () => {
  let vistas = 0;
  for (const c of almacen.casos) {
    const ficha = await consultarFichaPorFolio(c.folio, ctx).catch(() => undefined);
    if (!ficha) continue; // casos cerrados: 404
    vistas++;
    const esperadas = CAMPOS_FICHA_PUBLICA.filter((k) => k !== "caracteristicasDistintivas" || k in ficha);
    assert.deepEqual(Object.keys(ficha).sort(), [...esperadas].sort(), c.folio);
  }
  assert.ok(vistas >= 8, `solo ${vistas} fichas visibles`);
});

test("D6 · ninguna columna reservada ni dato de la persona tutora aparece en la ficha, la consulta por folio ni la confirmación de avistamiento", async () => {
  const textos: string[] = [];
  for (const c of almacen.casos) {
    const f = await consultarFichaPorFolio(c.folio, ctx).catch(() => undefined);
    if (f) textos.push(JSON.stringify(f));
    const e = await consultarEstatusPorFolio(c.folio, ctx).catch(() => undefined);
    if (e) {
      assert.deepEqual(Object.keys(e), [...CAMPOS_CONSULTA_ESTATUS]);
      textos.push(JSON.stringify(e));
    }
  }
  const conf = await registrarAvistamiento({ canal: "folio", folio: "RUPE-K7M4XQ9T" }, { datos: { fecha: "2026-10-17", hora: "10:00", direccion: "Calle de prueba 1", idAlcaldia: 6, estadosAnimal: [1, 7] }, foto: { bytes: jpeg(), tipoDeclarado: "image/jpeg" } }, ctx);
  assert.deepEqual(Object.keys(conf), [...CAMPOS_CONFIRMACION_REPORTE]);
  textos.push(JSON.stringify(conf));
  const todo = textos.join("\n");
  for (const c of almacen.casos) for (const secreto of reservadosDe(c.idCasoExtravio)) assert.ok(!todo.includes(secreto), `se filtró «${secreto.slice(0, 20)}»`);
  for (const u of USUARIOS_INICIALES) assert.ok(!todo.includes(u.correo) && !todo.includes(u.nombreCompleto));
  assert.ok(!/momentoDelDia|direccionAproximada|referenciasDelLugar|descripcionCircunstancias|motivo|idUsuario|contrasena|telefono|correo/i.test(todo));
});
