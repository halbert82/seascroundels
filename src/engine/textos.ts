// Lectura de números de los textos de las cartas, para que el motor siga a cartas.json.

import { porId } from './catalogo.ts'

/** Texto de juego de una carta (vacío si no tiene). */
export function textoDe(id: string): string {
  const c = porId(id).carta
  return 'texto' in c && typeof c.texto === 'string' ? c.texto : ''
}

/** Primer número entero que aparece en el texto: «Revela 2 cartas…» → 2. */
export function primerNumero(texto: string): number {
  const m = /(\d+)/.exec(texto)
  if (!m?.[1]) throw new Error(`No hay ningún número en: ${texto}`)
  return Number(m[1])
}

/** Número con icono en el marcado: «{+1 COM}» con icono «COM» → 1; «{−1 avance g}» → −1. */
export function numeroConIcono(texto: string, icono: string): number {
  const m = new RegExp(`\\{([+−-]?\\d+) ${icono}\\b`).exec(texto)
  if (!m?.[1]) throw new Error(`No hay ningún {N ${icono}} en: ${texto}`)
  return Number(m[1].replace('−', '-'))
}

/** Números entre llaves del marcado, en orden: «Gasta {1 municion}: … recibe {+2}» → [1, 2]. */
export function numerosEntreLlaves(texto: string): number[] {
  return [...texto.matchAll(/\{([+−-]?\d+)/g)].map((m) => Number((m[1] ?? '0').replace('−', '-')))
}

/** El número que sigue a unas palabras: «coste 2 o menos» con «coste» → 2. */
export function numeroTras(texto: string, palabras: string): number {
  const m = new RegExp(`${palabras} (\\d+)`).exec(texto)
  if (!m?.[1]) throw new Error(`No hay ningún número tras «${palabras}» en: ${texto}`)
  return Number(m[1])
}
