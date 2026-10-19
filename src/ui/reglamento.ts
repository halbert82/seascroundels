// Dónde están los dos libros del reglamento y sus PDF (se publican junto a la web).

const BASE = `${import.meta.env.BASE_URL}reglamento/`

export const LIBROS = [
  { nombre: 'Aprende a jugar', web: `${BASE}aprende-a-jugar.html`, pdf: `${BASE}aprende-a-jugar.pdf` },
  { nombre: 'Referencia de reglas', web: `${BASE}referencia-de-reglas.html`, pdf: `${BASE}referencia-de-reglas.pdf` },
] as const
