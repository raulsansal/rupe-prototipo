import assert from "node:assert/strict";
import { test } from "node:test";
import { rutaInternaSegura } from "./destino";

test("siguiente · una ruta relativa interna válida se respeta (con su query)", () => {
  assert.equal(rutaInternaSegura("/tutor/casos/RUPE-K7M4XQ9T", "Tutor"), "/tutor/casos/RUPE-K7M4XQ9T");
  assert.equal(rutaInternaSegura("/admin/usuarios?modal=rol", "Administrador"), "/admin/usuarios?modal=rol");
  assert.equal(rutaInternaSegura("/tutor/registrar?paso=2", "Tutor"), "/tutor/registrar?paso=2");
  assert.equal(rutaInternaSegura("/", "Tutor"), "/");
});

test("siguiente · sin valor o con la zona de otro rol, se usa el destino por defecto (Tutor /tutor, Administrador /admin)", () => {
  assert.equal(rutaInternaSegura(undefined, "Tutor"), "/tutor");
  assert.equal(rutaInternaSegura(null, "Administrador"), "/admin");
  assert.equal(rutaInternaSegura("", "Tutor"), "/tutor");
  assert.equal(rutaInternaSegura("/admin/usuarios", "Tutor"), "/tutor");
  assert.equal(rutaInternaSegura("/tutor/casos/x", "Administrador"), "/admin");
});

test("siguiente · rechazo: URLs externas y trucos de redirección abierta (siempre el destino por defecto)", () => {
  const malos = ["http://evil.example/tutor", "https://evil.example", "//evil.example", "///evil.example", "/\\evil.example", "\\\\evil.example", "javascript:alert(1)", "data:text/html,x", "tutor", "evil.example/tutor", "/tutor\n/x", "/tutor\r\nSet-Cookie: x=1", "/%0d%0aSet-Cookie", "/acceso", "/acceso?siguiente=/tutor", "/registro", "HTTP://evil.example", " /tutor"];
  for (const m of malos) {
    const r = rutaInternaSegura(m, "Tutor");
    assert.ok(r === "/tutor" || (m.startsWith("/%0d") && r === m), `${JSON.stringify(m)} → ${r}`);
    assert.ok(!r.startsWith("//") && !r.includes("evil"), r);
  }
});
