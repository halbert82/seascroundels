// Dónde se corta cada página. Paged.js 0.4.3 solo respeta «no partir este bloque» (break-inside: avoid) cuando el
// bloque entero empieza ya fuera de la página, y «no dejar solo este título» (break-after: avoid) cuando lo que sigue
// al título empieza fuera. Este ajuste se mete en su corte (onOverflow) y lo corrige:
//   - un recuadro, un diagrama o un ejemplo que empieza en la página pero no cabe pasa entero a la siguiente;
//   - un título que se queda al pie con una o dos líneas debajo (o con nada, porque lo que sigue no cabe) pasa a la
//     página siguiente con lo que le sigue.
// En los dos casos, solo si en la página queda algo antes (si no, no hay arreglo: se corta donde se pueda).

import { Handler } from 'pagedjs'

/** Títulos de sección: no pueden quedarse al pie de una página sin lo que les sigue. */
const TITULOS = '.subtitulo, .entrada-titulo, .componentes-grupo, .letra, .cabecera-capitulo, .inicio-capitulo, h2, h3, h4'

/** Bajo un título al pie de página tienen que quedar más de dos líneas (en px CSS: dos líneas y media de texto). */
const BAJO_TITULO = 15 * (96 / 25.4)

const esElemento = (n: Node | null): n is HTMLElement => n?.nodeType === Node.ELEMENT_NODE

function tieneContenido(n: Node): boolean {
  if (n.nodeType === Node.TEXT_NODE) return (n.textContent ?? '').trim() !== ''
  return esElemento(n) && n.getBoundingClientRect().height > 0
}

/** ¿Hay algo en la página antes de este nodo? */
function hayAntes(nodo: Node, raiz: Node): boolean {
  for (let x: Node | null = nodo; x && x !== raiz; x = x.parentNode) {
    for (let s = x.previousSibling; s; s = s.previousSibling) if (tieneContenido(s)) return true
  }
  return false
}

/** Un elemento y los que lo contienen mientras sea lo primero de ellos (el corte va delante de todos). */
function delanteDe(el: Element, raiz: Node): Element {
  let x = el
  while (x.parentElement && x.parentElement !== raiz && ![...x.parentElement.childNodes].slice(0, [...x.parentElement.childNodes].indexOf(x)).some(tieneContenido)) {
    x = x.parentElement
  }
  return x
}

/** Las cajas de un nodo (de un texto, sus líneas; de un bloque partido, un trozo por columna). */
function cajas(n: Node): DOMRect[] {
  if (esElemento(n)) return [...n.getClientRects()]
  const r = document.createRange()
  r.selectNodeContents(n)
  return [...r.getClientRects()]
}

/**
 * Paged.js deja lo que no cabe en una columna a la derecha de la página: solo cuenta lo que está en la página.
 * Devuelve dónde acaba (el borde inferior más bajo) lo que hay de esas cajas en la página, o null si no hay nada.
 */
function finEnPagina(lista: DOMRect[], limites: DOMRect): number | null {
  const dentro = lista.filter((r) => (r.width > 0 || r.height > 0) && r.left < limites.right - 1)
  return dentro.length ? Math.max(...dentro.map((r) => r.bottom)) : null
}

function inicioEnPagina(lista: DOMRect[], limites: DOMRect): number | null {
  const dentro = lista.filter((r) => (r.width > 0 || r.height > 0) && r.left < limites.right - 1 && r.top < limites.bottom)
  return dentro.length ? Math.min(...dentro.map((r) => r.top)) : null
}

/** Dónde acaba en la página lo que va antes de un nodo. */
function finDeLoAnterior(nodo: Node, repartido: Node, limites: DOMRect): number {
  for (let x: Node | null = nodo; x && x !== repartido; x = x.parentNode) {
    for (let s = x.previousSibling; s; s = s.previousSibling) {
      const fin = tieneContenido(s) ? finEnPagina(cajas(s), limites) : null
      if (fin !== null) return fin
    }
  }
  return limites.top
}

