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
- Colores solo con tokens (`bg-background`, `text-text`, `bg-primary`, `border-border`…), nunca hexadecimales fijos.
  Tema por `data-theme` en `<html>`; los tokens viven en `src/app/globals.css`.
- Mobile-first; probar a 390, 768 y 1280 px.
- Accesibilidad: contraste AA, objetivo táctil ≥ 44 px, el estado nunca solo por color (texto + ícono), foco visible.
- Los datos de la persona tutora nunca son públicos: la ficha pública usa solo `FichaPublica` (`src/mocks/tipos.ts`).
- Alcance: solo perros. Sin integración con registros oficiales.
- Nunca escribir valores de claves, tokens o contraseñas; solo sus nombres. No crear `.env` con valores reales.
- No ejecutar comandos de git que modifiquen el repositorio salvo que se pida; proponer commits pequeños.

## Estructura
`src/app/(publico|tutor|admin)` · `src/app/dev/fundaciones` (solo desarrollo) · `src/components/{ui,layout,features}`
`src/mocks` (tipos y datos ficticios) · `src/lib` · `public/brand` (logotipos) · `capturas/` (PNG generados)

## Referencias
- Láminas del sistema de diseño: `docs/diseno/sistema-de-diseno/` (4.1 a 4.13); mockups por rol: `docs/diseno/mockups/`.
- Si algo no es inequívoco en las láminas, no inventarlo: anotarlo como duda.
- Historias de usuario y diccionario de datos: `docs/referencia/` (el diccionario manda sobre los prompts).

## Comandos
`npm run dev` · `npm run build` · `npm run lint` · `npx tsc --noEmit` · `npm run verificar-tokens` · `npm run verificar-logos`
`npm run capturas` → build + start, PNG en `capturas/` (ruta_ancho_tema.png; rutas en `capturas.config.ts`).
