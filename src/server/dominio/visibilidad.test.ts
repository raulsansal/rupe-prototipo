import assert from "node:assert/strict";
import { test } from "node:test";
import { ErrorApp } from "../errores";
import { accesoParaReportar, estatusPorFolioVisible, exigirAdmiteAvistamientos, fichaPublicaVisible, situacionDe, type Situacion } from "./visibilidad";

// Tabla de decisión completa (ver el comentario de dominio/visibilidad.ts).
const FILAS: [string, Situacion | undefined, boolean, boolean, string][] = [
  ["inexistente", undefined, false, false, "no-encontrado"],
  ["Extraviado", { estado: "Extraviado" }, true, true, "permitido"],
  ["En búsqueda", { estado: "En búsqueda" }, true, true, "permitido"],
  ["Avistamiento reportado", { estado: "Avistamiento reportado" }, true, true, "permitido"],
  ["En seguimiento", { estado: "En seguimiento" }, true, true, "permitido"],
  ["Localizado", { estado: "Localizado" }, true, true, "no-admite"],
  ["Cerrado · cierre confirmado", { estado: "Cerrado", cierre: "cierre confirmado" }, false, true, "no-admite"],
  ["Cerrado · cancelación", { estado: "Cerrado", cierre: "cancelación" }, false, false, "no-encontrado"],
  ["Cerrado · deshabilitación", { estado: "Cerrado", cierre: "deshabilitación" }, false, false, "no-encontrado"],
];

for (const [nombre, s, ficha, estatus, reportar] of FILAS) {
  test(`R33/R13 · ${nombre}: ficha ${ficha ? "se muestra" : "404"} · estatus ${estatus ? "se muestra" : "404"} · reportar ${reportar}`, () => {
    assert.equal(fichaPublicaVisible(s), ficha);
    assert.equal(estatusPorFolioVisible(s), estatus);
    assert.equal(accesoParaReportar(s), reportar);
    if (reportar === "permitido") exigirAdmiteAvistamientos(s);
    else assert.throws(() => exigirAdmiteAvistamientos(s), (e) => e instanceof ErrorApp && e.estado === (reportar === "no-admite" ? 409 : 404) && (reportar === "no-admite" ? e.regla === "R13" : true));
  });
}

test("E1/R33 · la situación sale del ÚLTIMO movimiento (cancelación y deshabilitación se distinguen por su tipo)", () => {
  const h = (tipo: string, estado: string) => [{ consecutivo: 1, fechaHora: "t", tipo, estado }] as Parameters<typeof situacionDe>[0];
  assert.deepEqual(situacionDe(h("cancelación", "Cerrado")), { estado: "Cerrado", cierre: "cancelación" });
  assert.deepEqual(situacionDe(h("localización", "Localizado")), { estado: "Localizado" });
  assert.equal(situacionDe([]), undefined);
});
