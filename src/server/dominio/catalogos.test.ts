import assert from "node:assert/strict";
import { test } from "node:test";
import { REGLAS_CATALOGO } from "../../config/catalogos";
import { ErrorApp } from "../errores";
import { comprobarUnicidad, detalleDeDesactivacion, impedimentoParaDesactivar, leerDatosCatalogo, normalizarNombre, planearEdicion, sanearTextoCatalogo, type FilaCatalogo } from "./catalogos";

const fila = (id: number, nombre: string, extra: Partial<FilaCatalogo> = {}): FilaCatalogo => ({ id, nombre, clave: null, activo: true, ...extra });
const choca = (f: () => unknown, estado: number, codigo?: string) => {
  try {
    f();
  } catch (e) {
    assert.ok(e instanceof ErrorApp, String(e));
    assert.equal(e.estado, estado);
    if (codigo) assert.equal(e.codigo, codigo);
    return e;
  }
  assert.fail("debía fallar");
};
const R = REGLAS_CATALOGO;
const CATS = [{ id: 1, nombre: "Uno" }, { id: 2, nombre: "Dos" }];

test("R34 · «<b>x</b>» se guarda como «x»; sin etiquetas, sin caracteres de control y con los espacios colapsados", () => {
  assert.equal(sanearTextoCatalogo("<b>x</b>"), "x");
  assert.equal(sanearTextoCatalogo("  Pastor \u0007  <i>Belga</i>\n Malinois "), "Pastor Belga Malinois");
  assert.equal(leerDatosCatalogo(R.razas, { nombre: "<b>x</b>" }, []).nombre, "x");
  assert.equal(leerDatosCatalogo(R.motivos, { nombre: "A", idCategoria: 1, descripcion: "<script>alert(1)</script>Texto" }, CATS).descripcion, "alert(1)Texto");
  assert.equal(leerDatosCatalogo(R.alcaldias, { nombre: "Nueva", clave: " <b>09018</b> " }, []).clave, "09018");
  choca(() => leerDatosCatalogo(R.razas, { nombre: "<b></b>" }, []), 422, "VALIDACION"); // solo etiquetas = vacío
});

test("unicidad · sin distinguir acentos, mayúsculas ni espacios de más (los cuatro catálogos)", () => {
  assert.equal(normalizarNombre("  CAFÉ   con  Leche "), normalizarNombre("cafe con leche"));
  for (const r of [R.alcaldias, R.razas, R.motivos, R["estados-animal"]]) {
    const filas = [fila(1, "Cafetería Ñandú", { clave: "09001" })];
    for (const n of ["cafeteria ñandu", "CAFETERÍA   ÑANDÚ", " Cafeteria Ñandu "]) {
      const e = choca(() => comprobarUnicidad(r, filas, { nombre: n, clave: "09002" }), 409, "NOMBRE_DUPLICADO");
      assert.ok(e.campos?.nombre);
    }
    comprobarUnicidad(r, filas, { nombre: "Cafetería Ñandú" }, 1); // editarse a sí misma no choca
    comprobarUnicidad(r, filas, { nombre: "Otra cosa", clave: "09002" });
  }
  choca(() => comprobarUnicidad(R.alcaldias, [fila(1, "A", { clave: "09001" })], { nombre: "B", clave: "09001" }), 409, "CLAVE_DUPLICADA");
});

