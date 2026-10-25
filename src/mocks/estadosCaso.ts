// HU 053: los 6 estados del caso los define el sistema; el orden solo determina cómo se presentan (no define transiciones).
import { ESTADOS_CASO } from "./tipos";

export const ESTADOS_CASO_CATALOGO = ESTADOS_CASO.map((nombre, i) => ({ orden: i + 1, nombre }));
