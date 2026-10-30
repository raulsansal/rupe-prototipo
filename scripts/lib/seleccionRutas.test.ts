import assert from "node:assert/strict";
import { test } from "node:test";
import { RUTAS } from "../../capturas.config";
import { filtroDeArgumentos, hayFiltroDeRutas, seleccionaRuta, valorDeOpcion } from "./seleccionRutas";

const elegidas = (argv: string[]) => RUTAS.filter((r) => seleccionaRuta(r.ruta, filtroDeArgumentos(argv)));

test("--rutas conserva su comportamiento por prefijo: /admin alcanza todo lo que empieza con /admin", () => {
  const e = elegidas(["--rutas=/admin"]);
  assert.ok(e.some((r) => r.ruta === "/admin/usuarios") && e.some((r) => r.ruta === "/admin"));
  assert.ok(e.every((r) => r.ruta.startsWith("/admin")));
});

test("--rutas-exactas=/admin selecciona solo las entradas cuya ruta completa es /admin (el tablero y su variante de acceso denegado), nunca /admin/usuarios ni /admin?desde=", () => {
  const e = elegidas(["--rutas-exactas=/admin"]);
  assert.deepEqual(e.map((r) => r.archivo), ["admin-tablero", "acceso-denegado"]);
  assert.ok(e.every((r) => r.ruta === "/admin"));
});

test("--rutas-exactas admite varias rutas, incluso con consulta, y --rutas-exactas junto con --rutas exigen ambas", () => {
  assert.equal(valorDeOpcion(["--rutas-exactas=/admin?desde=2026-09-01&hasta=2026-09-30"], "rutas-exactas"), "/admin?desde=2026-09-01&hasta=2026-09-30");
  const e = elegidas(["--rutas-exactas=/admin,/admin?desde=2026-09-01&hasta=2026-09-30"]);
  assert.deepEqual(e.map((r) => r.archivo), ["admin-tablero", "admin-tablero-septiembre", "acceso-denegado"]);
  assert.equal(elegidas(["--rutas=/tutor", "--rutas-exactas=/admin"]).length, 0);
});

test("sin opciones se capturan todas, y hayFiltroDeRutas distingue la corrida completa", () => {
  assert.equal(elegidas([]).length, RUTAS.length);
  assert.equal(hayFiltroDeRutas(filtroDeArgumentos([])), false);
  assert.equal(hayFiltroDeRutas(filtroDeArgumentos(["--rutas-exactas=/admin"])), true);
});
