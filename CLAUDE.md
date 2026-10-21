# RUPE · Registro Único de Perros Extraviados (Ciudad de México)

Fase actual: MAQUETADO fiel al diseño aprobado, con datos ficticios (sin BD, API ni autenticación).
Después vendrá el Prototipo: MySQL en Aiven vía API Routes de Next.js (credenciales solo en variables de entorno).
Lee `AGENTS.md` y `node_modules/next/dist/docs/` antes de escribir código Next.js: esta versión difiere de lo habitual.

## Stack
Next.js (App Router, `src/`, alias `@/*`) · React · TypeScript · Tailwind CSS v4 · Montserrat (`next/font`).
Sin ORM ni librerías de UI, de estado global o de formularios: componentes hechos a mano con Tailwind.
Íconos: Material Symbols Rounded relleno vía `<Icono nombre="..." />` (`npm run iconos` regenera `rutas.ts`).

## Convenciones
- Rutas y textos de interfaz en español de México; "persona tutora" (salvo el nombre literal del rol "Tutor").
- Colores solo con tokens (`bg-background`, `text-text`, `bg-primary`…), nunca hexadecimales. Tema por `data-theme`
  en `<html>`; tokens en `src/app/globals.css`. Modo oscuro con variables del `[data-theme]` más cercano: no usar `dark:`.
- Mobile-first (390, 768, 1280 px). Accesibilidad: contraste AA, objetivo táctil ≥ 44 px, estado nunca solo por color, foco visible.
- Componentes en `src/components/ui` (uno por archivo; galería `/dev/componentes`), de dominio en `features`, plantillas en `layout`.
- Plantillas (`/dev/plantillas`): `PlantillaPublica` (layout de `(publico)`), `PlantillaTutor` (`(tutor)/tutor`, URL `/tutor/...`),
  `PlantillaAdmin` (`(admin)/admin`, URL `/admin/...`) y `PlantillaFlujo` (componente compartido por flujos de pasos).
  Cada una con un solo `<main id="contenido">`, «Saltar al contenido» y estado de menús por props.
- Utilidades `display` + `hidden` chocan en Tailwind: para ocultar un elemento con `inline-flex` usar `max-md:hidden`.
- Los datos de la persona tutora nunca son públicos: la ficha pública usa solo `FichaPublica` (`src/mocks/tipos.ts`).
- Alcance: solo perros. Sin integración con registros oficiales.
- Nunca escribir valores de claves, tokens o contraseñas; solo sus nombres. No crear `.env` con valores reales.
- No ejecutar comandos de git que modifiquen el repositorio salvo que se pida; proponer commits pequeños.

## Referencias
- Láminas: `docs/diseno/sistema-de-diseno/` (4.1 a 4.13); mockups por rol: `docs/diseno/mockups/`.
  Si algo no es inequívoco, no inventarlo: anotarlo como duda.
- Historias de usuario y diccionario de datos: `docs/referencia/` (el diccionario manda sobre los prompts).

## Comandos
`npm run dev` · `build` · `lint` · `npx tsc --noEmit` · `verificar-tokens` · `verificar-logos` · `verificar-contraste` ·
`verificar-componentes` · `verificar-plantillas`. `npm run capturas` → PNG en `capturas/` (`--secciones=a,b`, `--rutas=/prefijo`).

## Decisiones resueltas
- B1: texto deshabilitado con tokens `disabled-*` (no los tonos de la lámina 4.6); alertas en oscuro con tokens `*-bg`.
- B2: admin con barra lateral desde 1024 px (cajón `<dialog>` antes); pública con navegación desde 1024 px; pie del flujo sin redes.
