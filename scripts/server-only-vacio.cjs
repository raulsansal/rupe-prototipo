// Precarga de las pruebas del servidor (npm run probar): «server-only» lo resuelve Next al compilar y no existe como paquete; fuera de Next se reemplaza
// por un módulo vacío para poder probar los módulos que lo importan. No se usa en la aplicación.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require("node:module");
const original = Module._resolveFilename;
Module._resolveFilename = function (peticion, ...resto) {
  return peticion === "server-only" ? __filename : original.call(this, peticion, ...resto);
};
