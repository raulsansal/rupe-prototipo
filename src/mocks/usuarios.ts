// Usuarios ficticios para ADM-03 (tbl_usuario). El Administrador ve nombre, correo, rol, estatus y fecha de última modificación;
// el teléfono es reservado y no se muestra. Los correos usan el dominio de ejemplo.
export type Rol = "Administrador" | "Tutor";
export type Usuario = { id: number; nombreCompleto: string; correo: string; rol: Rol; activo: boolean; fechaUltimaModificacion: string };

export const USUARIOS_INICIALES: readonly Usuario[] = [
  { id: 1, nombreCompleto: "Ricardo Vega Ficticio", correo: "ricardo.vega@example.org", rol: "Administrador", activo: true, fechaUltimaModificacion: "2026-10-12T16:40:00Z" },
  { id: 2, nombreCompleto: "Rosa Hernández Ficticia", correo: "rosa.ficticia@example.org", rol: "Tutor", activo: true, fechaUltimaModificacion: "2026-10-18T22:10:00Z" },
  { id: 3, nombreCompleto: "Mateo Ruiz Ejemplo", correo: "mateo.ruiz@example.org", rol: "Tutor", activo: false, fechaUltimaModificacion: "2026-09-30T18:05:00Z" },
  { id: 4, nombreCompleto: "Carmen Ortiz Ejemplo", correo: "carmen.ortiz@example.org", rol: "Administrador", activo: false, fechaUltimaModificacion: "2026-08-21T15:30:00Z" },
  { id: 5, nombreCompleto: "Luis Navarro Ficticio", correo: "luis.navarro@example.org", rol: "Tutor", activo: true, fechaUltimaModificacion: "2026-10-14T19:40:00Z" },
  { id: 6, nombreCompleto: "Ana Beltrán Ejemplo", correo: "ana.beltran@example.org", rol: "Tutor", activo: true, fechaUltimaModificacion: "2026-10-09T14:00:00Z" },
  { id: 7, nombreCompleto: "Diego Salas Ficticio", correo: "diego.salas@example.org", rol: "Tutor", activo: true, fechaUltimaModificacion: "2026-10-06T15:05:00Z" },
  { id: 8, nombreCompleto: "Elena Cruz Ejemplo", correo: "elena.cruz@example.org", rol: "Tutor", activo: false, fechaUltimaModificacion: "2026-09-12T17:00:00Z" },
  { id: 9, nombreCompleto: "Fernando Lara Ficticio", correo: "fernando.lara@example.org", rol: "Tutor", activo: true, fechaUltimaModificacion: "2026-10-04T13:30:00Z" },
  { id: 10, nombreCompleto: "Gabriela Mena Ejemplo", correo: "gabriela.mena@example.org", rol: "Tutor", activo: true, fechaUltimaModificacion: "2026-09-25T18:45:00Z" },
  { id: 11, nombreCompleto: "Héctor Pineda Ficticio", correo: "hector.pineda@example.org", rol: "Tutor", activo: true, fechaUltimaModificacion: "2026-10-12T16:20:00Z" },
  { id: 12, nombreCompleto: "Irene Solís Ejemplo", correo: "irene.solis@example.org", rol: "Tutor", activo: true, fechaUltimaModificacion: "2026-10-01T10:15:00Z" },
];

/** HU 008 y 009: el último administrador activo no puede deshabilitarse ni cambiar de rol. */
export function esUltimoAdministradorActivo(usuarios: readonly Usuario[], id: number): boolean {
  const u = usuarios.find((x) => x.id === id);
  return !!u && u.rol === "Administrador" && u.activo && usuarios.filter((x) => x.rol === "Administrador" && x.activo).length === 1;
}
