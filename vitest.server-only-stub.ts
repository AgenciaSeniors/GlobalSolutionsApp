// Stub vacío para `server-only` en el entorno de pruebas (Vitest).
//
// El paquete real `server-only` lanza un error si se importa fuera de un
// React Server Component. En los tests no hay esa frontera, así que lo
// reemplazamos por un módulo vacío vía alias en `vitest.config.ts`.
export {};
