// Dónde se pueden partir las palabras del reglamento, con las reglas del español (patrones de TeX, paquete «hyphen»).
//
// Antes lo decidía el navegador («hyphens: auto»), y cada uno lo hace a su manera: el Chromium del Mac partía unas 30
// palabras más que el de la máquina de GitHub que publica los PDF, y las páginas publicadas no caían donde las que se
// revisaban. Ahora el libro marca él mismo dónde se puede partir cada palabra (con un guion blando, U+00AD) y el
// navegador solo parte por ahí («hyphens: manual»): en cualquier máquina, las mismas líneas y las mismas páginas.

import es from 'hyphen/es'

export const GUION_BLANDO = '­'

/** Letras que quedan, como mínimo, antes y después del guion (como el navegador: 2 y 2). */
const ANTES = 2
const DESPUES = 2

/** Lo que no se parte: las cartas dibujadas, las negritas (términos de juego), los títulos y las líneas de índice. */
// Fase 15: los nombres de las fichas de Componentes son títulos («Cartas de recompensa» no se parte con guion).
const SIN_PARTIR = '.miniatura, .card, strong, b, h1, h2, h3, h4, .indice-linea, .componente-nombre, svg, style, script'

/** Una palabra con sus guiones blandos («Re­ve­las»). Las siglas (NAV, COM) y las palabras cortas, tal cual. */
export function silabearPalabra(palabra: string): string {
  if (palabra.length < ANTES + DESPUES + 1 || palabra === palabra.toUpperCase()) return palabra
  const trozos = es.hyphenateSync(palabra, { hyphenChar: GUION_BLANDO }).split(GUION_BLANDO)
  // Junta los trozos de los extremos que dejarían menos letras de las debidas.
  while (trozos.length > 1 && (trozos[0] ?? '').length < ANTES) trozos.splice(0, 2, `${trozos[0]}${trozos[1]}`)
  while (trozos.length > 1 && (trozos.at(-1) ?? '').length < DESPUES) trozos.splice(-2, 2, `${trozos.at(-2)}${trozos.at(-1)}`)
  return trozos.join(GUION_BLANDO)
}

export function silabearTexto(texto: string): string {
  return texto.replace(/\p{L}{5,}/gu, silabearPalabra)
}

/** Pone los guiones blandos en todo el texto corrido del libro ya dibujado (antes de repartirlo en páginas). */
export function silabear(raiz: HTMLElement): void {
  const textos = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest(SIN_PARTIR) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  for (let n = textos.nextNode(); n; n = textos.nextNode()) {
    const antes = n.textContent ?? ''
    if (antes.includes(GUION_BLANDO)) continue
    const despues = silabearTexto(antes)
    if (despues !== antes) n.textContent = despues
  }
}
