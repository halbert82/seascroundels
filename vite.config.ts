/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En GitHub Pages la web vive en /seascroundels/ (nombre del repositorio).
// La versión compilada (y su vista previa) usa esa ruta; el servidor de desarrollo, la raíz.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/seascroundels/' : '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
