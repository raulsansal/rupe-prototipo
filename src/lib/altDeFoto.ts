// Texto alternativo de la fotografía de un perro, armado con los datos del caso (nunca genérico). Conserva el prefijo «Fotografía de {nombre}» y suma lo que haya:
// «Fotografía de Max, perro macho, Mestizo/No identificada, tamaño mediano, color café con blanco».
export type DatosParaAlt = { nombre: string; sexo?: string; raza?: string; tamano?: string; color?: string };

export function altDeFoto({ nombre, sexo, raza, tamano, color }: DatosParaAlt): string {
  const sexoTexto = sexo === "Macho" ? "perro macho" : sexo === "Hembra" ? "perro hembra" : "perro";
  const partes = [`Fotografía de ${nombre}`, sexoTexto];
  if (raza) partes.push(raza);
  if (tamano) partes.push(`tamaño ${tamano}`);
  if (color) partes.push(`color ${color.charAt(0).toLowerCase()}${color.slice(1)}`);
  return partes.join(", ");
}
