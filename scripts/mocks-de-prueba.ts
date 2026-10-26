// ORÁCULOS DE PRUEBA: lo que las pantallas de la persona tutora mostraban cuando leían los mocks (antes de P2b). Solo lo usan los scripts de verificación, para comparar
// contra lo que sirve el almacén; NADA de src/ debe importar este archivo.
import { CASOS_ORIGEN, type CasoOrigen } from "../src/mocks/casos";
import { AVISTAMIENTOS, type AvistamientoRecibido } from "../src/mocks/avistamientos";

/** «Mis registros» de la persona tutora 1 (dueña de los casos de CASOS_ORIGEN): por fecha de creación descendente (HU 015). */
export const casosDeLaPersonaTutora = (): CasoOrigen[] => [...CASOS_ORIGEN].sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro));

/** Avistamientos visibles de un caso, por fecha descendente (HU 039). */
export const avistamientosDelCaso = (folio: string): AvistamientoRecibido[] => AVISTAMIENTOS.filter((a) => a.folio === folio).sort((a, b) => b.fechaHora.localeCompare(a.fechaHora));

/** Orden cronológico (más antiguo primero): numera los marcadores del mapa (HU 047 y 048). */
export const avistamientosCronologicos = (folio: string): AvistamientoRecibido[] => [...avistamientosDelCaso(folio)].reverse();
