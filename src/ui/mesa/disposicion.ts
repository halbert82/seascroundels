// Medidas de la mesa (en unidades del lienzo: 900 de alto y entre 1440 y 1920 de ancho).

export const MARGEN = 14
export const HUECO = 12
/** Columna izquierda: la tripulación, en huecos fijos con sitio para la carta girada. */
export const IZQ = 520
/** Columna derecha: lo último que ha pasado, el Barco y los mazos. */
export const DER = 256
export const ARRIBA = 66
export const ALTO_ZONAS = 548

export function anchoCentro(anchoLienzo: number): number {
  return anchoLienzo - 2 * MARGEN - IZQ - DER - 2 * HUECO
}

/** Escala de carta (sobre 378×528) para que `n` cartas de ese ancho quepan en `disponible` con `hueco` entre ellas. */
export function escalaPara(disponible: number, n: number, anchoCarta: number, hueco: number, minima: number, maxima: number): number {
  if (n <= 0) return maxima
  return Math.max(minima, Math.min(maxima, (disponible - (n - 1) * hueco) / n / anchoCarta))
}

/** Posición de un elemento en unidades del lienzo (para menús, ampliaciones y explicaciones). */
export function enLienzo(elemento: HTMLElement): { x: number; y: number; ancho: number; alto: number; anchoLienzo: number } {
  const lienzo = elemento.closest<HTMLElement>('.lienzo')
  const caja = elemento.getBoundingClientRect()
  if (!lienzo) return { x: caja.left, y: caja.top, ancho: caja.width, alto: caja.height, anchoLienzo: window.innerWidth }
  const base = lienzo.getBoundingClientRect()
  const escala = base.width / lienzo.offsetWidth
  return {
    x: (caja.left - base.left) / escala,
    y: (caja.top - base.top) / escala,
    ancho: caja.width / escala,
    alto: caja.height / escala,
    anchoLienzo: lienzo.offsetWidth,
  }
}
