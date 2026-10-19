// Medidas de la mesa (en unidades del lienzo: 900 de alto o algo más, y entre 1440 y 1920 de ancho).

import { ALTO } from './Lienzo.tsx'

export const MARGEN = 14
export const HUECO = 12
/** Columna izquierda: la tripulación, en huecos fijos con sitio para la carta girada. */
export const IZQ = 520
/** Columna derecha: lo último que ha pasado, el Barco y los mazos. */
export const DER = 256
export const ARRIBA = 66
/** Alto de las zonas de arriba con la mesa a 900 de alto (si la mesa crece, crecen con lo que no se lleva la mano). */
export const ALTO_ZONAS = 548

export function anchoCentro(anchoLienzo: number): number {
  return anchoLienzo - 2 * MARGEN - IZQ - DER - 2 * HUECO
}

// ---------------------------------------------------------------------------
// La mano

/** Tamaño de las cartas de la mano (sobre 378×528). */
export const ESCALA_MANO = 0.4
const ANCHO_CARTA_MANO = 378 * ESCALA_MANO
const ALTO_CARTA_MANO = 528 * ESCALA_MANO
/** Con la mesa a 900 de alto, las cartas de la mano asoman: les faltan 40 por abajo (suben al pasar por encima). */
export const MANO_ESCONDIDA = 40
/** Margen al pie, bajo la carta más baja, cuando la mano se ve entera. */
export const MARGEN_PIE_MANO = 10
/** La mano se ve entera hasta con estas cartas (5 es el Mando del Capitán; 8, una mano muy llena). */
export const CARTAS_MANO_ENTERA = 8

/** La mano en abanico: cuánto se aparta cada carta del centro, cuánto gira (grados) y cuánto baja. */
export function abanico(n: number): { x: number; giro: number; caida: number }[] {
  const separacion = n <= 6 ? 128 : Math.max(70, 760 / n)
  return Array.from({ length: n }, (_, i) => {
    const desvio = i - (n - 1) / 2
    return { x: desvio * separacion, giro: desvio * 2.2, caida: Math.abs(desvio) * 5 }
  })
}

/**
 * Cuánto más abajo que la carta del centro llega la esquina más baja de las cartas de los extremos: bajan (`caida`) y,
 * al girar sobre un punto por debajo de la carta (a 1,2 veces su alto), una esquina de abajo baja algo más.
 */
export function bajadaDelAbanico(n: number): number {
  let bajada = 0
  for (const { giro, caida } of abanico(n)) {
    const g = (Math.abs(giro) * Math.PI) / 180
    bajada = Math.max(bajada, caida + (ANCHO_CARTA_MANO / 2) * Math.sin(g) + 0.2 * ALTO_CARTA_MANO * (1 - Math.cos(g)))
  }
  return bajada
}

/** Lo que necesita la mano, además de su sitio con la mesa a 900 de alto, para verse entera con su margen al pie. */
export const ALTO_PARA_MANO_ENTERA = Math.ceil(MANO_ESCONDIDA + bajadaDelAbanico(CARTAS_MANO_ENTERA) + MARGEN_PIE_MANO)

/**
 * A qué altura sobre el borde de abajo de la mesa queda el pie de la carta del centro de la mano (negativo: asoma).
 * Con la mesa a 900 de alto, a −40, como siempre. Con altura de más para la mano (`extraMano`), sube lo justo para que
 * la carta más baja del abanico quede a su margen del pie: con menos cartas, el abanico baja menos y la mano, pegada al
 * pie, queda más baja.
 */
export function pieDeLaMano(n: number, extraMano: number): number {
  return Math.min(extraMano - MANO_ESCONDIDA, MARGEN_PIE_MANO + bajadaDelAbanico(n))
}

/**
 * Si la mesa crece de alto (en una tableta), la altura de más se reparte así: primero la mano, hasta que sus cartas se
 * ven enteras (`ALTO_PARA_MANO_ENTERA`); lo que sobre después, las zonas de arriba (tripulación, misión o puerto y la
 * columna derecha). El panel de decisión va siempre justo debajo de las zonas.
 */
export function repartirAltoDeMas(altoLienzo: number): { mano: number; zonas: number } {
  const extra = Math.max(0, altoLienzo - ALTO)
  const mano = Math.min(extra, ALTO_PARA_MANO_ENTERA)
  return { mano, zonas: extra - mano }
}

// ---------------------------------------------------------------------------
// La tripulación

export interface MedidasTripulacion {
  /** Escala de las cartas (sobre 378×528). */
  escala: number
  anchoHueco: number
  altoHueco: number
  /** Cuánto se encoge una carta al agotarse para caber girada en su hueco (1: nada). */
  encogeAgotada: number
}

/**
 * Tamaño de las cartas de la tripulación: tres huecos por fila, en dos filas como mínimo (tres si son más de seis).
 * Con la mesa a 900 de alto (escritorio), cada hueco es cuadrado, con sitio para la carta girada: la carta mide lo que
 * cabe girada. Si las zonas de arriba crecen (en una tableta), la carta derecha crece hasta llenar el ancho de su hueco
 * (o el alto de su fila), para que sus números y su texto se lean sin tocarla; al agotarse, gira y se encoge hasta caber
 * en el hueco.
 */
export function medidasTripulacion(total: number, extraZonas: number): MedidasTripulacion {
  const porFila = 3
  const filas = Math.max(2, Math.ceil(total / porFila))
  const ancho = Math.floor((IZQ - 30 - (porFila - 1) * 12) / porFila)
  // Lo que deja cada fila para la carta: sin el rótulo, el margen y las Mejoras que van debajo de cada carta.
  const altoFila = (ALTO_ZONAS + extraZonas - 22 - 30 - (filas - 1) * 10) / filas - 28
  if (extraZonas <= 0) {
    const lado = Math.min(ancho, altoFila)
    return { escala: lado / 528, anchoHueco: lado, altoHueco: lado, encogeAgotada: 1 }
  }
  const escala = Math.min(ancho / 378, altoFila / 528)
  return { escala, anchoHueco: ancho, altoHueco: 528 * escala, encogeAgotada: Math.min(1, ancho / (528 * escala)) }
}

/** Escala de carta (sobre 378×528) para que `n` cartas de ese ancho quepan en `disponible` con `hueco` entre ellas. */
export function escalaPara(disponible: number, n: number, anchoCarta: number, hueco: number, minima: number, maxima: number): number {
  if (n <= 0) return maxima
  return Math.max(minima, Math.min(maxima, (disponible - (n - 1) * hueco) / n / anchoCarta))
}

/** Posición de un elemento en unidades del lienzo (para menús, ampliaciones y explicaciones). */
export function enLienzo(elemento: HTMLElement): { x: number; y: number; ancho: number; alto: number; anchoLienzo: number; altoLienzo: number } {
  const lienzo = elemento.closest<HTMLElement>('.lienzo')
  const caja = elemento.getBoundingClientRect()
  if (!lienzo) return { x: caja.left, y: caja.top, ancho: caja.width, alto: caja.height, anchoLienzo: window.innerWidth, altoLienzo: window.innerHeight }
  const base = lienzo.getBoundingClientRect()
  const escala = base.width / lienzo.offsetWidth
  return {
    x: (caja.left - base.left) / escala,
    y: (caja.top - base.top) / escala,
    ancho: caja.width / escala,
    alto: caja.height / escala,
    anchoLienzo: lienzo.offsetWidth,
    altoLienzo: lienzo.offsetHeight,
  }
}
