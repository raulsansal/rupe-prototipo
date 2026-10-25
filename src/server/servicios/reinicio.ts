// Quién puede reiniciar los datos ficticios (ruta POST /api/dev/reiniciar):
//  · producción sin RUPE_PERMITIR_REINICIO=1 → 404 (la ruta «no existe»);
//  · producción con RUPE_PERMITIR_REINICIO=1 → solo con sesión de Administrador (401 sin sesión, 403 con otro rol);
//  · fuera de producción (desarrollo, pruebas) → permitido.
import { noEncontrado } from "../errores";
import { exigirRol, type SesionActual } from "../sesion/guardas";

export const VARIABLE_PERMITIR_REINICIO = "RUPE_PERMITIR_REINICIO";
export const reinicioRequiereSesion = (entorno: string | undefined, permitir: string | undefined) => entorno === "production" && permitir === "1";

export function autorizarReinicio({ entorno, permitir, sesion }: { entorno: string | undefined; permitir: string | undefined; sesion: SesionActual | undefined }): void {
  if (entorno !== "production") return;
  if (permitir !== "1") throw noEncontrado();
  exigirRol(sesion, "Administrador");
}
