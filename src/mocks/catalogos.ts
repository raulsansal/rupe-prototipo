// Catálogos del diccionario de datos (tbl_categoria_estado_animal y tbl_estado_animal, valores iniciales).
// El catálogo puede crecer (HU 052): las pantallas se construyen a partir de estas listas, sin textos fijos.

export type CategoriaEstadoAnimal = {
  id: number;
  nombre: string;
  /** Regla de selección (R3): varias combinables o una sola; obligatoria u opcional. */
  seleccion: "multiple" | "unica";
  obligatoria: boolean;
  /** Texto de apoyo bajo el título de la categoría. */
  ayuda: string;
};

export type EstadoAnimal = {
  id: number;
  idCategoria: CategoriaEstadoAnimal["id"];
  /** Nombre del catálogo; el diccionario le agrega «(protegido, excluyente)» a tres valores, aquí va en `excluyente`. */
  nombre: string;
  descripcion: string;
  /** «Solo puede elegirse sola»: no se combina con ninguna otra opción de su categoría. */
  excluyente: boolean;
};

export const CATEGORIAS_ESTADO_ANIMAL: readonly CategoriaEstadoAnimal[] = [
  { id: 1, nombre: "Integridad física y salud", seleccion: "multiple", obligatoria: true, ayuda: "Elige una o varias opciones combinables" },
  { id: 2, nombre: "Contención y ubicación", seleccion: "unica", obligatoria: true, ayuda: "Elige una opción" },
  { id: 3, nombre: "Conducta", seleccion: "unica", obligatoria: false, ayuda: "Elige una opción o déjala vacía" },
  { id: 4, nombre: "Identificación visible", seleccion: "unica", obligatoria: false, ayuda: "Elige una opción o déjala vacía" },
];

export const ESTADOS_ANIMAL: readonly EstadoAnimal[] = [
  { id: 1, idCategoria: 1, nombre: "Ileso / Buen estado", descripcion: "Se ve en buenas condiciones, alerta y sin heridas visibles.", excluyente: true },
  { id: 2, idCategoria: 1, nombre: "Herido / lesionado", descripcion: "Se observan heridas, cortes, mordeduras, cojera o señales de golpe o atropellamiento.", excluyente: false },
  { id: 3, idCategoria: 1, nombre: "Enfermo / débil", descripcion: "Se ve decaído o sin fuerzas, o con síntomas visibles como vómito, secreción en ojos o nariz, o problemas de la piel.", excluyente: false },
  { id: 4, idCategoria: 1, nombre: "Desnutrido / deshidratado", descripcion: "Se ve muy delgado, con las costillas marcadas, o con señales de no haber comido ni bebido agua.", excluyente: false },
  { id: 5, idCategoria: 1, nombre: "Fallecido", descripcion: "El animal fue visto o encontrado sin vida.", excluyente: true },
  { id: 6, idCategoria: 1, nombre: "No se puede determinar", descripcion: "No fue posible observar su estado de salud, por ejemplo por haberlo visto a distancia o de forma muy breve.", excluyente: true },
  { id: 7, idCategoria: 2, nombre: "Libre en vía pública (suelto o en movimiento)", descripcion: "Se vio deambulando sin que nadie lo haya asegurado, ya sea en un punto fijo o desplazándose.", excluyente: false },
  { id: 8, idCategoria: 2, nombre: "Resguardado / En custodia temporal", descripcion: "Un vecino, rescatista o autoridad lo aseguró y lo tiene en un domicilio, local o vehículo.", excluyente: false },
  { id: 9, idCategoria: 2, nombre: "En clínica o veterinaria", descripcion: "Fue llevado a un centro médico veterinario para atención de urgencia o valoración.", excluyente: false },
  { id: 10, idCategoria: 2, nombre: "En albergue / Centro de control", descripcion: "Ingresó a un refugio, protectora o centro de atención canina.", excluyente: false },
  { id: 11, idCategoria: 3, nombre: "Dócil / amigable", descripcion: "Se acerca a las personas con facilidad, responde al llamado y se deja tocar.", excluyente: false },
  { id: 12, idCategoria: 3, nombre: "Asustado / temeroso", descripcion: "Se muestra desconfiado, busca esconderse o huye cuando alguien se acerca.", excluyente: false },
  { id: 13, idCategoria: 3, nombre: "Desorientado / confuso", descripcion: "Camina sin rumbo o no reacciona a lo habitual, como si no entendiera lo que pasa a su alrededor.", excluyente: false },
  { id: 14, idCategoria: 3, nombre: "Agresivo / defensivo", descripcion: "Gruñe, ladra como advertencia o intenta morder, quizá por miedo, dolor o por proteger su espacio. No se recomienda acercarse.", excluyente: false },
  { id: 15, idCategoria: 4, nombre: "Con placa y collar", descripcion: "Lleva collar con una placa que lo identifica o que tiene datos de contacto.", excluyente: false },
  { id: 16, idCategoria: 4, nombre: "Con collar sin datos", descripcion: "Lleva collar o arnés, pero sin placa o con una placa que no se puede leer.", excluyente: false },
  { id: 17, idCategoria: 4, nombre: "Sin accesorios", descripcion: "No lleva collar, arnés ni placa.", excluyente: false },
];

/** Estado que hace «no aplicable» la categoría Conducta (R3). */
export const ID_ESTADO_FALLECIDO = 5;
export const ID_CATEGORIA_CONDUCTA = 3;
