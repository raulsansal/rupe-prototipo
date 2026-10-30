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

// ---- Razas, motivos y momento del día (diccionario: tbl_raza, tbl_categoria_motivo, tbl_motivo) ----

export type Raza = { id: number; nombre: string };
/** «Otra» exige especificar la raza (R8). Los nombres «(protegida)» del diccionario se muestran sin ese sufijo. */
export const RAZAS: readonly Raza[] = [
  { id: 1, nombre: "Mestizo/No identificada" },
  { id: 2, nombre: "Chihuahua (Chihuahueño)" },
  { id: 3, nombre: "Schnauzer Miniatura" },
  { id: 4, nombre: "Labrador Retriever" },
  { id: 5, nombre: "Pitbull (American Pit Bull Terrier)" },
  { id: 6, nombre: "Pug (Carlino)" },
  { id: 7, nombre: "Golden Retriever" },
  { id: 8, nombre: "Pastor Alemán" },
  { id: 9, nombre: "Poodle (Caniche)" },
  { id: 10, nombre: "Husky Siberiano (Siberian Husky)" },
  { id: 11, nombre: "Bulldog Francés" },
  { id: 12, nombre: "Xoloitzcuintle (Xolo)" },
  { id: 13, nombre: "Calupoh" },
  { id: 14, nombre: "Otra" },
];
export const ID_RAZA_OTRA = 14;

export const CATEGORIAS_MOTIVO = [
  { id: 1, nombre: "Detonantes Emocionales y Ambientales" },
  { id: 2, nombre: "Impulsos Biológicos y Conductuales" },
  { id: 3, nombre: "Fallas en Infraestructura y Contención" },
  { id: 4, nombre: "Situaciones de Terceros o Fuerza Mayor" },
  { id: 5, nombre: "Sin determinar u otros" },
] as const;

export type Motivo = { id: number; idCategoria: number; nombre: string; descripcion: string };
export const MOTIVOS: readonly Motivo[] = [
  { id: 1, idCategoria: 1, nombre: "Pánico por ruidos fuertes", descripcion: "Pirotecnia, truenos, explosiones o maquinaria pesada que provocan una respuesta de huida incontrolada." },
  { id: 2, idCategoria: 1, nombre: "Estrés o ansiedad por separación", descripcion: "Intentos de salir de la propiedad al quedarse solo por períodos prolongados." },
  { id: 3, idCategoria: 1, nombre: "Cambios drásticos en el entorno", descripcion: "Mudanzas, obras en la vivienda o estancias en lugares desconocidos (pensiones, casas de familiares) que desorientan al animal." },
  { id: 4, idCategoria: 2, nombre: "Celo y conducta reproductiva", descripcion: "Instinto de búsqueda de pareja en machos y hembras no esterilizados." },
  { id: 5, idCategoria: 2, nombre: "Instinto de caza o rastreo", descripcion: "Persecución compulsiva de otros animales (gatos, aves, roedores) o seguimiento de rastros olfativos." },
  { id: 6, idCategoria: 2, nombre: "Curiosidad o aburrimiento", descripcion: "Falta de estimulación física o mental que motiva al perro a explorar fuera de sus límites habituales." },
  { id: 7, idCategoria: 3, nombre: "Portones o puertas abiertas", descripcion: "Descuidos al entrar o salir de la vivienda con vehículos o paquetes." },
  { id: 8, idCategoria: 3, nombre: "Deficiencias en cercas o bardas", descripcion: "Rejas con separación excesiva, huecos por los que el animal pueda cavar por debajo o muros bajos que logra saltar." },
  { id: 9, idCategoria: 3, nombre: "Equipo de sujeción defectuoso", descripcion: "Rotura o deslizamiento de collares, arneses ajustados de forma inadecuada o pecheras de las que el perro logra zafarse durante el paseo." },
  { id: 10, idCategoria: 4, nombre: "Accidentes o imprevistos durante el paseo", descripcion: "Caída de la correa por distracción, ataques de otros perros o asaltos." },
  { id: 11, idCategoria: 4, nombre: "Sismos o desastres naturales", descripcion: "Evacuaciones de emergencia donde las vías de contención quedan expuestas o el animal huye desorientado." },
  { id: 12, idCategoria: 4, nombre: "Sustracción o robo", descripcion: "Pérdida del perro a consecuencia de un presunto robo o sustracción de la propiedad. RUPE no sustituye la denuncia ante la autoridad competente." },
  { id: 13, idCategoria: 4, nombre: "Escape durante traslado o servicio de terceros", descripcion: "Huida al abrirse la puerta de un vehículo o durante una visita al veterinario, a la estética o a una guardería, o al cuidado de un paseador o cuidador." },
  { id: 14, idCategoria: 5, nombre: "Circunstancia desconocida o no presenciada", descripcion: "No se sabe cómo salió el perro; su ausencia se notó al regresar al lugar donde estaba." },
  { id: 15, idCategoria: 5, nombre: "Otro motivo", descripcion: "Circunstancia que no corresponde a las opciones anteriores, que puede detallarse en la descripción de las circunstancias." },
];

/** Clave geoestadística de cada alcaldía oficial (diccionario: tbl_alcaldia; «Fuera de la Ciudad de México» no lleva). Solo la usa el seed. */
export const CLAVES_GEOESTADISTICAS: Readonly<Record<string, string>> = {
  "Álvaro Obregón": "09010", Azcapotzalco: "09002", "Benito Juárez": "09014", Coyoacán: "09003", "Cuajimalpa de Morelos": "09004", Cuauhtémoc: "09015",
  "Gustavo A. Madero": "09005", Iztacalco: "09006", Iztapalapa: "09007", "La Magdalena Contreras": "09008", "Miguel Hidalgo": "09016", "Milpa Alta": "09009",
  Tláhuac: "09011", Tlalpan: "09012", "Venustiano Carranza": "09017", Xochimilco: "09013",
};

/** Momento del día (CHECK del diccionario) con los rangos de horas que define. */
export const MOMENTOS_DEL_DIA = [
  { valor: "madrugada", etiqueta: "Madrugada", rango: "0:00 a 5:59" },
  { valor: "mañana", etiqueta: "Mañana", rango: "6:00 a 11:59" },
  { valor: "tarde", etiqueta: "Tarde", rango: "12:00 a 18:59" },
  { valor: "noche", etiqueta: "Noche", rango: "19:00 a 23:59" },
  { valor: "desconocido", etiqueta: "Desconocido", rango: "no lo sé" },
] as const;
