// Azar con semilla (sfc32). Su estado vive dentro de la partida: la misma semilla da la misma partida.

import type { Estado } from './tipos.ts'

function hashTexto(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Estado inicial del generador a partir de una semilla (número o texto). */
export function sembrar(semilla: number | string): [number, number, number, number] {
  let h = typeof semilla === 'number' ? semilla >>> 0 : hashTexto(semilla)
  const splitmix = () => {
    h = (h + 0x9e3779b9) >>> 0
    let z = h
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0
    return (z ^ (z >>> 16)) >>> 0
  }
  const estado = { azar: [splitmix(), splitmix(), splitmix(), splitmix()] as [number, number, number, number] }
  for (let i = 0; i < 12; i++) siguiente(estado)
  return estado.azar
}

function siguiente(s: Pick<Estado, 'azar'>): number {
  let [a, b, c, d] = s.azar
  const t = (((a + b) | 0) + d) | 0
  d = (d + 1) | 0
  a = b ^ (b >>> 9)
  b = (c + (c << 3)) | 0
  c = (c << 21) | (c >>> 11)
  c = (c + t) | 0
  s.azar = [a >>> 0, b >>> 0, c >>> 0, d >>> 0]
  return (t >>> 0) / 4294967296
}

/** Número en [0, 1). */
export function aleatorio(s: Pick<Estado, 'azar'>): number {
  return siguiente(s)
}

/** Entero en [0, n). */
export function entero(s: Pick<Estado, 'azar'>, n: number): number {
  return Math.floor(siguiente(s) * n)
}

/** Baraja una lista en su sitio (Fisher-Yates). */
export function barajarLista<T>(s: Pick<Estado, 'azar'>, lista: T[]): void {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = entero(s, i + 1)
    const x = lista[i] as T
    lista[i] = lista[j] as T
    lista[j] = x
  }
}
