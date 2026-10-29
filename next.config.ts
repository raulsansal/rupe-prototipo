import type { NextConfig } from "next";

// Canal QR de la ficha pública: la URL impresa en el QR es /ficha/<token> (32 caracteres base62). Un rewrite de beforeFiles la lleva a rutas INTERNAS con su propio not-found
// («Este código QR ya no está vigente o no es válido», con 404 real). Los folios (RUPE-XXXXXXXX, con guion) siguen por /ficha/[clave]; cualquier otra clave se trata como un código QR. Esas páginas llevan Referrer-Policy: no-referrer y noindex.
const TOKEN_QR = "(?![Rr][Uu][Pp][Ee]-)[^/]+"; // todo lo que NO empieza por «RUPE-» es del canal QR: un token (32 base62), uno inexistente, regenerado o mal formado, todos con la misma respuesta
const SIN_REFERENCIA = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // forbidden() (HTTP 403 con app/forbidden.tsx) es experimental en esta versión de Next: se usa para «acceso denegado» (rol incorrecto).
  experimental: { authInterrupts: true },
  async rewrites() {
    return {
      beforeFiles: [
        { source: `/ficha/:token(${TOKEN_QR})`, destination: "/ficha-qr/:token" },
        { source: `/ficha/:token(${TOKEN_QR})/avistamiento`, destination: "/ficha-qr/:token/avistamiento" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  // Nada de lo que devuelve la API se guarda en cachés (también los errores y los 404 de rutas /api inexistentes).
  async headers() {
    return [
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: `/ficha/:token(${TOKEN_QR})`, headers: SIN_REFERENCIA },
      { source: `/ficha/:token(${TOKEN_QR})/avistamiento`, headers: SIN_REFERENCIA },
      { source: "/ficha-qr/:path*", headers: SIN_REFERENCIA },
    ];
  },
};

export default nextConfig;
