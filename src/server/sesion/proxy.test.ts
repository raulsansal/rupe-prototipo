import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import nextConfig from "../../../next.config";
import { proxy, config } from "../../proxy";
import { secretoAleatorio } from "../pruebas/auxiliares";
import { NOMBRE_COOKIE } from "./cookies";
import { firmar } from "./firma";

const secreto = secretoAleatorio();
const guardado = process.env.RUPE_SESION_SECRETO;
beforeEach(() => { process.env.RUPE_SESION_SECRETO = secreto; });
afterEach(() => { if (guardado === undefined) delete process.env.RUPE_SESION_SECRETO; else process.env.RUPE_SESION_SECRETO = guardado; });
const cookie = (exp: number, clave = secreto) => `${NOMBRE_COOKIE}=${firmar({ sid: "s", idUsuario: 2, rol: "Tutor", exp }, clave)}`;
const pide = (ruta: string, c?: string) => proxy(new NextRequest(`http://localhost:3000${ruta}`, c ? { headers: { cookie: c } } : {}));
const ahora = () => Math.floor(Date.now() / 1000);

test("proxy · sin cookie, /tutor y /admin redirigen a /acceso con siguiente (ruta + query)", () => {
  for (const ruta of ["/tutor", "/tutor/casos/RUPE-K7M4XQ9T?x=1", "/admin", "/admin/usuarios?modal=rol", "/tutor/registrar?paso=2"]) {
    const r = pide(ruta);
    assert.equal(r.status, 307, ruta);
    const l = new URL(r.headers.get("location")!);
    assert.equal(l.pathname, "/acceso");
    assert.equal(l.searchParams.get("siguiente"), ruta);
  }
});

test("proxy · cookie alterada, de otro secreto o expirada también redirige; con firma válida y vigente deja pasar", () => {
  assert.equal(pide("/tutor", cookie(ahora() + 3600, secretoAleatorio())).status, 307);
  assert.equal(pide("/tutor", cookie(ahora() - 10)).status, 307);
  assert.equal(pide("/tutor", `${NOMBRE_COOKIE}=basura.basura`).status, 307);
  const pasa = pide("/admin/usuarios", cookie(ahora() + 3600));
  assert.equal(pasa.status, 200);
  assert.equal(pasa.headers.get("location"), null);
});

test("proxy · falla cerrado si falta el secreto de firma", () => {
  delete process.env.RUPE_SESION_SECRETO;
  assert.equal(pide("/tutor", cookie(ahora() + 3600)).status, 307);
});

test("proxy · solo protege /tutor y /admin (las rutas públicas y /api quedan fuera)", () => {
  assert.deepEqual(config.matcher, ["/tutor/:path*", "/admin/:path*"]);
});

test("no-store · next.config.ts agrega Cache-Control: no-store a todo /api (también a sus errores y 404)", async () => {
  const reglas = await nextConfig.headers!();
  const api = reglas.find((r) => r.source === "/api/:path*")!;
  assert.deepEqual(api.headers, [{ key: "Cache-Control", value: "no-store" }]);
  assert.equal(nextConfig.experimental?.authInterrupts, true); // forbidden() = 403 para rol incorrecto
});
