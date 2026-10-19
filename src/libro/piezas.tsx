// Piezas comunes de la maqueta: cartas en pequeño, dorsos, ornamentos náuticos e iconos.

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import arteJson from '../../data/arte.json'
import { porId } from '../engine/catalogo.ts'
import { CartaEscalada, dimensiones } from '../ui/cartas/Carta.tsx'
import type { ParteCarta } from './cartasNombradas.ts'

/** Píxeles CSS por milímetro (96 ppp). */
export const MM = 96 / 25.4

/** Nombre de la ilustración de una carta («canones»), si la tiene: las viñetas no la repiten en su doble página. */
export function arteDeCarta(id: string): string | undefined {
  const archivo = (arteJson as Record<string, { archivo: string } | undefined>)[id]?.archivo
  return archivo?.split('/').pop()?.replace(/\.[a-z]+$/, '')
}

/** Una carta dibujada por la app, de `ancho` milímetros (de su lado corto si es apaisada, salvo `anchoReal`). */
export function Miniatura({ id, ancho, anchoReal = false, girada = 0, className = '', style }: { id: string; ancho: number; anchoReal?: boolean; girada?: number; className?: string; style?: CSSProperties }) {
  const entrada = porId(id)
  const d = dimensiones(entrada)
  const lado = anchoReal ? d.ancho : Math.min(d.ancho, d.alto)
  const escala = (ancho * MM) / lado
  return (
    <div className={`miniatura ${d.ancho > d.alto ? 'apaisada' : ''} ${className}`} style={{ ...(girada ? { transform: `rotate(${girada}deg)` } : {}), ...style }} data-carta={id} data-arte-carta={arteDeCarta(id)}>
      <CartaEscalada entrada={entrada} escala={escala} />
    </div>
  )
}

/** Ancho de una carta de Peligro sin escalar (px). */
const ANCHO_PELIGRO = 378
/** Lo que se ve de la carta alrededor de la parte recortada, arriba y abajo (px sin escalar). */
export const MARGEN_RECORTE = 3

/** Dónde está una parte en la carta dibujada. */
export function selectorParte(parte: ParteCarta): string {
  if (parte === 'destino') return '.dest'
  if (parte === 'encuentro') return '.encp'
  return `.encp[data-entorno="${parte}"]`
}

/**
 * Las partes de una carta de Peligro que cita un ejemplo (un encuentro, el Destino o los dos), recortadas de la carta
 * dibujada por la app y con el nombre de la carta encima. `ancho` (mm) es el de la carta entera: a ese ancho se lee.
 */
export function FragmentoPeligro({ id, partes, ancho: anchoFijo }: { id: string; partes: readonly ParteCarta[]; ancho?: number }) {
  const entrada = porId(id)
  // Sin ancho fijo, el que haga legible su letra (se lee en la carta ya dibujada).
  const [letra, setLetra] = useState<number | null>(null)
  const ancho = anchoFijo ?? anchoLegible(letra ?? 10)
  const escala = (ancho * MM) / ANCHO_PELIGRO
  const ref = useRef<HTMLElement>(null)
  // Cada recorte enseña su parte de la carta: se mide en la carta ya dibujada (que ajusta su letra al dibujarse).
  useLayoutEffect(() => {
    const carta = ref.current?.querySelector('.card')
    if (anchoFijo === undefined && letra === null && carta) setLetra(letraDeCarta(carta))
    for (const recorte of ref.current?.querySelectorAll<HTMLElement>('.recorte') ?? []) {
      const carta = recorte.querySelector<HTMLElement>('.card')
      const parte = carta?.querySelector<HTMLElement>(selectorParte(recorte.dataset.parte as ParteCarta))
      const lienzo = recorte.firstElementChild as HTMLElement | null
      if (!carta || !parte || !lienzo) continue
      const c = carta.getBoundingClientRect()
      const r = parte.getBoundingClientRect()
      const real = c.width / ANCHO_PELIGRO
      const arriba = Math.max(0, (r.top - c.top) / real - MARGEN_RECORTE)
      const abajo = (r.bottom - c.top) / real + MARGEN_RECORTE
      recorte.style.height = `${(abajo - arriba) * escala}px`
      lienzo.style.top = `${-arriba * escala}px`
    }
  })
  const nombre = 'nombre' in entrada.carta ? entrada.carta.nombre : ''
  return (
    <figure className="fragmento" ref={ref} style={{ width: `${ancho}mm` }} data-carta={id}>
      <figcaption className="fragmento-nombre">{nombre}</figcaption>
      {partes.map((p) => (
        <div key={p} className="recorte" data-parte={p}>
          <div className="recorte-lienzo">
            <CartaEscalada entrada={entrada} escala={escala} />
          </div>
        </div>
      ))}
    </figure>
  )
}

/**
 * Deja en cada recorte la carta solo hasta la parte que enseña. Lo que el recorte oculta por debajo sigue ocupando sitio
 * para Paged.js (que mide cada elemento, se vea o no) y le haría creer que el ejemplo no cabe en la página. Lo de encima
 * no molesta. Se hace en el libro ya dibujado, antes de repartirlo en páginas (React ya no lo toca): cada parte guarda el
 * alto que tenía, así que lo que se ve no cambia.
 */
