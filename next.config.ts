import type { NextConfig } from "next";

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
  // Nada de lo que devuelve la API se guarda en cachés (también los errores y los 404 de rutas /api inexistentes).
  async headers() {
    return [{ source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] }];
  },
};

export default nextConfig;