test("formato · nombre obligatorio y con límite 60/80/80/80; clave 09XXX; categoría de la lista; descripción obligatoria ≤ 255", () => {
  assert.deepEqual([R.alcaldias, R.razas, R.motivos, R["estados-animal"]].map((r) => r.longitudNombre), [60, 80, 80, 80]);
  choca(() => leerDatosCatalogo(R.alcaldias, { nombre: "x".repeat(61), clave: "09018" }, []), 422);
  leerDatosCatalogo(R.alcaldias, { nombre: "x".repeat(60), clave: "09018" }, []);
  choca(() => leerDatosCatalogo(R.razas, { nombre: "x".repeat(81) }, []), 422);
  leerDatosCatalogo(R.razas, { nombre: "x".repeat(80) }, []);
  for (const clave of [undefined, "", "9018", "10018", "0901X", "090181"]) assert.ok(choca(() => leerDatosCatalogo(R.alcaldias, { nombre: "N", clave }, []), 422).campos?.clave, String(clave));
  assert.ok(choca(() => leerDatosCatalogo(R.motivos, { nombre: "N", descripcion: "d" }, CATS), 422).campos?.idCategoria, "falta el campo idCategoria en el 422");
  assert.ok(choca(() => leerDatosCatalogo(R.motivos, { nombre: "N", idCategoria: 9, descripcion: "d" }, CATS), 422).campos?.idCategoria, "idCategoria inexistente: falta el campo en el 422");
  assert.ok(choca(() => leerDatosCatalogo(R["estados-animal"], { nombre: "N", idCategoria: 1 }, CATS), 422).campos?.descripcion, "falta el campo descripcion en el 422");
  assert.ok(choca(() => leerDatosCatalogo(R["estados-animal"], { nombre: "N", idCategoria: 1, descripcion: "d".repeat(256) }, CATS), 422).campos?.descripcion, "descripción de 256: falta el campo en el 422");
  leerDatosCatalogo(R["estados-animal"], { nombre: "N", idCategoria: "2", descripcion: "d".repeat(255) }, CATS);
  assert.ok(choca(() => leerDatosCatalogo(R.razas, { nombre: 5 }, []), 422).campos?.nombre);
  assert.ok(choca(() => leerDatosCatalogo(R.razas, "texto", []), 422).campos?.nombre);
});

test("«Fuera de la CDMX» (17) no lleva clave: se edita sin ella; las demás alcaldías sí la exigen", () => {
  const fuera = fila(17, "Fuera de la Ciudad de México");
  assert.equal(leerDatosCatalogo(R.alcaldias, { nombre: "Fuera de la CDMX" }, [], fuera).clave, undefined);
  choca(() => leerDatosCatalogo(R.alcaldias, { nombre: "Otra" }, [], fila(3, "X", { clave: "09003" })), 422);
});

test("protegidos · alcaldía 17, razas 1 y 14, motivos 14 y 15, estados del animal 1, 5 y 6: nunca se desactivan", () => {
  const casos: [keyof typeof R, number[]][] = [["alcaldias", [17]], ["razas", [1, 14]], ["motivos", [14, 15]], ["estados-animal", [1, 5, 6]]];
  for (const [t, ids] of casos) {
    assert.deepEqual([...R[t].protegidos], ids);
    for (const id of ids) {
      const f = fila(id, "P", { idCategoria: 1 });
      assert.equal(impedimentoParaDesactivar(R[t], [f, fila(99, "Q", { idCategoria: 1, clave: "09099" })], f, CATS)?.codigo, "VALOR_PROTEGIDO", `${t} ${id}`);
    }
    assert.equal(impedimentoParaDesactivar(R[t], [fila(98, "R", { idCategoria: 1 }), fila(99, "Q", { idCategoria: 1 })], fila(98, "R", { idCategoria: 1 }), CATS), undefined, `${t}: un no protegido con otra activa sí`);
  }
});

test("última opción activa · solo en estados del animal por categoría; en alcaldías (EXTENSIÓN) por las oficiales; razas y motivos no la tienen", () => {
  const e = R["estados-animal"];
  const solo = [fila(15, "Placa", { idCategoria: 4 }), fila(16, "Collar", { idCategoria: 4, activo: false }), fila(7, "Libre", { idCategoria: 2 })];
  assert.equal(impedimentoParaDesactivar(e, solo, solo[0], CATS)?.codigo, "ULTIMA_ACTIVA_DE_CATEGORIA");
  assert.equal(impedimentoParaDesactivar(e, solo, solo[2], CATS)?.codigo, "ULTIMA_ACTIVA_DE_CATEGORIA", "otra categoría con una sola activa");
  const dos = [fila(15, "Placa", { idCategoria: 4 }), fila(16, "Collar", { idCategoria: 4 })];
  assert.equal(impedimentoParaDesactivar(e, dos, dos[0], CATS), undefined);
  const alc = [fila(1, "A", { clave: "09001" }), fila(2, "B", { clave: "09002", activo: false }), fila(17, "Fuera")];
  assert.equal(impedimentoParaDesactivar(R.alcaldias, alc, alc[0], []) ?.codigo, "ULTIMA_ALCALDIA_ACTIVA", "la 17 activa no cuenta como oficial");
  assert.equal(impedimentoParaDesactivar(R.razas, [fila(2, "Sola")], fila(2, "Sola"), []), undefined, "razas: sin la regla");
  assert.equal(impedimentoParaDesactivar(R.motivos, [fila(3, "Solo", { idCategoria: 1 })], fila(3, "Solo", { idCategoria: 1 }), CATS), undefined, "motivos: sin la regla");
});

