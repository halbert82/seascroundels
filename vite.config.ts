/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// En GitHub Pages la web vive en /seascroundels/ (nombre del repositorio).
// La versión compilada (y su vista previa) usa esa ruta; el servidor de desarrollo, la raíz.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/seascroundels/' : '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      // La app y los dos libros del reglamento (cada uno, su página).
      input: {
        app: fileURLToPath(new URL('index.html', import.meta.url)),
        aprende: fileURLToPath(new URL('reglamento/aprende-a-jugar.html', import.meta.url)),
        referencia: fileURLToPath(new URL('reglamento/referencia-de-reglas.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
