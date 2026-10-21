/** Sesiones ficticias para las plantillas: no hay autenticación en esta fase. */

/** Versión ficticia del aviso de privacidad (en los mockups aparece como «[vN]»). */
export const VERSION_AVISO_PRIVACIDAD = "v1";

export type SesionTutor = { nombre: string; /** Avistamientos nuevos; 0 oculta la insignia. */ avisosNuevos: number };
export type SesionAdmin = { nombre: string; rol: "Administrador" };

export const SESION_TUTOR_EJEMPLO: SesionTutor = { nombre: "Rosa Hernández", avisosNuevos: 3 };
export const SESION_ADMIN_EJEMPLO: SesionAdmin = { nombre: "Ricardo Vega", rol: "Administrador" };