test("edición · bitácora «anterior → nuevo»: nombre, clave, categoría y estatus con valores; la descripción solo dice «modificada»; reactivar = editar", () => {
  const motivos = R.motivos;
  const actual = fila(3, "Viejo", { idCategoria: 1, descripcion: "Texto largo anterior" });
  const p = planearEdicion(motivos, [actual], actual, { nombre: "Nuevo", idCategoria: 2, descripcion: "Otro texto" }, CATS);
  assert.equal(p.detalle, "nombre: «Viejo» → «Nuevo»; categoría: «Uno» → «Dos»; descripción modificada");
  assert.ok(!p.detalle.includes("Texto largo") && !p.detalle.includes("Otro texto"));
  assert.equal(planearEdicion(motivos, [actual], actual, { nombre: "Viejo", idCategoria: 1, descripcion: "Texto largo anterior" }, CATS).sinCambios, true);
  const inactivo = fila(4, "Inactivo", { idCategoria: 1, descripcion: "d", activo: false });
  const reactivar = planearEdicion(motivos, [inactivo], inactivo, { nombre: "Inactivo", idCategoria: 1, descripcion: "d", activo: true }, CATS);
  assert.deepEqual([reactivar.detalle, reactivar.reactiva, reactivar.sinCambios, reactivar.nueva.activo], ["Inactivo → Activo", true, false, true]);
  assert.equal(planearEdicion(R.alcaldias, [fila(5, "X", { clave: "09005", activo: false })], fila(5, "X", { clave: "09005", activo: false }), { nombre: "X", clave: "09005", activo: true }, []).detalle, "Inactiva → Activa");
  const conTodo = planearEdicion(R.alcaldias, [fila(5, "X", { clave: "09005" })], fila(5, "X", { clave: "09005" }), { nombre: "Y", clave: "09006" }, []);
  assert.equal(conTodo.detalle, "nombre: «X» → «Y»; clave: 09005 → 09006");
  // Editar sin tocar el estatus de una fila desactivada la deja desactivada; el detalle jamás pasa de 600 con los máximos.
  const larga = fila(6, "a".repeat(80), { idCategoria: 1, descripcion: "d".repeat(255) });
  assert.ok(planearEdicion(motivos, [larga], larga, { nombre: "b".repeat(80), idCategoria: 2, descripcion: "e".repeat(255) }, [{ id: 1, nombre: "c".repeat(80) }, { id: 2, nombre: "d".repeat(80) }]).detalle.length <= 600, "el detalle no pasa de 600 con los máximos");
});

test("edición · no desactiva (422 activo:false), no mueve la última activa de su categoría (409) y los protegidos se renombran pero no se desactivan", () => {
  const e = R["estados-animal"];
  const a = fila(15, "Placa", { idCategoria: 4, descripcion: "d" });
  const b = fila(16, "Collar", { idCategoria: 4, descripcion: "d", activo: false });
  assert.ok(choca(() => planearEdicion(e, [a, b], a, { nombre: "Placa", idCategoria: 4, descripcion: "d", activo: false }, CATS), 422).campos?.activo, "activo:false en una fila activa: falta el campo activo en el 422");
  choca(() => planearEdicion(e, [a, b], a, { nombre: "Placa", idCategoria: 2, descripcion: "d" }, CATS), 409, "ULTIMA_ACTIVA_DE_CATEGORIA");
  const prot = fila(5, "Fallecido", { idCategoria: 1, descripcion: "d" });
  assert.equal(planearEdicion(e, [prot], prot, { nombre: "Fallecido/a", idCategoria: 1, descripcion: "d" }, CATS).nueva.activo, true);
  choca(() => planearEdicion(R.razas, [fila(1, "Mestizo"), fila(2, "Otra raza")], fila(1, "Mestizo"), { nombre: "otra RAZA" }, []), 409, "NOMBRE_DUPLICADO");
});

test("detalle de desactivación según el género: «Activa → Inactiva» en alcaldías y razas, «Activo → Inactivo» en motivos y estados", () => {
  assert.equal(detalleDeDesactivacion(R.alcaldias), "Activa → Inactiva");
  assert.equal(detalleDeDesactivacion(R.razas), "Activa → Inactiva");
  assert.equal(detalleDeDesactivacion(R.motivos), "Activo → Inactivo");
  assert.equal(detalleDeDesactivacion(R["estados-animal"]), "Activo → Inactivo");
});
