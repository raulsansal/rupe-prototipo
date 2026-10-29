import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp } from "../errores";
import { idDeCatalogo, LIMITE_AFECTADA, LIMITE_DETALLE, validarEntrada } from "./bitacora";
import { validarRangoDeDias } from "./filtrosAvistamientos";
import { paginar } from "./paginacion";
import { esUltimoAdministradorActivo, validarRol } from "./usuarios";

const lanza = (f: () => unknown, estado: number, codigo: string) => assert.throws(f, (e) => e instanceof ErrorApp && e.estado === estado && e.codigo === codigo);

test("paginar · página inválida va a la 1, fuera de rango a la última, y cuenta bien", () => {
  const datos = Array.from({ length: 12 }, (_, i) => i);
  assert.deepEqual(paginar(datos, "2", 5).items, [5, 6, 7, 8, 9]);
  for (const mala of [undefined, "", "abc", "0", "-3", "1.5", NaN]) assert.equal(paginar(datos, mala, 5).pagina, 1, String(mala));
  const ultima = paginar(datos, "99", 5);
  assert.deepEqual([ultima.pagina, ultima.totalPaginas, ultima.total, ultima.items.length], [3, 3, 12, 2]);
  assert.deepEqual([paginar([], "4", 5).pagina, paginar([], "4", 5).totalPaginas], [1, 1]);
});

test("bitácora · motivo obligatorio solo en deshabilitar caso y ocultar avistamiento; límites; se recorta", () => {
  lanza(() => validarEntrada({ tipoAccion: "deshabilitar caso", idAfectada: "3" }), 422, "MOTIVO_OBLIGATORIO");
  lanza(() => validarEntrada({ tipoAccion: "ocultar avistamiento", idAfectada: "3", motivo: "   " }), 422, "MOTIVO_OBLIGATORIO");
  assert.deepEqual(validarEntrada({ tipoAccion: "restaurar caso", idAfectada: " 3 " }), { tipoAccion: "restaurar caso", idAfectada: "3" });
  lanza(() => validarEntrada({ tipoAccion: "ocultar avistamiento", idAfectada: "3", motivo: "x".repeat(301) }), 422, "MOTIVO_LARGO");
  lanza(() => validarEntrada({ tipoAccion: "cambiar rol", idAfectada: "3", detalle: "x".repeat(LIMITE_DETALLE + 1) }), 422, "DETALLE_LARGO");
  lanza(() => validarEntrada({ tipoAccion: "cambiar rol", idAfectada: "" }), 422, "ENTIDAD_INVALIDA");
  lanza(() => validarEntrada({ tipoAccion: "cambiar rol", idAfectada: "x".repeat(LIMITE_AFECTADA + 1) }), 422, "ENTIDAD_INVALIDA");
  lanza(() => validarEntrada({ tipoAccion: "inventada" as never, idAfectada: "1" }), 422, "TIPO_DE_ACCION_INVALIDO");
  assert.equal(validarEntrada({ tipoAccion: "deshabilitar caso", idAfectada: "3", motivo: "  razón  " }).motivo, "razón");
  assert.equal(idDeCatalogo("estado_animal", 16), "estado_animal:16");
});

test("R21 · último administrador activo: cuenta solo administradores con estatus activo", () => {
  const u = (idUsuario: number, rol: "Administrador" | "Tutor", estatus: 0 | 1) => ({ idUsuario, rol, estatus });
  assert.equal(esUltimoAdministradorActivo([u(1, "Administrador", 1), u(2, "Tutor", 1), u(4, "Administrador", 0)], 1), true);
  assert.equal(esUltimoAdministradorActivo([u(1, "Administrador", 1), u(4, "Administrador", 1)], 1), false);
  assert.equal(esUltimoAdministradorActivo([u(1, "Administrador", 1)], 2), false); // una tutora nunca es «el último»
});

test("roles · solo Administrador o Tutor, tal cual (sin espacios ni minúsculas)", () => {
  assert.equal(validarRol("Tutor"), "Tutor");
  for (const mal of ["tutor", " Administrador", "Root", "", undefined, null, 3]) lanza(() => validarRol(mal), 422, "ROL_INVALIDO");
});

test("rango de días · fechas reales, «hasta» no anterior a «desde», el campo malo no se aplica", () => {
  assert.deepEqual(validarRangoDeDias({ desde: "2026-10-01", hasta: "2026-10-18" }), { desde: "2026-10-01", hasta: "2026-10-18", errores: {} });
  assert.deepEqual(validarRangoDeDias({}), { errores: {} });
  const irreal = validarRangoDeDias({ desde: "2026-02-31", hasta: "2026-13-01" });
  assert.ok(irreal.errores.desde && irreal.errores.hasta && !irreal.desde && !irreal.hasta);
  const invertido = validarRangoDeDias({ desde: "2026-10-10", hasta: "2026-10-01" });
  assert.deepEqual([invertido.desde, invertido.hasta, !!invertido.errores.hasta], ["2026-10-10", undefined, true]);
  assert.ok(validarRangoDeDias({ desde: 5 as never }).errores.desde); // lo que no es una fecha en texto se informa y no se aplica
});
