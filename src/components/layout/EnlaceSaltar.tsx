/** «Saltar al contenido»: invisible hasta recibir el foco con el teclado. Apunta al <main id="contenido">. */
export function EnlaceSaltar() {
  return (
    <a
      href="#contenido"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:inline-flex focus:h-tactil focus:items-center focus:rounded-boton focus:bg-primary focus:px-4 focus:text-small focus:font-semibold focus:text-on-primary"
    >
      Saltar al contenido
    </a>
  );
}