/** Altura (px) a la que empieza un nodo en la página; si ya no está en ella, donde acaba lo anterior. */
function alturaDe(nodo: Node, repartido: Node, limites: DOMRect): number {
  return inicioEnPagina(cajas(nodo), limites) ?? finDeLoAnterior(nodo, repartido, limites)
}

/** El nodo donde empieza el corte y la altura (px) a la que corta. */
function puntoDeCorte(rango: Range, repartido: Node, limites: DOMRect): { nodo: Node; y: number } | null {
  const { startContainer: c, startOffset: o } = rango
  if (c.nodeType === Node.TEXT_NODE) {
    // Un corte dentro de un texto: donde acaban, en la página, sus líneas anteriores.
    const antes = document.createRange()
    antes.setStart(c, 0)
    antes.setEnd(c, o)
    const fin = finEnPagina([...antes.getClientRects()], limites)
    return { nodo: c, y: fin ?? finDeLoAnterior(c, repartido, limites) }
  }
  const nodo = c.childNodes[o]
  return nodo ? { nodo, y: alturaDe(nodo, repartido, limites) } : null
}

/** Rango desde delante de `el` hasta el final de lo repartido en la página (lo que pasa a la siguiente). */
function cortarDelante(el: Element, repartido: Element): Range {
  const r = document.createRange()
  r.selectNode(el)
  if (repartido.lastChild) r.setEndAfter(repartido.lastChild)
  return r
}

/** El bloque que no se puede partir más grande que contiene el corte (si cabe en una página). */
function bloqueEntero(nodo: Node, repartido: Element, altoPagina: number): Element | null {
  let entero: Element | null = null
  for (let x: Node | null = nodo; x && x !== repartido; x = x.parentNode) {
    if (!esElemento(x)) continue
    const evita = getComputedStyle(x).breakInside === 'avoid' || x.dataset.breakInside === 'avoid'
    // Su alto entero, aunque Paged.js lo tenga repartido en dos columnas.
    const alto = cajas(x).reduce((n, r) => n + r.height, 0)
    if (evita && alto < altoPagina * 0.92) entero = x
  }
  return entero
}

/** El título (o la serie de títulos seguidos) que queda justo encima del corte, a menos de BAJO_TITULO. */
function tituloHuerfano(nodo: Node, y: number, repartido: Element, limites: DOMRect): Element | null {
  let titulo: Element | null = null
  buscar: for (let x: Node | null = nodo; x && x !== repartido; x = x.parentNode) {
    for (let s = x.previousSibling; s; s = s.previousSibling) {
      if (!esElemento(s) || !tieneContenido(s)) continue
      const fin = finEnPagina(cajas(s), limites)
      if (fin === null) continue
      if (y - fin > BAJO_TITULO) break buscar
      if (s.matches(TITULOS)) {
        titulo = s
        break buscar
      }
    }
  }
  if (!titulo) return null
  // Títulos seguidos («D» y, debajo, «Daño»): se van todos juntos.
  for (;;) {
    const arriba = delanteDe(titulo, repartido)
    let previo: Node | null = arriba.previousSibling
    while (previo && !tieneContenido(previo)) previo = previo.previousSibling
    if (esElemento(previo) && previo.matches(TITULOS)) titulo = previo
    else return arriba
  }
}

export class CortesDePagina extends Handler {
  onOverflow(desborde: Range | undefined, repartido: HTMLElement, limites: DOMRect): Range | undefined {
    if (!desborde) return undefined
    const punto = puntoDeCorte(desborde, repartido, limites)
    if (!punto) return undefined
    let { nodo, y } = punto
    let rango: Range | undefined
    // 1. Un bloque que no se parte, entero a la página siguiente.
    const entero = bloqueEntero(nodo, repartido, limites.height)
    if (entero) {
      const delante = delanteDe(entero, repartido)
      if (hayAntes(delante, repartido)) {
        rango = cortarDelante(delante, repartido)
        nodo = delante
        y = alturaDe(delante, repartido, limites)
      }
    }
    // 2. Un título no se queda al pie sin lo que le sigue.
    const titulo = tituloHuerfano(nodo, y, repartido, limites)
    if (titulo && hayAntes(titulo, repartido)) rango = cortarDelante(titulo, repartido)
    return rango
  }
}