export function cortarRecortes(raiz: ParentNode): void {
  for (const recorte of raiz.querySelectorAll<HTMLElement>('.recorte')) {
    const carta = recorte.querySelector<HTMLElement>('.card')
    const parte = carta?.querySelector<HTMLElement>(selectorParte(recorte.dataset.parte as ParteCarta))
    const escalada = carta?.parentElement?.parentElement
    if (!carta || !parte || !escalada) continue
    const hijos = [...carta.children] as HTMLElement[]
    for (const h of hijos) {
      if (getComputedStyle(h).position === 'absolute') continue
      h.style.height = `${h.offsetHeight}px`
      h.style.maxHeight = 'none'
      h.style.flex = 'none'
    }
    const fila = hijos.find((h) => h === parte || h.contains(parte))
    if (!fila) continue
    for (const h of hijos.slice(hijos.indexOf(fila) + 1)) h.remove()
    const alto = fila.offsetTop + fila.offsetHeight + MARGEN_RECORTE
    const escala = escalada.offsetWidth / ANCHO_PELIGRO
    carta.style.height = `${alto}px`
    escalada.style.height = `${alto * escala}px`
  }
}

/** Letra de una carta de Peligro ya dibujada (px sin escalar): con ella se decide a qué ancho se lee. */
export function letraDeCarta(carta: Element): number {
  return parseFloat((carta as HTMLElement).style.getPropertyValue('--fs2')) || 10
}

/**
 * De las cartas de Peligro (tres encuentros y un Destino) solo se enseña la parte que cita un ejemplo, recortada y a un
 * ancho en que su letra se lea: al menos 60 mm y lo que haga falta para que la letra de la carta mida 8 px (unos 6 pt).
 * Para que un ejemplo quepa en una fila, puede bajar hasta 7,2 px (unos 5,4 pt).
 */
export const RECORTE_MINIMO = 60
export const LETRA_LEGIBLE = 8
export const LETRA_MINIMA = 7.2

/** Ancho (mm) al que una carta de Peligro con esa letra (px sin escalar) la enseña a `objetivo` px. */
export function anchoLegible(letra: number, maximo = 116, objetivo = LETRA_LEGIBLE): number {
  const mm = (ANCHO_PELIGRO * objetivo) / letra / MM
  return Math.min(maximo, Math.max(RECORTE_MINIMO, Math.floor(mm * 2) / 2))
}

export type TipoDorso = 'peligros' | 'capitan' | 'muelle' | 'escenario' | 'misiones' | 'historia'

const DORSOS: Record<TipoDorso, { nombre: string; color: string; icono: string }> = {
  peligros: { nombre: 'Peligros', color: '#6E1F17', icono: 'rep' },
  capitan: { nombre: 'Capitán', color: '#1E3550', icono: 'man' },
  muelle: { nombre: 'Muelle', color: '#24452F', icono: 'espacio' },
  escenario: { nombre: 'Escenario', color: '#7A5418', icono: 'acampar' },
  misiones: { nombre: 'Misiones', color: '#3a2a1e', icono: 'avance' },
  historia: { nombre: 'Historia', color: '#4a3a5a', icono: 'doblon' },
}

/** Dorso de un mazo, de `ancho` milímetros, con `grosor` cartas debajo (un mazo, no una carta). */
export function Dorso({ tipo, ancho, grosor = 3, apaisado = false }: { tipo: TipoDorso; ancho: number; grosor?: number; apaisado?: boolean }) {
  const d = DORSOS[tipo]
  const w = apaisado ? ancho * (528 / 378) : ancho
  const h = apaisado ? ancho : ancho * (528 / 378)
  return (
    <div className="dorso-libro" style={{ width: `${w}mm`, height: `${h}mm`, '--dorso': d.color, '--grosor': grosor } as CSSProperties}>
      <div className="dorso-libro-marco">
        <span className={`ic i-${d.icono} dorso-libro-icono`} />
        <span className="dorso-libro-nombre">{d.nombre}</span>
      </div>
    </div>
  )
}

/** Icono del juego (máscara SVG) en línea con el texto. */
export function Icono({ id, className = '', style }: { id: string; className?: string; style?: CSSProperties }) {
  return <i className={`ic i-${id} ${className}`} style={style} />
}

/** Rosa de los vientos pequeña (ornamento de los títulos y de las cabeceras). */
export function Rosa({ tam = 14, className = '' }: { tam?: number; className?: string }) {
  return (
    <svg className={`rosa ${className}`} width={tam} height={tam} viewBox="-10 -10 20 20" aria-hidden="true">
      <path d="M0-10L2-2 10 0 2 2 0 10-2 2-10 0-2-2Z" fill="currentColor" />
      <path d="M0-6L1.2-1.2 6 0 1.2 1.2 0 6-1.2 1.2-6 0-1.2-1.2Z" transform="rotate(45)" fill="currentColor" opacity=".55" />
      <circle r="1.3" fill="var(--papel, #faf5e9)" />
    </svg>
  )
}

/** Filete con una rosa de los vientos en medio. */
export function Filete({ className = '' }: { className?: string }) {
  return (
    <div className={`filete ${className}`} aria-hidden="true">
      <span className="filete-linea" />
      <Rosa tam={13} />
      <span className="filete-linea" />
    </div>
  )
}

/** Marcador numerado (o con letra) de los gráficos: el círculo rojo de las láminas. */
export function Marcador({ children, style, className = '' }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <span className={`marcador ${className}`} style={style}>
      {children}
    </span>
  )
}
