export const CLAVE_TEMA = "rupe-tema";

export type Tema = "light" | "dark";

/** Script que corre antes de pintar: evita el parpadeo al cargar. Debe permanecer mínimo. */
export const SCRIPT_TEMA_INICIAL = `(function(){var t;try{t=localStorage.getItem("${CLAVE_TEMA}")}catch(e){}if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)})()`;
