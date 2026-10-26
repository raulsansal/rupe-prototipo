import { NextResponse, type NextRequest } from "next/server";
import { NOMBRE_COOKIE } from "./server/sesion/cookies";
import { leerSecreto, verificar } from "./server/sesion/firma";

/**
 * Primera barrera de /tutor y /admin en CADA petición (también las de navegación del cliente): sin cookie de sesión con firma válida y vigente, se manda
 * a /acceso?siguiente=<ruta>. Aquí solo se puede verificar la firma (el almacén de sesiones no es visible desde el proxy); la sesión registrada, la cuenta
 * activa y el rol los comprueban los layouts (403 con otro rol) y, sobre todo, cada servicio que lee o escribe datos. Si falta el secreto, falla cerrado.
 */
export function proxy(peticion: NextRequest) {
  let valida = false;
  try {
    valida = verificar(peticion.cookies.get(NOMBRE_COOKIE)?.value, leerSecreto()) !== undefined;
  } catch {
    valida = false;
  }
  if (valida) return NextResponse.next();
  const destino = new URL("/acceso", peticion.url);
  destino.searchParams.set("siguiente", peticion.nextUrl.pathname + peticion.nextUrl.search);
  return NextResponse.redirect(destino);
}

export const config = { matcher: ["/tutor/:path*", "/admin/:path*"] };
